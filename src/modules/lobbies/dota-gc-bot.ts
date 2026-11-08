// [Phase: v3 / Custom Lobby Bot] Real Steam & Dota 2 Game Coordinator (AppID 570) Lobby Bot
// Features:
// 1. Moves bot out of Radiant Slot 1 into Unassigned (DOTA_GC_TEAM_PLAYER_POOL = 4) via 7047
// 2. Detects when a human player enters the Dota 2 lobby (via GC SharedObject update) and automatically
//    leaves the lobby (7040), transferring Lobby Leader to the player and freeing the bot for new lobbies!
import SteamUser from 'steam-user';
import { db } from '@/lib/db';

const DOTA2_APP_ID = 570;

// Dota 2 Game Coordinator Message IDs (from Valve Protobufs)
const k_ESOMsg_Update = 22;
const k_ESOMsg_CacheSubscribed = 24;
const k_ESOMsg_UpdateMultiple = 26;
const k_EMsgGCClientHello = 4006;
const k_EMsgGCClientWelcome = 4004;
const k_EMsgGCInviteToLobby = 4512;
const k_EMsgGCAbandonCurrentGame = 7035;
const k_EMsgGCPracticeLobbyCreate = 7038;
const k_EMsgGCPracticeLobbyLeave = 7040;
const k_EMsgGCPracticeLobbyLaunch = 7041;
const k_EMsgGCPracticeLobbySetTeamSlot = 7047;

// DOTA_GC_TEAM enum values
const DOTA_GC_TEAM_PLAYER_POOL = 4; // «НЕОПРЕДЕЛИВШИЕСЯ» (Unassigned pool)

// Minimal Pure-TS Protobuf Wire Format Encoder for Dota 2 GC Messages
function encodeVarint(value: number | bigint): Buffer {
  let v = BigInt(value);
  const bytes: number[] = [];
  while (v >= 0x80n) {
    bytes.push(Number((v & 0x7fn) | 0x80n));
    v >>= 7n;
  }
  bytes.push(Number(v));
  return Buffer.from(bytes);
}

function encodeTag(fieldNumber: number, wireType: 0 | 1 | 2): Buffer {
  return encodeVarint((fieldNumber << 3) | wireType);
}

function encodeVarintField(fieldNumber: number, value: number | bigint): Buffer {
  return Buffer.concat([encodeTag(fieldNumber, 0), encodeVarint(value)]);
}

function encodeFixed64Field(fieldNumber: number, value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value, 0);
  return Buffer.concat([encodeTag(fieldNumber, 1), buf]);
}

function encodeBytesField(fieldNumber: number, bytes: Buffer): Buffer {
  return Buffer.concat([
    encodeTag(fieldNumber, 2),
    encodeVarint(bytes.length),
    bytes,
  ]);
}

function encodeStringField(fieldNumber: number, str: string): Buffer {
  return encodeBytesField(fieldNumber, Buffer.from(str, 'utf8'));
}

function encodeClientHello(): Buffer {
  return Buffer.concat([
    encodeVarintField(3, 1), // client_session_need = 1
    encodeVarintField(7, 1), // engine = k_ESE_Source2 (1)
  ]);
}

/**
 * Encodes `CMsgPracticeLobbySetTeamSlot` (7047) to move the bot out of Radiant Slot 1
 * into `DOTA_GC_TEAM_PLAYER_POOL` (4 = Неопределившиеся)
 */
function encodePracticeLobbySetTeamSlot(
  team: number = DOTA_GC_TEAM_PLAYER_POOL,
  slot = 0,
): Buffer {
  return Buffer.concat([
    encodeVarintField(1, team), // team = 1
    encodeVarintField(2, slot), // slot = 2
  ]);
}

function mapGameModeToDotaEnum(gameMode: string): number {
  switch (gameMode) {
    case 'all_pick':
      return 1; // DOTA_GAMEMODE_AP
    case 'captains_mode':
      return 2; // DOTA_GAMEMODE_CM
    case 'random_draft':
      return 3; // DOTA_GAMEMODE_RD
    case 'mid_only':
      return 21; // DOTA_GAMEMODE_1V1MID
    case 'turbo':
      return 23; // DOTA_GAMEMODE_TURBO
    default:
      return 1;
  }
}

function mapServerRegionToDotaId(serverLocation: string, region: string): number {
  const loc = serverLocation.toLowerCase();
  if (loc.includes('stockholm')) return 8; // Stockholm
  if (loc.includes('luxembourg')) return 3; // Europe West
  if (loc.includes('frankfurt') || loc.includes('vienna') || loc.includes('warsaw')) {
    return 9; // Europe East
  }
  if (loc.includes('us east')) return 2; // US East
  if (loc.includes('singapore') || loc.includes('asia')) return 5; // SE Asia
  if (region === 'US') return 2;
  if (region === 'ASIA' || region === 'CN') return 5;
  if (region === 'BR') return 10;
  return 8; // Default Stockholm
}

function encodePracticeLobbyCreate(opts: {
  gameName: string;
  passKey: string;
  gameMode: string;
  serverLocation: string;
  region: string;
}): Buffer {
  const serverRegionId = mapServerRegionToDotaId(opts.serverLocation, opts.region);
  const dotaGameMode = mapGameModeToDotaEnum(opts.gameMode);

  const detailsParts: Buffer[] = [
    encodeStringField(2, opts.gameName), // game_name = 2
    encodeVarintField(4, serverRegionId), // server_region = 4
    encodeVarintField(5, dotaGameMode), // game_mode = 5
    encodeVarintField(6, 0), // cm_pick = DOTA_CM_RANDOM (0)
    encodeVarintField(10, 0), // allow_cheats = false (10)
    encodeVarintField(11, 0), // fill_with_bots = false (11)
    encodeVarintField(13, 1), // allow_spectating = true (13)
    encodeStringField(15, opts.passKey), // pass_key = 15
    encodeVarintField(23, 1), // allchat = true (23)
    encodeVarintField(24, 0), // dota_tv_delay = 0 (24)
    encodeVarintField(33, 0), // visibility = DOTALobbyVisibility_Public (33)
  ];
  const lobbyDetailsBuf = Buffer.concat(detailsParts);

  return Buffer.concat([
    encodeStringField(1, ''), // search_key = 1
    encodeStringField(5, opts.passKey), // pass_key = 5
    encodeVarintField(6, 0), // client_version = 6
    encodeBytesField(7, lobbyDetailsBuf), // lobby_details = 7
  ]);
}

function encodeInviteToLobby(steamId64: string): Buffer {
  return encodeFixed64Field(1, BigInt(steamId64));
}

function steamId64ToFixed64Buffer(steamId64: string): Buffer | null {
  if (!/^\d{17}$/.test(steamId64)) return null;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(steamId64), 0);
  return buf;
}

export interface DotaBotRuntimeState {
  client: SteamUser | null;
  status:
    | 'disconnected'
    | 'connecting'
    | 'awaiting_steam_guard'
    | 'connected_steam'
    | 'ready_gc'
    | 'error';
  accountName: string | null;
  guardDomain: string | null;
  lastError: string | null;
  activeLobbyId: string | null;
  watchedPlayerBuffers: Buffer[];
  autoHandoffTriggered: boolean;
  steamGuardCallback: ((code: string) => void) | null;
  gcHelloInterval: ReturnType<typeof setInterval> | null;
  autoInitAttempted: boolean;
}

const globalForBot = globalThis as unknown as {
  dotaBotState?: DotaBotRuntimeState;
};

function getRuntime(): DotaBotRuntimeState {
  if (!globalForBot.dotaBotState) {
    globalForBot.dotaBotState = {
      client: null,
      status: 'disconnected',
      accountName: null,
      guardDomain: null,
      lastError: null,
      activeLobbyId: null,
      watchedPlayerBuffers: [],
      autoHandoffTriggered: false,
      steamGuardCallback: null,
      gcHelloInterval: null,
      autoInitAttempted: false,
    };
  }
  return globalForBot.dotaBotState;
}

async function persistBotState(patch: {
  accountName?: string | null;
  password?: string | null;
  refreshToken?: string | null;
  status?: string;
  guardDomain?: string | null;
  lastError?: string | null;
  activeLobbyId?: string | null;
}) {
  try {
    await db.steamBotConfig.upsert({
      where: { id: 'singleton' },
      update: patch,
      create: {
        id: 'singleton',
        ...patch,
      },
    });
  } catch {
    // Ignore DB errors during early boot
  }
}

function clearGcHelloLoop(rt: DotaBotRuntimeState) {
  if (rt.gcHelloInterval) {
    clearInterval(rt.gcHelloInterval);
    rt.gcHelloInterval = null;
  }
}

export async function getDotaBotStatus() {
  const rt = getRuntime();

  if (!rt.autoInitAttempted && rt.status === 'disconnected') {
    rt.autoInitAttempted = true;
    const saved = await db.steamBotConfig
      .findUnique({ where: { id: 'singleton' } })
      .catch(() => null);

    const envUser = process.env.STEAM_BOT_USER?.trim();
    const envPass = process.env.STEAM_BOT_PASS?.trim();

    if (saved?.refreshToken && saved.accountName) {
      void startBotConnection({
        accountName: saved.accountName,
        refreshToken: saved.refreshToken,
      });
    } else if (saved?.accountName && saved?.password) {
      void startBotConnection({
        accountName: saved.accountName,
        password: saved.password,
      });
    } else if (envUser && envPass) {
      void startBotConnection({
        accountName: envUser,
        password: envPass,
      });
    }
  }

  return {
    status: rt.status,
    accountName: rt.accountName,
    guardDomain: rt.guardDomain,
    lastError: rt.lastError,
    activeLobbyId: rt.activeLobbyId,
    isReady: rt.status === 'ready_gc',
    awaitingSteamGuard: rt.status === 'awaiting_steam_guard',
  };
}

export async function startBotConnection(opts: {
  accountName: string;
  password?: string;
  refreshToken?: string;
}) {
  const rt = getRuntime();
  clearGcHelloLoop(rt);

  if (rt.client) {
    try {
      rt.client.logOff();
      rt.client.removeAllListeners();
    } catch {
      // Ignore cleanup error
    }
    rt.client = null;
  }

  rt.accountName = opts.accountName.trim();
  rt.status = 'connecting';
  rt.lastError = null;
  rt.guardDomain = null;
  rt.steamGuardCallback = null;

  await persistBotState({
    accountName: rt.accountName,
    ...(opts.password ? { password: opts.password } : {}),
    status: 'connecting',
    lastError: null,
    guardDomain: null,
  });

  const client = new SteamUser({
    autoRelogin: true,
    renewRefreshTokens: true,
  });
  rt.client = client;

  client.on('steamGuard', (domain: string | null, callback: (code: string) => void) => {
    rt.status = 'awaiting_steam_guard';
    rt.guardDomain = domain ? `почту @${domain}` : 'мобильное приложение Steam Guard';
    rt.steamGuardCallback = callback;
    void persistBotState({
      status: 'awaiting_steam_guard',
      guardDomain: rt.guardDomain,
    });
  });

  client.on('refreshToken', (token: string) => {
    void persistBotState({ refreshToken: token });
  });

  client.on('loggedOn', () => {
    rt.status = 'connected_steam';
    rt.guardDomain = null;
    rt.steamGuardCallback = null;
    rt.lastError = null;
    void persistBotState({
      status: 'connected_steam',
      guardDomain: null,
      lastError: null,
    });

    client.setPersona(SteamUser.EPersonaState.Online);
    client.gamesPlayed([DOTA2_APP_ID]);

    clearGcHelloLoop(rt);
    const sendHello = () => {
      if (!rt.client || rt.status === 'ready_gc') {
        clearGcHelloLoop(rt);
        return;
      }
      try {
        rt.client.sendToGC(
          DOTA2_APP_ID,
          k_EMsgGCClientHello,
          {},
          encodeClientHello(),
        );
      } catch {
        // Retry on next tick
      }
    };

    setTimeout(sendHello, 1500);
    rt.gcHelloInterval = setInterval(sendHello, 4000);
  });

  client.on('receivedFromGC', (appid: number, msgType: number, payload: Buffer) => {
    if (appid !== DOTA2_APP_ID) return;

    if (msgType === k_EMsgGCClientWelcome) {
      clearGcHelloLoop(rt);
      rt.status = 'ready_gc';
      rt.lastError = null;
      void persistBotState({ status: 'ready_gc', lastError: null });
      return;
    }

    // Detect when any invited human player joins the Dota 2 Lobby via GC SharedObject update!
    // Once a human player is inside the lobby, the bot automatically leaves the lobby after 2.5s:
    // 1. Valve automatically transfers "Лидер лобби" to that human player!
    // 2. The bot disappears from the lobby slots completely!
    // 3. The single bot is immediately free to create the next lobby (2nd, 3rd, 10th lobby)!
    if (
      (msgType === k_ESOMsg_Update ||
        msgType === k_ESOMsg_CacheSubscribed ||
        msgType === k_ESOMsg_UpdateMultiple) &&
      rt.activeLobbyId &&
      !rt.autoHandoffTriggered &&
      rt.watchedPlayerBuffers.length > 0 &&
      Buffer.isBuffer(payload)
    ) {
      const humanJoined = rt.watchedPlayerBuffers.some((playerBuf) =>
        payload.includes(playerBuf),
      );
      if (humanJoined) {
        rt.autoHandoffTriggered = true;
        setTimeout(() => {
          botLeaveLobbyAndRelease();
        }, 2500);
      }
    }
  });

  client.on('error', (err: Error) => {
    clearGcHelloLoop(rt);
    rt.status = 'error';
    rt.lastError = err.message || 'Ошибка входа в Steam';
    void persistBotState({
      status: 'error',
      lastError: rt.lastError,
    });
  });

  client.on('disconnected', () => {
    clearGcHelloLoop(rt);
    if (rt.status !== 'error' && rt.status !== 'awaiting_steam_guard') {
      rt.status = 'disconnected';
    }
  });

  if (opts.refreshToken) {
    client.logOn({ refreshToken: opts.refreshToken });
  } else if (opts.password) {
    client.logOn({
      accountName: rt.accountName,
      password: opts.password,
    });
  }
}

export async function submitBotSteamGuardCode(code: string): Promise<boolean> {
  const rt = getRuntime();
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode || !rt.steamGuardCallback) {
    return false;
  }

  const cb = rt.steamGuardCallback;
  rt.steamGuardCallback = null;
  rt.status = 'connecting';
  await persistBotState({ status: 'connecting', guardDomain: null });
  cb(cleanCode);
  return true;
}

export async function disconnectDotaBot() {
  const rt = getRuntime();
  clearGcHelloLoop(rt);
  if (rt.client) {
    try {
      rt.client.logOff();
      rt.client.removeAllListeners();
    } catch {
      // Ignore
    }
    rt.client = null;
  }
  rt.status = 'disconnected';
  rt.accountName = null;
  rt.guardDomain = null;
  rt.lastError = null;
  rt.activeLobbyId = null;
  rt.watchedPlayerBuffers = [];
  rt.autoHandoffTriggered = false;
  await persistBotState({
    accountName: null,
    password: null,
    refreshToken: null,
    status: 'disconnected',
    guardDomain: null,
    lastError: null,
    activeLobbyId: null,
  });
}

/**
 * Leaves the current Dota 2 practice lobby (`7040`).
 * If at least 1 human player is inside the lobby, Dota 2 keeps the lobby alive,
 * promotes the human player to "Лидер лобби", and frees the bot to create new lobbies!
 */
export function botLeaveLobbyAndRelease(): boolean {
  const rt = getRuntime();
  if (!rt.client || rt.status !== 'ready_gc') {
    return false;
  }

  try {
    rt.client.sendToGC(
      DOTA2_APP_ID,
      k_EMsgGCPracticeLobbyLeave,
      {},
      Buffer.alloc(0),
    );
    rt.activeLobbyId = null;
    rt.watchedPlayerBuffers = [];
    rt.autoHandoffTriggered = false;
    void persistBotState({ activeLobbyId: null });
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a real practice lobby inside Dota 2 Game Coordinator, immediately moves the bot
 * out of Radiant Slot 1 into Unassigned («НЕОПРЕДЕЛИВШИЕСЯ»), invites all participants,
 * and watches for the host/players to join so it can hand over leadership and free itself!
 */
export async function botCreateDotaLobbyAndInvite(opts: {
  lobbyId: string;
  gameName: string;
  passKey: string;
  gameMode: string;
  serverLocation: string;
  region: string;
  steamIds64: string[];
}): Promise<{ ok: boolean; reason?: string }> {
  const rt = getRuntime();
  if (!rt.client || rt.status !== 'ready_gc') {
    return {
      ok: false,
      reason: 'BOT_NOT_READY_IN_GC',
    };
  }

  try {
    // 1. Leave any previous practice lobby first
    rt.client.sendToGC(
      DOTA2_APP_ID,
      k_EMsgGCPracticeLobbyLeave,
      {},
      Buffer.alloc(0),
    );
    rt.client.sendToGC(
      DOTA2_APP_ID,
      k_EMsgGCAbandonCurrentGame,
      {},
      Buffer.alloc(0),
    );

    await new Promise((r) => setTimeout(r, 600));

    // 2. Watch for human participants joining this lobby so we can auto-handoff leadership
    rt.watchedPlayerBuffers = opts.steamIds64
      .map((id) => steamId64ToFixed64Buffer(id))
      .filter((b): b is Buffer => b !== null);
    rt.autoHandoffTriggered = false;

    // 3. Create the new Practice Lobby in Dota 2 GC
    const createPayload = encodePracticeLobbyCreate({
      gameName: opts.gameName,
      passKey: opts.passKey,
      gameMode: opts.gameMode,
      serverLocation: opts.serverLocation,
      region: opts.region,
    });

    rt.client.sendToGC(
      DOTA2_APP_ID,
      k_EMsgGCPracticeLobbyCreate,
      {},
      createPayload,
    );

    rt.activeLobbyId = opts.lobbyId;
    await persistBotState({ activeLobbyId: opts.lobbyId });

    // 4. Wait 900ms for GC to place the bot in the lobby, then IMMEDIATELY move the bot
    //    out of Radiant Slot 1 into DOTA_GC_TEAM_PLAYER_POOL (4 = «НЕОПРЕДЕЛИВШИЕСЯ»)
    await new Promise((r) => setTimeout(r, 900));

    rt.client.sendToGC(
      DOTA2_APP_ID,
      k_EMsgGCPracticeLobbySetTeamSlot,
      {},
      encodePracticeLobbySetTeamSlot(DOTA_GC_TEAM_PLAYER_POOL, 0),
    );

    // 5. Invite all participants by SteamID64
    await new Promise((r) => setTimeout(r, 400));

    for (const steamId64 of opts.steamIds64) {
      if (/^\d{17}$/.test(steamId64)) {
        rt.client.sendToGC(
          DOTA2_APP_ID,
          k_EMsgGCInviteToLobby,
          {},
          encodeInviteToLobby(steamId64),
        );
      }
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'GC_SEND_ERROR',
    };
  }
}

export function botInvitePlayerToDotaLobby(steamId64: string): boolean {
  const rt = getRuntime();
  if (!rt.client || rt.status !== 'ready_gc' || !/^\d{17}$/.test(steamId64)) {
    return false;
  }

  try {
    const buf = steamId64ToFixed64Buffer(steamId64);
    if (buf && !rt.watchedPlayerBuffers.some((b) => b.equals(buf))) {
      rt.watchedPlayerBuffers.push(buf);
    }

    rt.client.sendToGC(
      DOTA2_APP_ID,
      k_EMsgGCInviteToLobby,
      {},
      encodeInviteToLobby(steamId64),
    );
    return true;
  } catch {
    return false;
  }
}

export function botLaunchDotaLobby(): boolean {
  const rt = getRuntime();
  if (!rt.client || rt.status !== 'ready_gc') {
    return false;
  }

  try {
    rt.client.sendToGC(
      DOTA2_APP_ID,
      k_EMsgGCPracticeLobbyLaunch,
      {},
      Buffer.alloc(0),
    );
    return true;
  } catch {
    return false;
  }
}
