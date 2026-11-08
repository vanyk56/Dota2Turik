// Platform owner (administrator) accounts. Only these SteamIDs can ever hold the `admin` role.
// Override with env `ADMIN_STEAM_IDS` (comma-separated SteamID64 list).
const DEFAULT_OWNER_STEAM_IDS = ['76561199870625489'];

export function getOwnerSteamIds(): string[] {
  const fromEnv = process.env.ADMIN_STEAM_IDS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_OWNER_STEAM_IDS;
}

export function isOwnerSteamId(steamId64: string): boolean {
  return getOwnerSteamIds().includes(steamId64);
}
