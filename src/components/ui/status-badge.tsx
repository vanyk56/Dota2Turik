// [Phase: MVP v1] StatusBadge Component (Section 12: Active green, Recruiting yellow, Live purple pulse, Completed gray)
import * as React from 'react';
import { cn } from '@/lib/utils';

export type BadgeStatusType =
  | 'active'
  | 'recruiting'
  | 'inactive'
  | 'live'
  | 'in_progress'
  | 'completed'
  | 'finished'
  | 'scheduled'
  | 'registration'
  | 'waiting'
  | 'awaiting_confirmation'
  | 'disputed'
  | 'draft'
  | 'cancelled'
  | 'pending'
  | 'approved'
  | 'rejected';

interface StatusBadgeProps {
  status: BadgeStatusType | string;
  label?: string;
  className?: string;
}

const DEFAULT_LABELS: Record<string, string> = {
  active: 'Active',
  recruiting: 'Recruiting',
  inactive: 'Inactive',
  live: 'LIVE',
  in_progress: 'In Progress',
  completed: 'Completed',
  finished: 'Finished',
  scheduled: 'Scheduled',
  registration: 'Registration',
  waiting: 'Открыт набор',
  awaiting_confirmation: 'Confirming',
  disputed: 'Disputed',
  draft: 'Draft',
  cancelled: 'Cancelled',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  const displayLabel = label ?? DEFAULT_LABELS[normalized] ?? status;

  const isSuccess =
    normalized === 'active' ||
    normalized === 'approved' ||
    normalized === 'registration' ||
    normalized === 'waiting';
  const isWarning =
    normalized === 'recruiting' ||
    normalized === 'awaiting_confirmation' ||
    normalized === 'pending';
  const isLive = normalized === 'live' || normalized === 'in_progress';
  const isDanger =
    normalized === 'disputed' || normalized === 'rejected' || normalized === 'cancelled';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-0.5 text-xs font-medium tracking-wide border transition-colors',
        isSuccess && 'bg-success/15 text-success border-success/30',
        isWarning && 'bg-warning/15 text-warning border-warning/30',
        isLive && 'bg-accent/20 text-accent border-accent/40 shadow-accent-glow',
        isDanger && 'bg-danger/15 text-danger border-danger/30',
        !isSuccess &&
          !isWarning &&
          !isLive &&
          !isDanger &&
          'bg-white/[0.04] text-text-muted border-glass-border',
        className,
      )}
    >
      {isLive && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
        </span>
      )}
      {isSuccess && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
      {isWarning && <span className="h-1.5 w-1.5 rounded-full bg-warning" />}
      {isDanger && <span className="h-1.5 w-1.5 rounded-full bg-danger" />}
      {displayLabel}
    </span>
  );
}
