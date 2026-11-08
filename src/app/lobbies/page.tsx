// [Phase: MVP v1] Custom Lobbies Directory Page (/lobbies) — Open & Password-Protected Dota 2 Game Rooms
import Link from 'next/link';
import {
  Gamepad2,
  Lock,
  Unlock,
  Plus,
  Users,
  Server,
  Crown,
  ArrowRight,
  LogIn,
} from 'lucide-react';
import { getCurrentUser } from '@/modules/auth/service';
import {
  listCustomLobbies,
  LOBBY_GAME_MODE_LABELS,
} from '@/modules/lobbies/service';
import { joinLobbyAction } from '@/modules/lobbies/actions';
import { PLATFORM_CONFIG } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, FilterBar, PageHeader } from '@/components/ui/states';

export const metadata = {
  title: 'Лобби (Лобаки 5x5 и 1x1)',
  description:
    'Пользовательские лобби Dota 2 со свободным входом или по паролю — создайте комнату или подключитесь к игре.',
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
  const lobbies = await listCustomLobbies({
    query,
    access,
    status,
    gameMode,
    region,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Лобби Dota 2 (Лобаки 5x5 и 1x1)"
        subtitle="Создайте собственную комнату (со свободным входом или по паролю) либо подключитесь к готовому лобби за Силы Света или Силы Тьмы."
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
              <Button variant="primary">Войти через Steam для создания лобби</Button>
            </a>
          )
        }
      />

      <form method="GET" action="/lobbies">
        <FilterBar>
          <Input
            name="q"
            defaultValue={query}
            placeholder="Поиск по названию лобби или создателю..."
            className="w-full sm:w-[260px]"
          />

          <Select name="access" defaultValue={access} className="w-[190px]">
            <option value="ALL">Любой вход (Все)</option>
            <option value="open">🔓 Свободный вход</option>
            <option value="password">🔒 По паролю</option>
          </Select>

          <Select name="status" defaultValue={status} className="w-[180px]">
            <option value="ALL">Все статусы</option>
            <option value="waiting">Открыт набор</option>
            <option value="in_progress">Идёт игра (LIVE)</option>
            <option value="finished">Завершённые</option>
          </Select>

          <Select name="gameMode" defaultValue={gameMode} className="w-[190px]">
            <option value="ALL">Все режимы</option>
            <option value="all_pick">All Pick 5x5</option>
            <option value="captains_mode">Captains Mode 5x5</option>
            <option value="mid_only">1x1 / Mid Only</option>
            <option value="random_draft">Random Draft</option>
            <option value="turbo">Turbo</option>
          </Select>

          <Select name="region" defaultValue={region} className="w-[140px]">
            <option value="ALL">Все регионы</option>
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
          title="Активных лобби не найдено"
          description="Сейчас нет комнат по выбранным фильтрам. Создайте первый открытый или закрытый лобак прямо сейчас!"
          actionLabel={user ? 'Создать лобби' : 'Войти через Steam'}
          actionHref={user ? '/lobbies/new' : '/api/auth/steam/login'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {lobbies.map((lobby) => {
            const isMember = Boolean(
              user && lobby.participants.some((p) => p.userId === user.id),
            );
            const isFull = lobby.activePlayersCount >= lobby.maxPlayers;
            const canQuickJoin =
              lobby.status === 'waiting' && !isFull && !isMember;
            const radiantPlayers = lobby.participants.filter(
              (p) => p.side === 'radiant',
            );
            const direPlayers = lobby.participants.filter(
              (p) => p.side === 'dire',
            );
            const fillPercent = Math.min(
              100,
              Math.round((lobby.activePlayersCount / lobby.maxPlayers) * 100),
            );

            return (
              <Card
                key={lobby.id}
                className="flex flex-col justify-between gap-4 hover:border-white/20 transition-all"
              >
                <div className="space-y-3">
                  {/* Top Badges: Status + Open/Password */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <StatusBadge
                      status={lobby.status}
                      label={
                        lobby.status === 'waiting'
                          ? 'Открыт набор'
                          : lobby.status === 'in_progress'
                            ? 'Идёт игра • LIVE'
                            : 'Завершён'
                      }
                    />

                    {lobby.hasPassword ? (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-accent/15 border border-accent/40 px-2.5 py-0.5 text-xs font-semibold text-accent">
                        <Lock className="h-3 w-3" />
                        По паролю
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-success/15 border border-success/30 px-2.5 py-0.5 text-xs font-semibold text-success">
                        <Unlock className="h-3 w-3" />
                        Свободный вход
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <Link
                      href={`/lobbies/${lobby.id}`}
                      className="block text-lg font-bold text-text hover:text-accent transition-colors"
                    >
                      {lobby.name}
                    </Link>
                    {lobby.description && (
                      <p className="text-xs text-text-muted line-clamp-2 mt-1">
                        {lobby.description}
                      </p>
                    )}
                  </div>

                  {/* Mode & Server Info */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-sm border border-glass-border bg-bg-elevated p-2">
                      <div className="text-text-muted flex items-center gap-1">
                        <Gamepad2 className="h-3 w-3 text-accent" />
                        Режим
                      </div>
                      <div className="font-semibold text-text mt-0.5 truncate">
                        {LOBBY_GAME_MODE_LABELS[lobby.gameMode]}
                      </div>
                    </div>

                    <div className="rounded-sm border border-glass-border bg-bg-elevated p-2">
                      <div className="text-text-muted flex items-center gap-1">
                        <Server className="h-3 w-3 text-accent" />
                        Сервер
                      </div>
                      <div className="font-semibold text-text mt-0.5 truncate">
                        {lobby.serverLocation} ({lobby.region})
                      </div>
                    </div>
                  </div>

                  {/* Players Progress Bar & Side Split */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-accent" />
                        Игроки в лобби:
                      </span>
                      <span className="font-mono font-bold text-text">
                        {lobby.activePlayersCount} / {lobby.maxPlayers}
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-bg-elevated overflow-hidden border border-glass-border">
                      <div
                        className="h-full bg-accent transition-all"
                        style={{ width: `${fillPercent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted pt-0.5">
                      <span className="text-success font-medium">
                        Силы Света: {radiantPlayers.length}/
                        {Math.floor(lobby.maxPlayers / 2)}
                      </span>
                      <span className="text-danger font-medium">
                        Силы Тьмы: {direPlayers.length}/
                        {Math.floor(lobby.maxPlayers / 2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer: Host + Quick Join / Open Room */}
                <div className="pt-3 border-t border-glass-border space-y-3">
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span className="flex items-center gap-1.5 truncate">
                      <Crown className="h-3.5 w-3.5 text-warning shrink-0" />
                      Хост:{' '}
                      <strong className="text-text truncate">
                        {lobby.host.nickname}
                      </strong>
                    </span>

                    <Link
                      href={`/lobbies/${lobby.id}`}
                      className="text-accent hover:underline font-medium inline-flex items-center gap-1 shrink-0"
                    >
                      Комната
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>

                  {isMember ? (
                    <Link href={`/lobbies/${lobby.id}`} className="block">
                      <Button variant="primary" size="sm" className="w-full">
                        Вы в лобби • Перейти к слотам
                      </Button>
                    </Link>
                  ) : canQuickJoin ? (
                    user ? (
                      lobby.hasPassword ? (
                        <form
                          action={joinLobbyAction}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="lobbyId"
                            value={lobby.id}
                          />
                          <Input
                            name="password"
                            type="password"
                            placeholder="Пароль лобби..."
                            className="h-8 text-xs"
                            required
                          />
                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            className="shrink-0"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            Войти
                          </Button>
                        </form>
                      ) : (
                        <form action={joinLobbyAction}>
                          <input
                            type="hidden"
                            name="lobbyId"
                            value={lobby.id}
                          />
                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            className="w-full"
                          >
                            <LogIn className="h-3.5 w-3.5" />
                            Подключиться (Свободный вход)
                          </Button>
                        </form>
                      )
                    ) : (
                      <a href="/api/auth/steam/login" className="block">
                        <Button variant="secondary" size="sm" className="w-full">
                          Войти через Steam для подключения
                        </Button>
                      </a>
                    )
                  ) : (
                    <Link href={`/lobbies/${lobby.id}`} className="block">
                      <Button variant="secondary" size="sm" className="w-full">
                        Открыть комнату лобби
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
