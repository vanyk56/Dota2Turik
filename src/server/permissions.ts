// [Phase: MVP v1] Unified Server-Side Permission Matrix (Section 3 & Section 13)
import type { TeamRole, UserRole } from '@prisma/client';

export interface PermissionActor {
  id: string;
  role: UserRole;
  isBlocked: boolean;
}

export interface TeamPermissionContext {
  teamRole?: TeamRole | null;
  allowCoCaptainRegister?: boolean;
}

export interface TournamentPermissionContext {
  organizerId: string;
}

export interface MatchPermissionContext {
  organizerId: string;
  isParticipantOfTeamA: boolean;
  isParticipantOfTeamB: boolean;
}

export class PermissionDeniedError extends Error {
  public readonly statusCode = 403;
  constructor(message = 'FORBIDDEN_ACTION') {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

export function isActiveActor(actor: PermissionActor | null | undefined): actor is PermissionActor {
  return Boolean(actor && !actor.isBlocked);
}

export function isAdmin(actor: PermissionActor | null | undefined): boolean {
  return isActiveActor(actor) && actor.role === 'admin';
}

export function isModeratorOrAdmin(actor: PermissionActor | null | undefined): boolean {
  return isActiveActor(actor) && (actor.role === 'moderator' || actor.role === 'admin');
}

// 1. Создать команду: Пользователь или Админ
export function canCreateTeam(actor: PermissionActor | null | undefined): boolean {
  return isActiveActor(actor);
}

// 2. Приглашать и принимать заявки, удалять Player и Substitute: Co-Captain, Captain, Админ
export function canManageTeamRosterAndInvites(
  actor: PermissionActor | null | undefined,
  ctx: TeamPermissionContext,
): boolean {
  if (!isActiveActor(actor)) return false;
  if (actor.role === 'admin') return true;
  return ctx.teamRole === 'captain' || ctx.teamRole === 'co_captain';
}

// 3. Менять название, логотип, пароль, назначать Co-Captain, передавать капитанство, удалять команду: Captain, Админ
export function canEditTeamCoreSettings(
  actor: PermissionActor | null | undefined,
  ctx: TeamPermissionContext,
): boolean {
  if (!isActiveActor(actor)) return false;
  if (actor.role === 'admin') return true;
  return ctx.teamRole === 'captain';
}

// 4. Регистрировать команду на турнир: Captain, Co-Captain (если разрешено капитаном), Админ
export function canRegisterTeamForTournament(
  actor: PermissionActor | null | undefined,
  ctx: TeamPermissionContext,
): boolean {
  if (!isActiveActor(actor)) return false;
  if (actor.role === 'admin') return true;
  if (ctx.teamRole === 'captain') return true;
  if (ctx.teamRole === 'co_captain' && (ctx.allowCoCaptainRegister ?? true)) {
    return true;
  }
  return false;
}

// 5. Создавать турнир: Пользователь, Организатор, Админ
export function canCreateTournament(actor: PermissionActor | null | undefined): boolean {
  return isActiveActor(actor);
}

// 6. Принимать заявки и управлять сеткой: Организатор (своего турнира) или Админ
export function canManageTournament(
  actor: PermissionActor | null | undefined,
  ctx: TournamentPermissionContext,
): boolean {
  if (!isActiveActor(actor)) return false;
  if (actor.role === 'admin') return true;
  return actor.id === ctx.organizerId;
}

// 7. Вводить результат матча: участник команды матча (Player/Co-Captain/Captain), Организатор турнира, Админ
export function canSubmitMatchResult(
  actor: PermissionActor | null | undefined,
  ctx: MatchPermissionContext,
): boolean {
  if (!isActiveActor(actor)) return false;
  if (actor.role === 'admin') return true;
  if (actor.id === ctx.organizerId) return true;
  return ctx.isParticipantOfTeamA || ctx.isParticipantOfTeamB;
}

// 8. Решать спор: Организатор турнира, Модератор, Админ
export function canResolveDispute(
  actor: PermissionActor | null | undefined,
  ctx: TournamentPermissionContext,
): boolean {
  if (!isActiveActor(actor)) return false;
  if (actor.role === 'admin' || actor.role === 'moderator') return true;
  return actor.id === ctx.organizerId;
}

// 9. Блокировать пользователя: только Админ
export function canBlockUser(actor: PermissionActor | null | undefined): boolean {
  return isAdmin(actor);
}

// 10. Менять формулу рейтинга: только Админ
export function canEditRatingFormula(actor: PermissionActor | null | undefined): boolean {
  return isAdmin(actor);
}

export function assertPermission(condition: boolean, message = 'FORBIDDEN_ACTION'): void {
  if (!condition) {
    throw new PermissionDeniedError(message);
  }
}
