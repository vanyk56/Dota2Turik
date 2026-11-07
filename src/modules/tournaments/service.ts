// [Phase: MVP v1] Tournaments Domain Service (Section 10)
import {
  Prisma,
  type RegistrationStatus,
  type TournamentFormat,
  type TournamentStatus,
} from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import { PLATFORM_CONFIG } from '@/lib/config';
import { slugify } from '@/lib/utils';
import {
  assertPermission,
  canCreateTournament,
  canManageTournament,
  canRegisterTeamForTournament,
  type PermissionActor,
} from '@/server/permissions';
import { recordAuditLog } from '@/modules/audit/service';
import { calculateRosterCounts } from '@/modules/teams/rules';
import {
  calculateRoundRobinStandings,
  generateRoundRobinBracket,
  generateSingleEliminationBracket,
  type BracketEngineSettings,
  type EngineMatch,
} from '@/modules/brackets/engine';
import { awardTournamentRatings } from '@/modules/ratings/service';

export const createTournamentSchema = z.object({
  name: z.string().trim().min(3).max(80),
  slug: z.string().trim().min(3).max(80).optional(),
  description: z.string().trim().min(10).max(5000),
  format: z.enum(['single_elimination', 'round_robin']).default('single_elimination'),
  region: z.enum(PLATFORM_CONFIG.regions).default('EEU'),
  prizePool: z.string().trim().max(120).optional().or(z.literal('')),
  rules: z.string().trim().max(10000).optional().or(z.literal('')),
  maxTeams: z.coerce.number().int().min(2).max(128).default(16),
  startsAt: z.string().min(1),
  endsAt: z.string().optional().or(z.literal('')),
  levelWeight: z.enum(['tier_s', 'tier_a', 'tier_b', 'tier_c']).default('tier_b'),
  seedingMode: z.enum(['rating', 'manual']).default('rating'),
  defaultBestOf: z.coerce.number().int().refine((v) => [1, 3, 5].includes(v), {
    message: 'Best-Of must be 1, 3, or 5',
  }).default(3),
  initialStatus: z.enum(['draft', 'registration']).default('registration'),
});

export async function createTournament(
  actor: PermissionActor,
  rawInput: unknown,
  coverUrl?: string | null,
) {
  assertPermission(canCreateTournament(actor), 'CANNOT_CREATE_TOURNAMENT');
  const parsed = createTournamentSchema.parse(rawInput);

  let baseSlug = slugify(parsed.slug || parsed.name);
  if (!baseSlug || baseSlug.length < 3) {
    baseSlug = `tournament-${Date.now()}`;
  }

  const existingSlug = await db.tournament.findUnique({
    where: { slug: baseSlug },
  });
  const finalSlug = existingSlug
    ? `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`
    : baseSlug;

  const settings: BracketEngineSettings = {
    seedingMode: parsed.seedingMode,
    defaultBestOf: parsed.defaultBestOf,
    pointsPerWin: 2,
    pointsPerLoss: 0,
    tieBreakOrder: ['head_to_head', 'score_diff', 'wins'],
  };

  const tournament = await db.tournament.create({
    data: {
      name: parsed.name,
      slug: finalSlug,
      description: parsed.description,
      coverUrl: coverUrl ?? null,
      format: parsed.format as TournamentFormat,
      status: parsed.initialStatus as TournamentStatus,
      startsAt: new Date(parsed.startsAt),
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
      region: parsed.region,
      prizePool: parsed.prizePool || null,
      rules: parsed.rules || null,
      maxTeams: parsed.maxTeams,
      settings: settings as unknown as Prisma.InputJsonValue,
      organizerId: actor.id,
      levelWeight: parsed.levelWeight,
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    action: 'tournament.created',
    entityType: 'Tournament',
    entityId: tournament.id,
    payload: {
      slug: tournament.slug,
      format: tournament.format,
      status: tournament.status,
    },
  });

  return tournament;
}

export async function listTournaments(params?: {
  status?: string;
  region?: string;
  format?: string;
  viewerId?: string | null;
  viewerRole?: string | null;
}) {
  try {
    const where: Prisma.TournamentWhereInput = {};

    if (params?.status && params.status !== 'ALL') {
      where.status = params.status as TournamentStatus;
    } else if (params?.viewerRole !== 'admin') {
      // Section 10: Drafts are only visible to their organizer or admin
      where.OR = [
        { status: { not: 'draft' } },
        ...(params?.viewerId ? [{ organizerId: params.viewerId }] : []),
      ];
    }

    if (params?.region && params.region !== 'ALL') {
      where.region = params.region;
    }

    if (params?.format && params.format !== 'ALL') {
      where.format = params.format as TournamentFormat;
    }

    const items = await db.tournament.findMany({
      where,
      include: {
        organizer: {
          select: { id: true, nickname: true, steamId64: true },
        },
        _count: {
          select: {
            registrations: { where: { status: 'approved' } },
            matches: true,
          },
        },
      },
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    });

    return items;
  } catch {
    return [];
  }
}

export async function getTournamentBySlug(
  slugOrId: string,
  viewer?: PermissionActor | null,
) {
  try {
    const tournament = await db.tournament.findFirst({
      where: {
        OR: [{ slug: slugOrId }, { id: slugOrId }],
      },
      include: {
        organizer: {
          select: { id: true, nickname: true, steamId64: true, avatarUrl: true },
        },
        registrations: {
          include: {
            team: {
              include: {
                memberships: {
                  where: { isActive: true },
                  include: {
                    user: {
                      select: {
                        id: true,
                        nickname: true,
                        steamId64: true,
                        avatarUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [{ seed: 'asc' }, { createdAt: 'asc' }],
        },
        brackets: {
          orderBy: { createdAt: 'asc' },
        },
        matches: {
          include: {
            teamA: {
              select: { id: true, name: true, tag: true, logoUrl: true },
            },
            teamB: {
              select: { id: true, name: true, tag: true, logoUrl: true },
            },
            winner: {
              select: { id: true, name: true, tag: true, logoUrl: true },
            },
            results: {
              include: {
                submittedByTeam: { select: { id: true, tag: true, name: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
            disputes: {
              include: {
                openedBy: { select: { id: true, nickname: true } },
                resolvedBy: { select: { id: true, nickname: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: [{ round: 'asc' }, { position: 'asc' }],
        },
      },
    });

    if (!tournament) return null;

    // Enforce draft visibility (Section 10)
    if (
      tournament.status === 'draft' &&
      viewer?.role !== 'admin' &&
      viewer?.id !== tournament.organizerId
    ) {
      return null;
    }

    const approvedTeams = tournament.registrations
      .filter((r) => r.status === 'approved')
      .map((r) => r.team);

    let roundRobinStandings = null;
    if (tournament.format === 'round_robin' && approvedTeams.length >= 2) {
      const engineMatches: EngineMatch[] = tournament.matches.map((m) => ({
        id: m.id,
        round: m.round,
        position: m.position,
        stage: m.stage,
        teamAId: m.teamAId,
        teamBId: m.teamBId,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        status: m.status,
        winnerId: m.winnerId,
        nextMatchId: m.nextMatchId,
        loserNextMatchId: m.loserNextMatchId,
        bestOf: m.bestOf,
        isBye: m.isBye,
      }));

      roundRobinStandings = calculateRoundRobinStandings(
        approvedTeams.map((t) => t.id),
        engineMatches,
        (tournament.settings as unknown as BracketEngineSettings) ?? {},
      );
    }

    return {
      ...tournament,
      roundRobinStandings,
    };
  } catch {
    return null;
  }
}

export async function registerTeamForTournament(
  actor: PermissionActor,
  tournamentId: string,
  teamId: string,
  autoApproveByOrganizer = false,
) {
  const [tournament, team] = await Promise.all([
    db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        registrations: {
          where: { status: { in: ['pending', 'approved'] } },
          include: {
            team: {
              include: {
                memberships: { where: { isActive: true } },
              },
            },
          },
        },
      },
    }),
    db.team.findUnique({
      where: { id: teamId },
      include: {
        memberships: { where: { isActive: true } },
      },
    }),
  ]);

  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');
  if (!team) throw new Error('TEAM_NOT_FOUND');

  if (tournament.status !== 'registration') {
    throw new Error('TOURNAMENT_REGISTRATION_CLOSED');
  }

  const isOrganizerOrAdmin = canManageTournament(actor, {
    organizerId: tournament.organizerId,
  });

  if (!autoApproveByOrganizer || !isOrganizerOrAdmin) {
    const actorMembership = team.memberships.find((m) => m.userId === actor.id);
    assertPermission(
      canRegisterTeamForTournament(actor, {
        teamRole: actorMembership?.role ?? null,
        allowCoCaptainRegister: team.allowCoCaptainRegister,
      }),
      'CANNOT_REGISTER_TEAM',
    );
  }

  const approvedCount = tournament.registrations.filter(
    (r) => r.status === 'approved',
  ).length;
  if (approvedCount >= tournament.maxTeams) {
    throw new Error('TOURNAMENT_MAX_TEAMS_REACHED');
  }

  // Section 10: "Проверки: команда заполнена минимум на 5 основных игроков"
  const counts = calculateRosterCounts(team.memberships);
  if (counts.mainCount < PLATFORM_CONFIG.roster.minMainPlayersForTournament) {
    throw new Error('TEAM_NEEDS_AT_LEAST_5_MAIN_PLAYERS');
  }

  // Section 7 & 10: "при регистрации проверяется, что ни один участник заявки не числится в другой команде, зарегистрированной на тот же турнир"
  const candidatePlayerIds = new Set(team.memberships.map((m) => m.userId));
  for (const reg of tournament.registrations) {
    if (reg.teamId === team.id) continue;
    for (const member of reg.team.memberships) {
      if (candidatePlayerIds.has(member.userId)) {
        throw new Error('ROSTER_CONFLICT_PLAYER_ALREADY_REGISTERED_IN_ANOTHER_TEAM');
      }
    }
  }

  const status: RegistrationStatus =
    autoApproveByOrganizer && isOrganizerOrAdmin ? 'approved' : 'pending';

  const registration = await db.registration.upsert({
    where: {
      tournamentId_teamId: {
        tournamentId: tournament.id,
        teamId: team.id,
      },
    },
    update: {
      status,
      rosterSnapshot: Array.from(candidatePlayerIds) as unknown as Prisma.InputJsonValue,
    },
    create: {
      tournamentId: tournament.id,
      teamId: team.id,
      status,
      rosterSnapshot: Array.from(candidatePlayerIds) as unknown as Prisma.InputJsonValue,
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    action: autoApproveByOrganizer
      ? 'tournament.team.added_manually'
      : 'tournament.registration.submitted',
    entityType: 'Tournament',
    entityId: tournament.id,
    payload: { teamId: team.id, registrationId: registration.id, status },
  });

  return registration;
}

export async function decideTournamentRegistration(
  actor: PermissionActor,
  registrationId: string,
  status: 'approved' | 'rejected' | 'withdrawn',
  seed?: number | null,
) {
  const reg = await db.registration.findUnique({
    where: { id: registrationId },
    include: { tournament: true },
  });
  if (!reg) throw new Error('REGISTRATION_NOT_FOUND');

  assertPermission(
    canManageTournament(actor, { organizerId: reg.tournament.organizerId }),
    'ONLY_ORGANIZER_CAN_MANAGE_REGISTRATIONS',
  );

  if (reg.tournament.status !== 'registration') {
    throw new Error('CANNOT_CHANGE_REGISTRATIONS_AFTER_START');
  }

  const updated = await db.registration.update({
    where: { id: registrationId },
    data: {
      status,
      ...(seed !== undefined ? { seed } : {}),
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    action: `tournament.registration.${status}`,
    entityType: 'Tournament',
    entityId: reg.tournamentId,
    payload: { registrationId, teamId: reg.teamId, seed },
  });

  return updated;
}

export async function startTournamentAndGenerateBracket(
  actor: PermissionActor,
  tournamentId: string,
  forceRegenerate = false,
) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: {
        where: { status: 'approved' },
        include: {
          team: { select: { id: true, ratingPoints: true } },
        },
        orderBy: [{ seed: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');

  assertPermission(
    canManageTournament(actor, { organizerId: tournament.organizerId }),
    'ONLY_ORGANIZER_CAN_START_TOURNAMENT',
  );

  if (
    tournament.status !== 'registration' &&
    !(tournament.status === 'in_progress' && forceRegenerate)
  ) {
    throw new Error('INVALID_TOURNAMENT_STATUS_FOR_BRACKET_GENERATION');
  }

  if (tournament.registrations.length < 2) {
    throw new Error('MINIMUM_2_APPROVED_TEAMS_REQUIRED');
  }

  const settings =
    (tournament.settings as unknown as BracketEngineSettings) ?? {};
  const participants = tournament.registrations.map((r, idx) => ({
    teamId: r.teamId,
    seed: r.seed ?? idx + 1,
    ratingPoints: r.team.ratingPoints,
  }));

  const engineMatches =
    tournament.format === 'round_robin'
      ? generateRoundRobinBracket(participants, settings, 'rr')
      : generateSingleEliminationBracket(participants, settings, 'se');

  await db.$transaction(async (tx) => {
    // Remove previous bracket & matches if regenerating
    await tx.match.deleteMany({ where: { tournamentId: tournament.id } });
    await tx.bracket.deleteMany({ where: { tournamentId: tournament.id } });

    const bracket = await tx.bracket.create({
      data: {
        tournamentId: tournament.id,
        format: tournament.format,
        stage: 'main',
        layout: {},
      },
    });

    // First pass: create all matches without nextMatchId links
    const engineIdToDbId = new Map<string, string>();
    for (const em of engineMatches) {
      const createdMatch = await tx.match.create({
        data: {
          tournamentId: tournament.id,
          bracketId: bracket.id,
          round: em.round,
          position: em.position,
          stage: em.stage,
          teamAId: em.teamAId,
          teamBId: em.teamBId,
          scoreA: em.scoreA,
          scoreB: em.scoreB,
          status: em.status,
          winnerId: em.winnerId,
          bestOf: em.bestOf,
          isBye: em.isBye,
        },
      });
      engineIdToDbId.set(em.id, createdMatch.id);
    }

    // Second pass: link nextMatchId
    for (const em of engineMatches) {
      if (em.nextMatchId) {
        const dbMatchId = engineIdToDbId.get(em.id);
        const dbNextId = engineIdToDbId.get(em.nextMatchId);
        if (dbMatchId && dbNextId) {
          await tx.match.update({
            where: { id: dbMatchId },
            data: { nextMatchId: dbNextId },
          });
        }
      }
    }

    await tx.tournament.update({
      where: { id: tournament.id },
      data: { status: 'in_progress' },
    });
  });

  await recordAuditLog({
    actorId: actor.id,
    action: forceRegenerate
      ? 'tournament.bracket.regenerated'
      : 'tournament.started',
    entityType: 'Tournament',
    entityId: tournament.id,
    payload: {
      teamCount: participants.length,
      format: tournament.format,
    },
  });
}

export async function updateTournamentStatus(
  actor: PermissionActor,
  tournamentId: string,
  targetStatus: TournamentStatus,
) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
  });
  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');

  assertPermission(
    canManageTournament(actor, { organizerId: tournament.organizerId }),
    'ONLY_ORGANIZER_CAN_CHANGE_STATUS',
  );

  if (tournament.status === 'finished' && actor.role !== 'admin') {
    throw new Error('FINISHED_TOURNAMENT_IS_READ_ONLY');
  }

  const updated = await db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: targetStatus,
      ...(targetStatus === 'finished' ? { endsAt: new Date() } : {}),
    },
  });

  if (targetStatus === 'finished') {
    await awardTournamentRatings(tournament.id);
  }

  await recordAuditLog({
    actorId: actor.id,
    action: `tournament.status.${targetStatus}`,
    entityType: 'Tournament',
    entityId: tournamentId,
    payload: { from: tournament.status, to: targetStatus },
  });

  return updated;
}

export async function saveBracketNodeLayout(
  actor: PermissionActor,
  bracketId: string,
  layout: Record<string, { x: number; y: number }>,
) {
  const bracket = await db.bracket.findUnique({
    where: { id: bracketId },
    include: { tournament: true },
  });
  if (!bracket) throw new Error('BRACKET_NOT_FOUND');

  assertPermission(
    canManageTournament(actor, { organizerId: bracket.tournament.organizerId }),
    'ONLY_ORGANIZER_CAN_SAVE_BRACKET_LAYOUT',
  );

  await db.bracket.update({
    where: { id: bracketId },
    data: { layout: layout as unknown as Prisma.InputJsonValue },
  });

  await recordAuditLog({
    actorId: actor.id,
    action: 'bracket.layout.saved',
    entityType: 'Bracket',
    entityId: bracketId,
    payload: { nodeCount: Object.keys(layout).length },
  });
}

export async function getTournamentViewerTeamsContext(userId?: string | null) {
  try {
    const [viewerMemberships, allTeams] = await Promise.all([
      userId
        ? db.teamMembership.findMany({
            where: { userId, isActive: true },
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  tag: true,
                  allowCoCaptainRegister: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      db.team.findMany({
        select: { id: true, name: true, tag: true, ratingPoints: true },
        orderBy: { ratingPoints: 'desc' },
        take: 100,
      }),
    ]);

    return {
      viewerTeamIds: viewerMemberships.map((m) => m.teamId),
      registrableTeams: viewerMemberships
        .filter(
          (m) =>
            m.role === 'captain' ||
            (m.role === 'co_captain' && m.team.allowCoCaptainRegister),
        )
        .map((m) => m.team),
      allTeams,
    };
  } catch {
    return {
      viewerTeamIds: [] as string[],
      registrableTeams: [] as Array<{
        id: string;
        name: string;
        tag: string;
        allowCoCaptainRegister: boolean;
      }>,
      allTeams: [] as Array<{
        id: string;
        name: string;
        tag: string;
        ratingPoints: number;
      }>,
    };
  }
}

