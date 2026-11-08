// [Phase: MVP v1] Create New Team Page (/teams/new) (Section 7)
import Link from 'next/link';
import { getCurrentUser } from '@/modules/auth/service';
import { createTeamAction } from '@/modules/teams/actions';
import { PLATFORM_CONFIG } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { ForbiddenState, PageHeader } from '@/components/ui/states';

export default async function CreateTeamPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <ForbiddenState message="Для создания команды необходимо авторизоваться через Steam OpenID." />
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Создание новой команды"
        subtitle="Создатель автоматически получает роль Captain. Основной состав — до 5 игроков и до 2 запасных."
      />

      <Card>
        <form action={createTeamAction} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Название команды (уникально) *
              </label>
              <Input
                name="name"
                placeholder="Например: Team Spirit"
                minLength={3}
                maxLength={40}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Тег (2–5 символов) *
              </label>
              <Input
                name="tag"
                placeholder="TS"
                pattern="[A-Za-z0-9]{2,5}"
                minLength={2}
                maxLength={5}
                className="uppercase font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                Страна *
              </label>
              <Select name="country" defaultValue="RU">
                {PLATFORM_CONFIG.countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              Логотип команды (PNG / JPG / WEBP, до 2 МБ)
            </label>
            <Input
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              Описание коллектива
            </label>
            <Textarea
              name="description"
              placeholder="Расскажите о команде, расписании праков и целях на сезон..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Ссылка на Discord
              </label>
              <Input
                name="discordUrl"
                type="url"
                placeholder="https://discord.gg/..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Ссылка на Telegram
              </label>
              <Input
                name="telegramUrl"
                type="url"
                placeholder="https://t.me/..."
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              Пароль для быстрого вступления (необязательно, мин. 4 символа)
            </label>
            <Input
              name="joinPassword"
              type="password"
              minLength={4}
              placeholder="Введите пароль для вступления без заявки..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-glass-border">
            <Link href="/teams">
              <Button type="button" variant="secondary">
                Отмена
              </Button>
            </Link>
            <Button type="submit" variant="primary">
              Создать команду
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
