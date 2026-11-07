// [Phase: MVP v1] Unit Tests for Pure Bracket Engine & Rating Engine (Section 3, 9, 10, 16)
import { describe, expect, it } from 'vitest';
import {
  advanceMatchResult,
  calculateRoundRobinStandings,
  extractTournamentPlacements,
  generateRoundRobinBracket,
  generateSingleEliminationBracket,
  generateStandardSeedOrder,
  rollbackMatchResult,
} from '@/modules/brackets/engine';
import {
  aggregateTotalTeamRatings,
  calculateTeamTournamentPoints,
  calculateTournamentRatingSnapshots,
  DEFAULT_RATING_FORMULA_CONFIG,
} from '@/modules/ratings/engine';

describe('Pure Tournament Bracket Engine — Single Elimination', () => {
  it('generates canonical seed order for 8 teams so top seeds meet as late as possible', () => {
    const order = generateStandardSeedOrder(8);
    expect(order).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('generates 8-team power-of-two Single Elimination bracket and advances to champion', () => {
    const participants = Array.from({ length: 8 }, (_, idx) => ({
      teamId: `team_${idx + 1}`,
      ratingPoints: (8 - idx) * 100, // team_1 has highest rating (800)
    }));

    let matches = generateSingleEliminationBracket(participants, {
      seedingMode: 'rating',
      defaultBestOf: 3,
    });

    // 4 R1 + 2 R2 + 1 R3 = 7 matches
    expect(matches).toHaveLength(7);

    const r1 = matches.filter((m) => m.round === 1);
    expect(r1).toHaveLength(4);
    expect(r1.every((m) => !m.isBye)).toBe(true);

    // Match 0 has seed 1 (team_1) vs seed 8 (team_8)
    expect(r1[0]?.teamAId).toBe('team_1');
    expect(r1[0]?.teamBId).toBe('team_8');

    // Advance all Round 1 matches
    for (const m of r1) {
      matches = advanceMatchResult(matches, m.id, 2, 0);
    }

    const r2 = matches.filter((m) => m.round === 2);
    expect(r2[0]?.teamAId).toBe('team_1');
    expect(r2[0]?.teamBId).toBe('team_4');
    expect(r2[1]?.teamAId).toBe('team_2');
    expect(r2[1]?.teamBId).toBe('team_3');

    // Advance Semifinals
    matches = advanceMatchResult(matches, r2[0]!.id, 2, 1);
    matches = advanceMatchResult(matches, r2[1]!.id, 2, 0);

    const finalMatch = matches.find((m) => m.round === 3)!;
    expect(finalMatch.teamAId).toBe('team_1');
    expect(finalMatch.teamBId).toBe('team_2');

    // Final
    matches = advanceMatchResult(matches, finalMatch.id, 3, 2);

    const placements = extractTournamentPlacements(
      'single_elimination',
      matches,
      participants.map((p) => p.teamId),
    );

    expect(placements[0]).toEqual({
      teamId: 'team_1',
      placement: 1,
      winsCount: 3,
    });
    expect(placements[1]?.teamId).toBe('team_2');
    expect(placements[1]?.placement).toBe(2);
  });

  it('distributes byes to highest seeds when team count is not a power of two (6 teams)', () => {
    const participants = [
      { teamId: 'seed1', seed: 1 },
      { teamId: 'seed2', seed: 2 },
      { teamId: 'seed3', seed: 3 },
      { teamId: 'seed4', seed: 4 },
      { teamId: 'seed5', seed: 5 },
      { teamId: 'seed6', seed: 6 },
    ];

    const matches = generateSingleEliminationBracket(participants, {
      seedingMode: 'manual',
    });

    const r1 = matches.filter((m) => m.round === 1);
    const r2 = matches.filter((m) => m.round === 2);

    // 6 teams in 8-bracket -> 2 byes for seed1 and seed2
    const byeMatches = r1.filter((m) => m.isBye);
    expect(byeMatches).toHaveLength(2);
    expect(byeMatches.map((m) => m.winnerId).sort()).toEqual(['seed1', 'seed2']);

    // seed1 and seed2 are already placed in Round 2!
    expect(r2[0]?.teamAId).toBe('seed1');
    expect(r2[1]?.teamAId).toBe('seed2');
  });

  it('safely rolls back match progression including downstream matches', () => {
    const participants = [
      { teamId: 't1', ratingPoints: 400 },
      { teamId: 't2', ratingPoints: 300 },
      { teamId: 't3', ratingPoints: 200 },
      { teamId: 't4', ratingPoints: 100 },
    ];

    let matches = generateSingleEliminationBracket(participants);
    const semi1 = matches.find((m) => m.round === 1 && m.position === 0)!;
    const semi2 = matches.find((m) => m.round === 1 && m.position === 1)!;
    const final = matches.find((m) => m.round === 2)!;

    matches = advanceMatchResult(matches, semi1.id, 2, 0);
    matches = advanceMatchResult(matches, semi2.id, 2, 1);
    matches = advanceMatchResult(matches, final.id, 2, 0);

    // Rollback semi1 -> should reset semi1 AND reset final because final depended on semi1
    matches = rollbackMatchResult(matches, semi1.id);

    const updatedSemi1 = matches.find((m) => m.id === semi1.id)!;
    const updatedFinal = matches.find((m) => m.id === final.id)!;

    expect(updatedSemi1.status).toBe('scheduled');
    expect(updatedSemi1.winnerId).toBeNull();
    expect(updatedFinal.status).toBe('scheduled');
    expect(updatedFinal.winnerId).toBeNull();
    expect(updatedFinal.teamAId).toBeNull();
    expect(updatedFinal.teamBId).toBe('t2');
  });
});

describe('Pure Tournament Bracket Engine — Round Robin & Tie-Breaks', () => {
  it('generates Round Robin schedule and resolves ties by head-to-head then score_diff', () => {
    const participants = [
      { teamId: 'alpha' },
      { teamId: 'beta' },
      { teamId: 'gamma' },
      { teamId: 'delta' },
    ];

    let matches = generateRoundRobinBracket(participants);
    // 4 teams -> 6 matches across 3 rounds
    expect(matches).toHaveLength(6);

    // Play matches so alpha and beta both have 2 wins, 1 loss (4 points),
    // but beta beat alpha head-to-head!
    for (const m of matches) {
      const pair = [m.teamAId, m.teamBId];
      if (pair.includes('alpha') && pair.includes('beta')) {
        // beta beats alpha 2-1
        const scoreA = m.teamAId === 'beta' ? 2 : 1;
        const scoreB = m.teamBId === 'beta' ? 2 : 1;
        matches = advanceMatchResult(matches, m.id, scoreA, scoreB);
      } else if (pair.includes('alpha')) {
        // alpha beats gamma and delta 2-0
        const scoreA = m.teamAId === 'alpha' ? 2 : 0;
        const scoreB = m.teamBId === 'alpha' ? 2 : 0;
        matches = advanceMatchResult(matches, m.id, scoreA, scoreB);
      } else if (pair.includes('beta') && pair.includes('gamma')) {
        // beta beats gamma 2-0
        const scoreA = m.teamAId === 'beta' ? 2 : 0;
        const scoreB = m.teamBId === 'beta' ? 2 : 0;
        matches = advanceMatchResult(matches, m.id, scoreA, scoreB);
      } else if (pair.includes('beta') && pair.includes('delta')) {
        // delta upsets beta 2-1
        const scoreA = m.teamAId === 'delta' ? 2 : 1;
        const scoreB = m.teamBId === 'delta' ? 2 : 1;
        matches = advanceMatchResult(matches, m.id, scoreA, scoreB);
      } else {
        // gamma beats delta 2-0
        const scoreA = m.teamAId === 'gamma' ? 2 : 0;
        const scoreB = m.teamBId === 'gamma' ? 2 : 0;
        matches = advanceMatchResult(matches, m.id, scoreA, scoreB);
      }
    }

    // By default tieBreakOrder ['head_to_head', 'score_diff']:
    // Both beta and alpha have 4 points, but beta beat alpha in H2H -> beta is #1!
    const standingsH2H = calculateRoundRobinStandings(
      ['alpha', 'beta', 'gamma', 'delta'],
      matches,
      { tieBreakOrder: ['head_to_head', 'score_diff'] },
    );
    expect(standingsH2H[0]?.teamId).toBe('beta');
    expect(standingsH2H[1]?.teamId).toBe('alpha');

    // If tieBreakOrder is ['score_diff', 'head_to_head']:
    // alpha has scoreDiff (5 - 2 = +3), beta has (5 - 3 = +2) -> alpha is #1!
    const standingsScoreDiff = calculateRoundRobinStandings(
      ['alpha', 'beta', 'gamma', 'delta'],
      matches,
      { tieBreakOrder: ['score_diff', 'head_to_head'] },
    );
    expect(standingsScoreDiff[0]?.teamId).toBe('alpha');
    expect(standingsScoreDiff[1]?.teamId).toBe('beta');
  });
});

describe('Pure Platform Rating Engine (Section 9 & 16)', () => {
  it('calculates points with levelWeight and matchBonus for boundary placements', () => {
    // 1st place in tier_s (weight 2.0) with 4 match wins (4 * 15 = 60): 1000 * 2.0 + 60 = 2060
    const pts1 = calculateTeamTournamentPoints(
      1,
      4,
      'tier_s',
      DEFAULT_RATING_FORMULA_CONFIG,
    );
    expect(pts1).toBe(2060);

    // 16th place in tier_c (weight 0.5) with 0 wins: 25 * 0.5 + 0 = 13
    const pts16 = calculateTeamTournamentPoints(
      16,
      0,
      'tier_c',
      DEFAULT_RATING_FORMULA_CONFIG,
    );
    expect(pts16).toBe(13);

    // 32nd place (outside basePoints table) with 1 win: 0 + 15 = 15
    const pts32 = calculateTeamTournamentPoints(
      32,
      1,
      'tier_b',
      DEFAULT_RATING_FORMULA_CONFIG,
    );
    expect(pts32).toBe(15);
  });

  it('returns empty snapshots for cancelled or empty tournaments', () => {
    const cancelled = calculateTournamentRatingSnapshots({
      tournamentStatus: 'cancelled',
      levelWeight: 'tier_a',
      formulaVersion: 1,
      config: DEFAULT_RATING_FORMULA_CONFIG,
      placements: [{ teamId: 't1', placement: 1, winsCount: 3 }],
    });
    expect(cancelled).toEqual([]);

    const empty = calculateTournamentRatingSnapshots({
      tournamentStatus: 'finished',
      levelWeight: 'tier_a',
      formulaVersion: 1,
      config: DEFAULT_RATING_FORMULA_CONFIG,
      placements: [],
    });
    expect(empty).toEqual([]);
  });

  it('aggregates rating snapshots across multiple tournaments', () => {
    const totals = aggregateTotalTeamRatings([
      { teamId: 't1', points: 1000 },
      { teamId: 't2', points: 650 },
      { teamId: 't1', points: 450 },
    ]);
    expect(totals.get('t1')).toBe(1450);
    expect(totals.get('t2')).toBe(650);
  });
});
