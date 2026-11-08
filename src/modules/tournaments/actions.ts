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
  if (!user) {
    redirect(
      '/tournaments/new?error=' +
        encodeURIComponent('Для создания турнира необходимо войти через Steam.'),
    );
  }

  let coverUrl: string | null = null;
  try {
    const coverFile = formData.get('cover');
    if (coverFile instanceof File && coverFile.size > 0) {
      const stored = await validateAndStoreImage(coverFile, 'covers');
      coverUrl = stored.url;
    }
  } catch (err) {
    console.warn(
      '[Tournament Action] Cover upload failed, continuing with default cover:',
      err,
    );
  }

  let tournament;
  try {
    tournament = await createTournament(
      user,
      {
        name: String(formData.get('name') ?? '').trim(),
        slug: String(formData.get('slug') ?? '').trim(),
        description: String(formData.get('description') ?? '').trim(),
        format: String(formData.get('format') ?? 'single_elimination'),
        region: String(formData.get('region') ?? 'EU'),
        prizePool: String(formData.get('prizePool') ?? '').trim(),
        rules: String(formData.get('rules') ?? '').trim(),
        maxTeams: Number(formData.get('maxTeams') ?? 16),
        startsAt: String(formData.get('startsAt') ?? ''),
        endsAt: String(formData.get('endsAt') ?? ''),
        levelWeight: String(formData.get('levelWeight') ?? 'tier_b'),
        seedingMode: String(formData.get('seedingMode') ?? 'rating'),
        defaultBestOf: Number(formData.get('defaultBestOf') ?? 3),
        initialStatus: String(formData.get('initialStatus') ?? 'registration'),
      },
      coverUrl,
    );
  } catch (err: unknown) {
    let msg = 'Произошла ошибка при создании турнира.';
    if (err instanceof Error) {
      msg = err.message;
    }
    console.error('[Tournament Action] createTournament failed:', err);
    redirect('/tournaments/new?error=' + encodeURIComponent(msg));
  }

  revalidatePath('/tournaments');
  redirect(`/tournaments/${tournament.slug}`);
}

export async function registerTeamForTournamentAction(formData: FormData) {
  const user = await getCurrentUser();
  const tournamentSlug = String(formData.get('tournamentSlug') ?? '');

  if (!user) {
    redirect(
      `/tournaments/${tournamentSlug}?reg_error=` +
        encodeURIComponent('Для регистрации на турнир необходимо войти через Steam.'),
    );
  }

  const tournamentId = String(formData.get('tournamentId') ?? '');
  const teamId = String(formData.get('teamId') ?? '');
  const autoApprove = formData.get('autoApprove') === 'true';

  try {
    await registerTeamForTournament(user, tournamentId, teamId, autoApprove);
  } catch (err: unknown) {
    let msg = 'Не удалось зарегистрировать команду на турнир.';
    if (err instanceof Error) {
      if (err.message === 'TEAM_NEEDS_AT_LEAST_5_MAIN_PLAYERS') {
        msg =
          'В основном составе команды должно быть минимум 5 игроков для участия в турнире.';
      } else if (err.message === 'TOURNAMENT_REGISTRATION_CLOSED') {
        msg = 'Регистрация на этот турнир уже закрыта.';
      } else if (err.message === 'TOURNAMENT_MAX_TEAMS_REACHED') {
        msg = 'Достигнут лимит команд на этом турнире.';
      } else if (
        err.message ===
        'ROSTER_CONFLICT_PLAYER_ALREADY_REGISTERED_IN_ANOTHER_TEAM'
      ) {
        msg =
          'Один из игроков команды уже заявлен на этот турнир за другой коллектив.';
      } else if (err.message === 'CANNOT_REGISTER_TEAM') {
        msg = 'Только капитан или уполномоченный вице-капитан может подавать заявку.';
      } else {
        msg = err.message;
      }
    }
    redirect(
      `/tournaments/${tournamentSlug}?reg_error=` + encodeURIComponent(msg),
    );
  }

  revalidatePath(`/tournaments/${tournamentSlug}`);
  redirect(
    `/tournaments/${tournamentSlug}?reg_success=` +
      encodeURIComponent('Заявка команды успешно отправлена!'),
  );
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
