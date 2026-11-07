'use server';

// [Phase: MVP v1] Authentication & Account Security Server Actions (Section 5 & 14)
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  getCurrentUser,
  refreshUserSteamProfile,
  revokeAllUserSessions,
  revokeCurrentSession,
} from './service';
import { anonymizeUserAccount } from '@/modules/users/service';

export async function logoutAction() {
  await revokeCurrentSession();
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function logoutAllDevicesAction() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }
  await revokeAllUserSessions(user.id);
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function refreshSteamProfileAction() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  const updated = await refreshUserSteamProfile(user.id);
  revalidatePath(`/players/${updated.steamId64}`);
  revalidatePath('/', 'layout');
}

export async function anonymizeAccountAction() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  await anonymizeUserAccount(user.id);
  await revokeAllUserSessions(user.id);
  revalidatePath('/', 'layout');
  redirect('/');
}
