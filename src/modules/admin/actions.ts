'use server';

// [Phase: MVP v1] Admin Panel Server Actions (Section 1, 9, 13, 14)
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentUser } from '@/modules/auth/service';
import {
  createNewRatingFormulaVersion,
  recalculateAllRatingsByVersion,
} from '@/modules/ratings/service';
import { DEFAULT_RATING_FORMULA_CONFIG } from '@/modules/ratings/engine';
import { toggleUserBlockStatus, updateUserPlatformRole } from './service';

export async function toggleUserBlockAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const targetUserId = z.string().min(1).parse(formData.get('targetUserId'));
  const isBlocked = formData.get('isBlocked') === 'true';

  await toggleUserBlockStatus(user, targetUserId, isBlocked);
  revalidatePath('/admin');
}

export async function changeUserRoleAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const targetUserId = z.string().min(1).parse(formData.get('targetUserId'));
  const role = z.enum(['user', 'moderator', 'admin']).parse(formData.get('role'));

  await updateUserPlatformRole(user, targetUserId, role);
  revalidatePath('/admin');
}

export async function createRatingFormulaVersionAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const place1 = z.coerce.number().int().min(0).max(50000).parse(formData.get('place1') ?? 1000);
  const place2 = z.coerce.number().int().min(0).max(50000).parse(formData.get('place2') ?? 650);
  const place3 = z.coerce.number().int().min(0).max(50000).parse(formData.get('place3') ?? 400);
  const place4 = z.coerce.number().int().min(0).max(50000).parse(formData.get('place4') ?? 250);
  const matchBonus = z.coerce.number().int().min(0).max(1000).parse(formData.get('matchBonus') ?? 15);
  const tierS = z.coerce.number().min(0.1).max(10).parse(formData.get('tier_s') ?? 2.0);
  const tierA = z.coerce.number().min(0.1).max(10).parse(formData.get('tier_a') ?? 1.5);
  const tierB = z.coerce.number().min(0.1).max(10).parse(formData.get('tier_b') ?? 1.0);
  const tierC = z.coerce.number().min(0.1).max(10).parse(formData.get('tier_c') ?? 0.5);

  await createNewRatingFormulaVersion(user, {
    basePoints: {
      ...DEFAULT_RATING_FORMULA_CONFIG.basePoints,
      '1': place1,
      '2': place2,
      '3': place3,
      '4': place4,
    },
    levelWeight: {
      tier_s: tierS,
      tier_a: tierA,
      tier_b: tierB,
      tier_c: tierC,
    },
    matchBonus,
  });

  revalidatePath('/admin');
  revalidatePath('/leaderboard');
}

export async function triggerRatingRecalculationAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const versionRaw = formData.get('version');
  const version =
    versionRaw && String(versionRaw).trim() !== ''
      ? Number(versionRaw)
      : undefined;

  await recalculateAllRatingsByVersion(user, version);
  revalidatePath('/admin');
  revalidatePath('/leaderboard');
  revalidatePath('/teams');
}
