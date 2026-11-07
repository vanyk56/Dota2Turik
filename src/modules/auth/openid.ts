// [Phase: MVP v1] Steam OpenID 2.0 Protocol Implementation & Verification (Section 5)
const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const OPENID_NS = 'http://specs.openid.net/auth/2.0';
const IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';
const CLAIMED_ID_REGEX = /^https?:\/\/steamcommunity\.com\/openid\/id\/(7656119\d{10})$/;

export function buildSteamOpenIdLoginUrl(returnTo: string, realm: string): string {
  const params = new URLSearchParams({
    'openid.ns': OPENID_NS,
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': realm,
    'openid.identity': IDENTIFIER_SELECT,
    'openid.claimed_id': IDENTIFIER_SELECT,
  });

  return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`;
}

export function extractSteamId64FromClaimedId(claimedId: string | null | undefined): string | null {
  if (!claimedId) return null;
  const match = CLAIMED_ID_REGEX.exec(claimedId.trim());
  return match?.[1] ?? null;
}

export interface OpenIdVerificationResult {
  valid: boolean;
  steamId64?: string;
  error?: string;
}

export async function verifySteamOpenIdCallback(
  searchParams: URLSearchParams,
  expectedReturnTo: string,
  fetchFn: typeof fetch = fetch,
): Promise<OpenIdVerificationResult> {
  const mode = searchParams.get('openid.mode');
  const ns = searchParams.get('openid.ns');
  const claimedId = searchParams.get('openid.claimed_id');
  const identity = searchParams.get('openid.identity');
  const returnTo = searchParams.get('openid.return_to');
  const sig = searchParams.get('openid.sig');
  const signed = searchParams.get('openid.signed');

  if (mode !== 'id_res') {
    return { valid: false, error: 'INVALID_OPENID_MODE' };
  }

  if (ns !== OPENID_NS) {
    return { valid: false, error: 'INVALID_OPENID_NAMESPACE' };
  }

  if (!sig || !signed) {
    return { valid: false, error: 'MISSING_OPENID_SIGNATURE' };
  }

  if (!returnTo || !returnTo.startsWith(expectedReturnTo)) {
    return { valid: false, error: 'MISMATCHED_RETURN_TO' };
  }

  if (!claimedId || !identity || claimedId !== identity) {
    return { valid: false, error: 'MISMATCHED_CLAIMED_ID_AND_IDENTITY' };
  }

  const steamId64 = extractSteamId64FromClaimedId(claimedId);
  if (!steamId64) {
    return { valid: false, error: 'INVALID_STEAM_CLAIMED_ID_FORMAT' };
  }

  // Back-channel check_authentication request to Steam
  const verificationParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key.startsWith('openid.')) {
      verificationParams.set(key, value);
    }
  });
  verificationParams.set('openid.mode', 'check_authentication');

  try {
    const response = await fetchFn(STEAM_OPENID_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: verificationParams.toString(),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { valid: false, error: `STEAM_HTTP_${response.status}` };
    }

    const bodyText = await response.text();
    const isValid = /(^|\n)is_valid\s*:\s*true(\r|\n|$)/i.test(bodyText);

    if (!isValid) {
      return { valid: false, error: 'STEAM_CHECK_AUTHENTICATION_REJECTED' };
    }

    return {
      valid: true,
      steamId64,
    };
  } catch {
    return { valid: false, error: 'STEAM_VERIFICATION_NETWORK_ERROR' };
  }
}
