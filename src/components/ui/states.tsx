// [Phase: MVP v1] Required State & Layout Components (Section 12: EmptyState, Skeleton, ErrorState, PageHeader, FilterBar, Pagination)
import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Inbox, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-white/[0.06]', className)}
      {...props}
    />
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="glass-panel rounded-lg p-10 flex flex-col items-center justify-center text-center border-dashed border-white/[0.12]">
      <div className="h-12 w-12 rounded-full bg-accent-soft border border-accent/30 flex items-center justify-center text-accent mb-4">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <h3 className="text-base font-semibold text-text mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-text-muted max-w-md mb-5">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link href={actionHref}>
          <Button variant="primary" size="sm">
            {actionLabel}
          </Button>
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  requestId?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Ошибка загрузки данных',
  message = 'Не удалось выполнить запрос к серверу или базе данных. Проверьте подключение и повторите попытку.',
  requestId,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="glass-panel rounded-lg p-8 flex flex-col items-center justify-center text-center border-danger/30 bg-danger/[0.04]">
      <div className="h-12 w-12 rounded-full bg-danger/15 border border-danger/30 flex items-center justify-center text-danger mb-4">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold text-text mb-1">{title}</h3>
      <p className="text-sm text-text-muted max-w-md mb-4">{message}</p>
      {requestId && (
        <code className="text-xs text-text-muted bg-bg-elevated px-2.5 py-1 rounded-sm mb-4 border border-glass-border">
          ID: {requestId}
        </code>
      )}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Повторить попытку
        </Button>
      )}
    </div>
  );
}

export function ForbiddenState({
  message = 'У вас недостаточно прав для просмотра этой страницы или выполнения действия.',
}: {
  message?: string;
}) {
  return (
    <div className="glass-panel rounded-lg p-10 flex flex-col items-center justify-center text-center border-warning/30">
      <div className="h-12 w-12 rounded-full bg-warning/15 border border-warning/30 flex items-center justify-center text-warning mb-4">
        <Lock className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-semibold text-text mb-1">403 — Доступ ограничен</h2>
      <p className="text-sm text-text-muted max-w-md mb-5">{message}</p>
      <Link href="/">
        <Button variant="secondary" size="sm">
          На главную
        </Button>
      </Link>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, badge, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-glass-border mb-6">
      <div className="space-y-1.5">
        {badge && <div>{badge}</div>}
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-text">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-text-muted max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
}

export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'glass-panel rounded-md p-3.5 mb-6 flex flex-wrap items-center gap-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  buildHref: (targetPage: number) => string;
}

export function Pagination({ page, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between border-t border-glass-border pt-5 mt-6"
    >
      <span className="text-xs text-text-muted">
        Страница <strong className="text-text">{page}</strong> из{' '}
        <strong className="text-text">{totalPages}</strong>
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={buildHref(page - 1)}>
            <Button variant="secondary" size="sm">
              <ChevronLeft className="h-4 w-4" />
              Назад
            </Button>
          </Link>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            <ChevronLeft className="h-4 w-4" />
            Назад
          </Button>
        )}
        {page < totalPages ? (
          <Link href={buildHref(page + 1)}>
            <Button variant="secondary" size="sm">
              Вперёд
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            Вперёд
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </nav>
  );
}
