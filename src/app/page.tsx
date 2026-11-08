// [Phase: MVP v1] Home / Landing Page — Powered Strictly by Real Module Services & DB
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Swords, Users, Trophy, Calendar, ArrowRight, Plus } from 'lucide-react';
import { getCurrentUser } from '@/modules/auth/service';
import { listTournaments } from '@/modules/tournaments/service';
import { searchTeamsCatalog } from '@/modules/catalog/service';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/states';
import { TeamCard } from '@/components/teams/team-card';
import { formatDate } from '@/lib/utils';

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { authError?: string };
}) {
  const [user, tournaments, catalog, t] = await Promise.all([
    getCurrentUser(),
    listTournaments(),
    searchTeamsCatalog({ limit: 6, sortBy: 'rating' }),
    getTranslations('home'),
  ]);

  const activeTournamentsCount = tournaments.filter(
    (tr) => tr.status === 'registration' || tr.status === 'in_progress',
  ).length;

  const totalMatchesCount = tournaments.reduce(
    (acc, tr) => acc + tr._count.matches,
    0,
  );

  return (
    <div className="space-y-12">
      {/* Auth Error Alert */}
      {searchParams?.authError && (
        <div className="rounded-md bg-danger/15 border border-danger/30 px-4 py-3 text-sm text-danger">
          Ошибка входа через Steam OpenID: <code>{searchParams.authError}</code>
        </div>
      )}

      {/* Hero Section */}
      <section className="glass-elevated rounded-lg p-8 md:p-10 border border-glass-border relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-2xl space-y-5">
            <span className="inline-flex items-center gap-2 rounded-sm bg-accent-soft border border-accent/30 px-3 py-1 text-xs font-semibold text-accent">
              <Swords className="h-3.5 w-3.5" />
              Dota turnir • {t('badge')}
            </span>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-text leading-tight">
              {t('title')}
            </h1>
            <p className="text-base text-text-muted leading-relaxed">
              {t('subtitle')}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/tournaments">
                <Button variant="primary" size="lg">
                  <Swords className="h-4 w-4" />
                  {t('exploreTournaments')}
                </Button>
              </Link>
              <Link href="/teams">
                <Button variant="secondary" size="lg">
                  <Users className="h-4 w-4 text-accent" />
                  {t('browseTeams')}
                </Button>
              </Link>
              {user && (
                <Link href="/tournaments/new">
                  <Button variant="outline" size="lg">
                    <Plus className="h-4 w-4 text-accent" />
                    Создать турнир
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="hidden lg:flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Dota turnir"
              className="h-44 w-44 object-contain drop-shadow-[0_0_28px_rgba(139,92,246,0.4)]"
            />
          </div>
        </div>

        {/* Real Platform Metrics from DB */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-8 border-t border-glass-border">
          <div className="bg-bg/80 rounded-md p-4 border border-glass-border">
            <div className="text-xs text-text-muted">{t('statsActiveTournaments')}</div>
            <div className="text-2xl font-bold text-text mt-1">
              {activeTournamentsCount}
            </div>
          </div>
          <div className="bg-bg/80 rounded-md p-4 border border-glass-border">
            <div className="text-xs text-text-muted">{t('statsRegisteredTeams')}</div>
            <div className="text-2xl font-bold text-text mt-1">
              {catalog.total}
            </div>
          </div>
          <div className="bg-bg/80 rounded-md p-4 border border-glass-border">
            <div className="text-xs text-text-muted">{t('statsCompletedMatches')}</div>
            <div className="text-2xl font-bold text-accent mt-1">
              {totalMatchesCount}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Tournaments */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-text flex items-center gap-2">
            <Swords className="h-5 w-5 text-accent" />
            {t('featuredTournaments')}
          </h2>
          <Link
            href="/tournaments"
            className="text-xs font-medium text-accent hover:underline flex items-center gap-1"
          >
            Все турниры
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {tournaments.length === 0 ? (
          <EmptyState
            title="Активных турниров пока нет"
            description="Создайте первый турнир на платформе или запустите prisma db seed для генерации демонстрационных турниров и 16 команд."
            actionLabel={user ? 'Создать турнир' : 'Войти через Steam'}
            actionHref={user ? '/tournaments/new' : '/api/auth/steam/login'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tournaments.slice(0, 6).map((tr) => (
              <Card
                key={tr.id}
                className="flex flex-col justify-between gap-4 hover:border-white/20 overflow-hidden"
              >
                <div className="space-y-2.5">
                  {tr.coverUrl && (
                    <div className="-mx-5 -mt-5 mb-3 h-36 overflow-hidden border-b border-glass-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={tr.coverUrl}
                        alt={tr.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={tr.status} />
                    <span className="text-xs font-mono text-text-muted uppercase">
                      {tr.region} • {tr.format === 'round_robin' ? 'Round Robin' : 'Single Elim'}
                    </span>
                  </div>
                  <Link
                    href={`/tournaments/${tr.slug}`}
                    className="block text-lg font-bold text-text hover:text-accent transition-colors"
                  >
                    {tr.name}
                  </Link>
                  <p className="text-xs text-text-muted line-clamp-2">
                    {tr.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-glass-border flex items-center justify-between text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-accent" />
                    {formatDate(tr.startsAt)}
                  </span>
                  <span>
                    Команд:{' '}
                    <strong className="text-text">
                      {tr._count.registrations}/{tr.maxTeams}
                    </strong>
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Top Platform Teams */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-text flex items-center gap-2">
            <Trophy className="h-5 w-5 text-accent" />
            {t('topTeams')}
          </h2>
          <Link
            href="/teams"
            className="text-xs font-medium text-accent hover:underline flex items-center gap-1"
          >
            Каталог команд
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {catalog.items.length === 0 ? (
          <EmptyState
            title="В каталоге пока нет команд"
            description="Зарегистрируйте свою команду после входа через Steam, чтобы участвовать в турнирах."
            actionLabel={user ? 'Создать команду' : 'Войти через Steam'}
            actionHref={user ? '/teams/new' : '/api/auth/steam/login'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {catalog.items.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
