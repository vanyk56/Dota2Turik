// [Phase: MVP v1] CSRF Origin Verification for Route Handlers (Section 14)
import { NextRequest } from 'next/server';

export function verifyRequestOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) {
    return false;
  }
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}
