// [Phase: MVP v1] Create Tournament Page (/tournaments/new) (Section 10)
import Link from 'next/link';
import { getCurrentUser } from '@/modules/auth/service';
import { createTournamentAction } from '@/modules/tournaments/actions';
import { PLATFORM_CONFIG } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { ForbiddenState, PageHeader } from '@/components/ui/states';

export default async function CreateTournamentPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <ForbiddenState message="Для создания турнира необходимо войти через Steam OpenID." />
    );
  }

  const tomorrowIso = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Создание турнира Dota 2"
        subtitle="Настройте формат сетки (Single Elimination или Round Robin), посев, серию матчей и уровень турнира для расчёта рейтинга."
      />

      {searchParams?.error && (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-950/30 text-red-200 text-sm flex items-start gap-3 backdrop-blur-sm shadow-lg">
          <span className="text-lg">⚠️</span>
          <div className="space-y-1">
            <p className="font-semibold text-red-100">Ошибка при создании турнира</p>
            <p className="text-red-300/90 text-xs leading-relaxed">{searchParams.error}</p>
          </div>
        </div>
      )}

      <Card>
        <form action={createTournamentAction} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Название турнира *
              </label>
              <Input
                name="name"
                placeholder="Например: Winter Cup 2026"
                minLength={2}
                maxLength={80}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                URL Slug (необязательно, сгенерируется автоматически)
              </label>
              <Input
                name="slug"
                placeholder="winter-cup-2026"
                className="font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Формат сетки (MVP v1) *
              </label>
              <Select name="format" defaultValue="single_elimination">
                <option value="single_elimination">Single Elimination</option>
                <option value="round_robin">Round Robin (Круговая)</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Максимум команд *
              </label>
              <Select name="maxTeams" defaultValue="16">
                <option value="4">4 команды</option>
                <option value="8">8 команд</option>
                <option value="16">16 команд</option>
                <option value="32">32 команды</option>
                <option value="64">64 команды</option>
                <option value="128">128 команд</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Серия матчей по умолчанию (BO)
              </label>
              <Select name="defaultBestOf" defaultValue="3">
                <option value="1">Best of 1 (BO1)</option>
                <option value="3">Best of 3 (BO3)</option>
                <option value="5">Best of 5 (BO5)</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Правило посева (Seeding)
              </label>
              <Select name="seedingMode" defaultValue="rating">
                <option value="rating">По рейтингу платформы</option>
                <option value="manual">Ручной посев организатора</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Вес турнира для рейтинга
              </label>
              <Select name="levelWeight" defaultValue="tier_b">
                <option value="tier_s">Tier S (x2.0)</option>
                <option value="tier_a">Tier A (x1.5)</option>
                <option value="tier_b">Tier B (x1.0)</option>
                <option value="tier_c">Tier C (x0.5)</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Дата и время старта *
              </label>
              <Input
                name="startsAt"
                type="datetime-local"
                defaultValue={tomorrowIso}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Призовой фонд (текст)
              </label>
              <Input name="prizePool" placeholder="Например: 500 000 ₽ / Кубок" />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Начальный статус
              </label>
              <Select name="initialStatus" defaultValue="registration">
                <option value="registration">Открыть регистрацию сразу</option>
                <option value="draft">Сохранить как черновик (Draft)</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              Обложка турнира (PNG / JPG / WEBP, до 2 МБ)
            </label>
            <Input
              name="cover"
              type="file"
              accept="image/png,image/jpeg,image/webp"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              Описание турнира (необязательно)
            </label>
            <Textarea
              name="description"
              placeholder="Информация о турнире, расписании, формате и призах..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              Регламент и правила (Markdown)
            </label>
            <Textarea
              name="rules"
              placeholder="1. Режим лобби: Captains Mode. 2. Сервер: Стокгольм / Франкфурт. 3. Пауза до 10 минут на команду..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-glass-border">
            <Link href="/tournaments">
              <Button type="button" variant="secondary">
                Отмена
              </Button>
            </Link>
            <Button type="submit" variant="primary">
              Создать турнир
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
