'use client';

// [Phase: MVP v1] TeamDetailPanel Component with About / Roster / History / Stats Tabs (Section 8 & 12)
import * as React from 'react';
import Link from 'next/link';
import {
  Trophy,
  Users,
  History,
  BarChart3,
  Info,
  ExternalLink,
  Crown,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { formatDate, getCountryFlag } from '@/lib/utils';

export interface TeamDetailPanelData {
  id: string;
  name: string;
  tag: string;
  logoUrl: string | null;
  description: string | null;
  country: string;
  region: string;
  status: string;
  ratingPoints: number;
  rankPosition: number;
  socialLinks: Record<string, string | null>;
  memberships: Array<{
    id: string;
    role: string;
    joinedAt: Date | string;
    user: {
      id: string;
      steamId64: string;
      nickname: string;
      avatarUrl: string | null;
    };
  }>;
  history: Array<{
    id: string;
    action: string;
    createdAt: Date | string;
    user: { id: string; nickname: string; steamId64: string } | null;
    actor: { id: string; nickname: string; steamId64: string } | null;
  }>;
  registrations: Array<{
    id: string;
    status: string;
    tournament: {
      id: string;
      slug: string;
      name: string;
      format: string;
      status: string;
      startsAt: Date | string;
    };
  }>;
  stats: {
    tournamentsCount: number;
    matchesPlayed: number;
    matchesWon: number;
    matchesLost: number;
    winrate: number;
  };
}

export function TeamDetailPanel({
  team,
  compact = false,
}: {
  team: TeamDetailPanelData;
  compact?: boolean;
}) {
  const [activeTab, setActiveTab] = React.useState<
    'about' | 'roster' | 'history' | 'stats'
  >('roster');

  const flag = getCountryFlag(team.country);

  return (
    <div className="glass-elevated rounded-lg p-5 space-y-5 border border-glass-border">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-glass-border pb-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-14 w-14 rounded-lg bg-bg border border-glass-border flex items-center justify-center text-base font-bold text-accent shrink-0 overflow-hidden">
            {team.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={team.logoUrl}
                alt={team.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{team.tag}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-accent bg-accent-soft px-2 py-0.5 rounded-sm border border-accent/30">
                [{team.tag}]
              </span>
              <span className="text-xs text-text-muted">
                {flag} {team.country} • {team.region}
              </span>
              <StatusBadge status={team.status} />
            </div>
            <h2 className="text-xl font-bold text-text truncate mt-1">
              {team.name}
            </h2>
            <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
              <span className="flex items-center gap-1 text-accent font-semibold">
                <Trophy className="h-3.5 w-3.5" />
                {team.ratingPoints} pts (Ранг #{team.rankPosition})
              </span>
            </div>
          </div>
        </div>

        {compact && (
          <Link href={`/teams/${team.tag}`}>
            <Button variant="secondary" size="sm">
              Открыть
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 bg-bg p-1 rounded-md border border-glass-border">
        <button
          type="button"
          onClick={() => setActiveTab('about')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-sm text-xs font-medium transition-colors ${
            activeTab === 'about'
              ? 'bg-accent text-white'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <Info className="h-3.5 w-3.5" />
          About
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-sm text-xs font-medium transition-colors ${
            activeTab === 'roster'
              ? 'bg-accent text-white'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Roster ({team.memberships.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-sm text-xs font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-accent text-white'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <History className="h-3.5 w-3.5" />
          History
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-sm text-xs font-medium transition-colors ${
            activeTab === 'stats'
              ? 'bg-accent text-white'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Stats
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'about' && (
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              Описание коллектива
            </h3>
            <p className="text-text leading-relaxed whitespace-pre-line">
              {team.description || 'Описание команды ещё не заполнено капитаном.'}
            </p>
          </div>
          {(team.socialLinks?.discord || team.socialLinks?.telegram) && (
            <div className="pt-3 border-t border-glass-border space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Социальные ссылки
              </h4>
              <div className="flex flex-wrap gap-2">
                {team.socialLinks.discord && (
                  <a
                    href={team.socialLinks.discord}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-accent hover:underline bg-accent-soft px-2.5 py-1 rounded-sm border border-accent/30"
                  >
                    Discord
                  </a>
                )}
                {team.socialLinks.telegram && (
                  <a
                    href={team.socialLinks.telegram}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-accent hover:underline bg-accent-soft px-2.5 py-1 rounded-sm border border-accent/30"
                  >
                    Telegram
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'roster' && (
        <div className="space-y-2.5">
          {team.memberships.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-2.5 rounded-md bg-bg border border-glass-border"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-full bg-bg-elevated border border-glass-border flex items-center justify-center text-xs font-bold text-accent overflow-hidden shrink-0">
                  {m.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.user.avatarUrl}
                      alt={m.user.nickname}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{m.user.nickname.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/players/${m.user.steamId64}`}
                    className="text-sm font-semibold text-text hover:text-accent truncate block"
                  >
                    {m.user.nickname}
                  </Link>
                  <span className="text-[11px] text-text-muted">
                    В команде с {formatDate(m.joinedAt)}
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-sm bg-white/[0.04] border border-glass-border text-text">
                {m.role === 'captain' && (
                  <Crown className="h-3 w-3 text-warning" />
                )}
                {m.role}
              </span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              Турнирная история
            </h4>
            {team.registrations.length === 0 ? (
              <p className="text-xs text-text-muted">
                Команда ещё не принимала участия в турнирах.
              </p>
            ) : (
              <div className="space-y-2">
                {team.registrations.map((reg) => (
                  <div
                    key={reg.id}
                    className="flex items-center justify-between p-2.5 rounded-sm bg-bg border border-glass-border text-xs"
                  >
                    <div>
                      <Link
                        href={`/tournaments/${reg.tournament.slug}`}
                        className="font-semibold text-text hover:text-accent"
                      >
                        {reg.tournament.name}
                      </Link>
                      <div className="text-text-muted text-[11px]">
                        {formatDate(reg.tournament.startsAt)} •{' '}
                        {reg.tournament.format}
                      </div>
                    </div>
                    <StatusBadge status={reg.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-glass-border pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              Журнал изменений состава
            </h4>
            {team.history.length === 0 ? (
              <p className="text-xs text-text-muted">Записей нет.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {team.history.map((h) => (
                  <div
                    key={h.id}
                    className="text-xs flex items-center justify-between py-1.5 px-2.5 rounded-sm bg-bg/60 border border-glass-border"
                  >
                    <span className="text-text">
                      <code className="text-accent mr-1.5">{h.action}</code>
                      {h.user && <strong>{h.user.nickname}</strong>}
                    </span>
                    <span className="text-[11px] text-text-muted">
                      {formatDate(h.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-md bg-bg border border-glass-border">
            <div className="text-xs text-text-muted">Турниров сыграно</div>
            <div className="text-xl font-bold text-text mt-1">
              {team.stats.tournamentsCount}
            </div>
          </div>
          <div className="p-3 rounded-md bg-bg border border-glass-border">
            <div className="text-xs text-text-muted">Винрейт на платформе</div>
            <div className="text-xl font-bold text-accent mt-1">
              {team.stats.winrate}%
            </div>
          </div>
          <div className="p-3 rounded-md bg-bg border border-glass-border">
            <div className="text-xs text-text-muted">Побед в матчах</div>
            <div className="text-xl font-bold text-success mt-1">
              {team.stats.matchesWon}
            </div>
          </div>
          <div className="p-3 rounded-md bg-bg border border-glass-border">
            <div className="text-xs text-text-muted">Поражений</div>
            <div className="text-xl font-bold text-danger mt-1">
              {team.stats.matchesLost}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
