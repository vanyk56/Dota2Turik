// Lobby room
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Gamepad2,
  Lock,
  Unlock,
  Crown,
  CheckCircle2,
  Clock,
  Shuffle,
  Play,
  Trophy,
  LogOut,
  UserMinus,
  Eye,
  ArrowLeft,
  Server,
  AlertTriangle,
} from 'lucide-react';
import type { LobbySide } from '@prisma/client';
import { getCurrentUser } from '@/modules/auth/service';
import {
  DOTA_POSITION_LABELS,
  getCustomLobbyById,
  LOBBY_GAME_MODE_LABELS,
} from '@/modules/lobbies/service';
import { getDotaBotStatus } from '@/modules/lobbies/dota-gc-bot';
import { SteamBotCard } from '@/components/lobbies/steam-bot-card';
import {
  joinLobbyAction,
  kickLobbyPlayerAction,
  leaveLobbyAction,
  shuffleLobbyTeamsAction,
  switchLobbySlotAction,
  toggleLobbyReadyAction,
  updateLobbyAccessAction,
  updateLobbyStatusAction,
} from '@/modules/lobbies/actions';
import {
  CopyableField,
  LobbyAutoRefresh,
} from '@/components/lobbies/lobby-live-controls';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_LOBBY_PASSWORD: 'Неверный пароль',
  PASSWORD_REQUIRED_TO_JOIN: 'Введите пароль лобби, чтобы занять слот',
  LOBBY_FULL: 'Все слоты заняты',
  SLOT_ALREADY_TAKEN: 'Слот уже занят',
  TOO_MANY_PASSWORD_ATTEMPTS: 'Слишком много попыток, подождите минуту',
  LOBBY_NOT_ACCEPTING_PLAYERS: 'Набор игроков закрыт',
  BOT_NOT_READY_IN_GC: 'Бот не в сети',
};

type LobbyView = NonNullable<Awaited<ReturnType<typeof getCustomLobbyById>>>;

function SideColumn({
  side,
  lobby,
  maxPerSide,
  userId,
  hasJoined,
  loggedIn,
}: {
  side: 'radiant' | 'dire';
  lobby: LobbyView;
  maxPerSide: number;
  userId: string | null;
  hasJoined: boolean;
  loggedIn: boolean;
}) {
  const isRadiant = side === 'radiant';
  const title = isRadiant ? 'Силы Света' : 'Силы Тьмы';
  const dot = isRadiant ? 'bg-success' : 'bg-danger';
  const tint = isRadiant
    ? 'bg-success/10 border-success/30 text-success'
    : 'bg-danger/10 border-danger/30 text-danger';
  const slots = Array.from({ length: maxPerSide }, (_, i) => i + 1);
  const count = lobby.participants.filter((p) => p.side === side).length;
  const canTakeSlot = hasJoined || !lobby.hasPassword || lobby.canManage;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between pb-3 border-b border-glass-border">
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
          <h2 className="text-base font-semibold text-text">{title}</h2>
        </div>
        <span className="text-xs font-mono text-text-muted">
          {count}/{maxPerSide}
        </span>
      </div>

      <div className="space-y-2">
        {slots.map((slotNum) => {
          const occupant = lobby.participants.find(
            (p) => p.side === side && p.slot === slotNum,
          );
          const posLabel =
            maxPerSide === 1
              ? 'Solo Mid'
              : DOTA_POSITION_LABELS[slotNum] ?? `Слот ${slotNum}`;
          const isMe = Boolean(userId && occupant?.userId === userId);

          return (
            <div
              key={`${side}-${slotNum}`}
              className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 ${
                occupant
                  ? isMe
                    ? 'border-accent/50 bg-accent-soft'
                    : 'border-glass-border bg-bg-elevated'
                  : 'border-dashed border-glass-border'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border font-mono text-xs font-semibold ${tint}`}
                >
                  {slotNum}
                </div>

                {occupant ? (
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/players/${occupant.user.steamId64}`}
                        className="text-sm font-medium text-text hover:text-accent-light truncate"
                      >
                        {occupant.user.nickname}
                      </Link>
                      {occupant.userId === lobby.hostId && (
                        <Crown className="h-3 w-3 text-warning shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-text-muted">{posLabel}</div>
                  </div>
                ) : (
                  <div className="text-sm text-text-muted">{posLabel}</div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {occupant ? (
                  <>
                    {occupant.isReady ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Clock className="h-4 w-4 text-text-muted" />
                    )}

                    {lobby.canManage &&
                      lobby.status === 'waiting' &&
                      occupant.userId !== userId && (
                        <form action={kickLobbyPlayerAction}>
                          <input type="hidden" name="lobbyId" value={lobby.id} />
                          <input
                            type="hidden"
                            name="targetUserId"
                            value={occupant.userId}
                          />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-danger"
                            title="Исключить"
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      )}
                  </>
                ) : (
                  lobby.status === 'waiting' &&
                  (!loggedIn ? (
                    <a href="/api/auth/steam/login">
                      <Button variant="ghost" size="sm">
                        Войти
                      </Button>
                    </a>
                  ) : canTakeSlot ? (
                    <form action={switchLobbySlotAction}>
                      <input type="hidden" name="lobbyId" value={lobby.id} />
                      <input type="hidden" name="side" value={side} />
                      <input type="hidden" name="slot" value={String(slotNum)} />
                      <Button type="submit" variant="secondary" size="sm">
                        {hasJoined ? 'Сюда' : 'Занять'}
                      </Button>
                    </form>
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-text-muted" />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default async function LobbyDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { error?: string; botInvited?: string };
}) {
  const user = await getCurrentUser();
  const [lobby, botStatus] = await Promise.all([
    getCustomLobbyById(params.id, user?.id ?? null, user?.role ?? null),
    getDotaBotStatus(),
  ]);

  if (!lobby) {
    notFound();
  }

  const maxPerSide = Math.max(1, Math.floor(lobby.maxPlayers / 2));
  const myParticipant = user
    ? lobby.participants.find((p) => p.userId === user.id) ?? null
    : null;
  const spectators = lobby.participants.filter(
    (p) => (p.side as LobbySide) === 'spectator',
  );
  const readyCount = lobby.participants.filter(
    (p) => (p.side === 'radiant' || p.side === 'dire') && p.isReady,
  ).length;

  const errorMessage = searchParams?.error
    ? ERROR_MESSAGES[searchParams.error] ?? searchParams.error
    : null;

  const showBotCard =
    user && (user.role === 'admin' || ((lobby.canManage || lobby.isParticipant) && botStatus.isReady));

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/lobbies"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Все лобби
        </Link>

        <div className="flex items-center gap-2">
          <LobbyAutoRefresh
            active={lobby.status === 'waiting' || lobby.status === 'in_progress'}
          />

          {myParticipant && lobby.status === 'waiting' && (
            <>
              <form action={toggleLobbyReadyAction}>
                <input type="hidden" name="lobbyId" value={lobby.id} />
                <Button
                  type="submit"
                  variant={myParticipant.isReady ? 'secondary' : 'primary'}
                  size="sm"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {myParticipant.isReady ? 'Готов' : 'Я готов'}
                </Button>
              </form>

              <form action={leaveLobbyAction}>
                <input type="hidden" name="lobbyId" value={lobby.id} />
                <Button type="submit" variant="danger" size="sm">
                  <LogOut className="h-3.5 w-3.5" />
                  Выйти
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-3 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      {searchParams?.botInvited === '1' && (
        <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Приглашение отправлено — проверьте клиент Dota 2
        </div>
      )}

      {/* Header */}
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={lobby.status}
                label={
                  lobby.status === 'waiting'
                    ? 'Набор'
                    : lobby.status === 'in_progress'
                      ? 'LIVE'
                      : lobby.status === 'finished'
                        ? 'Завершено'
                        : 'Закрыто'
                }
              />
              <span
                className={`inline-flex items-center gap-1 text-xs ${
                  lobby.hasPassword ? 'text-accent-light' : 'text-success'
                }`}
              >
                {lobby.hasPassword ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <Unlock className="h-3.5 w-3.5" />
                )}
                {lobby.hasPassword ? 'По паролю' : 'Свободный вход'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text break-words">
              {lobby.name}
            </h1>
            {lobby.description && (
              <p className="text-sm text-text-muted max-w-2xl">
                {lobby.description}
              </p>
            )}
          </div>

          {lobby.status === 'finished' && lobby.winnerSide && (
            <div className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm font-semibold text-text">
              <Trophy className="h-4 w-4 text-warning" />
              {lobby.winnerSide === 'radiant' ? 'Победа Сил Света' : 'Победа Сил Тьмы'}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div className="rounded-md bg-bg-elevated border border-glass-border px-3 py-2.5">
            <div className="text-xs text-text-muted flex items-center gap-1.5">
              <Gamepad2 className="h-3 w-3" />
              Режим
            </div>
            <div className="font-semibold text-text mt-0.5">
              {LOBBY_GAME_MODE_LABELS[lobby.gameMode]}
            </div>
          </div>
          <div className="rounded-md bg-bg-elevated border border-glass-border px-3 py-2.5">
            <div className="text-xs text-text-muted flex items-center gap-1.5">
              <Server className="h-3 w-3" />
              Сервер
            </div>
            <div className="font-semibold text-text mt-0.5 truncate">
              {lobby.serverLocation}
            </div>
          </div>
          <div className="rounded-md bg-bg-elevated border border-glass-border px-3 py-2.5">
            <div className="text-xs text-text-muted flex items-center gap-1.5">
              <Crown className="h-3 w-3" />
              Хост
            </div>
            <Link
              href={`/players/${lobby.host.steamId64}`}
              className="font-semibold text-text hover:text-accent-light mt-0.5 block truncate"
            >
              {lobby.host.nickname}
            </Link>
          </div>
          <div className="rounded-md bg-bg-elevated border border-glass-border px-3 py-2.5">
            <div className="text-xs text-text-muted flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" />
              Игроки
            </div>
            <div className="font-semibold text-text mt-0.5 font-mono">
              {lobby.activePlayersCount}/{lobby.maxPlayers}
              <span className="text-text-muted font-normal"> · {readyCount} готовы</span>
            </div>
          </div>
        </div>

        {/* In-game credentials */}
        {lobby.canViewCredentials ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CopyableField
              label="Название лобби в Dota 2"
              value={lobby.dotaLobbyName || lobby.name}
            />
            <CopyableField
              label="Пароль в Dota 2"
              value={lobby.dotaLobbyPassword || '—'}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Lock className="h-4 w-4 text-accent-light" />
            Данные для входа в Dota 2 откроются после ввода пароля
          </div>
        )}
      </Card>

      {showBotCard && (
        <SteamBotCard
          botStatus={botStatus}
          returnTo={`/lobbies/${lobby.id}`}
          isAdmin={user.role === 'admin'}
          lobbyId={lobby.id}
          canManageLobby={lobby.canManage}
          isParticipant={lobby.isParticipant}
        />
      )}

      {/* Join */}
      {lobby.status === 'waiting' && !myParticipant && (
        <Card className="border-accent/30">
          {!user ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-text-muted">
                Войдите, чтобы занять слот
              </span>
              <a href="/api/auth/steam/login">
                <Button variant="primary">Войти через Steam</Button>
              </a>
            </div>
          ) : lobby.hasPassword ? (
            <form
              action={joinLobbyAction}
              className="flex flex-wrap items-center gap-3"
            >
              <input type="hidden" name="lobbyId" value={lobby.id} />
              <div className="flex items-center gap-2 text-sm font-medium text-text mr-auto">
                <Lock className="h-4 w-4 text-accent-light" />
                Лобби защищено паролем
              </div>
              <Select
                name="preferredSide"
                defaultValue=""
                className="w-full sm:w-[170px]"
              >
                <option value="">Любая сторона</option>
                <option value="radiant">Силы Света</option>
                <option value="dire">Силы Тьмы</option>
                <option value="spectator">Наблюдатель</option>
              </Select>
              <Input
                name="password"
                type="password"
                placeholder="Пароль"
                className="w-full sm:w-[200px]"
                required
              />
              <Button type="submit" variant="primary">
                Войти
              </Button>
            </form>
          ) : (
            <form
              action={joinLobbyAction}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <input type="hidden" name="lobbyId" value={lobby.id} />
              <span className="text-sm text-text-muted">
                Выберите слот ниже или зайдите автоматически
              </span>
              <Button type="submit" variant="primary">
                Присоединиться
              </Button>
            </form>
          )}
        </Card>
      )}

      {/* Teams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SideColumn
          side="radiant"
          lobby={lobby}
          maxPerSide={maxPerSide}
          userId={user?.id ?? null}
          hasJoined={Boolean(myParticipant)}
          loggedIn={Boolean(user)}
        />
        <SideColumn
          side="dire"
          lobby={lobby}
          maxPerSide={maxPerSide}
          userId={user?.id ?? null}
          hasJoined={Boolean(myParticipant)}
          loggedIn={Boolean(user)}
        />
      </div>

      {/* Spectators */}
      {(spectators.length > 0 ||
        (lobby.status === 'waiting' && myParticipant)) && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-text">
              <Eye className="h-4 w-4 text-accent-light" />
              Наблюдатели ({spectators.length})
            </div>
            {lobby.status === 'waiting' &&
              myParticipant &&
              myParticipant.side !== 'spectator' && (
                <form action={switchLobbySlotAction}>
                  <input type="hidden" name="lobbyId" value={lobby.id} />
                  <input type="hidden" name="side" value="spectator" />
                  <input
                    type="hidden"
                    name="slot"
                    value={String(Math.min(10, spectators.length + 1))}
                  />
                  <Button type="submit" variant="secondary" size="sm">
                    Стать наблюдателем
                  </Button>
                </form>
              )}
          </div>
          {spectators.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {spectators.map((sp) => (
                <div
                  key={sp.id}
                  className="inline-flex items-center gap-2 rounded-md border border-glass-border bg-bg-elevated px-3 py-1.5 text-xs"
                >
                  <Link
                    href={`/players/${sp.user.steamId64}`}
                    className="font-medium text-text hover:text-accent-light"
                  >
                    {sp.user.nickname}
                  </Link>
                  {lobby.canManage && sp.userId !== user?.id && (
                    <form action={kickLobbyPlayerAction}>
                      <input type="hidden" name="lobbyId" value={lobby.id} />
                      <input type="hidden" name="targetUserId" value={sp.userId} />
                      <button
                        type="submit"
                        className="text-danger hover:underline"
                        title="Исключить"
                      >
                        ×
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Host controls */}
      {lobby.canManage && (
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-text">Управление</h2>

          <div className="flex flex-wrap items-center gap-2">
            {lobby.status === 'waiting' && (
              <>
                <form action={shuffleLobbyTeamsAction}>
                  <input type="hidden" name="lobbyId" value={lobby.id} />
                  <Button type="submit" variant="secondary">
                    <Shuffle className="h-4 w-4 text-accent-light" />
                    Перемешать
                  </Button>
                </form>

                <form action={updateLobbyStatusAction}>
                  <input type="hidden" name="lobbyId" value={lobby.id} />
                  <input type="hidden" name="status" value="in_progress" />
                  <Button type="submit" variant="primary">
                    <Play className="h-4 w-4" />
                    Начать матч
                  </Button>
                </form>
              </>
            )}

            {lobby.status === 'in_progress' && (
              <>
                <form action={updateLobbyStatusAction}>
                  <input type="hidden" name="lobbyId" value={lobby.id} />
                  <input type="hidden" name="status" value="finished" />
                  <input type="hidden" name="winnerSide" value="radiant" />
                  <Button type="submit" variant="primary">
                    <Trophy className="h-4 w-4" />
                    Победил Свет
                  </Button>
                </form>

                <form action={updateLobbyStatusAction}>
                  <input type="hidden" name="lobbyId" value={lobby.id} />
                  <input type="hidden" name="status" value="finished" />
                  <input type="hidden" name="winnerSide" value="dire" />
                  <Button type="submit" variant="secondary">
                    <Trophy className="h-4 w-4 text-danger" />
                    Победила Тьма
                  </Button>
                </form>

                <form action={updateLobbyStatusAction}>
                  <input type="hidden" name="lobbyId" value={lobby.id} />
                  <input type="hidden" name="status" value="waiting" />
                  <Button type="submit" variant="ghost">
                    Вернуть в набор
                  </Button>
                </form>
              </>
            )}

            {lobby.status !== 'cancelled' && (
              <form action={updateLobbyStatusAction}>
                <input type="hidden" name="lobbyId" value={lobby.id} />
                <input type="hidden" name="status" value="cancelled" />
                <Button type="submit" variant="danger">
                  Закрыть лобби
                </Button>
              </form>
            )}
          </div>

          <form
            action={updateLobbyAccessAction}
            className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-4 border-t border-glass-border items-end"
          >
            <input type="hidden" name="lobbyId" value={lobby.id} />

            <div>
              <label className="block text-xs text-text-muted mb-1">Вход</label>
              <Select
                name="accessType"
                defaultValue={lobby.hasPassword ? 'password' : 'open'}
              >
                <option value="open">Свободный</option>
                <option value="password">По паролю</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">
                Новый пароль
              </label>
              <Input name="password" type="text" placeholder="Не менять" />
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">
                Пароль в Dota 2
              </label>
              <Input
                name="dotaLobbyPassword"
                type="text"
                defaultValue={lobby.dotaLobbyPassword ?? ''}
              />
            </div>

            <Button type="submit" variant="secondary">
              Сохранить
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
