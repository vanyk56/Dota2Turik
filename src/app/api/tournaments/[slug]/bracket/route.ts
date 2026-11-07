// [Phase: MVP v1] Bracket Polling Route Handler (Section 15: 10s interval when tab is active)
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/modules/auth/service';
import { getTournamentBySlug } from '@/modules/tournaments/service';

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const viewer = await getCurrentUser();
  const tournament = await getTournamentBySlug(params.slug, viewer);

  if (!tournament) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({
    status: tournament.status,
    matches: tournament.matches,
    brackets: tournament.brackets,
    roundRobinStandings: tournament.roundRobinStandings,
    updatedAt: new Date().toISOString(),
  });
}
