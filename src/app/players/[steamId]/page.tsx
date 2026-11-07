// [Phase: MVP v1] Player Profile Page (/players/[steamId]) — Separate Dota 2 (OpenDota) & Platform Stats (Section 5 & 6)
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  RefreshCw,
  ExternalLink,
  Shield,
  Trophy,
  Swords,
  Lock,
  AlertTriangle,
  LogOut,
  UserX,
} from 'lucide-react';
import { getCurrentUser } from '@/modules/auth/service';
import {
  anonymizeAccountAction,
  logoutAllDevicesAction,
  refreshSteamProfileAction,
} from '@/modules/auth/actions';
import { getPlayerProfile } from '@/modules/users/service';
import { syncPlayerOpenDotaAction } from '@/modules/users/actions';
import { formatRankTier, getHeroName } from '@/modules/dota-data/service';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate, formatDateTime } from '@/lib/utils';

export async function generateMetadata({
  params,
}: {
  params: { steamId: string };
}): Promise<Metadata> {
  const profile = await getPlayerProfile(params.steamId);
  if (!profile) {
    return { title: 'Игрок не найден' };
  }
  return {
    title: `${profile.user.nickname} — Профиль игрока Dota 2`,
    description: `Статистика игрока ${profile.user.nickname} на платформе AEGIS GRID и в Dota 2 (OpenDota).`,
  };
}

export default async function PlayerProfilePage({
  params,
}: {
  params: { steamId: string };
}) {
  const [viewer, profile] = await Promise.all([
    getCurrentUser(),
    getPlayerProfile(params.steamId),
  ]);

  if (!profile) {
    notFound();
  }

  const isOwnProfile = Boolean(viewer && viewer.id === profile.user.id);
  const { user, platformStats, teamHistory, dotaStats } = profile;

  return (
    <div className="space-y-8">
      {/* Top Player Identity Card */}
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-lg bg-bg-elevated border border-glass-border flex items-center justify-center text-2xl font-bold text-accent overflow-hidden shrink-0">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.nickname}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{user.nickname.slice(0, 2).toUpperCase()}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-text">{user.nickname}</h1>
              <span className="text-xs font-mono px-2 py-0.5 rounded-sm bg-accent-soft border border-accent/30 text-accent uppercase">
                {user.role}
              </span>
            </div>

            <div className="text-xs text-text-muted flex flex-wrap items-center gap-3">
              <span>
                SteamID64: <code className="text-text">{user.steamId64}</code>
              </span>
              <span>•</span>
              <span>На платформе с {formatDate(user.createdAt)}</span>
            </div>

            {user.profileUrl && (
              <div>
                <a
                  href={user.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  Профиль Steam Community
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Sync Actions */}
        {viewer && (
          <div className="flex flex-wrap items-center gap-2.5">
            {isOwnProfile && (
              <form action={refreshSteamProfileAction}>
                <Button type="submit" variant="secondary" size="sm">
                  <RefreshCw className="h-3.5 w-3.5 text-accent" />
                  Обновить профиль Steam
                </Button>
              </form>
            )}

            <form action={syncPlayerOpenDotaAction}>
              <input type="hidden" name="steamId64" value={user.steamId64} />
              <Button type="submit" variant="primary" size="sm">
                <RefreshCw className="h-3.5 w-3.5" />
                Синхронизировать OpenDota
              </Button>
            </form>
          </div>
        )}
      </Card>

      {/* Two Strictly Separate Blocks: 1. Platform Stats vs 2. Dota 2 (OpenDota) Stats (Section 6) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* BLOCK 1: Platform Tournament & Match Statistics */}
        <Card className="space-y-5">
          <div className="flex items-center justify-between border-b border-glass-border pb-3">
            <div>
              <h2 className="text-base font-bold text-text flex items-center gap-2">
                <Trophy className="h-4 w-4 text-accent" />
                Статистика на платформе AEGIS GRID
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Только официальные матчи и турниры платформы (не смешивается с MMR Dota 2)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-md bg-bg border border-glass-border">
              <div className="text-xs text-text-muted">Турниров сыграно</div>
              <div className="text-2xl font-bold text-text mt-1">
                {platformStats.tournamentsPlayed}
              </div>
            </div>

            <div className="p-3.5 rounded-md bg-bg border border-glass-border">
              <div className="text-xs text-text-muted">Турниров выиграно</div>
              <div className="text-2xl font-bold text-accent mt-1">
                {platformStats.tournamentsWon}
              </div>
            </div>

            <div className="p-3.5 rounded-md bg-bg border border-glass-border">
              <div className="text-xs text-text-muted">Винрейт платформы</div>
              <div className="text-2xl font-bold text-text mt-1">
                {platformStats.winrate}%
              </div>
            </div>

            <div className="p-3.5 rounded-md bg-bg border border-glass-border">
              <div className="text-xs text-text-muted">Матчей сыграно</div>
              <div className="text-xl font-bold text-text mt-1">
                {platformStats.matchesPlayed}
              </div>
            </div>

            <div className="p-3.5 rounded-md bg-bg border border-glass-border">
              <div className="text-xs text-text-muted">Побед</div>
              <div className="text-xl font-bold text-success mt-1">
                {platformStats.matchesWon}
              </div>
            </div>

            <div className="p-3.5 rounded-md bg-bg border border-glass-border">
              <div className="text-xs text-text-muted">Поражений</div>
              <div className="text-xl font-bold text-danger mt-1">
                {platformStats.matchesLost}
              </div>
            </div>
          </div>

          {/* Team Membership History */}
          <div className="space-y-3 pt-3 border-t border-glass-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-accent" />
              История команд игрока
            </h3>
            {teamHistory.length === 0 ? (
              <p className="text-xs text-text-muted">
                Игрок ещё не состоял ни в одной команде на платформе.
              </p>
            ) : (
              <div className="space-y-2">
                {teamHistory.map((m) => (
                  <div
                    key={m.membershipId}
                    className="flex items-center justify-between p-3 rounded-sm bg-bg border border-glass-border text-xs"
                  >
                    <div>
                      <Link
                        href={`/teams/${m.team.tag}`}
                        className="font-bold text-text hover:text-accent"
                      >
                        [{m.team.tag}] {m.team.name}
                      </Link>
                      <div className="text-text-muted text-[11px] mt-0.5">
                        Роль: <strong className="text-text">{m.role}</strong> •{' '}
                        {formatDate(m.joinedAt)} —{' '}
                        {m.leftAt ? formatDate(m.leftAt) : 'по наст. время'}
                      </div>
                    </div>
                    <StatusBadge status={m.isActive ? 'active' : 'inactive'} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* BLOCK 2: In-Game Dota 2 Statistics from OpenDota Cache */}
        <Card className="space-y-5">
          <div className="flex items-center justify-between border-b border-glass-border pb-3">
            <div>
              <h2 className="text-base font-bold text-text flex items-center gap-2">
                <Swords className="h-4 w-4 text-accent" />
                Статистика Dota 2 (OpenDota API)
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Кэш БД: TTL 1 час • Статус:{' '}
                <strong className="text-text uppercase">{dotaStats.status}</strong>
                {dotaStats.syncedAt &&
                  ` • Обновлено: ${formatDateTime(dotaStats.syncedAt)}`}
              </p>
            </div>
          </div>

          {/* Stale cache / API error notice (Section 6) */}
          {dotaStats.status === 'error' && dotaStats.data && (
            <div className="rounded-sm bg-warning/15 border border-warning/30 p-3 text-xs text-warning flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Внешний API OpenDota временно недоступен. Показан последний сохранённый кэш от{' '}
              {formatDateTime(dotaStats.syncedAt)}.
            </div>
          )}

          {/* Status states when no data is present */}
          {dotaStats.status === 'private' && (
            <div className="p-6 rounded-md bg-bg border border-glass-border text-center space-y-2">
              <Lock className="h-6 w-6 text-warning mx-auto" />
              <div className="text-sm font-semibold text-text">
                Профиль скрыт в Steam / OpenDota
              </div>
              <p className="text-xs text-text-muted">
                В настройках Dota 2 у игрока отключена опция «Общедоступная история матчей» (Expose Public Match Data).
              </p>
            </div>
          )}

          {dotaStats.status === 'pending' && !dotaStats.data && (
            <div className="p-6 rounded-md bg-bg border border-glass-border text-center space-y-2">
              <div className="text-sm font-semibold text-text">Нет данных</div>
              <p className="text-xs text-text-muted">
                Статистика OpenDota ещё не запрашивалась. Нажмите кнопку «Синхронизировать OpenDota» выше.
              </p>
            </div>
          )}

          {dotaStats.status === 'error' && !dotaStats.data && (
            <div className="p-6 rounded-md bg-danger/10 border border-danger/30 text-center space-y-2">
              <AlertTriangle className="h-6 w-6 text-danger mx-auto" />
              <div className="text-sm font-semibold text-text">
                Ошибка синхронизации с OpenDota
              </div>
              <p className="text-xs text-text-muted">
                Внешний сервис не ответил, а локальный кэш для этого SteamID64 пока пуст.
              </p>
            </div>
          )}

          {/* Render Real Cached OpenDota Stats */}
          {dotaStats.data && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-md bg-bg border border-glass-border">
                  <div className="text-xs text-text-muted">Ранг Dota 2</div>
                  <div className="text-lg font-bold text-accent mt-1">
                    {formatRankTier(dotaStats.data.rankTier)}
                  </div>
                </div>

                <div className="p-3.5 rounded-md bg-bg border border-glass-border">
                  <div className="text-xs text-text-muted">Оценка MMR</div>
                  <div className="text-lg font-bold text-text mt-1">
                    {dotaStats.data.estimatedMmr ?? 'Скрыт'}
                  </div>
                </div>

                <div className="p-3.5 rounded-md bg-bg border border-glass-border">
                  <div className="text-xs text-text-muted">Винрейт Dota 2</div>
                  <div className="text-lg font-bold text-text mt-1">
                    {dotaStats.data.winrate}%
                  </div>
                </div>

                <div className="p-3.5 rounded-md bg-bg border border-glass-border">
                  <div className="text-xs text-text-muted">Всего матчей</div>
                  <div className="text-lg font-bold text-text mt-1">
                    {dotaStats.data.totalMatches}
                  </div>
                </div>

                <div className="p-3.5 rounded-md bg-bg border border-glass-border">
                  <div className="text-xs text-text-muted">Побед</div>
                  <div className="text-lg font-bold text-success mt-1">
                    {dotaStats.data.wins}
                  </div>
                </div>

                <div className="p-3.5 rounded-md bg-bg border border-glass-border">
                  <div className="text-xs text-text-muted">Поражений</div>
                  <div className="text-lg font-bold text-danger mt-1">
                    {dotaStats.data.losses}
                  </div>
                </div>
              </div>

              {/* Favorite Heroes */}
              <div className="space-y-2.5 pt-3 border-t border-glass-border">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Любимые герои (Топ по числу матчей)
                </h3>
                {dotaStats.data.topHeroes.length === 0 ? (
                  <p className="text-xs text-text-muted">Нет данных о героях.</p>
                ) : (
                  <div className="space-y-2">
                    {dotaStats.data.topHeroes.map((h) => (
                      <div
                        key={h.heroId}
                        className="flex items-center justify-between p-2.5 rounded-sm bg-bg border border-glass-border text-xs"
                      >
                        <span className="font-semibold text-text">
                          {getHeroName(h.heroId)}
                        </span>
                        <div className="flex items-center gap-4 font-mono">
                          <span className="text-text-muted">
                            Матчей: <strong className="text-text">{h.games}</strong>
                          </span>
                          <span className="text-accent font-bold">
                            {h.winrate}% WR
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Security & Account Privacy Controls (Own Profile Only — Section 5 & 14) */}
      {isOwnProfile && (
        <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-glass-border">
          <div>
            <h3 className="text-sm font-bold text-text">
              Безопасность сессий и персональные данные
            </h3>
            <p className="text-xs text-text-muted">
              Вы можете завершить активные сессии на всех устройствах или анонимизировать свой профиль с сохранением турнирной истории.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <form action={logoutAllDevicesAction}>
              <Button type="submit" variant="secondary" size="sm">
                <LogOut className="h-3.5 w-3.5 text-warning" />
                Выйти со всех устройств
              </Button>
            </form>

            <form action={anonymizeAccountAction}>
              <Button type="submit" variant="danger" size="sm">
                <UserX className="h-3.5 w-3.5" />
                Анонимизировать аккаунт
              </Button>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
}
