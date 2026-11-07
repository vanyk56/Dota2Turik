// [Phase: MVP v1] User Profile & Platform Statistics Service (Section 6 & 14)
import { db } from '@/lib/db';
import { getCachedDotaStats, type DotaStatsView } from '@/modules/dota-data/service';
import { recordAuditLog } from '@/modules/audit/service';

export interface PlayerPlatformStats {
  tournamentsPlayed: number;
  tournamentsWon: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  winrate: number;
}

export interface PlayerProfileView {
  user: {
    id: string;
    steamId64: string;
    nickname: string;
    avatarUrl: string | null;
    profileUrl: string | null;
    visibility: number;
    role: string;
    createdAt: Date;
    lastLoginAt: Date;
  };
  platformStats: PlayerPlatformStats;
  teamHistory: Array<{
    membershipId: string;
    role: string;
    isActive: boolean;
    joinedAt: Date;
    leftAt: Date | null;
    team: {
      id: string;
      name: string;
      tag: string;
      logoUrl: string | null;
      ratingPoints: number;
      status: string;
    };
  }>;
  dotaStats: DotaStatsView;
}

export async function getPlayerProfile(
  steamIdOrUserId: string,
): Promise<PlayerProfileView | null> {
  try {
    const user = await db.user.findFirst({
      where: {
        OR: [{ steamId64: steamIdOrUserId }, { id: steamIdOrUserId }],
      },
      include: {
        memberships: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                tag: true,
                logoUrl: true,
                ratingPoints: true,
                status: true,
              },
            },
          },
          orderBy: { joinedAt: 'desc' },
        },
      },
    });

    if (!user) return null;

    const teamIds = Array.from(new Set(user.memberships.map((m) => m.teamId)));

    let tournamentsPlayed = 0;
    let tournamentsWon = 0;
    let matchesPlayed = 0;
    let matchesWon = 0;

    if (teamIds.length > 0) {
      const [registrations, firstPlaceSnapshots, completedMatches] =
        await Promise.all([
          db.registration.count({
            where: {
              teamId: { in: teamIds },
              status: 'approved',
              tournament: { status: { in: ['in_progress', 'finished'] } },
            },
          }),
          db.ratingSnapshot.count({
            where: {
              teamId: { in: teamIds },
              placement: 1,
            },
          }),
          db.match.findMany({
            where: {
              status: 'completed',
              isBye: false,
              OR: [
                { teamAId: { in: teamIds } },
                { teamBId: { in: teamIds } },
              ],
            },
            select: {
              id: true,
              winnerId: true,
            },
          }),
        ]);

      tournamentsPlayed = registrations;
      tournamentsWon = firstPlaceSnapshots;
      matchesPlayed = completedMatches.length;
      matchesWon = completedMatches.filter(
        (m) => m.winnerId && teamIds.includes(m.winnerId),
      ).length;
    }

    const matchesLost = Math.max(0, matchesPlayed - matchesWon);
    const winrate =
      matchesPlayed > 0
        ? Math.round((matchesWon / matchesPlayed) * 1000) / 10
        : 0;

    const dotaStats = await getCachedDotaStats(user.steamId64);

    return {
      user: {
        id: user.id,
        steamId64: user.steamId64,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        profileUrl: user.profileUrl,
        visibility: user.visibility,
        role: user.role,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      platformStats: {
        tournamentsPlayed,
        tournamentsWon,
        matchesPlayed,
        matchesWon,
        matchesLost,
        winrate,
      },
      teamHistory: user.memberships.map((m) => ({
        membershipId: m.id,
        role: m.role,
        isActive: m.isActive,
        joinedAt: m.joinedAt,
        leftAt: m.leftAt,
        team: m.team,
      })),
      dotaStats,
    };
  } catch {
    return null;
  }
}

export async function anonymizeUserAccount(userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const anonSuffix = user.id.slice(-6);
  await db.user.update({
    where: { id: userId },
    data: {
      nickname: `DeletedUser_${anonSuffix}`,
      avatarUrl: null,
      profileUrl: null,
      isAnonymized: true,
    },
  });

  await db.dotaStatsCache.deleteMany({
    where: { steamId64: user.steamId64 },
  });

  await recordAuditLog({
    actorId: userId,
    action: 'user.account.anonymized',
    entityType: 'User',
    entityId: userId,
  });
}
