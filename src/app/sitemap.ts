// [Phase: MVP v1] Dynamic SEO Sitemap (Section 14)
import type { MetadataRoute } from 'next';
import { listTournaments } from '@/modules/tournaments/service';
import { searchTeamsCatalog } from '@/modules/catalog/service';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'http://localhost:3000';

  const [tournaments, catalog] = await Promise.all([
    listTournaments(),
    searchTeamsCatalog({ limit: 48 }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/tournaments`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/teams`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  const tournamentRoutes: MetadataRoute.Sitemap = tournaments.map((t) => ({
    url: `${baseUrl}/tournaments/${t.slug}`,
    lastModified: t.createdAt,
    changeFrequency: 'hourly',
    priority: 0.8,
  }));

  const teamRoutes: MetadataRoute.Sitemap = catalog.items.map((team) => ({
    url: `${baseUrl}/teams/${team.tag}`,
    lastModified: team.createdAt,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  return [...staticRoutes, ...tournamentRoutes, ...teamRoutes];
}
