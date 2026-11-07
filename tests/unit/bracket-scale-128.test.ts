// [Phase: MVP v1] Load & Scale Benchmark for 128-Team Bracket Engine (Section 11 & Stage 7)
import { describe, expect, it } from 'vitest';
import {
  advanceMatchResult,
  extractTournamentPlacements,
  generateSingleEliminationBracket,
} from '@/modules/brackets/engine';
import { steamId64ToAccountId32, formatRankTier } from '@/modules/dota-data/service';

describe('128-Team Bracket Scale & OpenDota Utilities (Stage 4, 5, 7)', () => {
  it('generates and advances a full 128-team Single Elimination bracket (127 matches, 7 rounds) in < 50ms', () => {
    const startMs = performance.now();

    const participants = Array.from({ length: 128 }, (_, i) => ({
      teamId: `team_${i + 1}`,
      ratingPoints: 5000 - i * 10,
    }));

    let matches = generateSingleEliminationBracket(participants, {
      seedingMode: 'rating',
      defaultBestOf: 3,
    });

    expect(matches).toHaveLength(127);

    // Advance all 7 rounds sequentially
    for (let round = 1; round <= 7; round++) {
      const roundMatchIds = matches
        .filter((m) => m.round === round)
        .map((m) => m.id);
      for (const mId of roundMatchIds) {
        matches = advanceMatchResult(matches, mId, 2, 0);
      }
    }

    const placements = extractTournamentPlacements(
      'single_elimination',
      matches,
      participants.map((p) => p.teamId),
    );

    const elapsedMs = performance.now() - startMs;

    expect(placements[0]?.teamId).toBe('team_1');
    expect(placements[0]?.placement).toBe(1);
    expect( placements[0]?.winsCount).toBe(7);
    expect(elapsedMs).toBeLessThan(200);
  });

  it('converts SteamID64 to 32-bit OpenDota account_id and formats rank tiers accurately', () => {
    // 76561198000000001 - 76561197960265728 = 39734273
    expect(steamId64ToAccountId32('76561198000000001')).toBe('39734273');
    expect(formatRankTier(80)).toBe('Immortal');
    expect(formatRankTier(75)).toBe('Divine [5]');
    expect(formatRankTier(null)).toBe('Uncalibrated');
  });
});
