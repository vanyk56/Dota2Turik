// [Phase: MVP v1] Steam OpenID 2.0 Callback & Verification Route Handler (Section 5)
import { NextRequest, NextResponse } from 'next/server';
import { verifySteamOpenIdCallback } from '@/modules/auth/openid';
import { createServerSession, upsertUserFromSteam } from '@/modules/auth/service';
import { recordAuditLog } from '@/modules/audit/service';
import { generateRequestId } from '@/server/crypto';
import { getAppBaseUrl } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const appOrigin = getAppBaseUrl(request.nextUrl.origin);
  const expectedReturnTo = `${appOrigin}/api/auth/steam/callback`;

  try {
    const verification = await verifySteamOpenIdCallback(
      request.nextUrl.searchParams,
      expectedReturnTo,
    );

    if (!verification.valid || !verification.steamId64) {
      console.error(`[${requestId}] Steam OpenID verification failed:`, verification.error);
      return NextResponse.redirect(
        `${appOrigin}/?authError=${encodeURIComponent(verification.error ?? 'OPENID_INVALID')}`,
      );
    }

    const user = await upsertUserFromSteam(verification.steamId64);

    if (user.isBlocked) {
      return NextResponse.redirect(`${appOrigin}/?authError=USER_BLOCKED`);
    }

    await createServerSession(user.id, request.headers.get('user-agent'));

    await recordAuditLog({
      actorId: user.id,
      action: 'auth.steam.login',
      entityType: 'User',
      entityId: user.id,
      payload: { steamId64: user.steamId64, requestId },
    });

    return NextResponse.redirect(`${appOrigin}/players/${user.steamId64}`);
  } catch (error) {
    console.error(`[${requestId}] Steam callback error:`, error);
    return NextResponse.redirect(`${appOrigin}/?authError=SERVER_ERROR`);
  }
}
