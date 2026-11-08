// Lobbies directory
import Link from 'next/link';
import { Gamepad2, Lock, Plus, Server, Crown } from 'lucide-react';
import { getCurrentUser } from '@/modules/auth/service';
import {
  listCustomLobbies,
  LOBBY_GAME_MODE_LABELS,
} from '@/modules/lobbies/service';
import { getDotaBotStatus } from '@/modules/lobbies/dota-gc-bot';
import { PLATFORM_CONFIG } from '@/lib/config';
import { SteamBotCard } from '@/components/lobbies/steam-bot-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, FilterBar, PageHeader } from '@/components/ui/states';

export const metadata = {
  title: 'Лобби',
};

export default async function LobbiesPage({
  searchParams,
}: {
  searchParams?: {
    q?: string;
    access?: string;
    status?: string;
    gameMode?: string;
    region?: string;
  };
}) {
  const query = searchParams?.q ?? '';
  const access = searchParams?.access ?? 'ALL';
  const status = searchParams?.status ?? 'ALL';
  const gameMode = searchParams?.gameMode ?? 'ALL';
  const region = searchParams?.region ?? 'ALL';

  const user = await getCurrentUser();
  const isAdmin = user?.role === 'admin';

  const [lobbies, botStatus] = await Promise.all([
    listCustomLobbies({ query, access, status, gameMode, region }),
    isAdmin ? getDotaBotStatus() : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Лобби"
        actions={
          user ? (
            <Link href="/lobbies/new">
              <Button variant="primary">
                <Plus className="h-4 w-4" />
                Создать лобби
              </Button>
            </Link>
          ) : (
            <a href="/api/auth/steam/login">
              <Button variant="primary">Войти через Steam</Button>
            </a>
          )
        }
      />

      {isAdmin && botStatus && (
        <SteamBotCard botStatus={botStatus} returnTo="/lobbies" isAdmin />
      )}

      <form method="GET" action="/lobbies">
        <FilterBar>
          <Input
            name="q"
            defaultValue={query}
            placeholder="Поиск по названию или хосту"
            className="w-full sm:w-[240px]"
          />

          <Select name="access" defaultValue={access} className="w-[160px]">
            <option value="ALL">Любой вход</option>
            <option value="open">Свободный</option>
            <option value="password">По паролю</option>
          </Select>

          <Select name="status" defaultValue={status} className="w-[150px]">
            <option value="ALL">Все статусы</option>
            <option value="waiting">Набор</option>
            <option value="in_progress">Идёт игра</option>
            <option value="finished">Завершённые</option>
          </Select>

          <Select name="gameMode" defaultValue={gameMode} className="w-[170px]">
            <option value="ALL">Все режимы</option>
            <option value="all_pick">All Pick</option>
            <option value="captains_mode">Captains Mode</option>
            <option value="mid_only">1x1 Mid</option>
            <option value="random_draft">Random Draft</option>
            <option value="turbo">Turbo</option>
          </Select>

          <Select name="region" defaultValue={region} className="w-[120px]">
            <option value="ALL">Регион</option>
            {PLATFORM_CONFIG.regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>

          <Button type="submit" variant="primary">
            Найти
          </Button>
        </FilterBar>
      </form>

      {lobbies.length === 0 ? (
        <EmptyState
          title="Лобби не найдены"
          actionLabel={user ? 'Создать лобби' : 'Войти через Steam'}
          actionHref={user ? '/lobbies/new' : '/api/auth/steam/login'}
          icon={<Gamepad2 className="h-5 w-5" />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lobbies.map((lobby) => {
            const fillPercent = Math.min(
              100,
              Math.round((lobby.activePlayersCount / lobby.maxPlayers) * 100),
            );

            return (
              <Card
                key={lobby.id}
                href={`/lobbies/${lobby.id}`}
                className="flex flex-col gap-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge
                    status={lobby.status}
                    label={
                      lobby.status === 'waiting'
                        ? 'Набор'
                        : lobby.status === 'in_progress'
                          ? 'LIVE'
                          : 'Завершено'
                    }
                  />
                  {lobby.hasPassword && (
                    <span className="inline-flex items-center gap-1 text-xs text-accent-light">
                      <Lock className="h-3.5 w-3.5" />
                      Пароль
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="text-lg font-semibold text-text truncate">
                    {lobby.name}
                  </div>
                  <div className="text-xs text-text-muted mt-1 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <Gamepad2 className="h-3 w-3" />
                      {LOBBY_GAME_MODE_LABELS[lobby.gameMode]}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Server className="h-3 w-3" />
                      {lobby.region}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="h-1.5 w-full rounded-full bg-bg-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent-deep to-accent-light"
                      style={{ width: `${fillPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <Crown className="h-3 w-3 text-warning shrink-0" />
                      <span className="truncate">{lobby.host.nickname}</span>
                    </span>
                    <span className="font-mono text-text">
                      {lobby.activePlayersCount}/{lobby.maxPlayers}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
