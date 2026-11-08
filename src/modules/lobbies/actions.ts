'use server';

// [Phase: MVP v1] Custom Lobbies Server Actions (Open & Password-Protected Join, Slot Switching, Host Controls)
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getCurrentUser } from '@/modules/auth/service';
import {
  createCustomLobby,
  joinCustomLobby,
  kickCustomLobbyPlayer,
  leaveCustomLobby,
  shuffleCustomLobbyTeams,
  switchCustomLobbySlot,
  toggleCustomLobbyReady,
  updateCustomLobbyAccess,
  updateCustomLobbyStatus,
} from './service';

export async function createLobbyAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const accessTypeRaw = String(formData.get('accessType') ?? 'open');
  const passwordRaw = String(formData.get('password') ?? '').trim();
  const accessType =
    accessTypeRaw === 'password' || passwordRaw.length > 0 ? 'password' : 'open';

  const rawMax = Number(formData.get('maxPlayers') ?? 10);
  const maxPlayers: 2 | 10 = rawMax === 2 ? 2 : 10;

  const lobby = await createCustomLobby(user, {
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
    gameMode: z
      .enum(['all_pick', 'captains_mode', 'mid_only', 'random_draft', 'turbo'])
      .parse(formData.get('gameMode') ?? 'all_pick'),
    region: String(formData.get('region') ?? 'EEU'),
    serverLocation: String(formData.get('serverLocation') ?? 'Stockholm (EU North)'),
    maxPlayers,
    accessType,
    password: passwordRaw || undefined,
    dotaLobbyName: String(formData.get('dotaLobbyName') ?? ''),
    dotaLobbyPassword: String(formData.get('dotaLobbyPassword') ?? ''),
  });

  revalidatePath('/lobbies');
  revalidatePath('/');
  redirect(`/lobbies/${lobby.id}`);
}

export async function joinLobbyAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/api/auth/steam/login');
  }

  const lobbyId = z.string().min(1).parse(formData.get('lobbyId'));
  const password = String(formData.get('password') ?? '').trim();
  const sideRaw = formData.get('preferredSide');
  const slotRaw = formData.get('preferredSlot');

  const preferredSide =
    sideRaw === 'radiant' || sideRaw === 'dire' || sideRaw === 'spectator'
      ? sideRaw
      : undefined;
  const preferredSlot =
    slotRaw !== null && String(slotRaw).trim() !== ''
      ? Number(slotRaw)
      : undefined;

  let errorCode: string | null = null;
  try {
    await joinCustomLobby(user, {
      lobbyId,
      password: password || undefined,
      preferredSide,
      preferredSlot,
    });
  } catch (err) {
    errorCode = err instanceof Error ? err.message : 'JOIN_FAILED';
  }

  revalidatePath(`/lobbies/${lobbyId}`);
  revalidatePath('/lobbies');

  if (errorCode) {
    redirect(`/lobbies/${lobbyId}?error=${encodeURIComponent(errorCode)}`);
  }
  redirect(`/lobbies/${lobbyId}`);
}

export async function switchLobbySlotAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/api/auth/steam/login');
  }

  const lobbyId = z.string().min(1).parse(formData.get('lobbyId'));
  const side = z
    .enum(['radiant', 'dire', 'spectator'])
    .parse(formData.get('side'));
  const slot = Number(formData.get('slot') ?? 1);

  let errorCode: string | null = null;
  try {
    await switchCustomLobbySlot(user, { lobbyId, side, slot });
  } catch (err) {
    errorCode = err instanceof Error ? err.message : 'SWITCH_FAILED';
  }

  revalidatePath(`/lobbies/${lobbyId}`);
  revalidatePath('/lobbies');

  if (errorCode) {
    redirect(`/lobbies/${lobbyId}?error=${encodeURIComponent(errorCode)}`);
  }
}

export async function toggleLobbyReadyAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const lobbyId = z.string().min(1).parse(formData.get('lobbyId'));
  await toggleCustomLobbyReady(user, lobbyId);

  revalidatePath(`/lobbies/${lobbyId}`);
}

export async function leaveLobbyAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const lobbyId = z.string().min(1).parse(formData.get('lobbyId'));
  await leaveCustomLobby(user, lobbyId);

  revalidatePath(`/lobbies/${lobbyId}`);
  revalidatePath('/lobbies');
}

export async function shuffleLobbyTeamsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const lobbyId = z.string().min(1).parse(formData.get('lobbyId'));
  await shuffleCustomLobbyTeams(user, lobbyId);

  revalidatePath(`/lobbies/${lobbyId}`);
}

export async function kickLobbyPlayerAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const lobbyId = z.string().min(1).parse(formData.get('lobbyId'));
  const targetUserId = z.string().min(1).parse(formData.get('targetUserId'));
  await kickCustomLobbyPlayer(user, lobbyId, targetUserId);

  revalidatePath(`/lobbies/${lobbyId}`);
  revalidatePath('/lobbies');
}

export async function updateLobbyAccessAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const lobbyId = z.string().min(1).parse(formData.get('lobbyId'));
  const accessType = z
    .enum(['open', 'password'])
    .parse(formData.get('accessType') ?? 'open');
  const password = String(formData.get('password') ?? '').trim();
  const dotaLobbyName = String(formData.get('dotaLobbyName') ?? '').trim();
  const dotaLobbyPassword = String(formData.get('dotaLobbyPassword') ?? '').trim();

  await updateCustomLobbyAccess(user, lobbyId, {
    accessType,
    password: password || undefined,
    dotaLobbyName: dotaLobbyName || undefined,
    dotaLobbyPassword: dotaLobbyPassword || undefined,
  });

  revalidatePath(`/lobbies/${lobbyId}`);
  revalidatePath('/lobbies');
}

export async function updateLobbyStatusAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const lobbyId = z.string().min(1).parse(formData.get('lobbyId'));
  const status = z
    .enum(['waiting', 'in_progress', 'finished', 'cancelled'])
    .parse(formData.get('status'));
  const winnerRaw = formData.get('winnerSide');
  const winnerSide =
    winnerRaw === 'radiant' || winnerRaw === 'dire' ? winnerRaw : null;

  await updateCustomLobbyStatus(user, lobbyId, status, winnerSide);

  revalidatePath(`/lobbies/${lobbyId}`);
  revalidatePath('/lobbies');
  revalidatePath('/');
}
