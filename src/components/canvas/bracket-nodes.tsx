'use client';

// [Phase: MVP v1] Memoized React Flow Custom Nodes: TeamSlot, MatchNode, WinnerNode (Section 11 & 12)
import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Trophy, Swords, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CanvasTeamInfo {
  id: string;
  name: string;
  tag: string;
  logoUrl: string | null;
}

export interface MatchNodeData extends Record<string, unknown> {
  matchId: string;
  round: number;
  position: number;
  bestOf: number;
  status: string;
  isBye: boolean;
  teamA: CanvasTeamInfo | null;
  teamB: CanvasTeamInfo | null;
  scoreA: number;
  scoreB: number;
  winnerId: string | null;
  isSelected: boolean;
  isHighlightedPath: boolean;
  hoveredTeamId: string | null;
  onSelectMatch: (matchId: string) => void;
  onHoverTeam: (teamId: string | null) => void;
}

export interface WinnerNodeData extends Record<string, unknown> {
  champion: CanvasTeamInfo | null;
  tournamentName: string;
}

interface TeamSlotProps {
  team: CanvasTeamInfo | null;
  score: number;
  isWinner: boolean;
  isHighlighted: boolean;
  isByeSlot?: boolean;
  onHoverTeam: (teamId: string | null) => void;
}

export const TeamSlot = React.memo(function TeamSlot({
  team,
  score,
  isWinner,
  isHighlighted,
  isByeSlot,
  onHoverTeam,
}: TeamSlotProps) {
  return (
    <div
      onMouseEnter={() => team && onHoverTeam(team.id)}
      onMouseLeave={() => onHoverTeam(null)}
      className={cn(
        'flex items-center justify-between px-3 py-2 text-xs transition-colors duration-150',
        isWinner
          ? 'bg-accent/15 text-text font-semibold'
          : 'bg-transparent text-text-muted',
        isHighlighted && 'bg-accent/25 text-text',
      )}
    >
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <div
          className={cn(
            'h-5 w-5 rounded-sm flex items-center justify-center text-[10px] font-bold shrink-0 border',
            team
              ? 'bg-bg-elevated border-glass-border text-accent'
              : 'bg-white/[0.02] border-white/[0.05] text-text-muted',
          )}
        >
          {team ? team.tag.slice(0, 3) : '—'}
        </div>
        <span className="truncate font-medium text-text">
          {team ? team.tag : isByeSlot ? 'BYE' : 'TBD'}
        </span>
        {team && (
          <span className="truncate text-[11px] text-text-muted hidden sm:inline">
            {team.name}
          </span>
        )}
      </div>
      <span
        className={cn(
          'ml-2 font-mono text-xs px-1.5 py-0.5 rounded-sm border min-w-[24px] text-center',
          isWinner
            ? 'bg-accent text-white border-accent font-bold'
            : 'bg-bg-elevated text-text-muted border-glass-border',
        )}
      >
        {team ? score : '—'}
      </span>
    </div>
  );
});

export const MatchNode = React.memo(function MatchNode({
  data,
}: NodeProps & { data: MatchNodeData }) {
  const isLive = data.status === 'live';
  const isDisputed = data.status === 'disputed';
  const isConfirming = data.status === 'awaiting_confirmation';
  const isCompleted = data.status === 'completed';

  const labelA = data.teamA?.tag ?? 'TBD';
  const labelB = data.teamB?.tag ?? (data.isBye ? 'BYE' : 'TBD');

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Матч раунда ${data.round}: ${labelA} (${data.scoreA}) против ${labelB} (${data.scoreB}), статус ${data.status}`}
      onClick={() => data.onSelectMatch(data.matchId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          data.onSelectMatch(data.matchId);
        }
      }}
      className={cn(
        'w-[240px] rounded-md bg-bg-elevated/95 backdrop-blur-md border transition-all duration-150 select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-accent',
        data.isSelected
          ? 'border-accent shadow-accent-glow ring-1 ring-accent'
          : data.isHighlightedPath
            ? 'border-accent/80 shadow-accent-glow'
            : isLive
              ? 'border-accent/60 shadow-accent-glow'
              : isDisputed
                ? 'border-danger/70'
                : 'border-glass-border hover:border-white/25',
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-accent !border-bg"
      />

      {/* Match Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-glass-border text-[10px] text-text-muted uppercase tracking-wider">
        <span className="flex items-center gap-1 font-medium">
          <Swords className="h-3 w-3 text-accent" />R{data.round} • #
          {data.position + 1} • BO{data.bestOf}
        </span>
        <span className="flex items-center gap-1">
          {isLive && (
            <span className="text-accent font-bold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
              LIVE
            </span>
          )}
          {isDisputed && (
            <span className="text-danger font-semibold flex items-center gap-0.5">
              <AlertTriangle className="h-3 w-3" />
              СПОР
            </span>
          )}
          {isConfirming && (
            <span className="text-warning font-medium">ПОДТВЕРЖДЕНИЕ</span>
          )}
          {isCompleted && !data.isBye && (
            <CheckCircle2 className="h-3 w-3 text-success" />
          )}
          {data.isBye && <span className="text-text-muted">BYE</span>}
        </span>
      </div>

      {/* Team Slots */}
      <div className="divide-y divide-glass-border">
        <TeamSlot
          team={data.teamA}
          score={data.scoreA}
          isWinner={Boolean(data.winnerId && data.winnerId === data.teamA?.id)}
          isHighlighted={Boolean(
            data.hoveredTeamId && data.hoveredTeamId === data.teamA?.id,
          )}
          onHoverTeam={data.onHoverTeam}
        />
        <TeamSlot
          team={data.teamB}
          score={data.scoreB}
          isWinner={Boolean(data.winnerId && data.winnerId === data.teamB?.id)}
          isHighlighted={Boolean(
            data.hoveredTeamId && data.hoveredTeamId === data.teamB?.id,
          )}
          isByeSlot={data.isBye && !data.teamB}
          onHoverTeam={data.onHoverTeam}
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-accent !border-bg"
      />
    </div>
  );
});

export const WinnerNode = React.memo(function WinnerNode({
  data,
}: NodeProps & { data: WinnerNodeData }) {
  return (
    <div
      role="region"
      aria-label={`Чемпион турнира: ${data.champion ? data.champion.name : 'Определяется'}`}
      className={cn(
        'w-[220px] rounded-lg p-4 bg-bg-elevated/95 backdrop-blur-md border transition-all',
        data.champion
          ? 'border-accent shadow-accent-glow'
          : 'border-glass-border',
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-accent !border-bg"
      />
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shrink-0">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-accent font-semibold">
            Чемпион турнира
          </div>
          {data.champion ? (
            <div className="truncate text-sm font-bold text-text">
              [{data.champion.tag}] {data.champion.name}
            </div>
          ) : (
            <div className="text-xs text-text-muted">Ожидает финала</div>
          )}
        </div>
      </div>
    </div>
  );
});
