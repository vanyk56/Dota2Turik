// [Phase: MVP v1] Steam Web API Profile Sync (Section 5)
export interface SteamProfileSummary {
  steamId64: string;
  nickname: string;
  avatarUrl: string | null;
  profileUrl: string;
  visibility: number;
}

export async function fetchSteamProfileSummary(
  steamId64: string,
  fetchFn: typeof fetch = fetch,
): Promise<SteamProfileSummary> {
  const defaultProfileUrl = `https://steamcommunity.com/profiles/${steamId64}`;
  const fallback: SteamProfileSummary = {
    steamId64,
    nickname: `Player_${steamId64.slice(-6)}`,
    avatarUrl: null,
    profileUrl: defaultProfileUrl,
    visibility: 3,
  };

  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey || apiKey === 'your_steam_web_api_key_here') {
    return fallback;
  }

  try {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${encodeURIComponent(
      apiKey,
    )}&steamids=${encodeURIComponent(steamId64)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const response = await fetchFn(url, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    if (!response.ok) {
      return fallback;
    }

    const data = (await response.json()) as {
      response?: {
        players?: Array<{
          steamid?: string;
          personaname?: string;
          avatarfull?: string;
          avatarmedium?: string;
          profileurl?: string;
          communityvisibilitystate?: number;
        }>;
      };
    };

    const player = data?.response?.players?.[0];
    if (!player) {
      return fallback;
    }

    return {
      steamId64,
      nickname: player.personaname?.trim() || fallback.nickname,
      avatarUrl: player.avatarfull || player.avatarmedium || null,
      profileUrl: player.profileurl || defaultProfileUrl,
      visibility:
        typeof player.communityvisibilitystate === 'number'
          ? player.communityvisibilitystate
          : 3,
    };
  } catch {
    return fallback;
  }
}
