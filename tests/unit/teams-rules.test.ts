// [Phase: MVP v1] Unit Tests for Team Roster Limits, Role Rules & Validation (Section 7 & 16)
import { describe, expect, it } from 'vitest';
import {
  calculateRosterCounts,
  canAddMemberWithRole,
  canRemoveMember,
  createTeamSchema,
  resolveAutoJoinRole,
} from '@/modules/teams/rules';

describe('Team Roster Limits & Role Rules (Section 7)', () => {
  it('validates team name and 2-5 character alphanumeric tag', () => {
    const valid = createTeamSchema.safeParse({
      name: 'Team Spirit',
      tag: 'ts',
      country: 'RU',
      region: 'EEU',
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.tag).toBe('TS');
    }

    const invalidShortTag = createTeamSchema.safeParse({
      name: 'Team Spirit',
      tag: 'T',
      country: 'RU',
      region: 'EEU',
    });
    expect(invalidShortTag.success).toBe(false);

    const invalidLongTag = createTeamSchema.safeParse({
      name: 'Team Spirit',
      tag: 'SPIRIT6',
      country: 'RU',
      region: 'EEU',
    });
    expect(invalidLongTag.success).toBe(false);
  });

  it('enforces 5 main players and 2 substitutes limit from PLATFORM_CONFIG', () => {
    const fiveMainRoster = [
      { role: 'captain' as const },
      { role: 'co_captain' as const },
      { role: 'player' as const },
      { role: 'player' as const },
      { role: 'player' as const },
    ];

    const counts = calculateRosterCounts(fiveMainRoster);
    expect(counts.mainCount).toBe(5);
    expect(counts.substituteCount).toBe(0);

    // 6th main player is rejected
    expect(canAddMemberWithRole(fiveMainRoster, 'player')).toEqual({
      allowed: false,
      reason: 'MAIN_ROSTER_SLOTS_FULL',
    });

    // Auto-join assigns substitute when 5 main slots are full
    expect(resolveAutoJoinRole(fiveMainRoster)).toBe('substitute');

    // Adding 2 substitutes succeeds, 3rd substitute fails
    const fullSevenRoster = [
      ...fiveMainRoster,
      { role: 'substitute' as const },
      { role: 'substitute' as const },
    ];
    expect(canAddMemberWithRole(fullSevenRoster, 'substitute')).toEqual({
      allowed: false,
      reason: 'TEAM_ROSTER_FULL',
    });
    expect(resolveAutoJoinRole(fullSevenRoster)).toBeNull();
  });

  it('prevents removing captain without transferring captaincy first', () => {
    expect(canRemoveMember('captain', 'captain', true)).toEqual({
      allowed: false,
      reason: 'CAPTAIN_CANNOT_BE_REMOVED_WITHOUT_TRANSFER',
    });
    expect(canRemoveMember('admin', 'captain', false)).toEqual({
      allowed: false,
      reason: 'CAPTAIN_CANNOT_BE_REMOVED_WITHOUT_TRANSFER',
    });
  });

  it('allows co-captain to remove players and substitutes, but not other co-captains', () => {
    expect(canRemoveMember('co_captain', 'player', false).allowed).toBe(true);
    expect(canRemoveMember('co_captain', 'substitute', false).allowed).toBe(true);
    expect(canRemoveMember('co_captain', 'co_captain', false)).toEqual({
      allowed: false,
      reason: 'CO_CAPTAIN_CANNOT_REMOVE_PEERS',
    });
  });
});
