// [Phase: MVP v1] Matches, Dual-Team Result Confirmation & Disputes Service (Section 10)
import { db } from '@/lib/db';
import {
  assertPermission,
  canManageTournament,
  canResolveDispute,
  canSubmitMatchResult,
  type PermissionActor,
} from '@/server/permissions';
import { recordAuditLog } from '@/modules/audit/service';
import {
  advanceMatchResult,
  rollbackMatchResult,
  type EngineMatch,
} from '@/modules/brackets/engine';
import { awardTournamentRatings } from '@/modules/ratings/service';

async function applyEngineProgressionToDb(
  tournamentId: string,
  updatedMatches: EngineMatch[],
) {
  await db.$transaction(async (tx) => {
    for (const em of updatedMatches) {
      await tx.match.update({
        where: { id: em.id },
        data: {
          teamAId: em.teamAId,
          teamBId: em.teamBId,
          scoreA: em.scoreA,
          scoreB: em.scoreB,
          status: em.status,
          winnerId: em.winnerId,
        },
      });
    }
  });

  // Check if all matches in the tournament are now completed
  const remainingCount = await db.match.count({
    where: {
      tournamentId,
      status: { not: 'completed' },
    },
  });

  if (remainingCount === 0) {
    const tourney = await db.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (tourney && tourney.status === 'in_progress') {
      await db.tournament.update({
        where: { id: tournamentId },
        data: { status: 'finished', endsAt: new Date() },
      });
      await awardTournamentRatings(tournamentId);
    }
  }
}

export async function submitTeamMatchResult(
  actor: PermissionActor,
  matchId: string,
  scoreA: number,
  scoreB: number,
) {
  if (scoreA === scoreB || scoreA < 0 || scoreB < 0) {
    throw new Error('INVALID_NON_DRAW_SCORE_REQUIRED');
  }

  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: true,
      results: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!match) throw new Error('MATCH_NOT_FOUND');
  if (match.tournament.status !== 'in_progress') {
    throw new Error('TOURNAMENT_NOT_IN_PROGRESS');
  }
  if (!match.teamAId || !match.teamBId) {
    throw new Error('MATCH_TEAMS_NOT_READY');
  }
  if (match.status === 'completed') {
    throw new Error('MATCH_ALREADY_COMPLETED');
  }

  const [memberA, memberB] = await Promise.all([
    db.teamMembership.findFirst({
      where: {
        teamId: match.teamAId,
        userId: actor.id,
        isActive: true,
        role: { in: ['captain', 'co_captain', 'player'] },
      },
    }),
    db.teamMembership.findFirst({
      where: {
        teamId: match.teamBId,
        userId: actor.id,
        isActive: true,
        role: { in: ['captain', 'co_captain', 'player'] },
      },
    }),
  ]);

  assertPermission(
    canSubmitMatchResult(actor, {
      organizerId: match.tournament.organizerId,
      isParticipantOfTeamA: Boolean(memberA),
      isParticipantOfTeamB: Boolean(memberB),
    }),
    'NOT_AUTHORIZED_TO_SUBMIT_MATCH_RESULT',
  );

  // If organizer or admin submits directly without being on one of the two teams, treat as organizer override
  if (
    !memberA &&
    !memberB &&
    canManageTournament(actor, { organizerId: match.tournament.organizerId })
  ) {
    return organizerSetMatchResult(actor, matchId, scoreA, scoreB);
  }

  const submittingTeamId = memberA ? match.teamAId : match.teamBId;
  const opponentTeamId = memberA ? match.teamBId : match.teamAId;

  const opponentSubmission = match.results.find(
    (r) => r.submittedByTeamId === opponentTeamId && r.status === 'submitted',
  );

  if (!opponentSubmission) {
    // First submission (or updating own submission) -> awaiting_confirmation
    const createdResult = await db.$transaction(async (tx) => {
      await tx.matchResult.deleteMany({
        where: {
          matchId: match.id,
          submittedByTeamId: submittingTeamId,
          status: 'submitted',
        },
      });

      const res = await tx.matchResult.create({
        data: {
          matchId: match.id,
          submittedByTeamId: submittingTeamId,
          submittedByUserId: actor.id,
          scoreA,
          scoreB,
          status: 'submitted',
        },
      });

      await tx.match.update({
        where: { id: match.id },
        data: {
          scoreA,
          scoreB,
          status: 'awaiting_confirmation',
        },
      });

      return res;
    });

    await recordAuditLog({
      actorId: actor.id,
      action: 'match.result.submitted',
      entityType: 'Match',
      entityId: match.id,
      payload: {
        submittingTeamId,
        scoreA,
        scoreB,
        status: 'awaiting_confirmation',
      },
    });

    return { outcome: 'awaiting_confirmation' as const, result: createdResult };
  }

  // Opponent already submitted -> compare scores!
  if (
    opponentSubmission.scoreA === scoreA &&
    opponentSubmission.scoreB === scoreB
  ) {
    // Confirmed by both teams! Advance bracket!
    const allTournamentMatches = await db.match.findMany({
      where: { tournamentId: match.tournamentId },
    });

    const engineMatches: EngineMatch[] = allTournamentMatches.map((m) => ({
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

    const progressed = advanceMatchResult(
      engineMatches,
      match.id,
      scoreA,
      scoreB,
    );

    await db.$transaction([
      db.matchResult.create({
        data: {
          matchId: match.id,
          submittedByTeamId: submittingTeamId,
          submittedByUserId: actor.id,
          scoreA,
          scoreB,
          status: 'confirmed',
        },
      }),
      db.matchResult.update({
        where: { id: opponentSubmission.id },
        data: { status: 'confirmed' },
      }),
    ]);

    await applyEngineProgressionToDb(match.tournamentId, progressed);

    await recordAuditLog({
      actorId: actor.id,
      action: 'match.result.confirmed_by_both_teams',
      entityType: 'Match',
      entityId: match.id,
      payload: { scoreA, scoreB, confirmingTeamId: submittingTeamId },
    });

    return { outcome: 'completed' as const };
  }

  // Conflicting scores -> automatically open Dispute!
  await db.$transaction([
    db.matchResult.create({
      data: {
        matchId: match.id,
        submittedByTeamId: submittingTeamId,
        submittedByUserId: actor.id,
        scoreA,
        scoreB,
        status: 'disputed',
      },
    }),
    db.matchResult.update({
      where: { id: opponentSubmission.id },
      data: { status: 'disputed' },
    }),
    db.match.update({
      where: { id: match.id },
      data: { status: 'disputed' },
    }),
    db.matchDispute.create({
      data: {
        matchId: match.id,
        openedById: actor.id,
        reason: `Несовпадение счёта команд: (${opponentSubmission.scoreA}:${opponentSubmission.scoreB}) vs (${scoreA}:${scoreB})`,
        status: 'open',
      },
    }),
  ]);

  await recordAuditLog({
    actorId: actor.id,
    action: 'match.result.disputed_conflict',
    entityType: 'Match',
    entityId: match.id,
    payload: {
      opponentScore: `${opponentSubmission.scoreA}:${opponentSubmission.scoreB}`,
      submittedScore: `${scoreA}:${scoreB}`,
    },
  });

  return { outcome: 'disputed' as const };
}

export async function organizerSetMatchResult(
  actor: PermissionActor,
  matchId: string,
  scoreA: number,
  scoreB: number,
  resolutionNote?: string,
) {
  if (scoreA === scoreB || scoreA < 0 || scoreB < 0) {
    throw new Error('INVALID_NON_DRAW_SCORE_REQUIRED');
  }

  const match = await db.match.findUnique({
    where: { id: matchId },
    include: { tournament: true },
  });
  if (!match) throw new Error('MATCH_NOT_FOUND');

  assertPermission(
    canResolveDispute(actor, { organizerId: match.tournament.organizerId }),
    'ONLY_ORGANIZER_MODERATOR_OR_ADMIN_CAN_OVERRIDE_RESULT',
  );

  const allTournamentMatches = await db.match.findMany({
    where: { tournamentId: match.tournamentId },
  });

  const engineMatches: EngineMatch[] = allTournamentMatches.map((m) => ({
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

  const progressed = advanceMatchResult(
    engineMatches,
    match.id,
    scoreA,
    scoreB,
  );

  await applyEngineProgressionToDb(match.tournamentId, progressed);

  // Resolve any open disputes on this match
  await db.matchDispute.updateMany({
    where: { matchId: match.id, status: 'open' },
    data: {
      status: 'resolved',
      resolvedById: actor.id,
      resolution:
        resolutionNote || `Итоговый счёт установлен организатором: ${scoreA}:${scoreB}`,
      resolvedAt: new Date(),
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    action: 'match.result.organizer_override',
    entityType: 'Match',
    entityId: match.id,
    payload: { scoreA, scoreB, resolutionNote },
  });

  return { outcome: 'completed' as const };
}

export async function openManualMatchDispute(
  actor: PermissionActor,
  matchId: string,
  reason: string,
) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: { tournament: true },
  });
  if (!match || !match.teamAId || !match.teamBId) {
    throw new Error('MATCH_NOT_FOUND');
  }

  const [memberA, memberB] = await Promise.all([
    db.teamMembership.findFirst({
      where: { teamId: match.teamAId, userId: actor.id, isActive: true },
    }),
    db.teamMembership.findFirst({
      where: { teamId: match.teamBId, userId: actor.id, isActive: true },
    }),
  ]);

  assertPermission(
    canSubmitMatchResult(actor, {
      organizerId: match.tournament.organizerId,
      isParticipantOfTeamA: Boolean(memberA),
      isParticipantOfTeamB: Boolean(memberB),
    }),
    'NOT_AUTHORIZED_TO_OPEN_DISPUTE',
  );

  const dispute = await db.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: { status: 'disputed' },
    });

    return tx.matchDispute.create({
      data: {
        matchId: match.id,
        openedById: actor.id,
        reason: reason.trim().slice(0, 500),
        status: 'open',
      },
    });
  });

  await recordAuditLog({
    actorId: actor.id,
    action: 'match.dispute.opened',
    entityType: 'Match',
    entityId: match.id,
    payload: { disputeId: dispute.id, reason: dispute.reason },
  });

  return dispute;
}

export async function organizerRollbackMatch(
  actor: PermissionActor,
  matchId: string,
) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: { tournament: true },
  });
  if (!match) throw new Error('MATCH_NOT_FOUND');

  assertPermission(
    canManageTournament(actor, { organizerId: match.tournament.organizerId }),
    'ONLY_ORGANIZER_CAN_ROLLBACK_MATCH',
  );

  const allTournamentMatches = await db.match.findMany({
    where: { tournamentId: match.tournamentId },
  });

  const engineMatches: EngineMatch[] = allTournamentMatches.map((m) => ({
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

  const rolledBack = rollbackMatchResult(engineMatches, match.id);

  await db.$transaction(async (tx) => {
    await tx.matchResult.deleteMany({ where: { matchId: match.id } });
    for (const em of rolledBack) {
      await tx.match.update({
        where: { id: em.id },
        data: {
          teamAId: em.teamAId,
          teamBId: em.teamBId,
          scoreA: em.scoreA,
          scoreB: em.scoreB,
          status: em.status,
          winnerId: em.winnerId,
        },
      });
    }
  });

  await recordAuditLog({
    actorId: actor.id,
    action: 'match.result.rolled_back',
    entityType: 'Match',
    entityId: match.id,
  });
}
