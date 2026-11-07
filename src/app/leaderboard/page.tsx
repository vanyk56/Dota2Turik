// [Phase: MVP v1] Platform Team Rating Leaderboard Page (/leaderboard) (Section 9)
import Link from 'next/link';
import { Trophy, Calculator } from 'lucide-react';
import { getLeaderboardData } from '@/modules/ratings/service';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, PageHeader } from '@/components/ui/states';
import { getCountryFlag } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const { teams, activeFormula } = await getLeaderboardData();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Платформенный рейтинг команд"
        subtitle="Независимый от MMR Dota 2 рейтинг коллективов, рассчитываемый по завершённым турнирам с учётом уровня турнира и версионируемой формулы."
        badge={
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-accent bg-accent-soft px-2.5 py-1 rounded-sm border border-accent/30">
            <Calculator className="h-3.5 w-3.5" />
            Активная формула: v{activeFormula.version}
          </span>
        }
      />

      {/* Formula Breakdown Card */}
      <Card className="p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="space-y-1">
          <div className="font-bold text-text">
            Текущая формула расчёта очков (Версия v{activeFormula.version}):
          </div>
          <div className="text-text-muted font-mono">
            Points = round(basePoints[place] × levelWeight[tier] + wins ×{' '}
            {activeFormula.config.matchBonus})
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono">
          <span className="px-2 py-1 rounded-sm bg-bg border border-glass-border">
            1 место: {activeFormula.config.basePoints['1']}
          </span>
          <span className="px-2 py-1 rounded-sm bg-bg border border-glass-border">
            2 место: {activeFormula.config.basePoints['2']}
          </span>
          <span className="px-2 py-1 rounded-sm bg-bg border border-glass-border">
            3 место: {activeFormula.config.basePoints['3']}
          </span>
          <span className="px-2 py-1 rounded-sm bg-bg border border-glass-border text-accent">
            Tier S: x{activeFormula.config.levelWeight['tier_s']}
          </span>
        </div>
      </Card>

      {teams.length === 0 ? (
        <EmptyState
          title="В рейтинге пока нет команд"
          description="Рейтинговые очки начисляются командам автоматически после завершения турниров."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-text-muted border-b border-glass-border bg-bg-elevated">
              <tr>
                <th className="px-4 py-3.5">Позиция</th>
                <th className="px-4 py-3.5">Команда</th>
                <th className="px-4 py-3.5">Регион</th>
                <th className="px-4 py-3.5">Капитан</th>
                <th className="px-4 py-3.5 text-center">Турниров</th>
                <th className="px-4 py-3.5 text-center">Побед в матчах</th>
                <th className="px-4 py-3.5 text-center">Статус</th>
                <th className="px-4 py-3.5 text-right">Очки (Версия)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {teams.map((team) => (
                <tr
                  key={team.id}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3.5 font-mono font-bold">
                    {team.rank <= 3 ? (
                      <span className="inline-flex items-center gap-1 text-accent">
                        <Trophy className="h-3.5 w-3.5" />#{team.rank}
                      </span>
                    ) : (
                      <span className="text-text-muted">#{team.rank}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/teams/${team.tag}`}
                      className="font-bold text-text hover:text-accent flex items-center gap-2"
                    >
                      <span className="font-mono text-xs text-accent bg-accent-soft px-1.5 py-0.5 rounded-sm border border-accent/30">
                        [{team.tag}]
                      </span>
                      <span>{team.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-text-muted">
                    {getCountryFlag(team.country)} {team.region}
                  </td>
                  <td className="px-4 py-3.5 text-xs">
                    {team.captain ? (
                      <Link
                        href={`/players/${team.captain.steamId64}`}
                        className="text-text hover:text-accent"
                      >
                        {team.captain.nickname}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono">
                    {team.tournamentsCount}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono text-success">
                    {team.winsCount}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <StatusBadge status={team.status} />
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono">
                    <strong className="text-base text-accent">
                      {team.ratingPoints}
                    </strong>{' '}
                    <span className="text-[11px] text-text-muted">
                      (v{team.ratingVersion})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
