'use server';

// [Phase: MVP v1] Match Result & Dispute Server Actions (Section 10 & 14)
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentUser } from '@/modules/auth/service';
import { checkRateLimit } from '@/server/rate-limit';
import {
  openManualMatchDispute,
  organizerRollbackMatch,
  organizerSetMatchResult,
  submitTeamMatchResult,
} from './service';

const matchScoreSchema = z.object({
  matchId: z.string().min(1),
  tournamentSlug: z.string().min(1),
  scoreA: z.coerce.number().int().min(0).max(5),
  scoreB: z.coerce.number().int().min(0).max(5),
});

export async function submitMatchResultAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const rate = await checkRateLimit({
    key: `submit_match:${user.id}`,
    limit: 20,
    windowSeconds: 60,
  });
  if (!rate.allowed) throw new Error('RATE_LIMIT_EXCEEDED');

  const parsed = matchScoreSchema.parse({
    matchId: formData.get('matchId'),
    tournamentSlug: formData.get('tournamentSlug'),
    scoreA: formData.get('scoreA'),
    scoreB: formData.get('scoreB'),
  });

  await submitTeamMatchResult(
    user,
    parsed.matchId,
    parsed.scoreA,
    parsed.scoreB,
  );
  revalidatePath(`/tournaments/${parsed.tournamentSlug}`);
  revalidatePath('/leaderboard');
}

export async function organizerOverrideResultAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const parsed = matchScoreSchema.parse({
    matchId: formData.get('matchId'),
    tournamentSlug: formData.get('tournamentSlug'),
    scoreA: formData.get('scoreA'),
    scoreB: formData.get('scoreB'),
  });
  const resolutionNote = String(formData.get('resolutionNote') ?? '');

  await organizerSetMatchResult(
    user,
    parsed.matchId,
    parsed.scoreA,
    parsed.scoreB,
    resolutionNote || undefined,
  );
  revalidatePath(`/tournaments/${parsed.tournamentSlug}`);
  revalidatePath('/admin');
  revalidatePath('/leaderboard');
}

export async function openMatchDisputeAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const matchId = z.string().min(1).parse(formData.get('matchId'));
  const tournamentSlug = z.string().min(1).parse(formData.get('tournamentSlug'));
  const reason = z.string().min(5).max(500).parse(formData.get('reason'));

  await openManualMatchDispute(user, matchId, reason);
  revalidatePath(`/tournaments/${tournamentSlug}`);
  revalidatePath('/admin');
}

export async function rollbackMatchAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const matchId = z.string().min(1).parse(formData.get('matchId'));
  const tournamentSlug = z.string().min(1).parse(formData.get('tournamentSlug'));

  await organizerRollbackMatch(user, matchId);
  revalidatePath(`/tournaments/${tournamentSlug}`);
}
