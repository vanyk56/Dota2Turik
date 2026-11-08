// [Phase: MVP v1] Pure Team Roster & Role Validation Rules (Section 7 & 16)
import { z } from 'zod';
import { PLATFORM_CONFIG } from '@/lib/config';

export type TeamMemberRole = 'captain' | 'co_captain' | 'player' | 'substitute';

export interface RosterSlotCount {
  mainCount: number; // captain + co_captain + player
  substituteCount: number;
  totalCount: number;
}

export const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Название команды должно содержать от 3 до 40 символов')
    .max(40, 'Название команды должно содержать от 3 до 40 символов'),
  tag: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{2,5}$/, 'Тег должен содержать от 2 до 5 латинских букв или цифр')
    .transform((v) => v.toUpperCase()),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  country: z.string().trim().min(2).max(3).default('RU'),
  region: z.enum(PLATFORM_CONFIG.regions).default('EU'),
  discordUrl: z.string().url().optional().or(z.literal('')),
  telegramUrl: z.string().url().optional().or(z.literal('')),
  joinPassword: z.string().min(4).max(64).optional().or(z.literal('')),
});

export function calculateRosterCounts(
  activeMembers: Array<{ role: TeamMemberRole }>,
): RosterSlotCount {
  let mainCount = 0;
  let substituteCount = 0;

  for (const m of activeMembers) {
    if (m.role === 'substitute') {
      substituteCount += 1;
    } else {
      mainCount += 1;
    }
  }

  return {
    mainCount,
    substituteCount,
    totalCount: mainCount + substituteCount,
  };
}

export function canAddMemberWithRole(
  activeMembers: Array<{ role: TeamMemberRole }>,
  targetRole: TeamMemberRole,
): { allowed: boolean; reason?: string } {
  const counts = calculateRosterCounts(activeMembers);

  if (counts.totalCount >= PLATFORM_CONFIG.roster.maxTotalMembers) {
    return { allowed: false, reason: 'TEAM_ROSTER_FULL' };
  }

  if (targetRole === 'captain') {
    const hasCaptain = activeMembers.some((m) => m.role === 'captain');
    if (hasCaptain) {
      return { allowed: false, reason: 'CAPTAIN_ALREADY_EXISTS' };
    }
  }

  if (targetRole === 'substitute') {
    if (counts.substituteCount >= PLATFORM_CONFIG.roster.maxSubstitutes) {
      return { allowed: false, reason: 'SUBSTITUTE_SLOTS_FULL' };
    }
    return { allowed: true };
  }

  if (counts.mainCount >= PLATFORM_CONFIG.roster.maxMainPlayers) {
    return { allowed: false, reason: 'MAIN_ROSTER_SLOTS_FULL' };
  }

  return { allowed: true };
}

export function resolveAutoJoinRole(
  activeMembers: Array<{ role: TeamMemberRole }>,
): TeamMemberRole | null {
  const counts = calculateRosterCounts(activeMembers);
  if (counts.mainCount < PLATFORM_CONFIG.roster.maxMainPlayers) {
    return 'player';
  }
  if (counts.substituteCount < PLATFORM_CONFIG.roster.maxSubstitutes) {
    return 'substitute';
  }
  return null;
}

export function canRemoveMember(
  actorRole: TeamMemberRole | 'admin',
  targetRole: TeamMemberRole,
  isSelf: boolean,
): { allowed: boolean; reason?: string } {
  if (targetRole === 'captain') {
    return {
      allowed: false,
      reason: 'CAPTAIN_CANNOT_BE_REMOVED_WITHOUT_TRANSFER',
    };
  }

  if (isSelf) {
    return { allowed: true };
  }

  if (actorRole === 'admin' || actorRole === 'captain') {
    return { allowed: true };
  }

  if (actorRole === 'co_captain') {
    if (targetRole === 'player' || targetRole === 'substitute') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'CO_CAPTAIN_CANNOT_REMOVE_PEERS' };
  }

  return { allowed: false, reason: 'INSUFFICIENT_TEAM_ROLE' };
}
