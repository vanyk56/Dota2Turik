// [Phase: MVP v1] Central Platform Configuration & Limits
export const PLATFORM_CONFIG = {
  appName: 'Dota turnir',
  roster: {
    maxMainPlayers: 5,
    maxSubstitutes: 2,
    get maxTotalMembers() {
      return this.maxMainPlayers + this.maxSubstitutes;
    },
    minMainPlayersForTournament: 5,
  },
  invites: {
    tokenBytes: 32, // produces 64-char hex token (>= 32 chars requirement)
    defaultExpiryDays: 7,
  },
  sessions: {
    cookieName: 'dota2_session_token',
    tokenBytes: 32,
    ttlDays: 30,
    slidingWindowRefreshThresholdDays: 25,
  },
  uploads: {
    maxSizeBytes: 2 * 1024 * 1024, // 2 MB
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'] as const,
  },
  dotaStats: {
    cacheTtlMs: 60 * 60 * 1000, // 1 hour
    manualSyncCooldownMs: 5 * 60 * 1000, // 5 minutes anti-spam cooldown
    openDotaBaseUrl: 'https://api.opendota.com/api',
    stratzGraphqlUrl: 'https://api.stratz.com/graphql', // [Phase: v2]
    requestTimeoutMs: 8000,
    maxRetries: 2,
  },
  polling: {
    bracketIntervalMs: 10000, // 10 seconds in MVP when tab is active
  },
  catalog: {
    defaultPageSize: 12,
    maxPageSize: 48,
  },
  regions: ['EU', 'RU', 'US', 'CN', 'ASIA', 'BR', 'INT'] as const,
  countries: [
    { code: 'RU', name: 'Russia', flag: '🇷🇺' },
    { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
    { code: 'BY', name: 'Belarus', flag: '🇧🇾' },
    { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿' },
    { code: 'DE', name: 'Germany', flag: '🇩🇪' },
    { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
    { code: 'PL', name: 'Poland', flag: '🇵🇱' },
    { code: 'US', name: 'United States', flag: '🇺🇸' },
    { code: 'PE', name: 'Peru', flag: '🇵🇪' },
    { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
    { code: 'CN', name: 'China', flag: '🇨🇳' },
    { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
    { code: 'INT', name: 'International', flag: '🌐' },
  ] as const,
  defaultRatingFormula: {
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
    } as Record<string, number>,
    levelWeight: {
      tier_s: 2.0,
      tier_a: 1.5,
      tier_b: 1.0,
      tier_c: 0.5,
    } as Record<string, number>,
    matchBonus: 15,
  },
} as const;

export type RegionCode = (typeof PLATFORM_CONFIG.regions)[number];

/**
 * Resolves public application URL with native Railway `RAILWAY_PUBLIC_DOMAIN` support.
 */
export function getAppBaseUrl(requestOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (
    configured &&
    !(process.env.NODE_ENV === 'production' && configured.includes('localhost'))
  ) {
    return configured;
  }

  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim().replace(
    /^https?:\/\//,
    '',
  );
  if (railwayDomain) {
    return `https://${railwayDomain.replace(/\/$/, '')}`;
  }

  if (requestOrigin) {
    return requestOrigin.replace(/\/$/, '');
  }

  return 'http://localhost:3000';
}

