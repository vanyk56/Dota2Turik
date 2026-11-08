'use server';

// [Phase: MVP v1] Team Management Server Actions with Zod Validation & Rate Limiting (Section 7 & 14)
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getCurrentUser } from '@/modules/auth/service';
import { validateAndStoreImage } from '@/lib/storage';
import { checkRateLimit } from '@/server/rate-limit';
import {
  changeMemberRole,
  createTeam,
  createTeamInvite,
  decideJoinRequest,
  deleteTeam,
  joinTeamByInviteToken,
  joinTeamByPassword,
  removeOrLeaveTeamMember,
  revokeTeamInvite,
  submitJoinRequest,
  transferCaptaincy,
  updateTeamSettings,
} from './service';

export async function createTeamAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const rate = await checkRateLimit({
    key: `create_team:${user.id}`,
    limit: 5,
    windowSeconds: 300,
  });
  if (!rate.allowed) throw new Error('RATE_LIMIT_EXCEEDED');

  let logoUrl: string | null = null;
  const logoFile = formData.get('logo');
  if (logoFile instanceof File && logoFile.size > 0) {
    const stored = await validateAndStoreImage(logoFile, 'logos');
    logoUrl = stored.url;
  }

  const team = await createTeam(
    user,
    {
      name: String(formData.get('name') ?? ''),
      tag: String(formData.get('tag') ?? ''),
      description: String(formData.get('description') ?? ''),
      country: String(formData.get('country') ?? 'RU'),
      region: String(formData.get('region') ?? 'EU'),
      discordUrl: String(formData.get('discordUrl') ?? ''),
      telegramUrl: String(formData.get('telegramUrl') ?? ''),
      joinPassword: String(formData.get('joinPassword') ?? ''),
    },
    logoUrl,
  );

  revalidatePath('/teams');
  redirect(`/teams/${team.tag}`);
}

export async function createInviteTokenAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const teamId = z.string().min(1).parse(formData.get('teamId'));
  const teamTag = z.string().min(1).parse(formData.get('teamTag'));

  const rate = await checkRateLimit({
    key: `create_invite:${user.id}`,
    limit: 15,
    windowSeconds: 300,
  });
  if (!rate.allowed) throw new Error('RATE_LIMIT_EXCEEDED');

  const invite = await createTeamInvite(user, teamId);
  revalidatePath(`/teams/${teamTag}`);
  redirect(`/teams/${teamTag}?tab=manage&newInviteToken=${encodeURIComponent(invite.rawToken)}`);
}

export async function revokeInviteAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const inviteId = z.string().min(1).parse(formData.get('inviteId'));
  const teamTag = z.string().min(1).parse(formData.get('teamTag'));

  await revokeTeamInvite(user, inviteId);
  revalidatePath(`/teams/${teamTag}`);
}

export async function joinByPasswordAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const teamId = z.string().min(1).parse(formData.get('teamId'));
  const teamTag = z.string().min(1).parse(formData.get('teamTag'));
  const password = z.string().min(1).parse(formData.get('password'));

  await joinTeamByPassword(user, teamId, password);
  revalidatePath(`/teams/${teamTag}`);
  revalidatePath('/teams');
}

export async function joinByInviteTokenAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const token = z.string().min(32).parse(formData.get('token'));
  const teamTag = String(formData.get('teamTag') ?? '');

  await joinTeamByInviteToken(user, token);
  revalidatePath('/teams');
  if (teamTag) {
    revalidatePath(`/teams/${teamTag}`);
    redirect(`/teams/${teamTag}`);
  }
  redirect('/teams');
}

export async function submitJoinRequestAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const teamId = z.string().min(1).parse(formData.get('teamId'));
  const teamTag = z.string().min(1).parse(formData.get('teamTag'));
  const message = String(formData.get('message') ?? '');

  await submitJoinRequest(user, teamId, message);
  revalidatePath(`/teams/${teamTag}`);
}

export async function decideJoinRequestAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const requestId = z.string().min(1).parse(formData.get('requestId'));
  const decision = z.enum(['accepted', 'rejected']).parse(formData.get('decision'));
  const teamTag = z.string().min(1).parse(formData.get('teamTag'));

  await decideJoinRequest(user, requestId, decision);
  revalidatePath(`/teams/${teamTag}`);
  revalidatePath('/teams');
}

export async function changeMemberRoleAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const teamId = z.string().min(1).parse(formData.get('teamId'));
  const teamTag = z.string().min(1).parse(formData.get('teamTag'));
  const targetUserId = z.string().min(1).parse(formData.get('targetUserId'));
  const newRole = z
    .enum(['co_captain', 'player', 'substitute'])
    .parse(formData.get('newRole'));

  await changeMemberRole(user, teamId, targetUserId, newRole);
  revalidatePath(`/teams/${teamTag}`);
}

export async function transferCaptaincyAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const teamId = z.string().min(1).parse(formData.get('teamId'));
  const teamTag = z.string().min(1).parse(formData.get('teamTag'));
  const newCaptainUserId = z.string().min(1).parse(formData.get('newCaptainUserId'));

  await transferCaptaincy(user, teamId, newCaptainUserId);
  revalidatePath(`/teams/${teamTag}`);
  revalidatePath('/teams');
}

export async function removeOrLeaveMemberAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const teamId = z.string().min(1).parse(formData.get('teamId'));
  const teamTag = z.string().min(1).parse(formData.get('teamTag'));
  const targetUserId = z.string().min(1).parse(formData.get('targetUserId'));

  await removeOrLeaveTeamMember(user, teamId, targetUserId);
  revalidatePath(`/teams/${teamTag}`);
  revalidatePath('/teams');
}

export async function updateTeamSettingsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const teamId = z.string().min(1).parse(formData.get('teamId'));
  const teamTag = z.string().min(1).parse(formData.get('teamTag'));
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const status = z
    .enum(['active', 'recruiting', 'inactive'])
    .parse(formData.get('status') ?? 'recruiting');
  const allowCoCaptainRegister = formData.get('allowCoCaptainRegister') === 'on';
  const newPasswordRaw = String(formData.get('newPassword') ?? '');
  const clearPassword = formData.get('clearPassword') === 'on';

  let logoUrl: string | null | undefined = undefined;
  const logoFile = formData.get('logo');
  if (logoFile instanceof File && logoFile.size > 0) {
    const stored = await validateAndStoreImage(logoFile, 'logos');
    logoUrl = stored.url;
  }

  await updateTeamSettings(user, teamId, {
    name: name || undefined,
    description,
    status,
    allowCoCaptainRegister,
    newPassword: clearPassword
      ? null
      : newPasswordRaw.length >= 4
        ? newPasswordRaw
        : undefined,
    logoUrl,
  });

  revalidatePath(`/teams/${teamTag}`);
  revalidatePath('/teams');
}

export async function deleteTeamAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');

  const teamId = z.string().min(1).parse(formData.get('teamId'));
  await deleteTeam(user, teamId);
  revalidatePath('/teams');
  redirect('/teams');
}
