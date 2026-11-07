// [Phase: MVP v1] Steam OpenID 2.0 Login Initiation Route Handler (Section 5)
import { NextRequest, NextResponse } from 'next/server';
import { buildSteamOpenIdLoginUrl } from '@/modules/auth/openid';
import { checkRateLimit } from '@/server/rate-limit';
import { getAppBaseUrl } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';

  const rate = await checkRateLimit({
    key: `steam_login:${ip}`,
    limit: 20,
    windowSeconds: 60,
  });

  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'TOO_MANY_LOGIN_ATTEMPTS' },
      { status: 429 },
    );
  }

  const appOrigin = getAppBaseUrl(request.nextUrl.origin);

  const returnTo = `${appOrigin}/api/auth/steam/callback`;
  const realm = appOrigin;

  const redirectUrl = buildSteamOpenIdLoginUrl(returnTo, realm);
  return NextResponse.redirect(redirectUrl);
}
