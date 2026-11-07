// [Phase: MVP v1] PURE TYPESCRIPT Tournament Bracket Engine (Section 3 & Section 10)
// STRICT RULE: No imports from Next.js, Prisma, or React allowed in this module.

export interface BracketParticipant {
  teamId: string;
  seed?: number | null;
  ratingPoints?: number;
}

export type TieBreakRule = 'head_to_head' | 'score_diff' | 'wins';

export interface BracketEngineSettings {
  seedingMode?: 'rating' | 'manual';
  defaultBestOf?: number;
  bestOfByRound?: Record<string, number>;
  pointsPerWin?: number;
  pointsPerLoss?: number;
  tieBreakOrder?: TieBreakRule[];
}

export interface EngineMatch {
  id: string;
  round: number;
  position: number;
  stage: string;
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number;
  scoreB: number;
  status:
    | 'scheduled'
    | 'live'
    | 'awaiting_confirmation'
    | 'completed'
    | 'disputed';
  winnerId: string | null;
  nextMatchId: string | null;
  loserNextMatchId: string | null;
  bestOf: number;
  isBye: boolean;
}

export interface RoundRobinStandingRow {
  placement: number;
  teamId: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
  scoreFor: number;
  scoreAgainst: number;
  scoreDiff: number;
}

export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 2;
  let power = 2;
  while (power < n) {
    power *= 2;
  }
  return power;
}

/**
 * Generates standard tournament seed positions of length `bracketSize` (power of 2)
 * such that top seeds meet as late as possible and top seeds receive byes first.
 * Example for 8: [1, 8, 4, 5, 2, 7, 3, 6]
 */
export function generateStandardSeedOrder(bracketSize: number): number[] {
  const rounds = Math.log2(bracketSize);
  let seeds = [1, 2];

  for (let r = 1; r < rounds; r++) {
    const nextSeeds: number[] = [];
    const sum = seeds.length * 2 + 1;
    for (const s of seeds) {
      nextSeeds.push(s);
      nextSeeds.push(sum - s);
    }
    seeds = nextSeeds;
  }

  return seeds;
}

export function sortParticipantsBySeeding(
  participants: BracketParticipant[],
  mode: 'rating' | 'manual' = 'rating',
): BracketParticipant[] {
  const copy = [...participants];
  if (mode === 'manual') {
    return copy.sort((a, b) => {
      const seedA = a.seed ?? Number.MAX_SAFE_INTEGER;
      const seedB = b.seed ?? Number.MAX_SAFE_INTEGER;
      if (seedA !== seedB) return seedA - seedB;
      return (b.ratingPoints ?? 0) - (a.ratingPoints ?? 0);
    });
  }
  return copy.sort((a, b) => {
    const diff = (b.ratingPoints ?? 0) - (a.ratingPoints ?? 0);
    if (diff !== 0) return diff;
    return (a.seed ?? 999) - (b.seed ?? 999);
  });
}

export function generateSingleEliminationBracket(
  participants: BracketParticipant[],
  settings: BracketEngineSettings = {},
  idPrefix = 'se',
): EngineMatch[] {
  if (participants.length < 2) {
    throw new Error('MINIMUM_2_TEAMS_REQUIRED');
  }

  const ordered = sortParticipantsBySeeding(
    participants,
    settings.seedingMode ?? 'rating',
  );
  const bracketSize = nextPowerOfTwo(ordered.length);
  const totalRounds = Math.log2(bracketSize);
  const seedOrder = generateStandardSeedOrder(bracketSize);

  const matchesByRound: EngineMatch[][] = [];

  for (let round = 1; round <= totalRounds; round++) {
    const matchCount = bracketSize / Math.pow(2, round);
    const roundMatches: EngineMatch[] = [];
    const roundBestOf =
      settings.bestOfByRound?.[String(round)] ??
      (round === totalRounds
        ? (settings.defaultBestOf ?? 3)
        : (settings.defaultBestOf ?? 1));

    for (let pos = 0; pos < matchCount; pos++) {
      roundMatches.push({
        id: `${idPrefix}_r${round}_p${pos}`,
        round,
        position: pos,
        stage: 'main',
        teamAId: null,
        teamBId: null,
        scoreA: 0,
        scoreB: 0,
        status: 'scheduled',
        winnerId: null,
        nextMatchId: null,
        loserNextMatchId: null,
        bestOf: roundBestOf,
        isBye: false,
      });
    }
    matchesByRound.push(roundMatches);
  }

  // Link nextMatchId across rounds
  for (let r = 0; r < totalRounds - 1; r++) {
    const currentRound = matchesByRound[r]!;
    const nextRound = matchesByRound[r + 1]!;
    for (let pos = 0; pos < currentRound.length; pos++) {
      const targetNextPos = Math.floor(pos / 2);
      currentRound[pos]!.nextMatchId = nextRound[targetNextPos]!.id;
    }
  }

  // Populate Round 1 and process automatic Byes
  const round1 = matchesByRound[0]!;
  const round2 = matchesByRound[1];

  for (let pos = 0; pos < round1.length; pos++) {
    const seedIndexA = seedOrder[pos * 2]! - 1;
    const seedIndexB = seedOrder[pos * 2 + 1]! - 1;
    const teamA = ordered[seedIndexA]?.teamId ?? null;
    const teamB = ordered[seedIndexB]?.teamId ?? null;

    const match = round1[pos]!;
    match.teamAId = teamA;
    match.teamBId = teamB;

    if ((teamA && !teamB) || (!teamA && teamB)) {
      const advancingTeamId = teamA ?? teamB;
      match.isBye = true;
      match.status = 'completed';
      match.winnerId = advancingTeamId;
      match.scoreA = teamA ? 1 : 0;
      match.scoreB = teamB ? 1 : 0;

      if (round2 && advancingTeamId) {
        const nextPos = Math.floor(pos / 2);
        const nextMatch = round2[nextPos];
        if (nextMatch) {
          if (pos % 2 === 0) {
            nextMatch.teamAId = advancingTeamId;
          } else {
            nextMatch.teamBId = advancingTeamId;
          }
        }
      }
    }
  }

  return matchesByRound.flat();
}

export function generateRoundRobinBracket(
  participants: BracketParticipant[],
  settings: BracketEngineSettings = {},
  idPrefix = 'rr',
): EngineMatch[] {
  if (participants.length < 2) {
    throw new Error('MINIMUM_2_TEAMS_REQUIRED');
  }

  const ordered = sortParticipantsBySeeding(
    participants,
    settings.seedingMode ?? 'rating',
  );
  const teamIds: Array<string | null> = ordered.map((p) => p.teamId);

  if (teamIds.length % 2 !== 0) {
    teamIds.push(null); // dummy slot for odd number of teams
  }

  const n = teamIds.length;
  const totalRounds = n - 1;
  const half = n / 2;
  const bestOf = settings.defaultBestOf ?? 1;

  const rotation = [...teamIds];
  const matches: EngineMatch[] = [];

  for (let round = 1; round <= totalRounds; round++) {
    let position = 0;
    for (let i = 0; i < half; i++) {
      const teamA = rotation[i] ?? null;
      const teamB = rotation[n - 1 - i] ?? null;

      if (teamA && teamB) {
        matches.push({
          id: `${idPrefix}_r${round}_p${position}`,
          round,
          position,
          stage: 'round_robin',
          teamAId: round % 2 === 1 ? teamA : teamB,
          teamBId: round % 2 === 1 ? teamB : teamA,
          scoreA: 0,
          scoreB: 0,
          status: 'scheduled',
          winnerId: null,
          nextMatchId: null,
          loserNextMatchId: null,
          bestOf,
          isBye: false,
        });
        position += 1;
      }
    }

    // Rotate all except index 0 (Circle Method)
    const last = rotation.pop()!;
    rotation.splice(1, 0, last);
  }

  return matches;
}

export function advanceMatchResult(
  matches: EngineMatch[],
  matchId: string,
  scoreA: number,
  scoreB: number,
): EngineMatch[] {
  if (scoreA < 0 || scoreB < 0 || !Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    throw new Error('INVALID_MATCH_SCORE');
  }
  if (scoreA === scoreB) {
    throw new Error('DRAW_NOT_ALLOWED');
  }

  const cloned: EngineMatch[] = matches.map((m) => ({ ...m }));
  const target = cloned.find((m) => m.id === matchId);

  if (!target) {
    throw new Error('MATCH_NOT_FOUND');
  }
  if (!target.teamAId || !target.teamBId) {
    throw new Error('MATCH_TEAMS_NOT_READY');
  }

  const winnerId = scoreA > scoreB ? target.teamAId : target.teamBId;
  target.scoreA = scoreA;
  target.scoreB = scoreB;
  target.winnerId = winnerId;
  target.status = 'completed';

  if (target.nextMatchId) {
    const nextMatch = cloned.find((m) => m.id === target.nextMatchId);
    if (nextMatch) {
      if (target.position % 2 === 0) {
        nextMatch.teamAId = winnerId;
      } else {
        nextMatch.teamBId = winnerId;
      }
    }
  }

  return cloned;
}

export function rollbackMatchResult(
  matches: EngineMatch[],
  matchId: string,
): EngineMatch[] {
  const cloned: EngineMatch[] = matches.map((m) => ({ ...m }));
  const target = cloned.find((m) => m.id === matchId);

  if (!target) {
    throw new Error('MATCH_NOT_FOUND');
  }
  if (target.isBye) {
    throw new Error('CANNOT_ROLLBACK_BYE_MATCH');
  }

  function clearDownstream(current: EngineMatch) {
    if (!current.nextMatchId) return;
    const nextMatch = cloned.find((m) => m.id === current.nextMatchId);
    if (!nextMatch) return;

    // If nextMatch was already completed, recursively clear its downstream first
    if (nextMatch.status === 'completed') {
      clearDownstream(nextMatch);
      nextMatch.status = 'scheduled';
      nextMatch.scoreA = 0;
      nextMatch.scoreB = 0;
      nextMatch.winnerId = null;
    }

    if (current.position % 2 === 0) {
      nextMatch.teamAId = null;
    } else {
      nextMatch.teamBId = null;
    }
  }

  clearDownstream(target);
  target.status = 'scheduled';
  target.scoreA = 0;
  target.scoreB = 0;
  target.winnerId = null;

  return cloned;
}

export function calculateRoundRobinStandings(
  teamIds: string[],
  matches: EngineMatch[],
  settings: BracketEngineSettings = {},
): RoundRobinStandingRow[] {
  const pointsPerWin = settings.pointsPerWin ?? 2;
  const pointsPerLoss = settings.pointsPerLoss ?? 0;
  const tieBreakOrder: TieBreakRule[] = settings.tieBreakOrder ?? [
    'head_to_head',
    'score_diff',
    'wins',
  ];

  const statsMap = new Map<string, Omit<RoundRobinStandingRow, 'placement'>>();
  for (const teamId of teamIds) {
    statsMap.set(teamId, {
      teamId,
      played: 0,
      wins: 0,
      losses: 0,
      points: 0,
      scoreFor: 0,
      scoreAgainst: 0,
      scoreDiff: 0,
    });
  }

  // Head-to-head net wins matrix: h2hWins.get(`${teamA}:${teamB}`)
  const h2hWins = new Map<string, number>();

  for (const m of matches) {
    if (m.status !== 'completed' || !m.teamAId || !m.teamBId || !m.winnerId) {
      continue;
    }

    const rowA = statsMap.get(m.teamAId);
    const rowB = statsMap.get(m.teamBId);
    if (!rowA || !rowB) continue;

    rowA.played += 1;
    rowB.played += 1;
    rowA.scoreFor += m.scoreA;
    rowA.scoreAgainst += m.scoreB;
    rowA.scoreDiff = rowA.scoreFor - rowA.scoreAgainst;

    rowB.scoreFor += m.scoreB;
    rowB.scoreAgainst += m.scoreA;
    rowB.scoreDiff = rowB.scoreFor - rowB.scoreAgainst;

    if (m.winnerId === m.teamAId) {
      rowA.wins += 1;
      rowA.points += pointsPerWin;
      rowB.losses += 1;
      rowB.points += pointsPerLoss;
      const key = `${m.teamAId}:${m.teamBId}`;
      h2hWins.set(key, (h2hWins.get(key) ?? 0) + 1);
    } else if (m.winnerId === m.teamBId) {
      rowB.wins += 1;
      rowB.points += pointsPerWin;
      rowA.losses += 1;
      rowA.points += pointsPerLoss;
      const key = `${m.teamBId}:${m.teamAId}`;
      h2hWins.set(key, (h2hWins.get(key) ?? 0) + 1);
    }
  }

  const rows = Array.from(statsMap.values());

  rows.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    for (const rule of tieBreakOrder) {
      if (rule === 'head_to_head') {
        const aBeatB = h2hWins.get(`${a.teamId}:${b.teamId}`) ?? 0;
        const bBeatA = h2hWins.get(`${b.teamId}:${a.teamId}`) ?? 0;
        if (aBeatB !== bBeatA) {
          return bBeatA - aBeatB;
        }
      } else if (rule === 'score_diff') {
        if (b.scoreDiff !== a.scoreDiff) {
          return b.scoreDiff - a.scoreDiff;
        }
        if (b.scoreFor !== a.scoreFor) {
          return b.scoreFor - a.scoreFor;
        }
      } else if (rule === 'wins') {
        if (b.wins !== a.wins) {
          return b.wins - a.wins;
        }
      }
    }

    return a.teamId.localeCompare(b.teamId);
  });

  return rows.map((r, index) => ({
    ...r,
    placement: index + 1,
  }));
}

export function extractTournamentPlacements(
  format: 'single_elimination' | 'round_robin',
  matches: EngineMatch[],
  teamIds: string[],
  settings: BracketEngineSettings = {},
): Array<{ teamId: string; placement: number; winsCount: number }> {
  const winsCounter = new Map<string, number>();
  for (const id of teamIds) winsCounter.set(id, 0);

  for (const m of matches) {
    if (m.status === 'completed' && !m.isBye && m.winnerId) {
      winsCounter.set(m.winnerId, (winsCounter.get(m.winnerId) ?? 0) + 1);
    }
  }

  if (format === 'round_robin') {
    const standings = calculateRoundRobinStandings(teamIds, matches, settings);
    return standings.map((s) => ({
      teamId: s.teamId,
      placement: s.placement,
      winsCount: s.wins,
    }));
  }

  // Single Elimination placement calculation
  const maxRound = Math.max(...matches.map((m) => m.round), 1);
  const finalMatch = matches.find((m) => m.round === maxRound);
  const placed = new Map<string, number>();

  if (finalMatch?.status === 'completed' && finalMatch.winnerId) {
    placed.set(finalMatch.winnerId, 1);
    const runnerUp =
      finalMatch.teamAId === finalMatch.winnerId
        ? finalMatch.teamBId
        : finalMatch.teamAId;
    if (runnerUp) placed.set(runnerUp, 2);
  }

  // Assign placements for losers of earlier rounds from top to bottom
  for (let r = maxRound - 1; r >= 1; r--) {
    const roundPlacement = Math.pow(2, maxRound - r) + 1;
    const roundMatches = matches.filter((m) => m.round === r && !m.isBye);
    for (const m of roundMatches) {
      if (m.status === 'completed' && m.winnerId) {
        const loser = m.teamAId === m.winnerId ? m.teamBId : m.teamAId;
        if (loser && !placed.has(loser)) {
          placed.set(loser, roundPlacement);
        }
      }
    }
  }

  return teamIds
    .map((teamId) => ({
      teamId,
      placement: placed.get(teamId) ?? teamIds.length,
      winsCount: winsCounter.get(teamId) ?? 0,
    }))
    .sort((a, b) => a.placement - b.placement);
}
