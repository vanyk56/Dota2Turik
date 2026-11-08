// Team card — the whole card opens the team page
import * as React from 'react';
import { Trophy, Users, Crown } from 'lucide-react';
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

export function TeamCard({ team, isSelected }: TeamCardProps) {
  const flag = getCountryFlag(team.country);
  const maxMain = PLATFORM_CONFIG.roster.maxMainPlayers;
  const validLogoUrl =
    team.logoUrl && !team.logoUrl.startsWith('/uploads/') ? team.logoUrl : null;

  return (
    <Card
      href={`/teams/${team.tag}`}
      active={isSelected}
      className="flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 rounded-md bg-bg-elevated border border-glass-border flex items-center justify-center text-sm font-bold text-accent-light shrink-0 overflow-hidden">
            {validLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={validLogoUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{team.tag.slice(0, 3)}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold text-text truncate">
              {team.name}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              [{team.tag}] · {flag} {team.region}
            </div>
          </div>
        </div>
        <StatusBadge status={team.status} />
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-glass-border text-xs">
        <div>
          <div className="text-text-muted flex items-center gap-1 mb-0.5">
            <Trophy className="h-3 w-3 text-accent-light" />
            Рейтинг
          </div>
          <div className="font-semibold text-text">
            {team.ratingPoints}{' '}
            <span className="text-text-muted font-normal">
              #{team.rankPosition}
            </span>
          </div>
        </div>

        <div>
          <div className="text-text-muted flex items-center gap-1 mb-0.5">
            <Users className="h-3 w-3 text-accent-light" />
            Состав
          </div>
          <div className="font-semibold text-text">
            {team.mainRosterCount}/{maxMain}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-text-muted flex items-center gap-1 mb-0.5">
            <Crown className="h-3 w-3 text-accent-light" />
            Капитан
          </div>
          <div className="font-semibold text-text truncate">
            {team.captain ? team.captain.nickname : '—'}
          </div>
        </div>
      </div>
    </Card>
  );
}
