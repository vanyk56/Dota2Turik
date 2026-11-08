// [Phase: MVP v1] Tournaments Directory Page (/tournaments) (Section 10)
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Plus, Calendar, Trophy, Users, Swords } from 'lucide-react';
import { getCurrentUser } from '@/modules/auth/service';
import { listTournaments } from '@/modules/tournaments/service';
import { PLATFORM_CONFIG } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, FilterBar, PageHeader } from '@/components/ui/states';
import { formatDate } from '@/lib/utils';

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams?: {
    status?: string;
    region?: string;
    format?: string;
  };
}) {
  const status = searchParams?.status ?? 'ALL';
  const region = searchParams?.region ?? 'ALL';
  const format = searchParams?.format ?? 'ALL';

  const user = await getCurrentUser();
  const [tournaments, t] = await Promise.all([
    listTournaments({
      status,
      region,
      format,
      viewerId: user?.id ?? null,
      viewerRole: user?.role ?? null,
    }),
    getTranslations('tournaments'),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          user ? (
            <Link href="/tournaments/new">
              <Button variant="primary">
                <Plus className="h-4 w-4" />
                {t('createTournament')}
              </Button>
            </Link>
          ) : (
            <a href="/api/auth/steam/login">
              <Button variant="primary">Войти для создания турнира</Button>
            </a>
          )
        }
      />

      <form method="GET" action="/tournaments">
        <FilterBar>
          <Select name="status" defaultValue={status} className="w-[180px]">
            <option value="ALL">Все статусы</option>
            <option value="registration">Регистрация</option>
            <option value="in_progress">Идёт турнир</option>
            <option value="finished">Завершён</option>
            <option value="cancelled">Отменён</option>
            {user && <option value="draft">Мои черновики (Draft)</option>}
          </Select>

          <Select name="format" defaultValue={format} className="w-[200px]">
            <option value="ALL">Все форматы</option>
            <option value="single_elimination">Single Elimination</option>
            <option value="round_robin">Round Robin</option>
          </Select>

          <Select name="region" defaultValue={region} className="w-[150px]">
            <option value="ALL">Все регионы</option>
            {PLATFORM_CONFIG.regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>

          <Button type="submit" variant="primary">
            Фильтровать
          </Button>
        </FilterBar>
      </form>

      {tournaments.length === 0 ? (
        <EmptyState
          title="Турниры не найдены"
          description="По выбранным фильтрам нет турниров. Создайте новый турнир или сбросьте фильтры."
          actionLabel={user ? t('createTournament') : undefined}
          actionHref={user ? '/tournaments/new' : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tournaments.map((tr) => (
            <Card
              key={tr.id}
              className="flex flex-col justify-between gap-4 hover:border-white/20 overflow-hidden"
            >
              <div className="space-y-3">
                {tr.coverUrl && (
                  <div className="-mx-5 -mt-5 mb-3 h-40 overflow-hidden border-b border-glass-border">
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
                  <span className="text-xs font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-sm border border-accent/30 uppercase">
                    {tr.levelWeight}
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

                <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                  <div className="bg-bg-elevated rounded-sm p-2 border border-glass-border">
                    <div className="text-text-muted flex items-center gap-1">
                      <Swords className="h-3 w-3 text-accent" />
                      Формат
                    </div>
                    <div className="font-semibold text-text mt-0.5">
                      {tr.format === 'round_robin'
                        ? 'Round Robin'
                        : 'Single Elim'}
                    </div>
                  </div>

                  <div className="bg-bg-elevated rounded-sm p-2 border border-glass-border">
                    <div className="text-text-muted flex items-center gap-1">
                      <Trophy className="h-3 w-3 text-accent" />
                      Призовой фонд
                    </div>
                    <div className="font-semibold text-text truncate mt-0.5">
                      {tr.prizePool || 'Рейтинговые очки'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-glass-border flex items-center justify-between text-xs text-text-muted">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-accent" />
                  {formatDate(tr.startsAt)} • {tr.region}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-accent" />
                  <strong className="text-text">
                    {tr._count.registrations}/{tr.maxTeams}
                  </strong>
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
