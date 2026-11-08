// [Phase: MVP v1] TeamCard Component (Section 8 & 12: logo, name, tag, flag/region, captain, 5/5, rating with rank, status badge)
import * as React from 'react';
import Link from 'next/link';
import { Shield, Trophy, Users, Crown, ArrowUpRight } from 'lucide-react';
import type { TeamCardView } from '@/modules/catalog/service';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { getCountryFlag } from '@/lib/utils';
import { PLATFORM_CONFIG } from '@/lib/config';

interface TeamCardProps {
  team: TeamCardView;
  isSelected?: boolean;
  selectHref?: string;
}

export function TeamCard({ team, isSelected, selectHref }: TeamCardProps) {
  const flag = getCountryFlag(team.country);
  const maxMain = PLATFORM_CONFIG.roster.maxMainPlayers;
  const validLogoUrl =
    team.logoUrl && !team.logoUrl.startsWith('/uploads/') ? team.logoUrl : null;

  return (
    <Card
      active={isSelected}
      className="flex flex-col justify-between gap-4 hover:border-white/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 rounded-md bg-bg-elevated border border-glass-border flex items-center justify-center text-sm font-bold text-accent shrink-0 overflow-hidden">
            {validLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={validLogoUrl}
                alt={team.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{team.tag.slice(0, 3)}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-accent bg-accent-soft px-1.5 py-0.5 rounded-sm border border-accent/30">
                [{team.tag}]
              </span>
              <span className="text-xs text-text-muted">
                {flag} {team.region}
              </span>
            </div>
            <Link
              href={`/teams/${team.tag}`}
              className="block text-base font-bold text-text hover:text-accent truncate mt-1 transition-colors"
            >
              {team.name}
            </Link>
          </div>
        </div>
        <StatusBadge status={team.status} />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-glass-border text-xs">
        <div className="bg-bg-elevated/70 rounded-sm p-2 border border-glass-border">
          <div className="text-text-muted flex items-center gap-1 mb-0.5">
            <Trophy className="h-3 w-3 text-accent" />
            Рейтинг
          </div>
          <div className="font-bold text-text">
            {team.ratingPoints} pts{' '}
            <span className="text-text-muted font-normal">
              (#{team.rankPosition})
            </span>
          </div>
        </div>

        <div className="bg-bg-elevated/70 rounded-sm p-2 border border-glass-border">
          <div className="text-text-muted flex items-center gap-1 mb-0.5">
            <Users className="h-3 w-3 text-accent" />
            Состав
          </div>
          <div className="font-bold text-text">
            {team.mainRosterCount}/{maxMain}
            {team.substituteCount > 0 && (
              <span className="text-text-muted font-normal">
                {' '}
                (+{team.substituteCount})
              </span>
            )}
          </div>
        </div>

        <div className="bg-bg-elevated/70 rounded-sm p-2 border border-glass-border">
          <div className="text-text-muted flex items-center gap-1 mb-0.5">
            <Crown className="h-3 w-3 text-accent" />
            Капитан
          </div>
          <div className="font-semibold text-text truncate">
            {team.captain ? team.captain.nickname : '—'}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <span className="text-text-muted flex items-center gap-1">
          <Shield className="h-3.5 w-3.5 text-text-muted" />
          Турниров: <strong className="text-text">{team.tournamentsCount}</strong> • Побед:{' '}
          <strong className="text-text">{team.winsCount}</strong>
        </span>
        <div className="flex items-center gap-2">
          {selectHref && (
            <Link
              href={selectHref}
              className="hidden lg:inline-flex text-text-muted hover:text-text px-2 py-1 rounded-sm bg-white/[0.04] border border-glass-border transition-colors"
            >
              Превью
            </Link>
          )}
          <Link
            href={`/teams/${team.tag}`}
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
          >
            Профиль
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </Card>
  );
}
