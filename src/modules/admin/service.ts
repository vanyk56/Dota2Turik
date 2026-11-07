// [Phase: MVP v1] Admin Panel Service (Section 1, 9, 13, 14)
import type { UserRole } from '@prisma/client';
import { db } from '@/lib/db';
import {
  assertPermission,
  canBlockUser,
  isModeratorOrAdmin,
  type PermissionActor,
} from '@/server/permissions';
import { recordAuditLog, listAuditLogs } from '@/modules/audit/service';
import { getOrInitActiveRatingFormula } from '@/modules/ratings/service';

export async function getAdminDashboardData(actor: PermissionActor) {
  assertPermission(isModeratorOrAdmin(actor), 'ADMIN_OR_MODERATOR_REQUIRED');

  const [
    users,
    tournaments,
    teams,
    openDisputes,
    activeFormula,
    formulaHistory,
    auditData,
  ] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    db.tournament.findMany({
      include: {
        organizer: { select: { id: true, nickname: true, steamId64: true } },
        _count: { select: { registrations: true, matches: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    db.team.findMany({
      include: {
        _count: { select: { memberships: { where: { isActive: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    db.matchDispute.findMany({
      where: { status: 'open' },
      include: {
        openedBy: { select: { id: true, nickname: true, steamId64: true } },
        match: {
          include: {
            tournament: { select: { id: true, name: true, slug: true } },
            teamA: { select: { id: true, name: true, tag: true } },
            teamB: { select: { id: true, name: true, tag: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    getOrInitActiveRatingFormula(),
    db.ratingFormula.findMany({
      orderBy: { version: 'desc' },
      take: 10,
    }),
    listAuditLogs({ limit: 50 }),
  ]);

  return {
    users,
    tournaments,
    teams,
    openDisputes,
    activeFormula,
    formulaHistory,
    auditLogs: auditData.items,
  };
}

export async function toggleUserBlockStatus(
  actor: PermissionActor,
  targetUserId: string,
  isBlocked: boolean,
) {
  assertPermission(canBlockUser(actor), 'ONLY_ADMIN_CAN_BLOCK_USERS');
  if (actor.id === targetUserId) {
    throw new Error('CANNOT_BLOCK_SELF');
  }

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: targetUserId },
      data: { isBlocked },
    });

    if (isBlocked) {
      await tx.session.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return u;
  });

  await recordAuditLog({
    actorId: actor.id,
    action: isBlocked ? 'admin.user.blocked' : 'admin.user.unblocked',
    entityType: 'User',
    entityId: targetUserId,
    payload: { nickname: updated.nickname, isBlocked },
  });

  return updated;
}

export async function updateUserPlatformRole(
  actor: PermissionActor,
  targetUserId: string,
  role: UserRole,
) {
  assertPermission(canBlockUser(actor), 'ONLY_ADMIN_CAN_CHANGE_ROLES');

  const updated = await db.user.update({
    where: { id: targetUserId },
    data: { role },
  });

  await recordAuditLog({
    actorId: actor.id,
    action: 'admin.user.role_changed',
    entityType: 'User',
    entityId: targetUserId,
    payload: { nickname: updated.nickname, role },
  });

  return updated;
}
