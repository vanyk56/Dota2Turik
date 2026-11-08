// [Phase: MVP v1] Tournament Hub & Bracket Canvas Page (/tournaments/[slug]) (Section 10, 11, 14)
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Swords,
  Users,
  Trophy,
  Calendar,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  BookOpen,
} from 'lucide-react';
import { getCurrentUser } from '@/modules/auth/service';
import {
  getTournamentBySlug,
  getTournamentViewerTeamsContext,
} from '@/modules/tournaments/service';
import {
  changeTournamentStatusAction,
  decideRegistrationAction,
  registerTeamForTournamentAction,
  startTournamentAction,
} from '@/modules/tournaments/actions';
import { canManageTournament } from '@/server/permissions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, PageHeader } from '@/components/ui/states';
import {
  BracketCanvas,
  type SerializedBracketMatch,
} from '@/components/canvas/bracket-canvas';
import { formatDateTime } from '@/lib/utils';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const tournament = await getTournamentBySlug(params.slug);
  if (!tournament) {
    return { title: 'Турнир не найден' };
  }
  return {
    title: `${tournament.name} — Турнир Dota 2`,
    description: tournament.description.slice(0, 160),
    openGraph: {
      title: tournament.name,
      description: `${tournament.format} • Регион ${tournament.region} • Призовой фонд: ${tournament.prizePool ?? 'Рейтинговые очки'}`,
    },
  };
}

export default async function TournamentDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { reg_error?: string; reg_success?: string };
}) {
  const user = await getCurrentUser();
  const [tournament, viewerCtx] = await Promise.all([
    getTournamentBySlug(params.slug, user),
    getTournamentViewerTeamsContext(user?.id),
  ]);

  if (!tournament) {
    notFound();
  }

  const canManage = canManageTournament(user, {
    organizerId: tournament.organizerId,
  });

  const approvedRegistrations = tournament.registrations.filter(
    (r) => r.status === 'approved',
  );
  const mainBracket = tournament.brackets[0] ?? null;
  const savedLayout =
    (mainBracket?.layout as unknown as Record<string, { x: number; y: number }>) ??
    {};

  const teamMap = new Map(
    tournament.registrations.map((r) => [r.team.id, r.team]),
  );

  return (
    <div className="space-y-8">
      {searchParams?.reg_error && (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-950/30 text-red-200 text-sm flex items-start gap-3 backdrop-blur-sm shadow-lg">
          <span className="text-lg">⚠️</span>
          <div className="space-y-1">
            <p className="font-semibold text-red-100">Ошибка регистрации на турнир</p>
            <p className="text-red-300/90 text-xs leading-relaxed">{searchParams.reg_error}</p>
          </div>
        </div>
      )}

      {searchParams?.reg_success && (
        <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/30 text-emerald-200 text-sm flex items-start gap-3 backdrop-blur-sm shadow-lg">
          <span className="text-lg">✅</span>
          <div className="space-y-1">
            <p className="font-semibold text-emerald-100">Заявка принята</p>
            <p className="text-emerald-300/90 text-xs leading-relaxed">{searchParams.reg_success}</p>
          </div>
        </div>
      )}

      <PageHeader
        title={tournament.name}
        subtitle={tournament.description}
        badge={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={tournament.status} />
            <span className="text-xs font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-sm border border-accent/30 uppercase">
              {tournament.format === 'round_robin'
                ? 'Round Robin'
                : 'Single Elimination'}
            </span>
            <span className="text-xs font-mono text-text-muted bg-bg-elevated px-2 py-0.5 rounded-sm border border-glass-border uppercase">
              {tournament.region} • {tournament.levelWeight}
            </span>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Team Registration Button for Captain / Co-Captain */}
            {tournament.status === 'registration' &&
              viewerCtx.registrableTeams.length > 0 && (
                <form
                  action={registerTeamForTournamentAction}
                  className="flex items-center gap-2"
                >
                  <input
                    type="hidden"
                    name="tournamentId"
                    value={tournament.id}
                  />
                  <input
                    type="hidden"
                    name="tournamentSlug"
                    value={tournament.slug}
                  />
                  <Select
                    name="teamId"
                    className="h-9 text-xs w-[180px]"
                    defaultValue={viewerCtx.registrableTeams[0]?.id}
                  >
                    {viewerCtx.registrableTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.tag}] {t.name}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" variant="primary" size="sm">
                    Подать заявку командой
                  </Button>
                </form>
              )}

            {/* Organizer Start Tournament & Generate Bracket */}
            {canManage &&
              tournament.status === 'registration' &&
              approvedRegistrations.length >= 2 && (
                <form action={startTournamentAction}>
                  <input
                    type="hidden"
                    name="tournamentId"
                    value={tournament.id}
                  />
                  <input
                    type="hidden"
                    name="tournamentSlug"
                    value={tournament.slug}
                  />
                  <Button type="submit" variant="primary" size="sm">
                    <Play className="h-3.5 w-3.5" />
                    Запустить турнир и сгенерировать сетку
                  </Button>
                </form>
              )}

            {/* Organizer Explicit Regenerate Bracket (in_progress) */}
            {canManage && tournament.status === 'in_progress' && (
              <form action={startTournamentAction}>
                <input
                  type="hidden"
                  name="tournamentId"
                  value={tournament.id}
                />
                <input
                  type="hidden"
                  name="tournamentSlug"
                  value={tournament.slug}
                />
                <input type="hidden" name="regenerate" value="true" />
                <Button type="submit" variant="secondary" size="sm">
                  <RefreshCw className="h-3.5 w-3.5 text-warning" />
                  Перегенерировать сетку
                </Button>
              </form>
            )}
          </div>
        }
      />

      {/* Info Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-text-muted flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-accent" />
            Старт турнира
          </div>
          <div className="text-sm font-bold text-text mt-1">
            {formatDateTime(tournament.startsAt)}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-text-muted flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-accent" />
            Подтверждено команд
          </div>
          <div className="text-sm font-bold text-text mt-1">
            {approvedRegistrations.length} / {tournament.maxTeams}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-text-muted flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-accent" />
            Призовой фонд
          </div>
          <div className="text-sm font-bold text-accent mt-1">
            {tournament.prizePool || 'Очки рейтинга платформы'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-text-muted flex items-center gap-1.5">
            <Swords className="h-3.5 w-3.5 text-accent" />
            Организатор
          </div>
          <div className="text-sm font-bold text-text mt-1">
            <Link
              href={`/players/${tournament.organizer.steamId64}`}
              className="hover:text-accent"
            >
              {tournament.organizer.nickname}
            </Link>
          </div>
        </Card>
      </div>

      {/* Interactive React Flow Bracket Canvas Section (Section 11) */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-text flex items-center gap-2">
          <Swords className="h-5 w-5 text-accent" />
          Интерактивный холст турнирной сетки
        </h2>

        {tournament.matches.length === 0 ? (
          <EmptyState
            title="Турнирная сетка ещё не сгенерирована"
            description="Сетка создаётся автоматически при запуске турнира организатором, когда одобрено минимум 2 команды."
          />
        ) : (
          <BracketCanvas
            tournamentSlug={tournament.slug}
            tournamentName={tournament.name}
            tournamentStatus={tournament.status}
            format={tournament.format}
            bracketId={mainBracket?.id ?? null}
            initialLayout={savedLayout}
            initialMatches={
              tournament.matches as unknown as SerializedBracketMatch[]
            }
            canManageBracket={canManage}
            viewerTeamIds={viewerCtx.viewerTeamIds}
            isAuthenticated={Boolean(user)}
          />
        )}
      </section>

      {/* Round Robin Standings Table (if format is round_robin) */}
      {tournament.format === 'round_robin' &&
        tournament.roundRobinStandings &&
        tournament.roundRobinStandings.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-text flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent" />
              Турнирная таблица (Round Robin • Tie-break: Личные встречи → Разница карт)
            </h2>
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase text-text-muted border-b border-glass-border bg-bg-elevated">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Команда</th>
                    <th className="px-4 py-3 text-center">Игр</th>
                    <th className="px-4 py-3 text-center">Побед</th>
                    <th className="px-4 py-3 text-center">Поражений</th>
                    <th className="px-4 py-3 text-center">Карты</th>
                    <th className="px-4 py-3 text-center">Разница</th>
                    <th className="px-4 py-3 text-right">Очки</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glass-border">
                  {tournament.roundRobinStandings.map((row) => {
                    const teamInfo = teamMap.get(row.teamId);
                    return (
                      <tr
                        key={row.teamId}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3 font-mono font-bold text-accent">
                          #{row.placement}
                        </td>
                        <td className="px-4 py-3 font-semibold text-text">
                          {teamInfo ? (
                            <Link
                              href={`/teams/${teamInfo.tag}`}
                              className="hover:text-accent"
                            >
                              [{teamInfo.tag}] {teamInfo.name}
                            </Link>
                          ) : (
                            row.teamId
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">{row.played}</td>
                        <td className="px-4 py-3 text-center text-success font-semibold">
                          {row.wins}
                        </td>
                        <td className="px-4 py-3 text-center text-danger">
                          {row.losses}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {row.scoreFor}:{row.scoreAgainst}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {row.scoreDiff > 0
                            ? `+${row.scoreDiff}`
                            : row.scoreDiff}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-accent">
                          {row.points}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </section>
        )}

      {/* Participants & Organizer Management Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Participants List (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-lg font-bold text-text flex items-center gap-2">
            <Users className="h-5 w-5 text-accent" />
            Заявки и участники ({tournament.registrations.length})
          </h2>

          {tournament.registrations.length === 0 ? (
            <Card className="text-xs text-text-muted">
              Пока ни одна команда не подала заявку на участие.
            </Card>
          ) : (
            <div className="space-y-3">
              {tournament.registrations.map((reg) => (
                <Card
                  key={reg.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-accent bg-accent-soft px-1.5 py-0.5 rounded-sm border border-accent/30">
                        [{reg.team.tag}]
                      </span>
                      <Link
                        href={`/teams/${reg.team.tag}`}
                        className="font-bold text-text hover:text-accent"
                      >
                        {reg.team.name}
                      </Link>
                      <StatusBadge status={reg.status} />
                      {reg.seed && (
                        <span className="text-xs font-mono text-text-muted">
                          Seed #{reg.seed}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-muted">
                      Рейтинг: <strong>{reg.team.ratingPoints} pts</strong> •
                      Состав:{' '}
                      {reg.team.memberships
                        .map((m) => m.user.nickname)
                        .join(', ')}
                    </div>
                  </div>

                  {canManage && tournament.status === 'registration' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <form
                        action={decideRegistrationAction}
                        className="flex items-center gap-1.5"
                      >
                        <input
                          type="hidden"
                          name="registrationId"
                          value={reg.id}
                        />
                        <input
                          type="hidden"
                          name="tournamentSlug"
                          value={tournament.slug}
                        />
                        <Input
                          name="seed"
                          type="number"
                          min={1}
                          max={128}
                          defaultValue={reg.seed ?? ''}
                          placeholder="Сид"
                          className="h-8 w-16 text-xs"
                        />
                        <input type="hidden" name="status" value="approved" />
                        <Button type="submit" variant="success" size="sm">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Принять
                        </Button>
                      </form>

                      <form action={decideRegistrationAction}>
                        <input
                          type="hidden"
                          name="registrationId"
                          value={reg.id}
                        />
                        <input
                          type="hidden"
                          name="tournamentSlug"
                          value={tournament.slug}
                        />
                        <input type="hidden" name="status" value="rejected" />
                        <Button type="submit" variant="danger" size="sm">
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Rules & Organizer Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="space-y-3">
            <h3 className="text-base font-bold text-text flex items-center gap-2 border-b border-glass-border pb-3">
              <BookOpen className="h-4 w-4 text-accent" />
              Регламент и правила
            </h3>
            <div className="text-xs text-text-muted whitespace-pre-line leading-relaxed">
              {tournament.rules ||
                'Стандартный турнирный регламент Captains Mode (5v5). Результаты подтверждаются обеими командами.'}
            </div>
          </Card>

          {canManage && (
            <Card className="space-y-4 border-accent/40">
              <h3 className="text-base font-bold text-text border-b border-glass-border pb-3">
                Панель организатора турнира
              </h3>

              {/* Manual Team Addition during Registration */}
              {tournament.status === 'registration' && (
                <form
                  action={registerTeamForTournamentAction}
                  className="space-y-2.5"
                >
                  <input
                    type="hidden"
                    name="tournamentId"
                    value={tournament.id}
                  />
                  <input
                    type="hidden"
                    name="tournamentSlug"
                    value={tournament.slug}
                  />
                  <input type="hidden" name="autoApprove" value="true" />
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Вручную добавить команду (требуется ≥5 игроков основы)
                  </label>
                  <div className="flex gap-2">
                    <Select name="teamId" className="flex-1 text-xs">
                      {viewerCtx.allTeams.map((t) => (
                        <option key={t.id} value={t.id}>
                          [{t.tag}] {t.name} ({t.ratingPoints} pts)
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" variant="secondary" size="sm">
                      Добавить
                    </Button>
                  </div>
                </form>
              )}

              {/* Lifecycle Status Switcher */}
              <form
                action={changeTournamentStatusAction}
                className="space-y-2.5 pt-3 border-t border-glass-border"
              >
                <input
                  type="hidden"
                  name="tournamentId"
                  value={tournament.id}
                />
                <input
                  type="hidden"
                  name="tournamentSlug"
                  value={tournament.slug}
                />
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Изменить статус турнира (запишется в аудит)
                </label>
                <div className="flex gap-2">
                  <Select
                    name="status"
                    defaultValue={tournament.status}
                    className="flex-1 text-xs"
                  >
                    <option value="draft">Draft (Черновик)</option>
                    <option value="registration">
                      Registration (Регистрация)
                    </option>
                    <option value="in_progress">
                      In Progress (Идёт турнир)
                    </option>
                    <option value="finished">
                      Finished (Завершить и начислить рейтинг)
                    </option>
                    <option value="cancelled">
                      Cancelled (Отменить без рейтинга)
                    </option>
                  </Select>
                  <Button type="submit" variant="primary" size="sm">
                    Применить
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
