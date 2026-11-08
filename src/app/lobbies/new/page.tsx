// [Phase: MVP v1] Create Custom Lobby Page (/lobbies/new) — Open or Password-Protected Game Room
import Link from 'next/link';
import { Gamepad2 } from 'lucide-react';
import { getCurrentUser } from '@/modules/auth/service';
import { createLobbyAction } from '@/modules/lobbies/actions';
import { LOBBY_SERVER_LOCATIONS } from '@/modules/lobbies/service';
import { PLATFORM_CONFIG } from '@/lib/config';
import { LobbyAccessSelector } from '@/components/lobbies/lobby-live-controls';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { ForbiddenState, PageHeader } from '@/components/ui/states';

export default async function CreateLobbyPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <ForbiddenState message="Для создания лобби (лобака) необходимо войти через Steam." />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Создать лобби (Лобак Dota 2)"
        subtitle="Создайте открытую игру со свободным входом или закрытое лобби по паролю, соберите 10 игроков (5x5 Radiant vs Dire) или сыграйте 1x1 Solo Mid."
      />

      <Card>
        <form action={createLobbyAction} className="space-y-6">
          {/* Lobby Title & Format */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Название лобби *
              </label>
              <Input
                name="name"
                placeholder="Например: Вечерний лобак 5x5 без тильта"
                minLength={3}
                maxLength={80}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Размер комнаты *
              </label>
              <Select name="maxPlayers" defaultValue="10">
                <option value="10">5x5 — Полное лобби (10 игроков)</option>
                <option value="2">1x1 — Дуэль Solo Mid (2 игрока)</option>
              </Select>
            </div>
          </div>

          {/* Open vs Password-Protected Selector */}
          <LobbyAccessSelector />

          {/* Game Mode, Server, Region */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Режим игры в Dota 2 *
              </label>
              <Select name="gameMode" defaultValue="all_pick">
                <option value="all_pick">All Pick 5x5</option>
                <option value="captains_mode">Captains Mode (CM)</option>
                <option value="mid_only">1x1 / Mid Only</option>
                <option value="random_draft">Random Draft (RD)</option>
                <option value="turbo">Turbo</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Игровой сервер Dota 2 *
              </label>
              <Select name="serverLocation" defaultValue="Stockholm (EU North)">
                {LOBBY_SERVER_LOCATIONS.map((srv) => (
                  <option key={srv} value={srv}>
                    {srv}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Регион *
              </label>
              <Select name="region" defaultValue="EU">
                {PLATFORM_CONFIG.regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Optional In-Game Dota 2 Lobby Credentials */}
          <div className="rounded-md border border-glass-border bg-bg-elevated p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text">
              <Gamepad2 className="h-4 w-4 text-accent" />
              Данные лобби внутри клиента Dota 2 (необязательно — заполнятся автоматически)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">
                  Имя лобби в клиенте Dota 2
                </label>
                <Input
                  name="dotaLobbyName"
                  placeholder="Сгенерируется автоматически из названия"
                  maxLength={80}
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">
                  Пароль внутри клиента Dota 2 (виден участникам)
                </label>
                <Input
                  name="dotaLobbyPassword"
                  placeholder="Например: dt555 (сгенерируется автоматически)"
                  maxLength={64}
                />
              </div>
            </div>
          </div>

          {/* Description / Voice Chat */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              Описание, правила или ссылка на Discord (необязательно)
            </label>
            <Textarea
              name="description"
              placeholder="Укажите желаемый средний MMR, ссылку на голосовой канал Discord или дополнительные правила..."
              maxLength={500}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-glass-border">
            <Link href="/lobbies">
              <Button type="button" variant="secondary">
                Отмена
              </Button>
            </Link>
            <Button type="submit" variant="primary">
              <Gamepad2 className="h-4 w-4" />
              Создать лобби
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
