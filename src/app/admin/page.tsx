// [Phase: MVP v1] Admin Panel & Audit Log Page (/admin) (Section 1, 9, 13, 14)
import Link from 'next/link';
import {
  ShieldCheck,
  Users,
  Calculator,
  AlertTriangle,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { getCurrentUser } from '@/modules/auth/service';
import { getAdminDashboardData } from '@/modules/admin/service';
import {
  changeUserRoleAction,
  createRatingFormulaVersionAction,
  toggleUserBlockAction,
  triggerRatingRecalculationAction,
} from '@/modules/admin/actions';
import { organizerOverrideResultAction } from '@/modules/matches/actions';
import { isModeratorOrAdmin, isAdmin } from '@/server/permissions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { ForbiddenState, PageHeader } from '@/components/ui/states';
import { formatDateTime } from '@/lib/utils';

export default async function AdminPage() {
  const viewer = await getCurrentUser();

  if (!viewer || !isModeratorOrAdmin(viewer)) {
    return (
      <ForbiddenState message="Доступ к панели управления разрешён только администраторам и модераторам платформы." />
    );
  }

  const viewerIsAdmin = isAdmin(viewer);
  const data = await getAdminDashboardData(viewer);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Админ-панель и журнал аудита"
        subtitle="Управление пользователями, разрешение турнирных споров, версионирование формулы рейтинга и контроль безопасности."
        badge={
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-warning bg-warning/15 px-2.5 py-1 rounded-sm border border-warning/30 uppercase">
            <ShieldCheck className="h-3.5 w-3.5" />
            Роль: {viewer.role}
          </span>
        }
      />

      {/* 1. Open Match Disputes Section (Moderator & Admin) */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-text flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-danger" />
          Открытые споры по матчам ({data.openDisputes.length})
        </h2>

        {data.openDisputes.length === 0 ? (
          <Card className="text-xs text-text-muted">
            Открытых споров нет — все матчи подтверждены штатно.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.openDisputes.map((dispute) => (
              <Card
                key={dispute.id}
                className="space-y-3 border-danger/40 bg-danger/[0.03]"
              >
                <div className="flex items-center justify-between text-xs">
                  <Link
                    href={`/tournaments/${dispute.match.tournament.slug}`}
                    className="font-bold text-accent hover:underline"
                  >
                    {dispute.match.tournament.name} (R{dispute.match.round})
                  </Link>
                  <span className="text-text-muted">
                    {formatDateTime(dispute.createdAt)}
                  </span>
                </div>

                <div className="text-sm font-bold text-text">
                  [{dispute.match.teamA?.tag ?? 'TBD'}] vs [
                  {dispute.match.teamB?.tag ?? 'TBD'}]
                </div>

                <p className="text-xs text-text-muted bg-bg p-2.5 rounded-sm border border-glass-border">
                  <strong>{dispute.openedBy.nickname}:</strong> {dispute.reason}
                </p>

                <form
                  action={organizerOverrideResultAction}
                  className="space-y-2.5 pt-2 border-t border-glass-border"
                >
                  <input
                    type="hidden"
                    name="matchId"
                    value={dispute.match.id}
                  />
                  <input
                    type="hidden"
                    name="tournamentSlug"
                    value={dispute.match.tournament.slug}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">
                        Счёт {dispute.match.teamA?.tag}
                      </label>
                      <Input
                        name="scoreA"
                        type="number"
                        min={0}
                        max={5}
                        defaultValue={dispute.match.scoreA}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">
                        Счёт {dispute.match.teamB?.tag}
                      </label>
                      <Input
                        name="scoreB"
                        type="number"
                        min={0}
                        max={5}
                        defaultValue={dispute.match.scoreB}
                        required
                      />
                    </div>
                  </div>
                  <Input
                    name="resolutionNote"
                    placeholder="Вердикт модератора / судьи..."
                    required
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="w-full"
                  >
                    Разрешить спор и утвердить счёт
                  </Button>
                </form>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 2. Rating Formula Versioning & Recalculation (Admin Only — Section 9 & 13) */}
      {viewerIsAdmin && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-text flex items-center gap-2">
              <Calculator className="h-5 w-5 text-accent" />
              Формула рейтинга платформы (Активная версия: v
              {data.activeFormula.version})
            </h2>

            <form action={triggerRatingRecalculationAction}>
              <Button type="submit" variant="secondary" size="sm">
                <RefreshCw className="h-3.5 w-3.5 text-accent" />
                Пересчитать все завершённые турниры по v
                {data.activeFormula.version}
              </Button>
            </form>
          </div>

          <Card className="space-y-4">
            <p className="text-xs text-text-muted">
              Изменение параметров создаёт новую версию <code>RatingFormula</code>. Пересчёт старых турниров выполняется явно и фиксируется в <code>AuditLog</code>.
            </p>

            <form
              action={createRatingFormulaVersionAction}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    1 место (Base)
                  </label>
                  <Input
                    name="place1"
                    type="number"
                    defaultValue={data.activeFormula.config.basePoints['1']}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    2 место (Base)
                  </label>
                  <Input
                    name="place2"
                    type="number"
                    defaultValue={data.activeFormula.config.basePoints['2']}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    3 место (Base)
                  </label>
                  <Input
                    name="place3"
                    type="number"
                    defaultValue={data.activeFormula.config.basePoints['3']}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    4 место (Base)
                  </label>
                  <Input
                    name="place4"
                    type="number"
                    defaultValue={data.activeFormula.config.basePoints['4']}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    Бонус за победу (Match)
                  </label>
                  <Input
                    name="matchBonus"
                    type="number"
                    defaultValue={data.activeFormula.config.matchBonus}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    Множитель Tier S
                  </label>
                  <Input
                    name="tier_s"
                    type="number"
                    step="0.1"
                    defaultValue={
                      data.activeFormula.config.levelWeight['tier_s']
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    Множитель Tier A
                  </label>
                  <Input
                    name="tier_a"
                    type="number"
                    step="0.1"
                    defaultValue={
                      data.activeFormula.config.levelWeight['tier_a']
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    Множитель Tier B
                  </label>
                  <Input
                    name="tier_b"
                    type="number"
                    step="0.1"
                    defaultValue={
                      data.activeFormula.config.levelWeight['tier_b']
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    Множитель Tier C
                  </label>
                  <Input
                    name="tier_c"
                    type="number"
                    step="0.1"
                    defaultValue={
                      data.activeFormula.config.levelWeight['tier_c']
                    }
                    required
                  />
                </div>
              </div>

              <Button type="submit" variant="primary" size="sm">
                Сохранить как новую версию v{data.activeFormula.version + 1}
              </Button>
            </form>
          </Card>
        </section>
      )}

      {/* 3. Users Management & Blocking (Admin Only) */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-text flex items-center gap-2">
          <Users className="h-5 w-5 text-accent" />
          Пользователи платформы ({data.users.length})
        </h2>

        <Card className="overflow-x-auto p-0">
          <table className="w-full text-xs text-left">
            <thead className="uppercase text-text-muted border-b border-glass-border bg-bg-elevated">
              <tr>
                <th className="px-4 py-3">Игрок</th>
                <th className="px-4 py-3">SteamID64</th>
                <th className="px-4 py-3">Роль</th>
                <th className="px-4 py-3">Статус</th>
                {viewerIsAdmin && (
                  <th className="px-4 py-3 text-right">Действия (Admin)</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {data.users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-semibold text-text">
                    <Link
                      href={`/players/${u.steamId64}`}
                      className="hover:text-accent"
                    >
                      {u.nickname}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-text-muted">
                    {u.steamId64}
                  </td>
                  <td className="px-4 py-3 font-mono uppercase text-accent">
                    {u.role}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={u.isBlocked ? 'rejected' : 'active'}
                      label={u.isBlocked ? 'Blocked' : 'Active'}
                    />
                  </td>
                  {viewerIsAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <form
                          action={changeUserRoleAction}
                          className="inline-flex items-center gap-1"
                        >
                          <input
                            type="hidden"
                            name="targetUserId"
                            value={u.id}
                          />
                          <Select
                            name="role"
                            defaultValue={u.role}
                            className="h-7 text-xs w-[115px] py-0"
                          >
                            <option value="user">user</option>
                            <option value="moderator">moderator</option>
                            <option value="admin">admin</option>
                          </Select>
                          <Button type="submit" variant="secondary" size="sm">
                            Роль
                          </Button>
                        </form>

                        {u.id !== viewer.id && (
                          <form action={toggleUserBlockAction}>
                            <input
                              type="hidden"
                              name="targetUserId"
                              value={u.id}
                            />
                            <input
                              type="hidden"
                              name="isBlocked"
                              value={u.isBlocked ? 'false' : 'true'}
                            />
                            <Button
                              type="submit"
                              variant={u.isBlocked ? 'success' : 'danger'}
                              size="sm"
                            >
                              {u.isBlocked
                                ? 'Разблокировать'
                                : 'Заблокировать'}
                            </Button>
                          </form>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      {/* 4. Audit Log Journal (Section 14 & Stage 6) */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-text flex items-center gap-2">
          <FileText className="h-5 w-5 text-accent" />
          Журнал аудита безопасности (AuditLog)
        </h2>

        <Card className="overflow-x-auto p-0">
          <table className="w-full text-xs text-left">
            <thead className="uppercase text-text-muted border-b border-glass-border bg-bg-elevated">
              <tr>
                <th className="px-4 py-3">Время</th>
                <th className="px-4 py-3">Актор</th>
                <th className="px-4 py-3">Действие</th>
                <th className="px-4 py-3">Сущность</th>
                <th className="px-4 py-3">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {data.auditLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-text-muted"
                  >
                    Записей в журнале аудита пока нет.
                  </td>
                </tr>
              ) : (
                data.auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-text">
                      {log.actor ? log.actor.nickname : 'System'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-accent">
                      {log.action}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-text-muted">
                      {log.entityType}:{log.entityId.slice(0, 10)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-text-muted max-w-md truncate">
                      {JSON.stringify(log.payload)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
