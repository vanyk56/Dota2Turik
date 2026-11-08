// [Phase: v3 / Custom Lobby Bot] Interactive Steam Dota 2 GC Bot Connection, Steam Guard & Auto-Invite Card
import * as React from 'react';
import {
  Bot,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Send,
  PowerOff,
  Loader2,
  KeyRound,
} from 'lucide-react';
import {
  connectSteamBotAction,
  disconnectSteamBotAction,
  inviteMeWithBotAction,
  spawnDotaLobbyWithBotAction,
  submitSteamGuardAction,
} from '@/modules/lobbies/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export interface SteamBotStatusView {
  status:
    | 'disconnected'
    | 'connecting'
    | 'awaiting_steam_guard'
    | 'connected_steam'
    | 'ready_gc'
    | 'error';
  accountName: string | null;
  guardDomain: string | null;
  lastError: string | null;
  activeLobbyId: string | null;
  isReady: boolean;
  awaitingSteamGuard: boolean;
}

export function SteamBotCard({
  botStatus,
  returnTo,
  lobbyId,
  canManageLobby = false,
  isParticipant = false,
}: {
  botStatus: SteamBotStatusView;
  returnTo: string;
  lobbyId?: string;
  canManageLobby?: boolean;
  isParticipant?: boolean;
}) {
  const isReady = botStatus.status === 'ready_gc';
  const isConnecting =
    botStatus.status === 'connecting' || botStatus.status === 'connected_steam';
  const isGuard = botStatus.status === 'awaiting_steam_guard';
  const isError = botStatus.status === 'error';

  return (
    <Card
      className={`space-y-4 ${
        isReady
          ? 'border-success/40 bg-success/[0.04]'
          : isGuard
            ? 'border-warning/50 bg-warning/[0.06]'
            : 'border-accent/30'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-md border ${
              isReady
                ? 'border-success/40 bg-success/15 text-success'
                : isGuard
                  ? 'border-warning/40 bg-warning/15 text-warning'
                  : 'border-accent/40 bg-accent/15 text-accent'
            }`}
          >
            <Bot className="h-5 w-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-text">
                Автоматический Steam-бот Dota 2 (Game Coordinator)
              </h3>
              {isReady && (
                <span className="inline-flex items-center gap-1 rounded-sm bg-success/15 border border-success/30 px-2 py-0.5 text-[11px] font-semibold text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  В сети Dota 2 • Аккаунт: {botStatus.accountName}
                </span>
              )}
              {isConnecting && (
                <span className="inline-flex items-center gap-1 rounded-sm bg-accent/15 border border-accent/30 px-2 py-0.5 text-[11px] font-semibold text-accent">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Запуск Dota 2 GC ({botStatus.accountName})...
                </span>
              )}
              {isGuard && (
                <span className="inline-flex items-center gap-1 rounded-sm bg-warning/15 border border-warning/30 px-2 py-0.5 text-[11px] font-semibold text-warning">
                  <KeyRound className="h-3 w-3" />
                  Ожидает код Steam Guard
                </span>
              )}
            </div>

            <p className="text-xs text-text-muted mt-0.5">
              {isReady
                ? 'Бот подключён к серверам Valve: сам создаёт лобби внутри Dota 2 и отправляет приглашение игрокам прямо в игру.'
                : 'Подключите второй (свободный) аккаунт Steam — бот сам зайдёт в Dota 2, создаст лобби и кинет вам инвайт в игру.'}
            </p>
          </div>
        </div>

        {/* Disconnect / Switch Bot Account Button */}
        {botStatus.status !== 'disconnected' && (
          <form action={disconnectSteamBotAction}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <Button type="submit" variant="ghost" size="sm">
              <PowerOff className="h-3.5 w-3.5 text-danger" />
              Отключить бота
            </Button>
          </form>
        )}
      </div>

      {/* STATE 1: Awaiting Steam Guard Code */}
      {isGuard && (
        <form
          action={submitSteamGuardAction}
          className="rounded-md border border-warning/40 bg-bg/90 p-3.5 flex flex-col sm:flex-row sm:items-end justify-between gap-3"
        >
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="space-y-1 flex-1">
            <div className="text-xs font-bold text-warning flex items-center gap-1.5">
              <KeyRound className="h-4 w-4" />
              Введите 5-значный код Steam Guard (отправлен на{' '}
              {botStatus.guardDomain || 'почту / приложение'})
            </div>
            <p className="text-[11px] text-text-muted">
              Код вводится только 1 раз — после входа бот сохранит токен сессии в базу данных.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              name="guardCode"
              placeholder="Код (например: 8K4M2)"
              className="w-[180px] uppercase font-mono"
              maxLength={10}
              required
            />
            <Button type="submit" variant="primary" size="sm">
              Подтвердить код
            </Button>
          </div>
        </form>
      )}

      {/* STATE 2: Error Alert */}
      {isError && botStatus.lastError && (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            Ошибка входа бота в Steam: <strong>{botStatus.lastError}</strong>. Проверьте логин и пароль второго аккаунта.
          </span>
        </div>
      )}

      {/* STATE 3: Ready in Dota 2 GC + Inside a Lobby Room */}
      {isReady && lobbyId && (
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-glass-border">
          {canManageLobby && (
            <form action={spawnDotaLobbyWithBotAction}>
              <input type="hidden" name="lobbyId" value={lobbyId} />
              <Button type="submit" variant="primary" size="sm">
                <Sparkles className="h-3.5 w-3.5" />
                Создать это лобби в Dota 2 через бота и разослать всем инвайты
              </Button>
            </form>
          )}

          {isParticipant && (
            <form action={inviteMeWithBotAction}>
              <input type="hidden" name="lobbyId" value={lobbyId} />
              <Button type="submit" variant="secondary" size="sm">
                <Send className="h-3.5 w-3.5 text-accent" />
                Прислать мне приглашение в Dota 2 от бота
              </Button>
            </form>
          )}

          {botStatus.activeLobbyId === lobbyId && (
            <span className="text-xs text-success font-medium">
              ✓ Бот держит открытым это лобби в Dota 2
            </span>
          )}
        </div>
      )}

      {/* STATE 4: Disconnected or Error -> Form to Connect Bot Account */}
      {(botStatus.status === 'disconnected' || isError) && (
        <form
          action={connectSteamBotAction}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-glass-border items-end"
        >
          <input type="hidden" name="returnTo" value={returnTo} />
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">
              Логин второго аккаунта Steam (для бота) *
            </label>
            <Input
              name="accountName"
              defaultValue={botStatus.accountName ?? ''}
              placeholder="Логин Steam бота..."
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">
              Пароль Steam бота *
            </label>
            <Input
              name="password"
              type="password"
              placeholder="Пароль от аккаунта бота..."
              required
            />
          </div>
          <Button type="submit" variant="primary">
            <Bot className="h-4 w-4" />
            Подключить бота к Dota 2
          </Button>
        </form>
      )}
    </Card>
  );
}
