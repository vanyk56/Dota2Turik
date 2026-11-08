// [Phase: MVP v1] Custom Lobbies ("Лобби / Лобак 5x5 & 1x1") Service — Open & Password-Protected Lobbies
import { z } from 'zod';
import type { LobbyGameMode, LobbySide, LobbyStatus, Prisma } from '@prisma/client';
import { db as prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/server/crypto';
import {
  assertPermission,
  isActiveActor,
  isModeratorOrAdmin,
  type PermissionActor,
} from '@/server/permissions';
import { checkRateLimit } from '@/server/rate-limit';
import { recordAuditLog } from '@/modules/audit/service';
import {
  botCreateDotaLobbyAndInvite,
  botInvitePlayerToDotaLobby,
  botLaunchDotaLobby,
  getDotaBotStatus,
} from './dota-gc-bot';

export const CreateLobbyInputSchema = z.object({
  name: z.string().trim().min(3, 'Название от 3 символов').max(80),
  description: z.string().trim().max(500).optional(),
  gameMode: z.enum([
    'all_pick',
    'captains_mode',
    'mid_only',
    'random_draft',
    'turbo',
  ]),
  region: z.string().trim().min(2).max(16),
  serverLocation: z.string().trim().min(2).max(40).default('Stockholm'),
  maxPlayers: z.number().int().refine((v) => v === 2 || v === 10, {
    message: 'Допустимо 2 (1x1) или 10 (5x5) игроков',
  }),
  accessType: z.enum(['open', 'password']).default('open'),
  password: z.string().trim().max(64).optional(),
  dotaLobbyName: z.string().trim().max(80).optional(),
  dotaLobbyPassword: z.string().trim().max(64).optional(),
});

export type CreateLobbyInput = z.infer<typeof CreateLobbyInputSchema>;

export const LOBBY_GAME_MODE_LABELS: Record<LobbyGameMode, string> = {
  all_pick: 'All Pick 5x5',
  captains_mode: 'Captains Mode 5x5',
  mid_only: '1x1 / Mid Only',
  random_draft: 'Random Draft',
  turbo: 'Turbo',
};

export const LOBBY_SERVER_LOCATIONS = [
  'Stockholm (EU North)',
  'Luxembourg (EU West)',
  'Frankfurt (EU Central)',
  'Vienna (EU East)',
  'Warsaw',
  'US East',
  'SE Asia (Singapore)',
] as const;

export const DOTA_POSITION_LABELS: Record<number, string> = {
  1: 'Pos 1 • Carry (Керри)',
  2: 'Pos 2 • Midlane (Мидер)',
  3: 'Pos 3 • Offlane (Оффлейнер)',
  4: 'Pos 4 • Soft Support (Четвёрка)',
  5: 'Pos 5 • Hard Support (Пятёрка)',
};

export function canManageLobby(
  actor: PermissionActor | null | undefined,
  hostId: string,
): boolean {
  if (!isActiveActor(actor)) return false;
  if (isModeratorOrAdmin(actor)) return true;
  return actor.id === hostId;
}

export async function createCustomLobby(
  actor: PermissionActor,
  rawInput: CreateLobbyInput,
) {
  assertPermission(isActiveActor(actor), 'USER_BLOCKED_OR_UNAUTHORIZED');
  const parsed = CreateLobbyInputSchema.parse(rawInput);

  const cleanPassword = parsed.password?.trim() || '';
  const isPasswordProtected =
    parsed.accessType === 'password' && cleanPassword.length > 0;

  if (parsed.accessType === 'password' && cleanPassword.length < 2) {
    throw new Error('LOBBY_PASSWORD_TOO_SHORT');
  }

  const passwordHash = isPasswordProtected ? hashPassword(cleanPassword) : null;
  const defaultDotaName =
    parsed.dotaLobbyName?.trim() || `Dota turnir — ${parsed.name.slice(0, 28)}`;
  const defaultDotaPass =
    parsed.dotaLobbyPassword?.trim() ||
    (isPasswordProtected
      ? cleanPassword
      : `dt${Math.floor(1000 + Math.random() * 9000)}`);

  const lobby = await prisma.customLobby.create({
    data: {
      name: parsed.name,
      description: parsed.description || null,
      hostId: actor.id,
      status: 'waiting',
      gameMode: parsed.gameMode,
      region: parsed.region,
      serverLocation: parsed.serverLocation,
      maxPlayers: parsed.maxPlayers,
      passwordHash,
      dotaLobbyName: defaultDotaName,
      dotaLobbyPassword: defaultDotaPass,
      participants: {
        create: {
          userId: actor.id,
          side: 'radiant',
          slot: 1,
          isReady: true,
        },
      },
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    action: 'lobby.create',
    entityType: 'CustomLobby',
    entityId: lobby.id,
    payload: {
      name: lobby.name,
      gameMode: lobby.gameMode,
      region: lobby.region,
      maxPlayers: lobby.maxPlayers,
      hasPassword: Boolean(passwordHash),
    },
  });

  // If the Steam Dota 2 GC Bot is online and ready, automatically spawn the real lobby in Dota 2 and invite the host
  const botStatus = await getDotaBotStatus();
  if (botStatus.isReady) {
    const hostUser = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { steamId64: true },
    });
    void botCreateDotaLobbyAndInvite({
      lobbyId: lobby.id,
      gameName: defaultDotaName,
      passKey: defaultDotaPass,
      gameMode: lobby.gameMode,
      serverLocation: lobby.serverLocation,
      region: lobby.region,
      steamIds64: hostUser?.steamId64 ? [hostUser.steamId64] : [],
    });
  }

  return lobby;
}

export interface ListLobbiesFilters {
  query?: string;
  status?: string;
  access?: string; // 'ALL' | 'open' | 'password'
  gameMode?: string;
  region?: string;
  limit?: number;
}

export async function listCustomLobbies(filters: ListLobbiesFilters = {}) {
  const where: Prisma.CustomLobbyWhereInput = {};

  if (filters.status && filters.status !== 'ALL') {
    where.status = filters.status as LobbyStatus;
  } else {
    where.status = { not: 'cancelled' };
  }

  if (filters.access === 'open') {
    where.passwordHash = null;
  } else if (filters.access === 'password') {
    where.passwordHash = { not: null };
  }

  if (filters.gameMode && filters.gameMode !== 'ALL') {
    where.gameMode = filters.gameMode as LobbyGameMode;
  }

  if (filters.region && filters.region !== 'ALL') {
    where.region = filters.region;
  }

  if (filters.query && filters.query.trim().length > 0) {
    const q = filters.query.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { host: { nickname: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const rows = await prisma.customLobby.findMany({
    where,
    include: {
      host: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          steamId64: true,
        },
      },
      participants: {
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              avatarUrl: true,
              steamId64: true,
            },
          },
        },
        orderBy: [{ side: 'asc' }, { slot: 'asc' }],
      },
    },
    orderBy: [{ createdAt: 'desc' }],
    take: filters.limit ?? 50,
  });

  // Sort waiting & live lobbies first
  const statusPriority: Record<LobbyStatus, number> = {
    waiting: 0,
    in_progress: 1,
    finished: 2,
    cancelled: 3,
  };

  return rows
    .sort((a, b) => {
      const diff = statusPriority[a.status] - statusPriority[b.status];
      if (diff !== 0) return diff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .map((lobby) => {
      const activePlayers = lobby.participants.filter(
        (p) => p.side === 'radiant' || p.side === 'dire',
      );
      return {
        id: lobby.id,
        name: lobby.name,
        description: lobby.description,
        hostId: lobby.hostId,
        host: lobby.host,
        status: lobby.status,
        gameMode: lobby.gameMode,
        region: lobby.region,
        serverLocation: lobby.serverLocation,
        maxPlayers: lobby.maxPlayers,
        hasPassword: Boolean(lobby.passwordHash),
        winnerSide: lobby.winnerSide,
        createdAt: lobby.createdAt,
        startedAt: lobby.startedAt,
        finishedAt: lobby.finishedAt,
        activePlayersCount: activePlayers.length,
        spectatorsCount: lobby.participants.length - activePlayers.length,
        participants: lobby.participants,
      };
    });
}

export async function getCustomLobbyById(
  lobbyId: string,
  viewerId?: string | null,
  viewerRole?: string | null,
) {
  const lobby = await prisma.customLobby.findUnique({
    where: { id: lobbyId },
    include: {
      host: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          steamId64: true,
        },
      },
      participants: {
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              avatarUrl: true,
              steamId64: true,
            },
          },
        },
        orderBy: [{ side: 'asc' }, { slot: 'asc' }, { joinedAt: 'asc' }],
      },
    },
  });

  if (!lobby) return null;

  const hasPassword = Boolean(lobby.passwordHash);
  const isHost = Boolean(viewerId && lobby.hostId === viewerId);
  const isParticipant = Boolean(
    viewerId && lobby.participants.some((p) => p.userId === viewerId),
  );
  const isAdminOrMod = viewerRole === 'admin' || viewerRole === 'moderator';
  const canViewCredentials = !hasPassword || isParticipant || isHost || isAdminOrMod;

  const activePlayers = lobby.participants.filter(
    (p) => p.side === 'radiant' || p.side === 'dire',
  );

  return {
    id: lobby.id,
    name: lobby.name,
    description: lobby.description,
    hostId: lobby.hostId,
    host: lobby.host,
    status: lobby.status,
    gameMode: lobby.gameMode,
    region: lobby.region,
    serverLocation: lobby.serverLocation,
    maxPlayers: lobby.maxPlayers,
    hasPassword,
    isHost,
    isParticipant,
    canManage: isHost || isAdminOrMod,
    canViewCredentials,
    dotaLobbyName: canViewCredentials ? lobby.dotaLobbyName : null,
    dotaLobbyPassword: canViewCredentials ? lobby.dotaLobbyPassword : null,
    winnerSide: lobby.winnerSide,
    startedAt: lobby.startedAt,
    finishedAt: lobby.finishedAt,
    createdAt: lobby.createdAt,
    activePlayersCount: activePlayers.length,
    participants: lobby.participants,
  };
}

function findNextAvailableSlot(
  participants: Array<{ side: LobbySide; slot: number }>,
  maxPlayers: number,
  preferredSide?: LobbySide,
  preferredSlot?: number,
): { side: LobbySide; slot: number } | null {
  const maxPerSide = Math.max(1, Math.floor(maxPlayers / 2));

  const isTaken = (side: LobbySide, slot: number) =>
    participants.some((p) => p.side === side && p.slot === slot);

  if (preferredSide && preferredSlot) {
    const limit = preferredSide === 'spectator' ? 10 : maxPerSide;
    if (
      preferredSlot >= 1 &&
      preferredSlot <= limit &&
      !isTaken(preferredSide, preferredSlot)
    ) {
      return { side: preferredSide, slot: preferredSlot };
    }
  }

  if (preferredSide === 'spectator') {
    for (let s = 1; s <= 10; s++) {
      if (!isTaken('spectator', s)) return { side: 'spectator', slot: s };
    }
    return null;
  }

  // Balance between Radiant and Dire unless preferredSide was specified
  const radiantCount = participants.filter((p) => p.side === 'radiant').length;
  const direCount = participants.filter((p) => p.side === 'dire').length;

  const sideOrder: LobbySide[] =
    preferredSide === 'radiant'
      ? ['radiant', 'dire']
      : preferredSide === 'dire'
        ? ['dire', 'radiant']
        : radiantCount <= direCount
          ? ['radiant', 'dire']
          : ['dire', 'radiant'];

  for (const side of sideOrder) {
    for (let slot = 1; slot <= maxPerSide; slot++) {
      if (!isTaken(side, slot)) {
        return { side, slot };
      }
    }
  }

  return null;
}

export async function joinCustomLobby(
  actor: PermissionActor,
  input: {
    lobbyId: string;
    password?: string;
    preferredSide?: LobbySide;
    preferredSlot?: number;
  },
) {
  assertPermission(isActiveActor(actor), 'USER_BLOCKED_OR_UNAUTHORIZED');

  const lobby = await prisma.customLobby.findUnique({
    where: { id: input.lobbyId },
    include: { participants: true },
  });

  if (!lobby) throw new Error('LOBBY_NOT_FOUND');
  if (lobby.status !== 'waiting') {
    throw new Error('LOBBY_NOT_ACCEPTING_PLAYERS');
  }

  const existing = lobby.participants.find((p) => p.userId === actor.id);
  if (existing) {
    // Already in lobby — if a specific slot was requested, move there
    if (input.preferredSide && input.preferredSlot) {
      return switchCustomLobbySlot(actor, {
        lobbyId: lobby.id,
        side: input.preferredSide,
        slot: input.preferredSlot,
      });
    }
    return existing;
  }

  // Check password if lobby is password-protected (unless user is host or admin)
  if (
    lobby.passwordHash &&
    lobby.hostId !== actor.id &&
    !isModeratorOrAdmin(actor)
  ) {
    const rate = await checkRateLimit({
      key: `lobby_pwd:${actor.id}:${lobby.id}`,
      limit: 10,
      windowSeconds: 60,
    });
    if (!rate.allowed) {
      throw new Error('TOO_MANY_PASSWORD_ATTEMPTS');
    }

    const providedPassword = input.password?.trim() ?? '';
    if (!providedPassword || !verifyPassword(providedPassword, lobby.passwordHash)) {
      throw new Error('INVALID_LOBBY_PASSWORD');
    }
  }

  const slotAssignment = findNextAvailableSlot(
    lobby.participants,
    lobby.maxPlayers,
    input.preferredSide,
    input.preferredSlot,
  );

  if (!slotAssignment) {
    throw new Error('LOBBY_FULL');
  }

  const participant = await prisma.lobbyParticipant.create({
    data: {
      lobbyId: lobby.id,
      userId: actor.id,
      side: slotAssignment.side,
      slot: slotAssignment.slot,
      isReady: false,
    },
  });

  // Automatically send Dota 2 in-game invite if the GC Bot is active for this lobby
  const botStatus = await getDotaBotStatus();
  if (botStatus.isReady && botStatus.activeLobbyId === lobby.id) {
    const joinedUser = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { steamId64: true },
    });
    if (joinedUser?.steamId64) {
      botInvitePlayerToDotaLobby(joinedUser.steamId64);
    }
  }

  return participant;
}

export async function switchCustomLobbySlot(
  actor: PermissionActor,
  input: {
    lobbyId: string;
    side: LobbySide;
    slot: number;
  },
) {
  assertPermission(isActiveActor(actor), 'USER_BLOCKED_OR_UNAUTHORIZED');

  const lobby = await prisma.customLobby.findUnique({
    where: { id: input.lobbyId },
    include: { participants: true },
  });

  if (!lobby) throw new Error('LOBBY_NOT_FOUND');
  if (lobby.status !== 'waiting') {
    throw new Error('LOBBY_LOCKED');
  }

  const maxPerSide = Math.max(1, Math.floor(lobby.maxPlayers / 2));
  const maxSlot = input.side === 'spectator' ? 10 : maxPerSide;
  if (input.slot < 1 || input.slot > maxSlot) {
    throw new Error('INVALID_SLOT_NUMBER');
  }

  const occupied = lobby.participants.find(
    (p) =>
      p.side === input.side &&
      p.slot === input.slot &&
      p.userId !== actor.id,
  );
  if (occupied) {
    throw new Error('SLOT_ALREADY_TAKEN');
  }

  const existing = lobby.participants.find((p) => p.userId === actor.id);

  if (!existing) {
    // If lobby is open (no password), clicking an empty slot joins immediately!
    if (!lobby.passwordHash || lobby.hostId === actor.id || isModeratorOrAdmin(actor)) {
      return prisma.lobbyParticipant.create({
        data: {
          lobbyId: lobby.id,
          userId: actor.id,
          side: input.side,
          slot: input.slot,
          isReady: lobby.hostId === actor.id,
        },
      });
    }
    throw new Error('PASSWORD_REQUIRED_TO_JOIN');
  }

  return prisma.lobbyParticipant.update({
    where: { id: existing.id },
    data: {
      side: input.side,
      slot: input.slot,
    },
  });
}

export async function toggleCustomLobbyReady(
  actor: PermissionActor,
  lobbyId: string,
) {
  assertPermission(isActiveActor(actor), 'USER_BLOCKED_OR_UNAUTHORIZED');

  const participant = await prisma.lobbyParticipant.findUnique({
    where: {
      lobbyId_userId: {
        lobbyId,
        userId: actor.id,
      },
    },
  });

  if (!participant) {
    throw new Error('NOT_IN_LOBBY');
  }

  return prisma.lobbyParticipant.update({
    where: { id: participant.id },
    data: { isReady: !participant.isReady },
  });
}

export async function leaveCustomLobby(
  actor: PermissionActor,
  lobbyId: string,
) {
  const lobby = await prisma.customLobby.findUnique({
    where: { id: lobbyId },
    include: {
      participants: {
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  if (!lobby) throw new Error('LOBBY_NOT_FOUND');

  await prisma.lobbyParticipant.deleteMany({
    where: {
      lobbyId,
      userId: actor.id,
    },
  });

  // If the host left while waiting and other players remain, promote the next player to host
  if (lobby.hostId === actor.id && lobby.status === 'waiting') {
    const remaining = lobby.participants.filter((p) => p.userId !== actor.id);
    if (remaining.length > 0 && remaining[0]) {
      await prisma.customLobby.update({
        where: { id: lobbyId },
        data: { hostId: remaining[0].userId },
      });
    }
  }
}

export async function shuffleCustomLobbyTeams(
  actor: PermissionActor,
  lobbyId: string,
) {
  const lobby = await prisma.customLobby.findUnique({
    where: { id: lobbyId },
    include: { participants: true },
  });

  if (!lobby) throw new Error('LOBBY_NOT_FOUND');
  assertPermission(canManageLobby(actor, lobby.hostId), 'FORBIDDEN_LOBBY_HOST_ONLY');

  if (lobby.status !== 'waiting') {
    throw new Error('LOBBY_ALREADY_STARTED');
  }

  const activePlayers = lobby.participants.filter(
    (p) => p.side === 'radiant' || p.side === 'dire',
  );

  // Fisher-Yates shuffle
  const shuffled = [...activePlayers];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }

  const maxPerSide = Math.max(1, Math.floor(lobby.maxPlayers / 2));
  let radiantSlot = 1;
  let direSlot = 1;

  await prisma.$transaction(
    shuffled.map((p, idx) => {
      const assignRadiant =
        (idx % 2 === 0 && radiantSlot <= maxPerSide) || direSlot > maxPerSide;
      const side: LobbySide = assignRadiant ? 'radiant' : 'dire';
      const slot = assignRadiant ? radiantSlot++ : direSlot++;
      return prisma.lobbyParticipant.update({
        where: { id: p.id },
        data: { side, slot },
      });
    }),
  );

  await recordAuditLog({
    actorId: actor.id,
    action: 'lobby.shuffle_teams',
    entityType: 'CustomLobby',
    entityId: lobby.id,
    payload: { count: shuffled.length },
  });
}

export async function kickCustomLobbyPlayer(
  actor: PermissionActor,
  lobbyId: string,
  targetUserId: string,
) {
  const lobby = await prisma.customLobby.findUnique({
    where: { id: lobbyId },
  });

  if (!lobby) throw new Error('LOBBY_NOT_FOUND');
  assertPermission(canManageLobby(actor, lobby.hostId), 'FORBIDDEN_LOBBY_HOST_ONLY');

  await prisma.lobbyParticipant.deleteMany({
    where: {
      lobbyId,
      userId: targetUserId,
    },
  });
}

export async function updateCustomLobbyAccess(
  actor: PermissionActor,
  lobbyId: string,
  input: {
    accessType: 'open' | 'password';
    password?: string;
    dotaLobbyName?: string;
    dotaLobbyPassword?: string;
  },
) {
  const lobby = await prisma.customLobby.findUnique({
    where: { id: lobbyId },
  });

  if (!lobby) throw new Error('LOBBY_NOT_FOUND');
  assertPermission(canManageLobby(actor, lobby.hostId), 'FORBIDDEN_LOBBY_HOST_ONLY');

  const cleanPassword = input.password?.trim() || '';
  let passwordHash: string | null = lobby.passwordHash;

  if (input.accessType === 'open') {
    passwordHash = null;
  } else if (cleanPassword.length > 0) {
    passwordHash = hashPassword(cleanPassword);
  }

  return prisma.customLobby.update({
    where: { id: lobbyId },
    data: {
      passwordHash,
      dotaLobbyName:
        input.dotaLobbyName !== undefined
          ? input.dotaLobbyName.trim() || lobby.dotaLobbyName
          : lobby.dotaLobbyName,
      dotaLobbyPassword:
        input.dotaLobbyPassword !== undefined
          ? input.dotaLobbyPassword.trim() || lobby.dotaLobbyPassword
          : lobby.dotaLobbyPassword,
    },
  });
}

export async function updateCustomLobbyStatus(
  actor: PermissionActor,
  lobbyId: string,
  status: LobbyStatus,
  winnerSide?: LobbySide | null,
) {
  const lobby = await prisma.customLobby.findUnique({
    where: { id: lobbyId },
  });

  if (!lobby) throw new Error('LOBBY_NOT_FOUND');
  assertPermission(canManageLobby(actor, lobby.hostId), 'FORBIDDEN_LOBBY_HOST_ONLY');

  const updated = await prisma.customLobby.update({
    where: { id: lobbyId },
    data: {
      status,
      winnerSide: status === 'finished' ? (winnerSide ?? null) : null,
      startedAt:
        status === 'in_progress' && !lobby.startedAt
          ? new Date()
          : lobby.startedAt,
      finishedAt: status === 'finished' ? new Date() : null,
    },
  });

  if (status === 'in_progress') {
    const botStatus = await getDotaBotStatus();
    if (botStatus.isReady && botStatus.activeLobbyId === lobbyId) {
      botLaunchDotaLobby();
    }
  }

  await recordAuditLog({
    actorId: actor.id,
    action: 'lobby.update_status',
    entityType: 'CustomLobby',
    entityId: lobby.id,
    payload: { status, winnerSide: winnerSide ?? null },
  });

  return updated;
}
