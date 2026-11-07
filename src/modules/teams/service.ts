// [Phase: MVP v1] Teams Domain Service (Section 7)
import crypto from 'node:crypto';
import type { Prisma, TeamRole, TeamStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { PLATFORM_CONFIG } from '@/lib/config';
import { hashPassword, sha256Hex, verifyPassword } from '@/server/crypto';
import {
  assertPermission,
  canCreateTeam,
  canEditTeamCoreSettings,
  canManageTeamRosterAndInvites,
  type PermissionActor,
} from '@/server/permissions';
import { recordAuditLog } from '@/modules/audit/service';
import {
  calculateRosterCounts,
  canAddMemberWithRole,
  canRemoveMember,
  createTeamSchema,
  resolveAutoJoinRole,
} from './rules';

export async function getUserActiveTeamRole(
  userId: string,
  teamId: string,
): Promise<TeamRole | null> {
  const membership = await db.teamMembership.findFirst({
    where: { userId, teamId, isActive: true },
  });
  return membership?.role ?? null;
}

export async function createTeam(
  actor: PermissionActor,
  rawInput: unknown,
  logoUrl?: string | null,
) {
  assertPermission(canCreateTeam(actor), 'CANNOT_CREATE_TEAM');
  const parsed = createTeamSchema.parse(rawInput);

  // Check if user already in an active team
  const existingActiveMembership = await db.teamMembership.findFirst({
    where: { userId: actor.id, isActive: true },
  });
  if (existingActiveMembership) {
    throw new Error('USER_ALREADY_IN_ACTIVE_TEAM');
  }

  const [nameConflict, tagConflict] = await Promise.all([
    db.team.findUnique({ where: { name: parsed.name } }),
    db.team.findUnique({ where: { tag: parsed.tag } }),
  ]);

  if (nameConflict) throw new Error('TEAM_NAME_ALREADY_TAKEN');
  if (tagConflict) throw new Error('TEAM_TAG_ALREADY_TAKEN');

  const passwordHash =
    parsed.joinPassword && parsed.joinPassword.trim().length >= 4
      ? hashPassword(parsed.joinPassword.trim())
      : null;

  const team = await db.$transaction(async (tx) => {
    const created = await tx.team.create({
      data: {
        name: parsed.name,
        tag: parsed.tag,
        logoUrl: logoUrl ?? null,
        description: parsed.description || null,
        country: parsed.country.toUpperCase(),
        region: parsed.region,
        status: 'recruiting',
        passwordHash,
        socialLinks: {
          discord: parsed.discordUrl || null,
          telegram: parsed.telegramUrl || null,
        } as Prisma.InputJsonValue,
      },
    });

    await tx.teamMembership.create({
      data: {
        teamId: created.id,
        userId: actor.id,
        role: 'captain',
        isActive: true,
      },
    });

    await tx.teamHistory.create({
      data: {
        teamId: created.id,
        userId: actor.id,
        actorId: actor.id,
        action: 'team.created',
        payload: { name: created.name, tag: created.tag },
      },
    });

    return created;
  });

  await recordAuditLog({
    actorId: actor.id,
    action: 'team.created',
    entityType: 'Team',
    entityId: team.id,
    payload: { name: team.name, tag: team.tag },
  });

  return team;
}

export async function createTeamInvite(actor: PermissionActor, teamId: string) {
  const teamRole = await getUserActiveTeamRole(actor.id, teamId);
  assertPermission(
    canManageTeamRosterAndInvites(actor, { teamRole }),
    'CANNOT_CREATE_INVITE',
  );

  const rawToken = crypto
    .randomBytes(PLATFORM_CONFIG.invites.tokenBytes)
    .toString('hex');
  const tokenHash = sha256Hex(rawToken);
  const codeHint = rawToken.slice(-6).toUpperCase();
  const expiresAt = new Date(
    Date.now() + PLATFORM_CONFIG.invites.defaultExpiryDays * 24 * 60 * 60 * 1000,
  );

  const invite = await db.teamInvite.create({
    data: {
      teamId,
      token: tokenHash,
      codeHint,
      createdBy: actor.id,
      expiresAt,
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    action: 'team.invite.created',
    entityType: 'Team',
    entityId: teamId,
    payload: { inviteId: invite.id, codeHint },
  });

  return { inviteId: invite.id, rawToken, codeHint, expiresAt };
}

export async function revokeTeamInvite(
  actor: PermissionActor,
  inviteId: string,
) {
  const invite = await db.teamInvite.findUnique({ where: { id: inviteId } });
  if (!invite) throw new Error('INVITE_NOT_FOUND');

  const teamRole = await getUserActiveTeamRole(actor.id, invite.teamId);
  assertPermission(
    canManageTeamRosterAndInvites(actor, { teamRole }),
    'CANNOT_REVOKE_INVITE',
  );

  await db.teamInvite.update({
    where: { id: inviteId },
    data: { revokedAt: new Date() },
  });

  await recordAuditLog({
    actorId: actor.id,
    action: 'team.invite.revoked',
    entityType: 'Team',
    entityId: invite.teamId,
    payload: { inviteId },
  });
}

async function addMemberInternal(
  tx: Prisma.TransactionClient,
  teamId: string,
  userId: string,
  actorId: string,
  method: 'password' | 'invite_token' | 'join_request',
) {
  const existingActive = await tx.teamMembership.findFirst({
    where: { userId, isActive: true },
  });
  if (existingActive) {
    throw new Error('USER_ALREADY_IN_ACTIVE_TEAM');
  }

  const activeRoster = await tx.teamMembership.findMany({
    where: { teamId, isActive: true },
    select: { role: true },
  });

  const targetRole = resolveAutoJoinRole(activeRoster);
  if (!targetRole) {
    throw new Error('TEAM_ROSTER_FULL');
  }

  const check = canAddMemberWithRole(activeRoster, targetRole);
  if (!check.allowed) {
    throw new Error(check.reason ?? 'CANNOT_JOIN_TEAM');
  }

  const membership = await tx.teamMembership.create({
    data: {
      teamId,
      userId,
      role: targetRole,
      isActive: true,
    },
  });

  // Update team status to active once 5 main players are reached
  const updatedCounts = calculateRosterCounts([...activeRoster, { role: targetRole }]);
  if (updatedCounts.mainCount >= PLATFORM_CONFIG.roster.maxMainPlayers) {
    await tx.team.update({
      where: { id: teamId },
      data: { status: 'active' },
    });
  }

  await tx.teamHistory.create({
    data: {
      teamId,
      userId,
      actorId,
      action: `member.joined.${method}`,
      payload: { role: targetRole },
    },
  });

  return membership;
}

export async function joinTeamByPassword(
  actor: PermissionActor,
  teamId: string,
  password: string,
) {
  assertPermission(canCreateTeam(actor), 'BLOCKED_OR_GUEST');

  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team || !team.passwordHash) {
    throw new Error('TEAM_PASSWORD_JOIN_DISABLED');
  }

  if (!verifyPassword(password, team.passwordHash)) {
    throw new Error('INVALID_TEAM_PASSWORD');
  }

  const membership = await db.$transaction(async (tx) =>
    addMemberInternal(tx, team.id, actor.id, actor.id, 'password'),
  );

  await recordAuditLog({
    actorId: actor.id,
    action: 'team.member.joined_password',
    entityType: 'Team',
    entityId: team.id,
    payload: { userId: actor.id, role: membership.role },
  });

  return membership;
}

export async function joinTeamByInviteToken(
  actor: PermissionActor,
  rawToken: string,
) {
  assertPermission(canCreateTeam(actor), 'BLOCKED_OR_GUEST');
  const trimmed = rawToken.trim();
  if (trimmed.length < 32) {
    throw new Error('INVALID_INVITE_TOKEN_LENGTH');
  }

  const tokenHash = sha256Hex(trimmed);
  const now = new Date();

  const invite = await db.teamInvite.findUnique({
    where: { token: tokenHash },
  });

  if (
    !invite ||
    invite.revokedAt !== null ||
    invite.usedAt !== null ||
    invite.expiresAt <= now
  ) {
    throw new Error('INVITE_EXPIRED_OR_INVALID');
  }

  const membership = await db.$transaction(async (tx) => {
    await tx.teamInvite.update({
      where: { id: invite.id },
      data: {
        usedAt: now,
        usedBy: actor.id,
      },
    });

    return addMemberInternal(
      tx,
      invite.teamId,
      actor.id,
      actor.id,
      'invite_token',
    );
  });

  await recordAuditLog({
    actorId: actor.id,
    action: 'team.member.joined_invite',
    entityType: 'Team',
    entityId: invite.teamId,
    payload: { inviteId: invite.id, userId: actor.id },
  });

  return { teamId: invite.teamId, membership };
}

export async function submitJoinRequest(
  actor: PermissionActor,
  teamId: string,
  message?: string,
) {
  assertPermission(canCreateTeam(actor), 'BLOCKED_OR_GUEST');

  const existingActive = await db.teamMembership.findFirst({
    where: { userId: actor.id, isActive: true },
  });
  if (existingActive) {
    throw new Error('USER_ALREADY_IN_ACTIVE_TEAM');
  }

  const existingPending = await db.joinRequest.findFirst({
    where: { teamId, userId: actor.id, status: 'pending' },
  });
  if (existingPending) {
    throw new Error('JOIN_REQUEST_ALREADY_PENDING');
  }

  const request = await db.joinRequest.create({
    data: {
      teamId,
      userId: actor.id,
      message: message ? message.slice(0, 300) : null,
      status: 'pending',
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    action: 'team.join_request.submitted',
    entityType: 'Team',
    entityId: teamId,
    payload: { requestId: request.id },
  });

  return request;
}

export async function decideJoinRequest(
  actor: PermissionActor,
  requestId: string,
  decision: 'accepted' | 'rejected',
) {
  const joinReq = await db.joinRequest.findUnique({ where: { id: requestId } });
  if (!joinReq || joinReq.status !== 'pending') {
    throw new Error('JOIN_REQUEST_NOT_FOUND');
  }

  const teamRole = await getUserActiveTeamRole(actor.id, joinReq.teamId);
  assertPermission(
    canManageTeamRosterAndInvites(actor, { teamRole }),
    'CANNOT_DECIDE_JOIN_REQUEST',
  );

  await db.$transaction(async (tx) => {
    await tx.joinRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        decidedAt: new Date(),
        decidedBy: actor.id,
      },
    });

    if (decision === 'accepted') {
      await addMemberInternal(
        tx,
        joinReq.teamId,
        joinReq.userId,
        actor.id,
        'join_request',
      );
    }
  });

  await recordAuditLog({
    actorId: actor.id,
    action: `team.join_request.${decision}`,
    entityType: 'Team',
    entityId: joinReq.teamId,
    payload: { requestId, targetUserId: joinReq.userId },
  });
}

export async function changeMemberRole(
  actor: PermissionActor,
  teamId: string,
  targetUserId: string,
  newRole: 'co_captain' | 'player' | 'substitute',
) {
  const actorTeamRole = await getUserActiveTeamRole(actor.id, teamId);
  assertPermission(
    canEditTeamCoreSettings(actor, { teamRole: actorTeamRole }),
    'ONLY_CAPTAIN_OR_ADMIN_CAN_ASSIGN_ROLES',
  );

  const targetMembership = await db.teamMembership.findFirst({
    where: { teamId, userId: targetUserId, isActive: true },
  });
  if (!targetMembership) throw new Error('MEMBER_NOT_FOUND');
  if (targetMembership.role === 'captain') {
    throw new Error('USE_TRANSFER_CAPTAINCY_FOR_CAPTAIN');
  }

  const otherActive = await db.teamMembership.findMany({
    where: { teamId, isActive: true, NOT: { id: targetMembership.id } },
    select: { role: true },
  });

  const slotCheck = canAddMemberWithRole(otherActive, newRole);
  if (!slotCheck.allowed) {
    throw new Error(slotCheck.reason ?? 'ROLE_SLOT_LIMIT_EXCEEDED');
  }

  await db.$transaction([
    db.teamMembership.update({
      where: { id: targetMembership.id },
      data: { role: newRole },
    }),
    db.teamHistory.create({
      data: {
        teamId,
        userId: targetUserId,
        actorId: actor.id,
        action: 'member.role_changed',
        payload: { from: targetMembership.role, to: newRole },
      },
    }),
  ]);

  await recordAuditLog({
    actorId: actor.id,
    action: 'team.member.role_changed',
    entityType: 'Team',
    entityId: teamId,
    payload: { targetUserId, from: targetMembership.role, to: newRole },
  });
}

export async function transferCaptaincy(
  actor: PermissionActor,
  teamId: string,
  newCaptainUserId: string,
) {
  const actorTeamRole = await getUserActiveTeamRole(actor.id, teamId);
  assertPermission(
    canEditTeamCoreSettings(actor, { teamRole: actorTeamRole }),
    'ONLY_CAPTAIN_CAN_TRANSFER_CAPTAINCY',
  );

  const [currentCaptain, targetMember] = await Promise.all([
    db.teamMembership.findFirst({
      where: { teamId, role: 'captain', isActive: true },
    }),
    db.teamMembership.findFirst({
      where: { teamId, userId: newCaptainUserId, isActive: true },
    }),
  ]);

  if (!currentCaptain || !targetMember) {
    throw new Error('CAPTAIN_OR_TARGET_NOT_FOUND');
  }
  if (currentCaptain.userId === newCaptainUserId) {
    return;
  }

  await db.$transaction([
    db.teamMembership.update({
      where: { id: currentCaptain.id },
      data: { role: 'player' },
    }),
    db.teamMembership.update({
      where: { id: targetMember.id },
      data: { role: 'captain' },
    }),
    db.teamHistory.create({
      data: {
        teamId,
        userId: newCaptainUserId,
        actorId: actor.id,
        action: 'captaincy.transferred',
        payload: {
          previousCaptainId: currentCaptain.userId,
          newCaptainId: newCaptainUserId,
        },
      },
    }),
  ]);

  await recordAuditLog({
    actorId: actor.id,
    action: 'team.captaincy.transferred',
    entityType: 'Team',
    entityId: teamId,
    payload: {
      previousCaptainId: currentCaptain.userId,
      newCaptainId: newCaptainUserId,
    },
  });
}

export async function removeOrLeaveTeamMember(
  actor: PermissionActor,
  teamId: string,
  targetUserId: string,
) {
  const [actorMembership, targetMembership] = await Promise.all([
    db.teamMembership.findFirst({
      where: { teamId, userId: actor.id, isActive: true },
    }),
    db.teamMembership.findFirst({
      where: { teamId, userId: targetUserId, isActive: true },
    }),
  ]);

  if (!targetMembership) {
    throw new Error('MEMBER_NOT_FOUND');
  }

  const isSelf = actor.id === targetUserId;
  const effectiveActorRole =
    actor.role === 'admin' ? 'admin' : (actorMembership?.role ?? 'player');

  const check = canRemoveMember(effectiveActorRole, targetMembership.role, isSelf);
  if (!check.allowed) {
    throw new Error(check.reason ?? 'CANNOT_REMOVE_MEMBER');
  }

  await db.$transaction([
    db.teamMembership.update({
      where: { id: targetMembership.id },
      data: {
        isActive: false,
        leftAt: new Date(),
      },
    }),
    db.teamHistory.create({
      data: {
        teamId,
        userId: targetUserId,
        actorId: actor.id,
        action: isSelf ? 'member.left' : 'member.removed',
        payload: { role: targetMembership.role },
      },
    }),
  ]);

  await recordAuditLog({
    actorId: actor.id,
    action: isSelf ? 'team.member.left' : 'team.member.removed',
    entityType: 'Team',
    entityId: teamId,
    payload: { targetUserId, role: targetMembership.role },
  });
}

export async function updateTeamSettings(
  actor: PermissionActor,
  teamId: string,
  input: {
    name?: string;
    description?: string;
    status?: TeamStatus;
    allowCoCaptainRegister?: boolean;
    newPassword?: string | null;
    logoUrl?: string | null;
  },
) {
  const actorTeamRole = await getUserActiveTeamRole(actor.id, teamId);
  assertPermission(
    canEditTeamCoreSettings(actor, { teamRole: actorTeamRole }),
    'ONLY_CAPTAIN_CAN_EDIT_TEAM',
  );

  const data: Prisma.TeamUpdateInput = {};
  if (input.name && input.name.trim().length >= 3) {
    data.name = input.name.trim();
  }
  if (input.description !== undefined) {
    data.description = input.description.trim() || null;
  }
  if (input.status) {
    data.status = input.status;
  }
  if (typeof input.allowCoCaptainRegister === 'boolean') {
    data.allowCoCaptainRegister = input.allowCoCaptainRegister;
  }
  if (input.logoUrl !== undefined) {
    data.logoUrl = input.logoUrl;
  }
  if (input.newPassword !== undefined) {
    data.passwordHash =
      input.newPassword && input.newPassword.trim().length >= 4
        ? hashPassword(input.newPassword.trim())
        : null;
  }

  const updated = await db.team.update({
    where: { id: teamId },
    data,
  });

  await db.teamHistory.create({
    data: {
      teamId,
      actorId: actor.id,
      action: 'team.settings_updated',
      payload: { status: updated.status },
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    action: 'team.settings_updated',
    entityType: 'Team',
    entityId: teamId,
    payload: { name: updated.name, status: updated.status },
  });

  return updated;
}

export async function deleteTeam(actor: PermissionActor, teamId: string) {
  const actorTeamRole = await getUserActiveTeamRole(actor.id, teamId);
  assertPermission(
    canEditTeamCoreSettings(actor, { teamRole: actorTeamRole }),
    'ONLY_CAPTAIN_OR_ADMIN_CAN_DELETE_TEAM',
  );

  // Section 7: "Команду с участием в активном турнире нельзя удалить, только выйти из турнира."
  const activeTournamentReg = await db.registration.findFirst({
    where: {
      teamId,
      status: { in: ['pending', 'approved'] },
      tournament: {
        status: { in: ['registration', 'in_progress'] },
      },
    },
  });

  if (activeTournamentReg) {
    throw new Error('CANNOT_DELETE_TEAM_IN_ACTIVE_TOURNAMENT');
  }

  await db.team.delete({ where: { id: teamId } });

  await recordAuditLog({
    actorId: actor.id,
    action: 'team.deleted',
    entityType: 'Team',
    entityId: teamId,
  });
}

export async function getTeamDetailByTag(tagOrId: string) {
  try {
    const normalizedTag = tagOrId.toUpperCase();
    const team = await db.team.findFirst({
      where: {
        OR: [{ tag: normalizedTag }, { id: tagOrId }],
      },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                steamId64: true,
                nickname: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        history: {
          include: {
            user: { select: { id: true, nickname: true, steamId64: true } },
            actor: { select: { id: true, nickname: true, steamId64: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
        registrations: {
          include: {
            tournament: {
              select: {
                id: true,
                slug: true,
                name: true,
                format: true,
                status: true,
                startsAt: true,
                levelWeight: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        ratingSnapshots: {
          include: {
            tournament: {
              select: { id: true, name: true, slug: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        joinRequests: {
          where: { status: 'pending' },
          include: {
            user: {
              select: {
                id: true,
                steamId64: true,
                nickname: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        invites: {
          where: {
            revokedAt: null,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!team) return null;

    const [higherRatedCount, completedMatches] = await Promise.all([
      db.team.count({
        where: { ratingPoints: { gt: team.ratingPoints } },
      }),
      db.match.findMany({
        where: {
          status: 'completed',
          isBye: false,
          OR: [{ teamAId: team.id }, { teamBId: team.id }],
        },
        select: { id: true, winnerId: true },
      }),
    ]);

    const matchesPlayed = completedMatches.length;
    const matchesWon = completedMatches.filter(
      (m) => m.winnerId === team.id,
    ).length;
    const matchesLost = Math.max(0, matchesPlayed - matchesWon);
    const winrate =
      matchesPlayed > 0
        ? Math.round((matchesWon / matchesPlayed) * 1000) / 10
        : 0;

    const counts = calculateRosterCounts(team.memberships);

    return {
      ...team,
      hasPassword: Boolean(team.passwordHash),
      rankPosition: higherRatedCount + 1,
      rosterCounts: counts,
      stats: {
        tournamentsCount: team.registrations.filter(
          (r) => r.status === 'approved',
        ).length,
        matchesPlayed,
        matchesWon,
        matchesLost,
        winrate,
      },
    };
  } catch {
    return null;
  }
}
