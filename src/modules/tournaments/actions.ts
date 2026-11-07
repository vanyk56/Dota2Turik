'use server';

// [Phase: MVP v1] Tournament Server Actions with Zod Validation (Section 10)
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getCurrentUser } from '@/modules/auth/service';
import { validateAndStoreImage } from '@/lib/storage';
import {
  createTournament,
  decideTournamentRegistration,
  registerTeamForTournament,
  saveBracketNodeLayout,
  startTournamentAndGenerateBracket,
  updateTournamentStatus,
} from './service';

export async function createTournamentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  let coverUrl: string | null = null;
  const coverFile = formData.get('cover');
  if (coverFile instanceof File && coverFile.size > 0) {
    const stored = await validateAndStoreImage(coverFile, 'covers');
    coverUrl = stored.url;
  }

  const tournament = await createTournament(
    user,
    {
      name: String(formData.get('name') ?? ''),
      slug: String(formData.get('slug') ?? ''),
      description: String(formData.get('description') ?? ''),
      format: String(formData.get('format') ?? 'single_elimination'),
      region: String(formData.get('region') ?? 'EEU'),
      prizePool: String(formData.get('prizePool') ?? ''),
      rules: String(formData.get('rules') ?? ''),
      maxTeams: Number(formData.get('maxTeams') ?? 16),
      startsAt: String(formData.get('startsAt') ?? new Date().toISOString()),
      endsAt: String(formData.get('endsAt') ?? ''),
      levelWeight: String(formData.get('levelWeight') ?? 'tier_b'),
      seedingMode: String(formData.get('seedingMode') ?? 'rating'),
      defaultBestOf: Number(formData.get('defaultBestOf') ?? 3),
      initialStatus: String(formData.get('initialStatus') ?? 'registration'),
    },
    coverUrl,
  );

  revalidatePath('/tournaments');
  redirect(`/tournaments/${tournament.slug}`);
}

export async function registerTeamForTournamentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const tournamentId = z.string().min(1).parse(formData.get('tournamentId'));
  const tournamentSlug = z.string().min(1).parse(formData.get('tournamentSlug'));
  const teamId = z.string().min(1).parse(formData.get('teamId'));
  const autoApprove = formData.get('autoApprove') === 'true';

  await registerTeamForTournament(user, tournamentId, teamId, autoApprove);
  revalidatePath(`/tournaments/${tournamentSlug}`);
}

export async function decideRegistrationAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const registrationId = z.string().min(1).parse(formData.get('registrationId'));
  const tournamentSlug = z.string().min(1).parse(formData.get('tournamentSlug'));
  const status = z
    .enum(['approved', 'rejected', 'withdrawn'])
    .parse(formData.get('status'));
  const seedRaw = formData.get('seed');
  const seed =
    seedRaw !== null && String(seedRaw).trim() !== ''
      ? Number(seedRaw)
      : undefined;

  await decideTournamentRegistration(user, registrationId, status, seed);
  revalidatePath(`/tournaments/${tournamentSlug}`);
}

export async function startTournamentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const tournamentId = z.string().min(1).parse(formData.get('tournamentId'));
  const tournamentSlug = z.string().min(1).parse(formData.get('tournamentSlug'));
  const regenerate = formData.get('regenerate') === 'true';

  await startTournamentAndGenerateBracket(user, tournamentId, regenerate);
  revalidatePath(`/tournaments/${tournamentSlug}`);
}

export async function changeTournamentStatusAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const tournamentId = z.string().min(1).parse(formData.get('tournamentId'));
  const tournamentSlug = z.string().min(1).parse(formData.get('tournamentSlug'));
  const status = z
    .enum(['draft', 'registration', 'in_progress', 'finished', 'cancelled'])
    .parse(formData.get('status'));

  await updateTournamentStatus(user, tournamentId, status);
  revalidatePath(`/tournaments/${tournamentSlug}`);
  revalidatePath('/tournaments');
  revalidatePath('/leaderboard');
}

export async function saveBracketLayoutAction(
  bracketId: string,
  tournamentSlug: string,
  layout: Record<string, { x: number; y: number }>,
) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  await saveBracketNodeLayout(user, bracketId, layout);
  revalidatePath(`/tournaments/${tournamentSlug}`);
}
