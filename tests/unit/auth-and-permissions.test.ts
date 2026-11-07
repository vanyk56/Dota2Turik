// [Phase: MVP v1] Unit Tests for Steam OpenID 2.0 Verification & Permission Matrix (Section 5, 13, 16)
import { describe, expect, it } from 'vitest';
import {
  buildSteamOpenIdLoginUrl,
  extractSteamId64FromClaimedId,
  verifySteamOpenIdCallback,
} from '@/modules/auth/openid';
import {
  canBlockUser,
  canCreateTeam,
  canEditRatingFormula,
  canEditTeamCoreSettings,
  canManageTeamRosterAndInvites,
  canManageTournament,
  canRegisterTeamForTournament,
  canResolveDispute,
  canSubmitMatchResult,
} from '@/server/permissions';
import { hashPassword, verifyPassword } from '@/server/crypto';

describe('Steam OpenID 2.0 Protocol & Verification', () => {
  const returnTo = 'http://localhost:3000/api/auth/steam/callback';
  const realm = 'http://localhost:3000';

  it('builds a valid Steam OpenID 2.0 login URL', () => {
    const urlStr = buildSteamOpenIdLoginUrl(returnTo, realm);
    const url = new URL(urlStr);
    expect(url.origin + url.pathname).toBe('https://steamcommunity.com/openid/login');
    expect(url.searchParams.get('openid.mode')).toBe('checkid_setup');
    expect(url.searchParams.get('openid.return_to')).toBe(returnTo);
    expect(url.searchParams.get('openid.realm')).toBe(realm);
  });

  it('extracts valid SteamID64 from claimed_id and rejects spoofed URLs', () => {
    expect(
      extractSteamId64FromClaimedId(
        'https://steamcommunity.com/openid/id/76561198000000001',
      ),
    ).toBe('76561198000000001');

    expect(
      extractSteamId64FromClaimedId(
        'https://evil.example.com/openid/id/76561198000000001',
      ),
    ).toBeNull();

    expect(
      extractSteamId64FromClaimedId(
        'https://steamcommunity.com/openid/id/12345',
      ),
    ).toBeNull();
  });

  it('verifies a genuine callback when Steam check_authentication returns is_valid:true', async () => {
    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'id_res',
      'openid.op_endpoint': 'https://steamcommunity.com/openid/login',
      'openid.claimed_id': 'https://steamcommunity.com/openid/id/76561198012345678',
      'openid.identity': 'https://steamcommunity.com/openid/id/76561198012345678',
      'openid.return_to': returnTo,
      'openid.response_nonce': '2026-11-08T00:00:00Zabcdef',
      'openid.assoc_handle': '1234567890',
      'openid.signed': 'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
      'openid.sig': 'valid_signature_base64==',
    });

    const mockFetch: typeof fetch = async () =>
      new Response('ns:http://specs.openid.net/auth/2.0\nis_valid:true\n', {
        status: 200,
      });

    const result = await verifySteamOpenIdCallback(params, returnTo, mockFetch);
    expect(result.valid).toBe(true);
    expect(result.steamId64).toBe('76561198012345678');
  });

  it('rejects callback if Steam check_authentication returns is_valid:false', async () => {
    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'id_res',
      'openid.claimed_id': 'https://steamcommunity.com/openid/id/76561198012345678',
      'openid.identity': 'https://steamcommunity.com/openid/id/76561198012345678',
      'openid.return_to': returnTo,
      'openid.signed': 'claimed_id,identity',
      'openid.sig': 'forged_sig==',
    });

    const mockFetch: typeof fetch = async () =>
      new Response('ns:http://specs.openid.net/auth/2.0\nis_valid:false\n', {
        status: 200,
      });

    const result = await verifySteamOpenIdCallback(params, returnTo, mockFetch);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('STEAM_CHECK_AUTHENTICATION_REJECTED');
  });

  it('rejects callback if return_to does not match expected origin', async () => {
    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'id_res',
      'openid.claimed_id': 'https://steamcommunity.com/openid/id/76561198012345678',
      'openid.identity': 'https://steamcommunity.com/openid/id/76561198012345678',
      'openid.return_to': 'https://phishing.site/callback',
      'openid.signed': 'claimed_id,identity',
      'openid.sig': 'sig==',
    });

    const result = await verifySteamOpenIdCallback(params, returnTo);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('MISMATCHED_RETURN_TO');
  });
});

describe('Permission Matrix (Section 13) & Password Hashing', () => {
  const normalUser = { id: 'u1', role: 'user' as const, isBlocked: false };
  const blockedUser = { id: 'u2', role: 'user' as const, isBlocked: true };
  const moderator = { id: 'm1', role: 'moderator' as const, isBlocked: false };
  const admin = { id: 'a1', role: 'admin' as const, isBlocked: false };

  it('enforces team creation and core team settings permissions', () => {
    expect(canCreateTeam(null)).toBe(false);
    expect(canCreateTeam(blockedUser)).toBe(false);
    expect(canCreateTeam(normalUser)).toBe(true);

    expect(canEditTeamCoreSettings(normalUser, { teamRole: 'player' })).toBe(false);
    expect(canEditTeamCoreSettings(normalUser, { teamRole: 'co_captain' })).toBe(false);
    expect(canEditTeamCoreSettings(normalUser, { teamRole: 'captain' })).toBe(true);
    expect(canEditTeamCoreSettings(admin, { teamRole: null })).toBe(true);
  });

  it('enforces co-captain invite and tournament registration rules', () => {
    expect(canManageTeamRosterAndInvites(normalUser, { teamRole: 'co_captain' })).toBe(true);
    expect(canManageTeamRosterAndInvites(normalUser, { teamRole: 'player' })).toBe(false);

    expect(
      canRegisterTeamForTournament(normalUser, {
        teamRole: 'co_captain',
        allowCoCaptainRegister: true,
      }),
    ).toBe(true);
    expect(
      canRegisterTeamForTournament(normalUser, {
        teamRole: 'co_captain',
        allowCoCaptainRegister: false,
      }),
    ).toBe(false);
  });

  it('enforces tournament, match result, dispute, and admin permissions', () => {
    expect(canManageTournament(normalUser, { organizerId: 'u1' })).toBe(true);
    expect(canManageTournament(normalUser, { organizerId: 'other' })).toBe(false);
    expect(canManageTournament(admin, { organizerId: 'other' })).toBe(true);

    expect(
      canSubmitMatchResult(normalUser, {
        organizerId: 'other',
        isParticipantOfTeamA: true,
        isParticipantOfTeamB: false,
      }),
    ).toBe(true);
    expect(
      canSubmitMatchResult(normalUser, {
        organizerId: 'other',
        isParticipantOfTeamA: false,
        isParticipantOfTeamB: false,
      }),
    ).toBe(false);

    expect(canResolveDispute(moderator, { organizerId: 'other' })).toBe(true);
    expect(canBlockUser(moderator)).toBe(false);
    expect(canBlockUser(admin)).toBe(true);
    expect(canEditRatingFormula(admin)).toBe(true);
  });

  it('hashes and verifies team passwords securely', () => {
    const hash = hashPassword('SecretDota2Pass!');
    expect(verifyPassword('SecretDota2Pass!', hash)).toBe(true);
    expect(verifyPassword('WrongPass', hash)).toBe(false);
  });
});
