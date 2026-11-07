// [Phase: MVP v1] PURE TYPESCRIPT Platform Rating Formula Engine (Section 3 & Section 9)
// STRICT RULE: No imports from Next.js, Prisma, or React allowed in this module.

export interface RatingFormulaConfig {
  basePoints: Record<string, number>;
  levelWeight: Record<string, number>;
  matchBonus: number;
}

export interface TournamentPlacementInput {
  teamId: string;
  placement: number;
  winsCount: number;
}

export interface CalculatedRatingSnapshot {
  teamId: string;
  placement: number;
  points: number;
  formulaVersion: number;
}

export const DEFAULT_RATING_FORMULA_CONFIG: RatingFormulaConfig = {
  basePoints: {
    '1': 1000,
    '2': 650,
    '3': 400,
    '4': 250,
    '5': 150,
    '6': 150,
    '7': 100,
    '8': 100,
    '9': 50,
    '10': 50,
    '11': 50,
    '12': 50,
    '13': 25,
    '14': 25,
    '15': 25,
    '16': 25,
  },
  levelWeight: {
    tier_s: 2.0,
    tier_a: 1.5,
    tier_b: 1.0,
    tier_c: 0.5,
  },
  matchBonus: 15,
};

export function calculateTeamTournamentPoints(
  placement: number,
  winsCount: number,
  level: string,
  config: RatingFormulaConfig = DEFAULT_RATING_FORMULA_CONFIG,
): number {
  if (placement <= 0 || !Number.isFinite(placement)) {
    return 0;
  }

  const base = config.basePoints[String(placement)] ?? 0;
  const weight = config.levelWeight[level] ?? 1.0;
  const safeWins = Math.max(0, Math.floor(winsCount));
  const safeBonus = Math.max(0, config.matchBonus);

  return Math.max(0, Math.round(base * weight + safeWins * safeBonus));
}

export function calculateTournamentRatingSnapshots(params: {
  tournamentStatus: 'draft' | 'registration' | 'in_progress' | 'finished' | 'cancelled';
  levelWeight: string;
  formulaVersion: number;
  config: RatingFormulaConfig;
  placements: TournamentPlacementInput[];
}): CalculatedRatingSnapshot[] {
  // Section 9 & 10: Cancelled or unfinished or empty tournaments award 0 rating snapshots
  if (params.tournamentStatus !== 'finished' || params.placements.length === 0) {
    return [];
  }

  return params.placements.map((entry) => ({
    teamId: entry.teamId,
    placement: entry.placement,
    points: calculateTeamTournamentPoints(
      entry.placement,
      entry.winsCount,
      params.levelWeight,
      params.config,
    ),
    formulaVersion: params.formulaVersion,
  }));
}

export function aggregateTotalTeamRatings(
  snapshots: Array<{ teamId: string; points: number }>,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const s of snapshots) {
    totals.set(s.teamId, (totals.get(s.teamId) ?? 0) + s.points);
  }
  return totals;
}
