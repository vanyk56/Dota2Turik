// [Phase: MVP v1] OpenDota & STRATZ External API Client + Cache Service (Section 3 & Section 6)
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { PLATFORM_CONFIG } from '@/lib/config';
import { checkRateLimit } from '@/server/rate-limit';

const STEAM64_BASE = BigInt('76561197960265728');

export function steamId64ToAccountId32(steamId64: string): string {
  const id64 = BigInt(steamId64);
  if (id64 <= STEAM64_BASE) {
    throw new Error('INVALID_STEAMID64');
  }
  return (id64 - STEAM64_BASE).toString();
}

export interface DotaHeroStat {
  heroId: number;
  games: number;
  win: number;
  winrate: number;
}

export interface DotaPlayerStatsPayload {
  accountId32: string;
  wins: number;
  losses: number;
  totalMatches: number;
  winrate: number;
  rankTier: number | null;
  leaderboardRank: number | null;
  estimatedMmr: number | null;
  topHeroes: DotaHeroStat[];
}

export interface DotaStatsView {
  steamId64: string;
  source: 'opendota' | 'stratz';
  status: 'ok' | 'private' | 'error' | 'pending';
  syncedAt: Date | null;
  expiresAt: Date | null;
  isStaleCache: boolean;
  data: DotaPlayerStatsPayload | null;
  errorMessage?: string;
}

// Static Hero ID -> Name mapping for top Dota 2 heroes
export const DOTA_HERO_NAMES: Record<number, string> = {
  1: 'Anti-Mage',
  2: 'Axe',
  5: 'Crystal Maiden',
  7: 'Earthshaker',
  8: 'Juggernaut',
  9: 'Mirana',
  10: 'Morphling',
  11: 'Shadow Fiend',
  14: 'Pudge',
  17: 'Storm Spirit',
  18: 'Sven',
  19: 'Tiny',
  22: 'Zeus',
  23: 'Kunkka',
  25: 'Lina',
  26: 'Lion',
  27: 'Shadow Shaman',
  35: 'Sniper',
  39: 'Queen of Pain',
  41: 'Faceless Void',
  44: 'Phantom Assassin',
  46: 'Templar Assassin',
  53: 'Nature’s Prophet',
  54: 'Lifestealer',
  63: 'Weaver',
  70: 'Ursa',
  74: 'Invoker',
  86: 'Rubick',
  93: 'Slark',
  104: 'Legion Commander',
  106: 'Ember Spirit',
  114: 'Monkey King',
  120: 'Pangolier',
  126: 'Void Spirit',
  136: 'Marci',
  137: 'Primal Beast',
  138: 'Muerta',
};

export function getHeroName(heroId: number): string {
  return DOTA_HERO_NAMES[heroId] ?? `Hero #${heroId}`;
}

export function formatRankTier(rankTier: number | null | undefined): string {
  if (!rankTier || rankTier < 10) return 'Uncalibrated';
  const medals: Record<number, string> = {
    1: 'Herald',
    2: 'Guardian',
    3: 'Crusader',
    4: 'Archon',
    5: 'Legend',
    6: 'Ancient',
    7: 'Divine',
    8: 'Immortal',
  };
  const tier = Math.floor(rankTier / 10);
  const stars = rankTier % 10;
  const medal = medals[tier] ?? 'Uncalibrated';
  if (tier === 8) return 'Immortal';
  return stars > 0 ? `${medal} [${stars}]` : medal;
}

async function fetchWithRetryAndTimeout<T>(
  url: string,
  options: RequestInit = {},
  retries = PLATFORM_CONFIG.dotaStats.maxRetries,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      PLATFORM_CONFIG.dotaStats.requestTimeoutMs,
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(options.headers ?? {}),
        },
        cache: 'no-store',
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export async function getCachedDotaStats(steamId64: string): Promise<DotaStatsView> {
  try {
    const cached = await db.dotaStatsCache.findUnique({
      where: {
        steamId64_source: {
          steamId64,
          source: 'opendota',
        },
      },
    });

    if (!cached) {
      return {
        steamId64,
        source: 'opendota',
        status: 'pending',
        syncedAt: null,
        expiresAt: null,
        isStaleCache: false,
        data: null,
      };
    }

    const isExpired = cached.expiresAt <= new Date();
    const payload = cached.payload as unknown as DotaPlayerStatsPayload | null;

    return {
      steamId64,
      source: 'opendota',
      status: cached.status,
      syncedAt: cached.syncedAt,
      expiresAt: cached.expiresAt,
      isStaleCache: isExpired,
      data: payload && typeof payload.totalMatches === 'number' ? payload : null,
    };
  } catch {
    return {
      steamId64,
      source: 'opendota',
      status: 'pending',
      syncedAt: null,
      expiresAt: null,
      isStaleCache: false,
      data: null,
    };
  }
}

export async function syncOpenDotaStats(
  steamId64: string,
  forceManual = false,
): Promise<DotaStatsView> {
  const existing = await db.dotaStatsCache
    .findUnique({
      where: {
        steamId64_source: {
          steamId64,
          source: 'opendota',
        },
      },
    })
    .catch(() => null);

  const now = new Date();

  // Check manual anti-spam cooldown (Section 6: "Обновление по кнопке с защитой от спама")
  if (forceManual && existing) {
    const elapsedMs = now.getTime() - existing.syncedAt.getTime();
    if (elapsedMs < PLATFORM_CONFIG.dotaStats.manualSyncCooldownMs) {
      const waitSeconds = Math.ceil(
        (PLATFORM_CONFIG.dotaStats.manualSyncCooldownMs - elapsedMs) / 1000,
      );
      const cachedPayload = existing.payload as unknown as DotaPlayerStatsPayload | null;
      return {
        steamId64,
        source: 'opendota',
        status: existing.status,
        syncedAt: existing.syncedAt,
        expiresAt: existing.expiresAt,
        isStaleCache: false,
        data: cachedPayload && typeof cachedPayload.totalMatches === 'number' ? cachedPayload : null,
        errorMessage: `SYNC_COOLDOWN_${waitSeconds}S`,
      };
    }
  }

  // If not forced and cache is still fresh, return cache
  if (!forceManual && existing && existing.expiresAt > now && existing.status === 'ok') {
    return {
      steamId64,
      source: 'opendota',
      status: existing.status,
      syncedAt: existing.syncedAt,
      expiresAt: existing.expiresAt,
      isStaleCache: false,
      data: existing.payload as unknown as DotaPlayerStatsPayload,
    };
  }

  const rate = await checkRateLimit({
    key: `opendota_sync:${steamId64}`,
    limit: 10,
    windowSeconds: 300,
  });

  if (!rate.allowed) {
    return getCachedDotaStats(steamId64);
  }

  try {
    const accountId32 = steamId64ToAccountId32(steamId64);
    const baseUrl = PLATFORM_CONFIG.dotaStats.openDotaBaseUrl;

    const [playerRes, wlRes, heroesRes] = await Promise.all([
      fetchWithRetryAndTimeout<{
        profile?: { account_id?: number; personaname?: string };
        rank_tier?: number | null;
        leaderboard_rank?: number | null;
        mmr_estimate?: { estimate?: number | null };
      }>(`${baseUrl}/players/${accountId32}`),
      fetchWithRetryAndTimeout<{ win?: number; lose?: number }>(
        `${baseUrl}/players/${accountId32}/wl`,
      ),
      fetchWithRetryAndTimeout<
        Array<{ hero_id: string | number; games: number; win: number }>
      >(`${baseUrl}/players/${accountId32}/heroes`),
    ]);

    const wins = Number(wlRes?.win ?? 0);
    const losses = Number(wlRes?.lose ?? 0);
    const totalMatches = wins + losses;

    // Detect private / unexposed match data (Section 6: "Приватные профили... отдельный статус private")
    if (!playerRes?.profile || totalMatches === 0) {
      const expiresAt = new Date(now.getTime() + PLATFORM_CONFIG.dotaStats.cacheTtlMs);
      await db.dotaStatsCache.upsert({
        where: { steamId64_source: { steamId64, source: 'opendota' } },
        update: {
          status: 'private',
          payload: Prisma.JsonNull,
          syncedAt: now,
          expiresAt,
        },
        create: {
          steamId64,
          source: 'opendota',
          status: 'private',
          payload: Prisma.JsonNull,
          syncedAt: now,
          expiresAt,
        },
      });

      return {
        steamId64,
        source: 'opendota',
        status: 'private',
        syncedAt: now,
        expiresAt,
        isStaleCache: false,
        data: null,
      };
    }

    const winrate =
      totalMatches > 0 ? Math.round((wins / totalMatches) * 1000) / 10 : 0;

    const topHeroes: DotaHeroStat[] = (heroesRes ?? [])
      .filter((h) => Number(h.games) > 0)
      .sort((a, b) => Number(b.games) - Number(a.games))
      .slice(0, 5)
      .map((h) => {
        const games = Number(h.games);
        const win = Number(h.win);
        return {
          heroId: Number(h.hero_id),
          games,
          win,
          winrate: games > 0 ? Math.round((win / games) * 1000) / 10 : 0,
        };
      });

    const payload: DotaPlayerStatsPayload = {
      accountId32,
      wins,
      losses,
      totalMatches,
      winrate,
      rankTier: playerRes.rank_tier ?? null,
      leaderboardRank: playerRes.leaderboard_rank ?? null,
      estimatedMmr: playerRes.mmr_estimate?.estimate ?? null,
      topHeroes,
    };

    const expiresAt = new Date(now.getTime() + PLATFORM_CONFIG.dotaStats.cacheTtlMs);

    await db.dotaStatsCache.upsert({
      where: { steamId64_source: { steamId64, source: 'opendota' } },
      update: {
        status: 'ok',
        payload: payload as unknown as Prisma.InputJsonValue,
        syncedAt: now,
        expiresAt,
      },
      create: {
        steamId64,
        source: 'opendota',
        status: 'ok',
        payload: payload as unknown as Prisma.InputJsonValue,
        syncedAt: now,
        expiresAt,
      },
    });

    return {
      steamId64,
      source: 'opendota',
      status: 'ok',
      syncedAt: now,
      expiresAt,
      isStaleCache: false,
      data: payload,
    };
  } catch {
    // Section 6: "При недоступности внешнего API показывать последний кэш с пометкой о возрасте данных."
    const previousPayload = existing?.payload as unknown as DotaPlayerStatsPayload | null;
    const hasPreviousData = Boolean(
      previousPayload && typeof previousPayload.totalMatches === 'number',
    );

    if (existing) {
      await db.dotaStatsCache
        .update({
          where: { id: existing.id },
          data: { status: 'error' },
        })
        .catch(() => null);
    }

    return {
      steamId64,
      source: 'opendota',
      status: 'error',
      syncedAt: existing?.syncedAt ?? null,
      expiresAt: existing?.expiresAt ?? null,
      isStaleCache: hasPreviousData,
      data: hasPreviousData ? previousPayload : null,
      errorMessage: 'OPENDOTA_UNAVAILABLE',
    };
  }
}

// [Phase: v2] STRATZ GraphQL Client Stub (Requires STRATZ_TOKEN)
export async function syncStratzStats(steamId64: string): Promise<DotaStatsView> {
  const token = process.env.STRATZ_TOKEN;
  if (!token) {
    return {
      steamId64,
      source: 'stratz',
      status: 'error',
      syncedAt: null,
      expiresAt: null,
      isStaleCache: false,
      data: null,
      errorMessage: 'STRATZ_TOKEN_NOT_CONFIGURED',
    };
  }
  return getCachedDotaStats(steamId64);
}
