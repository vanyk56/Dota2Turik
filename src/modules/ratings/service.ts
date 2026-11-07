// [Phase: MVP v1] Platform Rating Service with Formula Versioning & Recalculation (Section 9)
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import {
  assertPermission,
  canEditRatingFormula,
  type PermissionActor,
} from '@/server/permissions';
import { recordAuditLog } from '@/modules/audit/service';
import {
  calculateTournamentRatingSnapshots,
  DEFAULT_RATING_FORMULA_CONFIG,
  type RatingFormulaConfig,
} from './engine';
import {
  extractTournamentPlacements,
  type BracketEngineSettings,
  type EngineMatch,
} from '@/modules/brackets/engine';

export async function getOrInitActiveRatingFormula(): Promise<{
  version: number;
  config: RatingFormulaConfig;
}> {
  try {
    const active = await db.ratingFormula.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });

    if (active) {
      return {
        version: active.version,
        config: active.config as unknown as RatingFormulaConfig,
      };
    }

    const created = await db.ratingFormula.create({
      data: {
        version: 1,
        config: DEFAULT_RATING_FORMULA_CONFIG as unknown as Prisma.InputJsonValue,
        isActive: true,
      },
    });

    return {
      version: created.version,
      config: created.config as unknown as RatingFormulaConfig,
    };
  } catch {
    return {
      version: 1,
      config: DEFAULT_RATING_FORMULA_CONFIG,
    };
  }
}

export async function createNewRatingFormulaVersion(
  actor: PermissionActor,
  newConfig: RatingFormulaConfig,
) {
  assertPermission(
    canEditRatingFormula(actor),
    'ONLY_ADMIN_CAN_EDIT_RATING_FORMULA',
  );

  const latest = await db.ratingFormula.findFirst({
    orderBy: { version: 'desc' },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const created = await db.$transaction(async (tx) => {
    await tx.ratingFormula.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    return tx.ratingFormula.create({
      data: {
        version: nextVersion,
        config: newConfig as unknown as Prisma.InputJsonValue,
        isActive: true,
        createdById: actor.id,
      },
    });
  });

  await recordAuditLog({
    actorId: actor.id,
    action: 'rating.formula.version_created',
    entityType: 'RatingFormula',
    entityId: created.id,
    payload: { version: created.version, config: newConfig },
  });

  return created;
}

export async function awardTournamentRatings(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: {
        where: { status: 'approved' },
      },
      matches: true,
    },
  });

  if (!tournament || tournament.status !== 'finished') {
    return [];
  }

  const formula = await getOrInitActiveRatingFormula();
  const teamIds = tournament.registrations.map((r) => r.teamId);
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

  const format =
    tournament.format === 'round_robin' ? 'round_robin' : 'single_elimination';
  const placements = extractTournamentPlacements(
    format,
    engineMatches,
    teamIds,
    (tournament.settings as unknown as BracketEngineSettings) ?? {},
  );

  const snapshots = calculateTournamentRatingSnapshots({
    tournamentStatus: tournament.status,
    levelWeight: tournament.levelWeight,
    formulaVersion: formula.version,
    config: formula.config,
    placements,
  });

  await db.$transaction(async (tx) => {
    for (const snap of snapshots) {
      await tx.ratingSnapshot.upsert({
        where: {
          teamId_tournamentId_formulaVersion: {
            teamId: snap.teamId,
            tournamentId: tournament.id,
            formulaVersion: formula.version,
          },
        },
        update: {
          placement: snap.placement,
          points: snap.points,
        },
        create: {
          teamId: snap.teamId,
          tournamentId: tournament.id,
          placement: snap.placement,
          points: snap.points,
          formulaVersion: formula.version,
        },
      });
    }

    // Recompute total ratingPoints for affected teams from their latest snapshot per tournament
    for (const teamId of teamIds) {
      const teamSnaps = await tx.ratingSnapshot.findMany({
        where: { teamId },
        orderBy: { formulaVersion: 'desc' },
      });

      const byTournament = new Map<string, number>();
      for (const s of teamSnaps) {
        if (!byTournament.has(s.tournamentId)) {
          byTournament.set(s.tournamentId, s.points);
        }
      }

      let totalPoints = 0;
      byTournament.forEach((pts) => {
        totalPoints += pts;
      });

      await tx.team.update({
        where: { id: teamId },
        data: {
          ratingPoints: totalPoints,
          ratingVersion: formula.version,
        },
      });
    }
  });

  return snapshots;
}

export async function recalculateAllRatingsByVersion(
  actor: PermissionActor,
  targetVersion?: number,
) {
  assertPermission(
    canEditRatingFormula(actor),
    'ONLY_ADMIN_CAN_RECALCULATE_RATINGS',
  );

  const formulaRecord = targetVersion
    ? await db.ratingFormula.findUnique({ where: { version: targetVersion } })
    : await db.ratingFormula.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' },
      });

  if (!formulaRecord) {
    throw new Error('RATING_FORMULA_NOT_FOUND');
  }

  const finishedTournaments = await db.tournament.findMany({
    where: { status: 'finished' },
    select: { id: true },
  });

  for (const t of finishedTournaments) {
    await awardTournamentRatings(t.id);
  }

  await recordAuditLog({
    actorId: actor.id,
    action: 'rating.recalculated_all',
    entityType: 'RatingFormula',
    entityId: formulaRecord.id,
    payload: {
      formulaVersion: formulaRecord.version,
      tournamentsCount: finishedTournaments.length,
    },
  });

  return {
    formulaVersion: formulaRecord.version,
    tournamentsProcessed: finishedTournaments.length,
  };
}

export async function getLeaderboardData() {
  try {
    const [teams, activeFormula, allFormulas] = await Promise.all([
      db.team.findMany({
        include: {
          memberships: {
            where: { isActive: true, role: 'captain' },
            include: {
              user: { select: { id: true, nickname: true, steamId64: true } },
            },
          },
          _count: {
            select: {
              registrations: { where: { status: 'approved' } },
              matchesWon: true,
            },
          },
        },
        orderBy: [{ ratingPoints: 'desc' }, { createdAt: 'asc' }],
        take: 100,
      }),
      getOrInitActiveRatingFormula(),
      db.ratingFormula.findMany({
        orderBy: { version: 'desc' },
        take: 10,
      }),
    ]);

    return {
      teams: teams.map((t, idx) => ({
        rank: idx + 1,
        id: t.id,
        name: t.name,
        tag: t.tag,
        logoUrl: t.logoUrl,
        country: t.country,
        region: t.region,
        status: t.status,
        ratingPoints: t.ratingPoints,
        ratingVersion: t.ratingVersion,
        captain: t.memberships[0]?.user ?? null,
        tournamentsCount: t._count.registrations,
        winsCount: t._count.matchesWon,
      })),
      activeFormula,
      allFormulas,
    };
  } catch {
    return {
      teams: [],
      activeFormula: { version: 1, config: DEFAULT_RATING_FORMULA_CONFIG },
      allFormulas: [],
    };
  }
}
