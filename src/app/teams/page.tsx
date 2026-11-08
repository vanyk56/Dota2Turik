// [Phase: MVP v1] Team Catalog Page (/teams) with URL Filters, Pagination & Right Detail Panel (Section 8)
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Plus, Search, KeyRound } from 'lucide-react';
import { getCurrentUser } from '@/modules/auth/service';
import { searchTeamsCatalog } from '@/modules/catalog/service';
import { joinByInviteTokenAction } from '@/modules/teams/actions';
import { PLATFORM_CONFIG } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import {
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
} from '@/components/ui/states';
import { TeamCard } from '@/components/teams/team-card';

export default async function TeamsCatalogPage({
  searchParams,
}: {
  searchParams?: {
    q?: string;
    region?: string;
    country?: string;
    status?: string;
    rosterFill?: 'all' | 'full' | 'open';
    sortBy?: 'rating' | 'tournaments' | 'wins' | 'created';
    page?: string;
    
  };
}) {
  const query = searchParams?.q ?? '';
  const region = searchParams?.region ?? 'ALL';
  const country = searchParams?.country ?? 'ALL';
  const status = searchParams?.status ?? 'ALL';
  const rosterFill = searchParams?.rosterFill ?? 'all';
  const sortBy = searchParams?.sortBy ?? 'rating';
  const page = Math.max(1, Number(searchParams?.page ?? 1));

  const [user, catalog, t] = await Promise.all([
    getCurrentUser(),
    searchTeamsCatalog({
      query,
      region,
      country,
      status,
      rosterFill,
      sortBy,
      page,
      limit: 12,
    }),
    getTranslations('teams'),
  ]);

  const buildUrl = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = {
      q: query || undefined,
      region: region !== 'ALL' ? region : undefined,
      country: country !== 'ALL' ? country : undefined,
      status: status !== 'ALL' ? status : undefined,
      rosterFill: rosterFill !== 'all' ? rosterFill : undefined,
      sortBy: sortBy !== 'rating' ? sortBy : undefined,
      page: page > 1 ? page : undefined,
      ...overrides,
    };
    Object.entries(merged).forEach(([k, v]) => {
      if (v !== undefined && v !== '') {
        params.set(k, String(v));
      }
    });
    const qs = params.toString();
    return qs ? `/teams?${qs}` : '/teams';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('catalogTitle')}
        subtitle={t('catalogSubtitle')}
        actions={
          user ? (
            <Link href="/teams/new">
              <Button variant="primary">
                <Plus className="h-4 w-4" />
                {t('createTeam')}
              </Button>
            </Link>
          ) : (
            <a href="/api/auth/steam/login">
              <Button variant="primary">Войти для создания команды</Button>
            </a>
          )
        }
      />

      {/* Quick join by invite code */}
      {user && (
        <form
          action={joinByInviteTokenAction}
          className="glass-panel rounded-md p-3 flex flex-col sm:flex-row items-center gap-3"
        >
          <div className="flex items-center gap-2 text-sm text-text-muted shrink-0">
            <KeyRound className="h-4 w-4 text-accent-light" />
            Код приглашения
          </div>
          <Input
            name="token"
            placeholder="Вставьте код..."
            className="flex-1 h-9 text-xs font-mono"
            required
          />
          <Button type="submit" variant="secondary" size="sm">
            Вступить
          </Button>
        </form>
      )}

      {/* URL-Synced Search & Filter Bar */}
      <form method="GET" action="/teams">
        <FilterBar>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 text-text-muted absolute left-3 top-3" />
            <Input
              name="q"
              defaultValue={query}
              placeholder={t('searchPlaceholder')}
              className="pl-9"
            />
          </div>

          <Select name="region" defaultValue={region} className="w-[140px]">
            <option value="ALL">{t('allRegions')}</option>
            {PLATFORM_CONFIG.regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>

          <Select name="country" defaultValue={country} className="w-[160px]">
            <option value="ALL">{t('allCountries')}</option>
            {PLATFORM_CONFIG.countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </Select>

          <Select name="status" defaultValue={status} className="w-[160px]">
            <option value="ALL">{t('allStatuses')}</option>
            <option value="active">Active</option>
            <option value="recruiting">Recruiting</option>
            <option value="inactive">Inactive</option>
          </Select>

          <Select
            name="rosterFill"
            defaultValue={rosterFill}
            className="w-[155px]"
          >
            <option value="all">Любой состав</option>
            <option value="full">Полный (5/5)</option>
            <option value="open">Ищут игроков (&lt;5)</option>
          </Select>

          <Select name="sortBy" defaultValue={sortBy} className="w-[175px]">
            <option value="rating">{t('sortByRating')}</option>
            <option value="wins">По числу побед</option>
            <option value="tournaments">{t('sortByTournaments')}</option>
            <option value="created">{t('sortByCreated')}</option>
          </Select>

          <Button type="submit" variant="primary" size="md">
            Применить
          </Button>
        </FilterBar>
      </form>

      {/* Catalog Grid */}
      {catalog.items.length === 0 ? (
        <EmptyState
          title={t('noTeamsFound')}
          actionLabel={user ? t('createTeam') : undefined}
          actionHref={user ? '/teams/new' : undefined}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {catalog.items.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>

          <Pagination
            page={catalog.page}
            totalPages={catalog.totalPages}
            buildHref={(targetPage) => buildUrl({ page: targetPage })}
          />
        </div>
      )}
    </div>
  );
}
