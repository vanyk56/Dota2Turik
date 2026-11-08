// Create lobby page
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

const labelClass = 'block text-xs font-medium text-text-muted mb-1.5';

export default async function CreateLobbyPage() {
  const user = await getCurrentUser();

  if (!user) {
    return <ForbiddenState message="Войдите через Steam, чтобы создать лобби." />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="Новое лобби" />

      <Card>
        <form action={createLobbyAction} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Название</label>
              <Input
                name="name"
                placeholder="Вечерний 5x5"
                minLength={3}
                maxLength={80}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Формат</label>
              <Select name="maxPlayers" defaultValue="10">
                <option value="10">5x5</option>
                <option value="2">1x1</option>
              </Select>
            </div>
          </div>

          <LobbyAccessSelector />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Режим</label>
              <Select name="gameMode" defaultValue="all_pick">
                <option value="all_pick">All Pick</option>
                <option value="captains_mode">Captains Mode</option>
                <option value="mid_only">1x1 Mid</option>
                <option value="random_draft">Random Draft</option>
                <option value="turbo">Turbo</option>
              </Select>
            </div>

            <div>
              <label className={labelClass}>Сервер</label>
              <Select name="serverLocation" defaultValue="Stockholm (EU North)">
                {LOBBY_SERVER_LOCATIONS.map((srv) => (
                  <option key={srv} value={srv}>
                    {srv}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className={labelClass}>Регион</label>
              <Select name="region" defaultValue="EU">
                {PLATFORM_CONFIG.regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Описание</label>
            <Textarea
              name="description"
              placeholder="MMR, Discord, правила..."
              maxLength={500}
              className="min-h-[72px]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-glass-border">
            <Link href="/lobbies">
              <Button type="button" variant="ghost">
                Отмена
              </Button>
            </Link>
            <Button type="submit" variant="primary">
              <Gamepad2 className="h-4 w-4" />
              Создать
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
