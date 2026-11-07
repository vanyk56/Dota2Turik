// [Phase: MVP v1] Logout Route Handler with CSRF Origin Check (Section 5 & 14)
import { NextRequest, NextResponse } from 'next/server';
import { revokeCurrentSession } from '@/modules/auth/service';
import { verifyRequestOrigin } from '@/server/csrf';
import { getAppBaseUrl } from '@/lib/config';

export async function POST(request: NextRequest) {
  if (!verifyRequestOrigin(request)) {
    return NextResponse.json({ error: 'INVALID_ORIGIN_CSRF' }, { status: 403 });
  }

  await revokeCurrentSession();
  const appOrigin = getAppBaseUrl(request.nextUrl.origin);

  return NextResponse.redirect(`${appOrigin}/`, { status: 303 });
}
