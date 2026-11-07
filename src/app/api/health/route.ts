// [Phase: MVP v1] Railway Zero-Downtime Healthcheck Endpoint (/api/health)
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'dota2-tournament-platform',
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
