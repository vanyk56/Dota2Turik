// [Phase: MVP v1] Team Catalog Search, Filtering, Sorting & Pagination Service (Section 8)
import { Prisma, type TeamStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { PLATFORM_CONFIG } from '@/lib/config';
import { calculateRosterCounts } from '@/modules/teams/rules';

export interface CatalogFilterInput {
  query?: string;
  region?: string;
  country?: string;
  status?: string;
  rosterFill?: 'all' | 'full' | 'open';
  sortBy?: 'rating' | 'tournaments' | 'wins' | 'created';
  page?: number;
  limit?: number;
}

export interface TeamCardView {
  id: string;
  name: string;
  tag: string;
  logoUrl: string | null;
  country: string;
  region: string;
  status: TeamStatus;
  ratingPoints: number;
  rankPosition: number;
  mainRosterCount: number;
  substituteCount: number;
  captain: {
    id: string;
    nickname: string;
    steamId64: string;
    avatarUrl: string | null;
  } | null;
  tournamentsCount: number;
  winsCount: number;
  createdAt: Date;
}

export async function searchTeamsCatalog(input: CatalogFilterInput) {
  const page = Math.max(1, Number(input.page ?? 1));
  const limit = Math.min(
    PLATFORM_CONFIG.catalog.maxPageSize,
    Math.max(1, Number(input.limit ?? PLATFORM_CONFIG.catalog.defaultPageSize)),
  );
  const offset = (page - 1) * limit;

  try {
    const where: Prisma.TeamWhereInput = {};

    if (input.query && input.query.trim().length > 0) {
      const q = input.query.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { tag: { contains: q, mode: 'insensitive' } },
        {
          memberships: {
            some: {
              isActive: true,
              user: {
                nickname: { contains: q, mode: 'insensitive' },
              },
            },
          },
        },
      ];
    }

    if (input.region && input.region !== 'ALL') {
      where.region = input.region.toUpperCase();
    }

    if (input.country && input.country !== 'ALL') {
      where.country = input.country.toUpperCase();
    }

    if (
      input.status &&
      (input.status === 'active' ||
        input.status === 'recruiting' ||
        input.status === 'inactive')
    ) {
      where.status = input.status;
    }

    let orderBy: Prisma.TeamOrderByWithRelationInput = { ratingPoints: 'desc' };
    if (input.sortBy === 'created') {
      orderBy = { createdAt: 'desc' };
    } else if (input.sortBy === 'tournaments') {
      orderBy = { registrations: { _count: 'desc' } };
    } else if (input.sortBy === 'wins') {
      orderBy = { matchesWon: { _count: 'desc' } };
    }

    const [teams, total, allRatings] = await Promise.all([
      db.team.findMany({
        where,
        include: {
          memberships: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  nickname: true,
                  steamId64: true,
                  avatarUrl: true,
                },
              },
            },
          },
          _count: {
            select: {
              registrations: { where: { status: 'approved' } },
              matchesWon: true,
            },
          },
        },
        orderBy,
        skip: offset,
        take: limit,
      }),
      db.team.count({ where }),
      db.team.findMany({
        select: { id: true, ratingPoints: true },
        orderBy: [{ ratingPoints: 'desc' }, { createdAt: 'asc' }],
      }),
    ]);

    const rankMap = new Map<string, number>();
    allRatings.forEach((t, idx) => {
      rankMap.set(t.id, idx + 1);
    });

    const mapped: TeamCardView[] = teams
      .map((team) => {
        const counts = calculateRosterCounts(team.memberships);
        const captainMember = team.memberships.find(
          (m) => m.role === 'captain',
        );
        return {
          id: team.id,
          name: team.name,
          tag: team.tag,
          logoUrl: team.logoUrl,
          country: team.country,
          region: team.region,
          status: team.status,
          ratingPoints: team.ratingPoints,
          rankPosition: rankMap.get(team.id) ?? 1,
          mainRosterCount: counts.mainCount,
          substituteCount: counts.substituteCount,
          captain: captainMember ? captainMember.user : null,
          tournamentsCount: team._count.registrations,
          winsCount: team._count.matchesWon,
          createdAt: team.createdAt,
        };
      })
      .filter((card) => {
        if (input.rosterFill === 'full') {
          return card.mainRosterCount >= PLATFORM_CONFIG.roster.maxMainPlayers;
        }
        if (input.rosterFill === 'open') {
          return card.mainRosterCount < PLATFORM_CONFIG.roster.maxMainPlayers;
        }
        return true;
      });

    return {
      items: mapped,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  } catch {
    return {
      items: [] as TeamCardView[],
      total: 0,
      page: 1,
      limit,
      totalPages: 1,
    };
  }
}
