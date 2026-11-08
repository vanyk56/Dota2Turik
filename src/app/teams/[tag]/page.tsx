// [Phase: MVP v1] Team Profile & Management Page (/teams/[tag]) (Section 7, 8, 13, 14)
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  KeyRound,
  UserPlus,
  Shield,
  LogOut,
  Trash2,
  Crown,
  Link2,
} from 'lucide-react';
import { getCurrentUser } from '@/modules/auth/service';
import { getTeamDetailByTag } from '@/modules/teams/service';
import {
  changeMemberRoleAction,
  createInviteTokenAction,
  decideJoinRequestAction,
  deleteTeamAction,
  joinByInviteTokenAction,
  joinByPasswordAction,
  removeOrLeaveMemberAction,
  revokeInviteAction,
  submitJoinRequestAction,
  transferCaptaincyAction,
  updateTeamSettingsAction,
} from '@/modules/teams/actions';
import {
  canEditTeamCoreSettings,
  canManageTeamRosterAndInvites,
} from '@/server/permissions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import {
  TeamDetailPanel,
  type TeamDetailPanelData,
} from '@/components/teams/team-detail-panel';
import { formatDateTime } from '@/lib/utils';

export async function generateMetadata({
  params,
}: {
  params: { tag: string };
}): Promise<Metadata> {
  const team = await getTeamDetailByTag(params.tag);
  if (!team) {
    return { title: 'Команда не найдена' };
  }
  return {
    title: `[${team.tag}] ${team.name} — Команда Dota 2`,
    description:
      team.description ??
      `Профиль команды [${team.tag}] ${team.name} на турнирной платформе Dota turnir.`,
    openGraph: {
      title: `[${team.tag}] ${team.name}`,
      description: `Рейтинг: ${team.ratingPoints} pts (#${team.rankPosition}) • Регион: ${team.region}`,
    },
  };
}

export default async function TeamProfilePage({
  params,
  searchParams,
}: {
  params: { tag: string };
  searchParams?: { newInviteToken?: string };
}) {
  const [user, team] = await Promise.all([
    getCurrentUser(),
    getTeamDetailByTag(params.tag),
  ]);

  if (!team) {
    notFound();
  }

  const viewerMembership = user
    ? team.memberships.find((m) => m.user.id === user.id)
    : null;
  const viewerTeamRole = viewerMembership?.role ?? null;

  const canManageInvites = canManageTeamRosterAndInvites(user, {
    teamRole: viewerTeamRole,
  });
  const canEditCore = canEditTeamCoreSettings(user, {
    teamRole: viewerTeamRole,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 7 Columns: Main Team Detail Panel */}
      <div className="lg:col-span-7 space-y-6">
        <TeamDetailPanel team={team as unknown as TeamDetailPanelData} />

        {/* Leave Team Button for Non-Captain Members */}
        {user && viewerMembership && viewerTeamRole !== 'captain' && (
          <Card className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text">
                Вы состоите в этой команде ({viewerTeamRole})
              </h3>
              <p className="text-xs text-text-muted">
                Выход из команды запишется в историю состава.
              </p>
            </div>
            <form action={removeOrLeaveMemberAction}>
              <input type="hidden" name="teamId" value={team.id} />
              <input type="hidden" name="teamTag" value={team.tag} />
              <input type="hidden" name="targetUserId" value={user.id} />
              <Button type="submit" variant="danger" size="sm">
                <LogOut className="h-3.5 w-3.5" />
                Покинуть команду
              </Button>
            </form>
          </Card>
        )}
      </div>

      {/* Right 5 Columns: Join Options OR Captain/Co-Captain Management */}
      <div className="lg:col-span-5 space-y-6">
        {/* Join Panel for Non-Members */}
        {user && !viewerMembership && (
          <Card className="space-y-5">
            <h3 className="text-base font-bold text-text flex items-center gap-2 border-b border-glass-border pb-3">
              <UserPlus className="h-4 w-4 text-accent" />
              Вступление в команду [{team.tag}]
            </h3>

            {/* 1. Join by Request */}
            <form action={submitJoinRequestAction} className="space-y-2.5">
              <input type="hidden" name="teamId" value={team.id} />
              <input type="hidden" name="teamTag" value={team.tag} />
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                1. Подать заявку капитану
              </label>
              <Input
                name="message"
                placeholder="Ваша позиция (1–5), MMR и опыт турниров..."
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="w-full"
              >
                Отправить заявку на вступление
              </Button>
            </form>

            {/* 2. Join by Password (if enabled) */}
            {team.hasPassword && (
              <form
                action={joinByPasswordAction}
                className="space-y-2.5 pt-4 border-t border-glass-border"
              >
                <input type="hidden" name="teamId" value={team.id} />
                <input type="hidden" name="teamTag" value={team.tag} />
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  2. Вступить по паролю команды
                </label>
                <div className="flex gap-2">
                  <Input
                    name="password"
                    type="password"
                    placeholder="Пароль команды..."
                    required
                  />
                  <Button type="submit" variant="secondary" size="md">
                    Войти
                  </Button>
                </div>
              </form>
            )}

            {/* 3. Join by One-Time Token */}
            <form
              action={joinByInviteTokenAction}
              className="space-y-2.5 pt-4 border-t border-glass-border"
            >
              <input type="hidden" name="teamTag" value={team.tag} />
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                3. Вступить по одноразовому коду приглашения
              </label>
              <div className="flex gap-2">
                <Input
                  name="token"
                  placeholder="64-символьный токен..."
                  className="font-mono text-xs"
                  required
                />
                <Button type="submit" variant="secondary" size="md">
                  Применить
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Captain & Co-Captain Management: Invites & Join Requests */}
        {canManageInvites && (
          <Card className="space-y-5">
            <h3 className="text-base font-bold text-text flex items-center gap-2 border-b border-glass-border pb-3">
              <KeyRound className="h-4 w-4 text-accent" />
              Приглашения и заявки ({team.joinRequests.length})
            </h3>

            {/* Newly generated invite token banner */}
            {searchParams?.newInviteToken && (
              <div className="rounded-md bg-accent-soft border border-accent p-3 space-y-1.5">
                <div className="text-xs font-bold text-accent flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  Одноразовый токен создан (скопируйте сейчас, в БД хранится только SHA-256 хеш):
                </div>
                <code className="block text-xs font-mono break-all bg-bg p-2 rounded-sm border border-glass-border text-text select-all">
                  {searchParams.newInviteToken}
                </code>
              </div>
            )}

            <form action={createInviteTokenAction}>
              <input type="hidden" name="teamId" value={team.id} />
              <input type="hidden" name="teamTag" value={team.tag} />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="w-full"
              >
                Сгенерировать одноразовый код приглашения (7 дней)
              </Button>
            </form>

            {/* Active Invites List */}
            {team.invites.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Активные одноразовые коды
                </div>
                {team.invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between text-xs bg-bg p-2.5 rounded-sm border border-glass-border"
                  >
                    <div>
                      <span className="font-mono text-accent font-bold">
                        ...{inv.codeHint}
                      </span>
                      <span className="text-text-muted ml-2">
                        до {formatDateTime(inv.expiresAt)}
                      </span>
                    </div>
                    <form action={revokeInviteAction}>
                      <input type="hidden" name="inviteId" value={inv.id} />
                      <input type="hidden" name="teamTag" value={team.tag} />
                      <Button type="submit" variant="danger" size="sm">
                        Отозвать
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            )}

            {/* Pending Join Requests */}
            <div className="space-y-2 pt-3 border-t border-glass-border">
              <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Входящие заявки игроков
              </div>
              {team.joinRequests.length === 0 ? (
                <p className="text-xs text-text-muted">
                  Новых заявок на вступление нет.
                </p>
              ) : (
                team.joinRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-sm bg-bg border border-glass-border space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-text">
                        {req.user.nickname}
                      </span>
                      <span className="text-text-muted">
                        {formatDateTime(req.createdAt)}
                      </span>
                    </div>
                    {req.message && (
                      <p className="text-text-muted">{req.message}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <form action={decideJoinRequestAction}>
                        <input type="hidden" name="requestId" value={req.id} />
                        <input type="hidden" name="teamTag" value={team.tag} />
                        <input type="hidden" name="decision" value="accepted" />
                        <Button type="submit" variant="success" size="sm">
                          Принять
                        </Button>
                      </form>
                      <form action={decideJoinRequestAction}>
                        <input type="hidden" name="requestId" value={req.id} />
                        <input type="hidden" name="teamTag" value={team.tag} />
                        <input type="hidden" name="decision" value="rejected" />
                        <Button type="submit" variant="danger" size="sm">
                          Отклонить
                        </Button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* Roster Role & Kick Management */}
        {canManageInvites && (
          <Card className="space-y-4">
            <h3 className="text-base font-bold text-text flex items-center gap-2 border-b border-glass-border pb-3">
              <Shield className="h-4 w-4 text-accent" />
              Управление составом и ролями
            </h3>
            <div className="space-y-2.5">
              {team.memberships.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-sm bg-bg border border-glass-border space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text">
                      {m.user.nickname}
                    </span>
                    <span className="font-mono text-accent">{m.role}</span>
                  </div>

                  {m.role !== 'captain' && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {canEditCore && (
                        <form
                          action={changeMemberRoleAction}
                          className="flex items-center gap-1.5"
                        >
                          <input type="hidden" name="teamId" value={team.id} />
                          <input
                            type="hidden"
                            name="teamTag"
                            value={team.tag}
                          />
                          <input
                            type="hidden"
                            name="targetUserId"
                            value={m.user.id}
                          />
                          <Select
                            name="newRole"
                            defaultValue={m.role}
                            className="h-8 text-xs w-[130px]"
                          >
                            <option value="co_captain">Co-Captain</option>
                            <option value="player">Player</option>
                            <option value="substitute">Substitute</option>
                          </Select>
                          <Button type="submit" variant="secondary" size="sm">
                            Сменить роль
                          </Button>
                        </form>
                      )}

                      {canEditCore && (
                        <form action={transferCaptaincyAction}>
                          <input type="hidden" name="teamId" value={team.id} />
                          <input
                            type="hidden"
                            name="teamTag"
                            value={team.tag}
                          />
                          <input
                            type="hidden"
                            name="newCaptainUserId"
                            value={m.user.id}
                          />
                          <Button type="submit" variant="outline" size="sm">
                            <Crown className="h-3 w-3 text-warning" />
                            Сделать капитаном
                          </Button>
                        </form>
                      )}

                      <form action={removeOrLeaveMemberAction}>
                        <input type="hidden" name="teamId" value={team.id} />
                        <input type="hidden" name="teamTag" value={team.tag} />
                        <input
                          type="hidden"
                          name="targetUserId"
                          value={m.user.id}
                        />
                        <Button type="submit" variant="danger" size="sm">
                          Исключить
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Captain Core Settings & Team Deletion */}
        {canEditCore && (
          <Card className="space-y-5">
            <h3 className="text-base font-bold text-text border-b border-glass-border pb-3">
              Настройки команды (Captain)
            </h3>

            <form action={updateTeamSettingsAction} className="space-y-3.5">
              <input type="hidden" name="teamId" value={team.id} />
              <input type="hidden" name="teamTag" value={team.tag} />

              <div>
                <label className="block text-xs text-text-muted mb-1">
                  Название команды
                </label>
                <Input name="name" defaultValue={team.name} required />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">
                  Статус набора
                </label>
                <Select name="status" defaultValue={team.status}>
                  <option value="active">Active</option>
                  <option value="recruiting">Recruiting</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">
                  Обновить логотип (PNG/JPG/WEBP, до 2 МБ)
                </label>
                <Input
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">
                  Описание
                </label>
                <Textarea
                  name="description"
                  defaultValue={team.description ?? ''}
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">
                  Новый пароль для вступления (оставьте пустым, чтобы не менять)
                </label>
                <Input
                  name="newPassword"
                  type="password"
                  placeholder="Мин. 4 символа"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-text cursor-pointer">
                <input
                  type="checkbox"
                  name="allowCoCaptainRegister"
                  defaultChecked={team.allowCoCaptainRegister}
                />
                Разрешить Co-Captain регистрировать команду на турниры
              </label>

              <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                <input type="checkbox" name="clearPassword" />
                Отключить вход по паролю
              </label>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="w-full"
              >
                Сохранить настройки
              </Button>
            </form>

            <form
              action={deleteTeamAction}
              className="pt-4 border-t border-glass-border"
            >
              <input type="hidden" name="teamId" value={team.id} />
              <Button
                type="submit"
                variant="danger"
                size="sm"
                className="w-full"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Удалить команду (недоступно во время активного турнира)
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
