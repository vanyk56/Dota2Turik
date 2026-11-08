// Steam Dota 2 bot card. Account controls are admin-only; others see invite actions when the bot is online.
import * as React from 'react';
import {
  Bot,
  CheckCircle2,
  ShieldAlert,
  Send,
  PowerOff,
  Loader2,
  KeyRound,
  UserCheck,
} from 'lucide-react';
import {
  connectSteamBotAction,
  disconnectSteamBotAction,
  inviteMeWithBotAction,
  releaseBotFromLobbyAction,
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
  isAdmin = false,
  lobbyId,
  canManageLobby = false,
  isParticipant = false,
}: {
  botStatus: SteamBotStatusView;
  returnTo: string;
  isAdmin?: boolean;
  lobbyId?: string;
  canManageLobby?: boolean;
  isParticipant?: boolean;
}) {
  const isReady = botStatus.status === 'ready_gc';
  const isConnecting =
    botStatus.status === 'connecting' || botStatus.status === 'connected_steam';
  const isGuard = botStatus.status === 'awaiting_steam_guard';
  const isError = botStatus.status === 'error';

  if (!isAdmin && (!isReady || !lobbyId)) {
    return null;
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent-light">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-text">Dota 2 бот</div>
            <div className="text-xs mt-0.5">
              {isReady && (
                <span className="inline-flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  В сети{isAdmin && botStatus.accountName ? ` · ${botStatus.accountName}` : ''}
                </span>
              )}
              {isConnecting && (
                <span className="inline-flex items-center gap-1 text-accent-light">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Подключение...
                </span>
              )}
              {isGuard && (
                <span className="inline-flex items-center gap-1 text-warning">
                  <KeyRound className="h-3 w-3" />
                  Нужен код Steam Guard
                </span>
              )}
              {isError && <span className="text-danger">Ошибка</span>}
              {botStatus.status === 'disconnected' && (
                <span className="text-text-muted">Не подключён</span>
              )}
            </div>
          </div>
        </div>

        {isAdmin && botStatus.status !== 'disconnected' && (
          <form action={disconnectSteamBotAction}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <Button type="submit" variant="ghost" size="sm">
              <PowerOff className="h-3.5 w-3.5 text-danger" />
              Отключить
            </Button>
          </form>
        )}
      </div>

      {isAdmin && isGuard && (
        <form
          action={submitSteamGuardAction}
          className="flex flex-wrap items-center gap-2 pt-3 border-t border-glass-border"
        >
          <input type="hidden" name="returnTo" value={returnTo} />
          <span className="text-xs text-text-muted mr-auto">
            Код отправлен на {botStatus.guardDomain || 'почту'}
          </span>
          <Input
            name="guardCode"
            placeholder="Код"
            className="w-[140px] uppercase font-mono"
            maxLength={10}
            required
          />
          <Button type="submit" variant="primary" size="sm">
            Подтвердить
          </Button>
        </form>
      )}

      {isAdmin && isError && botStatus.lastError && (
        <div className="flex items-center gap-2 text-xs text-danger">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          {botStatus.lastError}
        </div>
      )}

      {isReady && lobbyId && (
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-glass-border">
          {canManageLobby && (
            <form action={spawnDotaLobbyWithBotAction}>
              <input type="hidden" name="lobbyId" value={lobbyId} />
              <Button type="submit" variant="primary" size="sm">
                <Send className="h-3.5 w-3.5" />
                Создать лобби в Dota 2
              </Button>
            </form>
          )}

          {isParticipant && (
            <form action={inviteMeWithBotAction}>
              <input type="hidden" name="lobbyId" value={lobbyId} />
              <Button type="submit" variant="secondary" size="sm">
                Прислать инвайт
              </Button>
            </form>
          )}

          {canManageLobby && botStatus.activeLobbyId === lobbyId && (
            <form action={releaseBotFromLobbyAction}>
              <input type="hidden" name="lobbyId" value={lobbyId} />
              <Button type="submit" variant="ghost" size="sm">
                <UserCheck className="h-3.5 w-3.5" />
                Освободить бота
              </Button>
            </form>
          )}
        </div>
      )}

      {isAdmin && (botStatus.status === 'disconnected' || isError) && (
        <form
          action={connectSteamBotAction}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-glass-border items-end"
        >
          <input type="hidden" name="returnTo" value={returnTo} />
          <div>
            <label className="block text-xs text-text-muted mb-1">Логин бота</label>
            <Input
              name="accountName"
              defaultValue={botStatus.accountName ?? ''}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Пароль</label>
            <Input name="password" type="password" required />
          </div>
          <Button type="submit" variant="primary">
            Подключить
          </Button>
        </form>
      )}
    </Card>
  );
}
