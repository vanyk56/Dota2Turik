'use server';

// [Phase: MVP v1] Server Action for Manual OpenDota Stats Synchronization (Section 6)
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { syncOpenDotaStats } from '@/modules/dota-data/service';
import { getCurrentUser } from '@/modules/auth/service';

const syncInputSchema = z.object({
  steamId64: z.string().regex(/^7656119\d{10}$/),
});

export async function syncPlayerOpenDotaAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }

  const parsed = syncInputSchema.safeParse({
    steamId64: formData.get('steamId64'),
  });

  if (!parsed.success) {
    throw new Error('INVALID_STEAMID64');
  }

  await syncOpenDotaStats(parsed.data.steamId64, true);
  revalidatePath(`/players/${parsed.data.steamId64}`);
}
