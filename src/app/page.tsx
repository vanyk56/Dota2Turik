// Home page
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Swords,
  Gamepad2,
  Lock,
  Users,
  Trophy,
  Calendar,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { getCurrentUser } from '@/modules/auth/service';
import { listTournaments } from '@/modules/tournaments/service';
import {
  listCustomLobbies,
  LOBBY_GAME_MODE_LABELS,
} from '@/modules/lobbies/service';
import { searchTeamsCatalog } from '@/modules/catalog/service';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/states';
import { TeamCard } from '@/components/teams/team-card';
import { formatDate } from '@/lib/utils';

function SectionHeader({
  icon,
  title,
  href,
  linkLabel,
}: {
  icon: React.ReactNode;
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-text flex items-center gap-2">
        <span className="text-accent-light">{icon}</span>
        {title}
      </h2>
      <Link
        href={href}
        className="text-sm text-accent-light hover:text-text flex items-center gap-1 transition-colors"
      >
        {linkLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { authError?: string };
}) {
  const [user, tournaments, lobbies, catalog, t] = await Promise.all([
    getCurrentUser(),
    listTournaments(),
    listCustomLobbies({ limit: 6 }),
    searchTeamsCatalog({ limit: 6, sortBy: 'rating' }),
    getTranslations('home'),
  ]);

  const activeTournamentsCount = tournaments.filter(
    (tr) => tr.status === 'registration' || tr.status === 'in_progress',
  ).length;
  const openLobbies = lobbies.filter(
    (lb) => lb.status === 'waiting' || lb.status === 'in_progress',
  );

  const stats = [
    { label: t('statsActiveTournaments'), value: activeTournamentsCount },
    { label: t('statsRegisteredTeams'), value: catalog.total },
    { label: t('statsCompletedMatches'), value: openLobbies.length },
  ];

  return (
    <div className="space-y-12">
      {searchParams?.authError && (
        <div className="rounded-md bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
          Не удалось войти через Steam: <code>{searchParams.authError}</code>
        </div>
      )}

      {/* Hero */}
      <section className="glass-elevated rounded-lg px-8 py-12 md:px-12 md:py-16 relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent/20 blur-3xl"
        />
        <div className="relative max-w-2xl space-y-5">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-text leading-[1.1]">
            {t('title')}
          </h1>
          <p className="text-base md:text-lg text-text-muted">{t('subtitle')}</p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href="/lobbies">
              <Button variant="primary" size="lg">
                <Gamepad2 className="h-4 w-4" />
                Найти лобби
              </Button>
            </Link>
            <Link href="/tournaments">
              <Button variant="secondary" size="lg">
                <Swords className="h-4 w-4 text-accent-light" />
                {t('exploreTournaments')}
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative grid grid-cols-3 gap-3 mt-10 max-w-2xl">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-md bg-bg/60 border border-glass-border px-4 py-3"
            >
              <div className="text-2xl font-bold text-text">{s.value}</div>
              <div className="text-xs text-text-muted mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Lobbies */}
      <section className="space-y-4">
        <SectionHeader
          icon={<Gamepad2 className="h-5 w-5" />}
          title="Лобби"
          href="/lobbies"
          linkLabel="Все лобби"
        />

        {openLobbies.length === 0 ? (
          <EmptyState
            title="Пока нет лобби"
            actionLabel={user ? 'Создать лобби' : 'Войти через Steam'}
            actionHref={user ? '/lobbies/new' : '/api/auth/steam/login'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {openLobbies.slice(0, 3).map((lobby) => (
              <Card
                key={lobby.id}
                href={`/lobbies/${lobby.id}`}
                className="space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge
                    status={lobby.status}
                    label={lobby.status === 'waiting' ? 'Набор' : 'LIVE'}
                  />
                  {lobby.hasPassword && (
                    <Lock className="h-3.5 w-3.5 text-accent-light" />
                  )}
                </div>
                <div className="text-lg font-semibold text-text truncate">
                  {lobby.name}
                </div>
                <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-glass-border">
                  <span>{LOBBY_GAME_MODE_LABELS[lobby.gameMode]}</span>
                  <span className="font-mono text-text">
                    {lobby.activePlayersCount}/{lobby.maxPlayers}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Tournaments */}
      <section className="space-y-4">
        <SectionHeader
          icon={<Swords className="h-5 w-5" />}
          title={t('featuredTournaments')}
          href="/tournaments"
          linkLabel="Все турниры"
        />

        {tournaments.length === 0 ? (
          <EmptyState
            title="Пока нет турниров"
            actionLabel={user ? 'Создать турнир' : 'Войти через Steam'}
            actionHref={user ? '/tournaments/new' : '/api/auth/steam/login'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tournaments.slice(0, 6).map((tr) => (
              <Card
                key={tr.id}
                href={`/tournaments/${tr.slug}`}
                className="overflow-hidden space-y-3"
              >
                {tr.coverUrl && (
                  <div className="-mx-5 -mt-5 mb-3 h-36 overflow-hidden border-b border-glass-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tr.coverUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <StatusBadge status={tr.status} />
                <div className="text-lg font-semibold text-text truncate">
                  {tr.name}
                </div>
                <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-glass-border">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(tr.startsAt)}
                  </span>
                  <span className="font-mono text-text">
                    {tr._count.registrations}/{tr.maxTeams}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Teams */}
      <section className="space-y-4">
        <SectionHeader
          icon={<Trophy className="h-5 w-5" />}
          title={t('topTeams')}
          href="/teams"
          linkLabel="Все команды"
        />

        {catalog.items.length === 0 ? (
          <EmptyState
            title="Пока нет команд"
            actionLabel={user ? 'Создать команду' : 'Войти через Steam'}
            actionHref={user ? '/teams/new' : '/api/auth/steam/login'}
            icon={<Users className="h-5 w-5" />}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {catalog.items.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        )}
      </section>

      {user && (
        <div className="flex justify-center">
          <Link href="/teams/new">
            <Button variant="outline">
              <Plus className="h-4 w-4" />
              Создать команду
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
