import React, { useState } from 'react';
import { MatchFormat, Player, BowlingScorecard } from '../types/index.js';
import { UserCheck, AlertTriangle } from 'lucide-react';

interface BowlerSelectModalProps {
  isOpen: boolean;
  bowlingTeamPlayers: Player[];
  scorecards: BowlingScorecard[];
  lastBowlerId?: string | null;
  matchFormat: MatchFormat;
  onSelectBowler: (bowlerId: string) => void;
}

export const BowlerSelectModal: React.FC<BowlerSelectModalProps> = ({
  isOpen,
  bowlingTeamPlayers,
  scorecards,
  lastBowlerId,
  matchFormat,
  onSelectBowler,
}) => {
  const [selectedBowlerId, setSelectedBowlerId] = useState<string>('');

  if (!isOpen) return null;

  const getMaxOvers = (format: MatchFormat): number => {
    switch (format) {
      case 'T10':
        return 2;
      case 'T20':
        return 4;
      case 'ODI':
        return 10;
      case 'TEST':
        return Infinity;
    }
  };

  const maxOvers = getMaxOvers(matchFormat);

  const bowlersStatus = bowlingTeamPlayers.map(player => {
    const card = scorecards.find(sc => sc.playerId === player.id);
    const balls = card ? card.legalBalls : 0;
    const completedOvers = Math.floor(balls / 6);
    const isLastBowler = player.id === lastBowlerId;
    const isLimitReached = completedOvers >= maxOvers;
    const isEligible = !isLastBowler && !isLimitReached;

    return {
      player,
      card,
      completedOvers,
      balls,
      isLastBowler,
      isLimitReached,
      isEligible,
    };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBowlerId) {
      onSelectBowler(selectedBowlerId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Select Next Bowler</h2>
            <p className="text-xs text-slate-400">
              Over completed. Select an eligible bowler for the new over.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {bowlersStatus.map(
              ({ player, card, completedOvers, isLastBowler, isLimitReached, isEligible }) => (
                <button
                  type="button"
                  key={player.id}
                  disabled={!isEligible}
                  onClick={() => setSelectedBowlerId(player.id)}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                    selectedBowlerId === player.id
                      ? 'bg-emerald-500/20 border-emerald-500 text-white ring-1 ring-emerald-500'
                      : isEligible
                      ? 'bg-slate-800/60 border-slate-700 hover:bg-slate-800 text-slate-200'
                      : 'bg-slate-900/50 border-slate-800/50 text-slate-600 cursor-not-allowed opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                      #{player.jerseyNumber}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        {player.playerName}
                        <span className="text-[10px] font-medium text-slate-400 uppercase">
                          ({player.role})
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {card
                          ? `${card.oversText} ov, ${card.wickets}/${card.runsConceded}, Econ: ${card.economy.toFixed(1)}`
                          : 'Yet to bowl'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    {isLastBowler ? (
                      <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        Bowled Last Over
                      </span>
                    ) : isLimitReached ? (
                      <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                        Max Limit ({maxOvers} ov)
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-400">
                        {maxOvers !== Infinity ? `${completedOvers}/${maxOvers} ov` : `${completedOvers} ov`}
                      </span>
                    )}
                  </div>
                </button>
              )
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={!selectedBowlerId}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
            >
              Confirm Bowler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
