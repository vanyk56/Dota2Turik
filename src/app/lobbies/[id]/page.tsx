// [Phase: MVP v1] Custom Lobby Room Page (/lobbies/[id]) — Radiant vs Dire Slots, Password/Open Join & Host Controls
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
  Shield,
  ArrowLeft,
  Server,
  AlertTriangle,
} from 'lucide-react';
import { getCurrentUser } from '@/modules/auth/service';
import {
  DOTA_POSITION_LABELS,
  getCustomLobbyById,
  LOBBY_GAME_MODE_LABELS,
} from '@/modules/lobbies/service';
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
import { formatDate } from '@/lib/utils';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_LOBBY_PASSWORD:
    'Неверный пароль от лобби! Проверьте пароль у создателя комнаты и попробуйте снова.',
  PASSWORD_REQUIRED_TO_JOIN:
    'Это закрытое лобби. Введите пароль в блоке подключения выше, чтобы занять слот.',
  LOBBY_FULL: 'Все игровые слоты в этом лобби уже заняты.',
  SLOT_ALREADY_TAKEN:
    'Выбранный слот только что занял другой игрок. Выберите другой свободный слот.',
  TOO_MANY_PASSWORD_ATTEMPTS:
    'Слишком много неверных попыток ввода пароля. Подождите минуту.',
  LOBBY_NOT_ACCEPTING_PLAYERS:
    'Матч уже запущен или завершён — набор игроков закрыт.',
};

export default async function LobbyDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { error?: string };
}) {
  const user = await getCurrentUser();
  const lobby = await getCustomLobbyById(
    params.id,
    user?.id ?? null,
    user?.role ?? null,
  );

  if (!lobby) {
    notFound();
  }

  const maxPerSide = Math.max(1, Math.floor(lobby.maxPlayers / 2));
  const slotNumbers = Array.from({ length: maxPerSide }, (_, i) => i + 1);

  const myParticipant = user
    ? lobby.participants.find((p) => p.userId === user.id) ?? null
    : null;

  const spectators = lobby.participants.filter((p) => p.side === 'spectator');
  const readyCount = lobby.participants.filter(
    (p) => (p.side === 'radiant' || p.side === 'dire') && p.isReady,
  ).length;

  const errorMessage = searchParams?.error
    ? ERROR_MESSAGES[searchParams.error] ?? `Ошибка: ${searchParams.error}`
    : null;

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/lobbies"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-accent transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Назад к списку лобби
        </Link>

        <div className="flex items-center gap-2">
          <LobbyAutoRefresh
            active={
              lobby.status === 'waiting' || lobby.status === 'in_progress'
            }
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
                  {myParticipant.isReady ? 'Я готов ✓' : 'Подтвердить готовность'}
                </Button>
              </form>

              <form action={leaveLobbyAction}>
                <input type="hidden" name="lobbyId" value={lobby.id} />
                <Button type="submit" variant="danger" size="sm">
                  <LogOut className="h-3.5 w-3.5" />
                  Выйти из лобби
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="flex items-center gap-3 rounded-md border border-danger/40 bg-danger/15 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Lobby Header Card */}
      <Card className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={lobby.status}
                label={
                  lobby.status === 'waiting'
                    ? 'Открыт набор игроков'
                    : lobby.status === 'in_progress'
                      ? 'Идёт матч • LIVE'
                      : lobby.status === 'finished'
                        ? 'Матч завершён'
                        : 'Отменено'
                }
              />

              {lobby.hasPassword ? (
                <span className="inline-flex items-center gap-1 rounded-sm bg-accent/15 border border-accent/40 px-2.5 py-0.5 text-xs font-semibold text-accent">
                  <Lock className="h-3 w-3" />
                  Закрытое лобби (По паролю)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-sm bg-success/15 border border-success/30 px-2.5 py-0.5 text-xs font-semibold text-success">
                  <Unlock className="h-3 w-3" />
                  Свободный вход (Без пароля)
                </span>
              )}

              <span className="text-xs font-mono text-text-muted">
                Создано: {formatDate(lobby.createdAt)}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-text">
              {lobby.name}
            </h1>

            {lobby.description && (
              <p className="text-sm text-text-muted max-w-3xl">
                {lobby.description}
              </p>
            )}
          </div>

          {/* Winner Banner if finished */}
          {lobby.status === 'finished' && lobby.winnerSide && (
            <div
              className={`flex items-center gap-3 rounded-md border px-4 py-3 ${
                lobby.winnerSide === 'radiant'
                  ? 'border-success/40 bg-success/15 text-success'
                  : 'border-danger/40 bg-danger/15 text-danger'
              }`}
            >
              <Trophy className="h-6 w-6" />
              <div>
                <div className="text-xs uppercase font-semibold opacity-80">
                  Победитель лобби
                </div>
                <div className="text-base font-bold">
                  {lobby.winnerSide === 'radiant'
                    ? 'Силы Света (Radiant)'
                    : 'Силы Тьмы (Dire)'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-glass-border text-xs">
          <div className="rounded-md border border-glass-border bg-bg-elevated p-3">
            <div className="text-text-muted flex items-center gap-1.5">
              <Gamepad2 className="h-3.5 w-3.5 text-accent" />
              Режим игры
            </div>
            <div className="text-sm font-bold text-text mt-1">
              {LOBBY_GAME_MODE_LABELS[lobby.gameMode]}
            </div>
          </div>

          <div className="rounded-md border border-glass-border bg-bg-elevated p-3">
            <div className="text-text-muted flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-accent" />
              Сервер и Регион
            </div>
            <div className="text-sm font-bold text-text mt-1 truncate">
              {lobby.serverLocation} • {lobby.region}
            </div>
          </div>

          <div className="rounded-md border border-glass-border bg-bg-elevated p-3">
            <div className="text-text-muted flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5 text-warning" />
              Создатель (Хост)
            </div>
            <Link
              href={`/players/${lobby.host.steamId64}`}
              className="text-sm font-bold text-text hover:text-accent mt-1 block truncate"
            >
              {lobby.host.nickname}
            </Link>
          </div>

          <div className="rounded-md border border-glass-border bg-bg-elevated p-3">
            <div className="text-text-muted flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              Игроки и готовность
            </div>
            <div className="text-sm font-bold text-text mt-1 font-mono">
              {lobby.activePlayersCount}/{lobby.maxPlayers} игроков ({readyCount}{' '}
              готовы)
            </div>
          </div>
        </div>

        {/* Dota 2 Client Connection Credentials */}
        <div className="rounded-md border border-glass-border bg-bg-elevated p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-text flex items-center gap-2">
              <Gamepad2 className="h-4 w-4 text-accent" />
              Данные для подключения внутри клиента Dota 2
            </div>
            {lobby.canViewCredentials && (
              <span className="text-[11px] text-success font-medium">
                Нажмите «Копировать», чтобы вставить в поиске частных лобби Dota 2
              </span>
            )}
          </div>

          {lobby.canViewCredentials ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CopyableField
                label="Название лобби в Dota 2"
                value={lobby.dotaLobbyName || lobby.name}
              />
              <CopyableField
                label="Пароль в клиенте Dota 2"
                value={lobby.dotaLobbyPassword || 'Без пароля'}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 text-xs text-text-muted py-1">
              <Lock className="h-4 w-4 text-accent shrink-0" />
              <span>
                Название и пароль внутриигрового лобби скрыты. Введите пароль от
                комнаты ниже, чтобы подключиться и увидеть данные для входа в Dota 2.
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Join Banner for Non-Participants */}
      {lobby.status === 'waiting' && !myParticipant && (
        <Card className="border-accent/40 bg-accent/10">
          {!user ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-text">
                  Хотите занять слот в этом лобби?
                </h2>
                <p className="text-xs text-text-muted mt-1">
                  Авторизуйтесь через Steam, чтобы присоединиться к Силам Света или Силам Тьмы.
                </p>
              </div>
              <a href="/api/auth/steam/login">
                <Button variant="primary">Войти через Steam</Button>
              </a>
            </div>
          ) : lobby.hasPassword ? (
            <form
              action={joinLobbyAction}
              className="flex flex-col md:flex-row md:items-end justify-between gap-4"
            >
              <input type="hidden" name="lobbyId" value={lobby.id} />
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 text-sm font-bold text-text">
                  <Lock className="h-4 w-4 text-accent" />
                  Вход в закрытое лобби по паролю
                </div>
                <p className="text-xs text-text-muted">
                  Создатель установил пароль на вход. После верного ввода вы сможете свободно выбирать любой слот.
                </p>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                <Select
                  name="preferredSide"
                  defaultValue=""
                  className="w-full sm:w-[190px]"
                >
                  <option value="">Любая свободная сторона</option>
                  <option value="radiant">Силы Света (Radiant)</option>
                  <option value="dire">Силы Тьмы (Dire)</option>
                  <option value="spectator">Наблюдатель</option>
                </Select>

                <Input
                  name="password"
                  type="password"
                  placeholder="Введите пароль лобби..."
                  className="w-full sm:w-[220px]"
                  required
                />

                <Button type="submit" variant="primary" className="shrink-0">
                  <Lock className="h-4 w-4" />
                  Подключиться
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-text">
                  <Unlock className="h-4 w-4 text-success" />
                  Свободный вход открыт
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  Нажмите кнопку «Занять слот» на любой свободной позиции ниже или подключитесь автоматически.
                </p>
              </div>

              <form action={joinLobbyAction}>
                <input type="hidden" name="lobbyId" value={lobby.id} />
                <Button type="submit" variant="primary">
                  Быстро занять свободный слот
                </Button>
              </form>
            </div>
          )}
        </Card>
      )}

      {/* Radiant vs Dire 5x5 / 1x1 Interactive Roster Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RADIANT (Силы Света) */}
        <Card className="space-y-4 border-success/30">
          <div className="flex items-center justify-between border-b border-glass-border pb-3">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-success shadow-[0_0_12px_rgba(34,197,94,0.8)]" />
              <div>
                <h2 className="text-lg font-bold text-text">
                  Силы Света (Radiant)
                </h2>
                <p className="text-xs text-text-muted">
                  Слоты 1–{maxPerSide} • Первая сторона
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-success bg-success/10 border border-success/30 px-2.5 py-1 rounded-sm">
              {lobby.participants.filter((p) => p.side === 'radiant').length} /{' '}
              {maxPerSide}
            </span>
          </div>

          <div className="space-y-2.5">
            {slotNumbers.map((slotNum) => {
              const occupant = lobby.participants.find(
                (p) => p.side === 'radiant' && p.slot === slotNum,
              );
              const posLabel =
                maxPerSide === 1
                  ? '1x1 Solo Mid • Radiant'
                  : DOTA_POSITION_LABELS[slotNum] ?? `Слот #${slotNum}`;
              const isMe = Boolean(user && occupant?.userId === user.id);

              return (
                <div
                  key={`radiant-${slotNum}`}
                  className={`flex items-center justify-between gap-3 rounded-md border p-3 transition-colors ${
                    occupant
                      ? isMe
                        ? 'border-success/50 bg-success/10'
                        : 'border-glass-border bg-bg-elevated'
                      : 'border-dashed border-glass-border bg-bg/40 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-success/15 border border-success/30 font-mono text-xs font-bold text-success">
                      #{slotNum}
                    </div>

                    {occupant ? (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/players/${occupant.user.steamId64}`}
                            className="text-sm font-bold text-text hover:text-accent truncate"
                          >
                            {occupant.user.nickname}
                          </Link>
                          {occupant.userId === lobby.hostId && (
                            <span
                              className="inline-flex items-center gap-1 rounded-sm bg-warning/15 border border-warning/30 px-1.5 py-0.5 text-[10px] font-semibold text-warning"
                              title="Создатель лобби"
                            >
                              <Crown className="h-2.5 w-2.5" />
                              Хост
                            </span>
                          )}
                          {isMe && (
                            <span className="text-[10px] font-mono uppercase text-success">
                              (Вы)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-text-muted">
                          {posLabel}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm font-medium text-text-muted">
                          Свободный слот
                        </div>
                        <div className="text-[11px] text-text-muted/70">
                          {posLabel}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Side of Slot */}
                  <div className="flex items-center gap-2 shrink-0">
                    {occupant ? (
                      <>
                        {occupant.isReady ? (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-success/15 border border-success/30 px-2 py-0.5 text-xs font-medium text-success">
                            <CheckCircle2 className="h-3 w-3" />
                            Готов
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-white/[0.04] border border-glass-border px-2 py-0.5 text-xs text-text-muted">
                            <Clock className="h-3 w-3" />
                            Ожидание
                          </span>
                        )}

                        {lobby.canManage &&
                          lobby.status === 'waiting' &&
                          occupant.userId !== user?.id && (
                            <form action={kickLobbyPlayerAction}>
                              <input
                                type="hidden"
                                name="lobbyId"
                                value={lobby.id}
                              />
                              <input
                                type="hidden"
                                name="targetUserId"
                                value={occupant.userId}
                              />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                className="text-danger hover:bg-danger/15 h-7 px-2"
                                title="Освободить слот (Исключить игрока)"
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                              </Button>
                            </form>
                          )}
                      </>
                    ) : (
                      lobby.status === 'waiting' &&
                      (user ? (
                        myParticipant ||
                        !lobby.hasPassword ||
                        lobby.canManage ? (
                          <form action={switchLobbySlotAction}>
                            <input
                              type="hidden"
                              name="lobbyId"
                              value={lobby.id}
                            />
                            <input
                              type="hidden"
                              name="side"
                              value="radiant"
                            />
                            <input
                              type="hidden"
                              name="slot"
                              value={String(slotNum)}
                            />
                            <Button
                              type="submit"
                              variant="secondary"
                              size="sm"
                              className="h-8 text-xs hover:border-success hover:text-success"
                            >
                              {myParticipant ? 'Перейти сюда' : 'Занять слот'}
                            </Button>
                          </form>
                        ) : (
                          <span className="text-[11px] text-text-muted flex items-center gap-1">
                            <Lock className="h-3 w-3 text-accent" />
                            По паролю
                          </span>
                        )
                      ) : (
                        <a href="/api/auth/steam/login">
                          <Button variant="ghost" size="sm" className="h-8 text-xs">
                            Войти
                          </Button>
                        </a>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* DIRE (Силы Тьмы) */}
        <Card className="space-y-4 border-danger/30">
          <div className="flex items-center justify-between border-b border-glass-border pb-3">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-danger shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
              <div>
                <h2 className="text-lg font-bold text-text">
                  Силы Тьмы (Dire)
                </h2>
                <p className="text-xs text-text-muted">
                  Слоты 1–{maxPerSide} • Вторая сторона
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-danger bg-danger/10 border border-danger/30 px-2.5 py-1 rounded-sm">
              {lobby.participants.filter((p) => p.side === 'dire').length} /{' '}
              {maxPerSide}
            </span>
          </div>

          <div className="space-y-2.5">
            {slotNumbers.map((slotNum) => {
              const occupant = lobby.participants.find(
                (p) => p.side === 'dire' && p.slot === slotNum,
              );
              const posLabel =
                maxPerSide === 1
                  ? '1x1 Solo Mid • Dire'
                  : DOTA_POSITION_LABELS[slotNum] ?? `Слот #${slotNum}`;
              const isMe = Boolean(user && occupant?.userId === user.id);

              return (
                <div
                  key={`dire-${slotNum}`}
                  className={`flex items-center justify-between gap-3 rounded-md border p-3 transition-colors ${
                    occupant
                      ? isMe
                        ? 'border-danger/50 bg-danger/10'
                        : 'border-glass-border bg-bg-elevated'
                      : 'border-dashed border-glass-border bg-bg/40 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-danger/15 border border-danger/30 font-mono text-xs font-bold text-danger">
                      #{slotNum}
                    </div>

                    {occupant ? (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/players/${occupant.user.steamId64}`}
                            className="text-sm font-bold text-text hover:text-accent truncate"
                          >
                            {occupant.user.nickname}
                          </Link>
                          {occupant.userId === lobby.hostId && (
                            <span
                              className="inline-flex items-center gap-1 rounded-sm bg-warning/15 border border-warning/30 px-1.5 py-0.5 text-[10px] font-semibold text-warning"
                              title="Создатель лобби"
                            >
                              <Crown className="h-2.5 w-2.5" />
                              Хост
                            </span>
                          )}
                          {isMe && (
                            <span className="text-[10px] font-mono uppercase text-danger">
                              (Вы)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-text-muted">
                          {posLabel}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm font-medium text-text-muted">
                          Свободный слот
                        </div>
                        <div className="text-[11px] text-text-muted/70">
                          {posLabel}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Side of Slot */}
                  <div className="flex items-center gap-2 shrink-0">
                    {occupant ? (
                      <>
                        {occupant.isReady ? (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-success/15 border border-success/30 px-2 py-0.5 text-xs font-medium text-success">
                            <CheckCircle2 className="h-3 w-3" />
                            Готов
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-white/[0.04] border border-glass-border px-2 py-0.5 text-xs text-text-muted">
                            <Clock className="h-3 w-3" />
                            Ожидание
                          </span>
                        )}

                        {lobby.canManage &&
                          lobby.status === 'waiting' &&
                          occupant.userId !== user?.id && (
                            <form action={kickLobbyPlayerAction}>
                              <input
                                type="hidden"
                                name="lobbyId"
                                value={lobby.id}
                              />
                              <input
                                type="hidden"
                                name="targetUserId"
                                value={occupant.userId}
                              />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                className="text-danger hover:bg-danger/15 h-7 px-2"
                                title="Освободить слот (Исключить игрока)"
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                              </Button>
                            </form>
                          )}
                      </>
                    ) : (
                      lobby.status === 'waiting' &&
                      (user ? (
                        myParticipant ||
                        !lobby.hasPassword ||
                        lobby.canManage ? (
                          <form action={switchLobbySlotAction}>
                            <input
                              type="hidden"
                              name="lobbyId"
                              value={lobby.id}
                            />
                            <input type="hidden" name="side" value="dire" />
                            <input
                              type="hidden"
                              name="slot"
                              value={String(slotNum)}
                            />
                            <Button
                              type="submit"
                              variant="secondary"
                              size="sm"
                              className="h-8 text-xs hover:border-danger hover:text-danger"
                            >
                              {myParticipant ? 'Перейти сюда' : 'Занять слот'}
                            </Button>
                          </form>
                        ) : (
                          <span className="text-[11px] text-text-muted flex items-center gap-1">
                            <Lock className="h-3 w-3 text-accent" />
                            По паролю
                          </span>
                        )
                      ) : (
                        <a href="/api/auth/steam/login">
                          <Button variant="ghost" size="sm" className="h-8 text-xs">
                            Войти
                          </Button>
                        </a>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Spectators / Waiting Pool */}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-text">
            <Eye className="h-4 w-4 text-accent" />
            Наблюдатели и запасные ({spectators.length})
          </div>

          {lobby.status === 'waiting' &&
            user &&
            (myParticipant || !lobby.hasPassword || lobby.canManage) &&
            myParticipant?.side !== 'spectator' && (
              <form action={switchLobbySlotAction}>
                <input type="hidden" name="lobbyId" value={lobby.id} />
                <input type="hidden" name="side" value="spectator" />
                <input
                  type="hidden"
                  name="slot"
                  value={String(Math.min(10, spectators.length + 1))}
                />
                <Button type="submit" variant="secondary" size="sm">
                  <Eye className="h-3.5 w-3.5 text-accent" />
                  Перейти в наблюдатели
                </Button>
              </form>
            )}
        </div>

        {spectators.length === 0 ? (
          <p className="text-xs text-text-muted">
            В слотах наблюдателей сейчас никого нет.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {spectators.map((sp) => (
              <div
                key={sp.id}
                className="inline-flex items-center gap-2 rounded-md border border-glass-border bg-bg-elevated px-3 py-1.5 text-xs"
              >
                <Link
                  href={`/players/${sp.user.steamId64}`}
                  className="font-semibold text-text hover:text-accent"
                >
                  {sp.user.nickname}
                </Link>
                {lobby.canManage && sp.userId !== user?.id && (
                  <form action={kickLobbyPlayerAction}>
                    <input type="hidden" name="lobbyId" value={lobby.id} />
                    <input
                      type="hidden"
                      name="targetUserId"
                      value={sp.userId}
                    />
                    <button
                      type="submit"
                      className="text-danger hover:underline ml-1"
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

      {/* Host & Admin Management Panel */}
      {lobby.canManage && (
        <Card className="space-y-5 border-accent/40">
          <div className="flex items-center gap-2 border-b border-glass-border pb-3">
            <Shield className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-base font-bold text-text">
                Панель управления хоста лобби
              </h2>
              <p className="text-xs text-text-muted">
                Вы можете перемешать составы 5x5, сменить режим доступа (свободный / по паролю), запустить матч или зафиксировать победителя.
              </p>
            </div>
          </div>

          {/* Match Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {lobby.status === 'waiting' && (
              <>
                <form action={shuffleLobbyTeamsAction}>
                  <input type="hidden" name="lobbyId" value={lobby.id} />
                  <Button type="submit" variant="secondary">
                    <Shuffle className="h-4 w-4 text-accent" />
                    Перемешать игроков (Баланс 5x5)
                  </Button>
                </form>

                <form action={updateLobbyStatusAction}>
                  <input type="hidden" name="lobbyId" value={lobby.id} />
                  <input type="hidden" name="status" value="in_progress" />
                  <Button type="submit" variant="primary">
                    <Play className="h-4 w-4" />
                    Запустить матч (LIVE)
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
                    Завершить: Победа Сил Света (Radiant)
                  </Button>
                </form>

                <form action={updateLobbyStatusAction}>
                  <input type="hidden" name="lobbyId" value={lobby.id} />
                  <input type="hidden" name="status" value="finished" />
                  <input type="hidden" name="winnerSide" value="dire" />
                  <Button type="submit" variant="secondary">
                    <Trophy className="h-4 w-4 text-danger" />
                    Завершить: Победа Сил Тьмы (Dire)
                  </Button>
                </form>

                <form action={updateLobbyStatusAction}>
                  <input type="hidden" name="lobbyId" value={lobby.id} />
                  <input type="hidden" name="status" value="waiting" />
                  <Button type="submit" variant="ghost">
                    Вернуть в режим набора
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

          {/* Access & Password Settings Form */}
          <form
            action={updateLobbyAccessAction}
            className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-4 border-t border-glass-border items-end"
          >
            <input type="hidden" name="lobbyId" value={lobby.id} />

            <div>
              <label className="block text-xs text-text-muted mb-1">
                Режим входа на сайте
              </label>
              <Select
                name="accessType"
                defaultValue={lobby.hasPassword ? 'password' : 'open'}
              >
                <option value="open">🔓 Свободный вход (Без пароля)</option>
                <option value="password">🔒 По паролю</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">
                Новый пароль входа (если по паролю)
              </label>
              <Input
                name="password"
                type="text"
                placeholder="Оставьте пустым или введите новый"
              />
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">
                Пароль лобби в самой Dota 2
              </label>
              <Input
                name="dotaLobbyPassword"
                type="text"
                defaultValue={lobby.dotaLobbyPassword ?? ''}
                placeholder="Пароль в Dota 2"
              />
            </div>

            <Button type="submit" variant="secondary">
              Сохранить настройки входа
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
