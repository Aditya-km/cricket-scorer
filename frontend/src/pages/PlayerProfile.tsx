import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { statsApi, gullyApi } from '../services/api.js';
import { PlayerProfileData, PlayerGullyProfileData } from '../types/index.js';
import {
  User,
  Trophy,
  Activity,
  History,
  Target,
  Shield,
  ChevronLeft,
  ChevronRight,
  Flame,
  Zap,
  Globe,
  Sparkles,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';

export const PlayerProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [statsMode, setStatsMode] = useState<'INTERNATIONAL' | 'GULLY'>('INTERNATIONAL');

  // Fetch International Cricket Stats
  const { data, isLoading } = useQuery<PlayerProfileData>({
    queryKey: ['playerProfile', id],
    queryFn: async () => {
      const res = await statsApi.getPlayerProfile(id!);
      return res.data;
    },
    enabled: !!id,
  });

  // Fetch Gully Cricket Stats
  const { data: gullyData } = useQuery<PlayerGullyProfileData>({
    queryKey: ['playerGullyProfile', id],
    queryFn: async () => {
      try {
        const res = await gullyApi.getPlayerGullyProfile(id!);
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-slate-400">
        <User className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p>Player profile not found</p>
        <Link to="/squad" className="inline-block mt-4 text-emerald-400 hover:underline text-sm font-semibold">
          Return to Squad
        </Link>
      </div>
    );
  }

  const { player, battingStats, bowlingStats, fieldingStats, matchHistory } = data;
  const gullyBatting = gullyData?.gullyBattingStats;
  const gullyBowling = gullyData?.gullyBowlingStats;
  const teamBreakdown = gullyData?.teamMatchBreakdown;
  const singlesBreakdown = gullyData?.singlesMatchBreakdown;
  const gullyHistory = gullyData?.matchHistory;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Back button */}
      <div>
        <Link
          to="/squad"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Squad
        </Link>
      </div>

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-black text-2xl font-mono shrink-0">
              #{player.jerseyNumber}
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                {player.role.replace('_', ' ')}
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {player.playerName}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Team: <strong className="text-slate-200">{player.teamName}</strong> • Career Profile
              </p>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-6 bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl shrink-0">
            <div className="text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Int'l Runs</span>
              <span className="text-xl font-black text-emerald-400">{battingStats.totalRuns}</span>
            </div>
            <div className="w-px h-8 bg-slate-700"></div>
            <div className="text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Int'l Wkts</span>
              <span className="text-xl font-black text-blue-400">{bowlingStats.totalWickets}</span>
            </div>
            <div className="w-px h-8 bg-slate-700"></div>
            <div className="text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Gully Runs</span>
              <span className="text-xl font-black text-amber-400">{gullyBatting?.totalRuns || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-2 rounded-2xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatsMode('INTERNATIONAL')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              statsMode === 'INTERNATIONAL'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" />
            International Cricket Statistics
          </button>

          <button
            type="button"
            onClick={() => setStatsMode('GULLY')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              statsMode === 'GULLY'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4 text-slate-950 font-bold" />
            Gully Cricket Statistics
          </button>
        </div>

        <div className="text-[11px] text-slate-400 px-3">
          Independent records • Never combined
        </div>
      </div>

      {/* --- INTERNATIONAL CRICKET MODE --- */}
      {statsMode === 'INTERNATIONAL' && (
        <div className="space-y-6">
          {/* Batting Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
              <Zap className="w-5 h-5 text-emerald-400" />
              International Batting Statistics (T10, T20, ODI, Test)
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Matches</span>
                <span className="text-xl font-bold text-white mt-1 block">{battingStats.matchesPlayed}</span>
              </div>

              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Runs</span>
                <span className="text-xl font-bold text-emerald-400 mt-1 block">{battingStats.totalRuns}</span>
              </div>

              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Highest Score</span>
                <span className="text-xl font-bold text-white mt-1 block">{battingStats.highestScore}</span>
              </div>

              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Average</span>
                <span className="text-xl font-bold text-white mt-1 block">
                  {battingStats.battingAverage !== null ? battingStats.battingAverage.toFixed(2) : '-'}
                </span>
              </div>

              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Strike Rate</span>
                <span className="text-xl font-bold text-white mt-1 block">{battingStats.strikeRate.toFixed(1)}</span>
              </div>

              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Boundaries</span>
                <span className="text-xs font-bold text-slate-300 mt-1 block">
                  <strong className="text-emerald-400">{battingStats.fours}</strong> (4s) •{' '}
                  <strong className="text-amber-400">{battingStats.sixes}</strong> (6s)
                </span>
              </div>
            </div>
          </div>

          {/* Bowling Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
              <Activity className="w-5 h-5 text-blue-400" />
              International Bowling Figures
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Overs</span>
                <span className="text-xl font-bold text-white mt-1 block">{bowlingStats.oversBowled}</span>
              </div>

              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Wickets</span>
                <span className="text-xl font-bold text-blue-400 mt-1 block">{bowlingStats.totalWickets}</span>
              </div>

              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Economy</span>
                <span className="text-xl font-bold text-white mt-1 block">{bowlingStats.economyRate.toFixed(2)}</span>
              </div>

              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Average</span>
                <span className="text-xl font-bold text-white mt-1 block">
                  {bowlingStats.bowlingAverage !== null ? bowlingStats.bowlingAverage.toFixed(2) : '-'}
                </span>
              </div>

              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Best Bowling</span>
                <span className="text-xl font-bold text-emerald-400 mt-1 block">{bowlingStats.bestBowling}</span>
              </div>

              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Maidens</span>
                <span className="text-xl font-bold text-white mt-1 block">{bowlingStats.maidens}</span>
              </div>
            </div>
          </div>

          {/* International Match History */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
              <History className="w-5 h-5 text-emerald-400" />
              International Match Appearances
            </h2>

            {matchHistory && matchHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Format</th>
                      <th className="py-3 px-4">Opponent</th>
                      <th className="py-3 px-4 text-center">Runs</th>
                      <th className="py-3 px-4 text-center">Wickets</th>
                      <th className="py-3 px-4">Result</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {matchHistory.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-mono">
                          {m.matchDate ? format(new Date(m.matchDate), 'dd MMM yyyy') : '-'}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-400">{m.format}</td>
                        <td className="py-3 px-4 font-semibold text-white">{m.opponent}</td>
                        <td className="py-3 px-4 text-center text-emerald-400 font-bold">{m.runsScored}</td>
                        <td className="py-3 px-4 text-center text-blue-400 font-bold">{m.wicketsTaken}</td>
                        <td className="py-3 px-4 text-slate-300">{m.resultDescription || 'Finished'}</td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/scorecard/${m.matchId}`}
                            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold"
                          >
                            Scorecard <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">
                No international match appearances recorded
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- GULLY CRICKET MODE --- */}
      {statsMode === 'GULLY' && (
        <div className="space-y-6">
          {/* Overall Gully Stats Card */}
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
              <Flame className="w-5 h-5 text-amber-400" />
              Overall Gully Cricket Career Statistics
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Gully Matches</span>
                <span className="text-xl font-bold text-white mt-1 block">
                  {gullyBatting?.matchesPlayed || 0}
                </span>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Gully Runs</span>
                <span className="text-xl font-bold text-amber-400 mt-1 block">
                  {gullyBatting?.totalRuns || 0}
                </span>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">High Score</span>
                <span className="text-xl font-bold text-white mt-1 block">
                  {gullyBatting?.highestScore || '0'}
                </span>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Batting Avg</span>
                <span className="text-xl font-bold text-white mt-1 block">
                  {gullyBatting?.battingAverage ? gullyBatting.battingAverage.toFixed(2) : '-'}
                </span>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Strike Rate</span>
                <span className="text-xl font-bold text-white mt-1 block">
                  {gullyBatting?.strikeRate ? gullyBatting.strikeRate.toFixed(1) : '0.0'}
                </span>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Gully Wickets</span>
                <span className="text-xl font-bold text-cyan-400 mt-1 block">
                  {gullyBowling?.totalWickets || 0}
                </span>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Best Bowling</span>
                <span className="text-xl font-bold text-emerald-400 mt-1 block">
                  {gullyBowling?.bestBowling || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown: Team Match vs Singles Match */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Team Match Breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  Team Match Statistics
                </h3>
                <span className="text-xs text-slate-400">{teamBreakdown?.matches || 0} matches</span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div className="p-3 bg-slate-950 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase block">Runs</span>
                  <span className="text-lg font-black text-emerald-400 mt-0.5 block">{teamBreakdown?.runs || 0}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase block">HS</span>
                  <span className="text-lg font-black text-white mt-0.5 block">{teamBreakdown?.highestScore || '0'}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase block">SR</span>
                  <span className="text-lg font-black text-white mt-0.5 block">
                    {teamBreakdown?.strikeRate ? teamBreakdown.strikeRate.toFixed(1) : '0.0'}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase block">Wickets</span>
                  <span className="text-lg font-black text-blue-400 mt-0.5 block">{teamBreakdown?.wickets || 0}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase block">Bowl Avg</span>
                  <span className="text-lg font-black text-white mt-0.5 block">
                    {teamBreakdown?.bowlingAverage ? teamBreakdown.bowlingAverage.toFixed(2) : '-'}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase block">Econ</span>
                  <span className="text-lg font-black text-white mt-0.5 block">
                    {teamBreakdown?.economy ? teamBreakdown.economy.toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>
            </div>

            {/* Singles Match Breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-orange-400" />
                  Singles Match Statistics
                </h3>
                <span className="text-xs text-slate-400">Solo & Bowler</span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div className="p-3 bg-slate-950 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase block">Solo Inngs</span>
                  <span className="text-lg font-black text-orange-400 mt-0.5 block">
                    {singlesBreakdown?.matchesAsBatter || 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase block">Solo Runs</span>
                  <span className="text-lg font-black text-orange-400 mt-0.5 block">
                    {singlesBreakdown?.runsAsBatter || 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase block">Solo HS</span>
                  <span className="text-lg font-black text-white mt-0.5 block">
                    {singlesBreakdown?.highestScore || '0'}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase block">Bowl Inngs</span>
                  <span className="text-lg font-black text-cyan-400 mt-0.5 block">
                    {singlesBreakdown?.matchesAsBowler || 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase block">Solo Wkts</span>
                  <span className="text-lg font-black text-cyan-400 mt-0.5 block">
                    {singlesBreakdown?.wicketsAsBowler || 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase block">Solo Econ</span>
                  <span className="text-lg font-black text-white mt-0.5 block">
                    {singlesBreakdown?.economy ? singlesBreakdown.economy.toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Gully Match History */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
              <History className="w-5 h-5 text-amber-400" />
              Gully Match Participation History
            </h2>

            {gullyHistory && gullyHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Fixture / Solo</th>
                      <th className="py-3 px-4 text-center">Runs</th>
                      <th className="py-3 px-4 text-center">Wickets</th>
                      <th className="py-3 px-4">Result</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {gullyHistory.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-mono">
                          {m.matchDate ? format(new Date(m.matchDate), 'dd MMM yyyy') : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              m.matchType === 'SINGLES_MATCH'
                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {m.matchType === 'SINGLES_MATCH' ? 'Singles' : 'Team'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">{m.opponent}</td>
                        <td className="py-3 px-4 text-center text-amber-400 font-bold">{m.runsScored}</td>
                        <td className="py-3 px-4 text-center text-cyan-400 font-bold">{m.wicketsTaken}</td>
                        <td className="py-3 px-4 text-slate-300">{m.resultDescription || 'Completed'}</td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/gully/scorecard/${m.matchId}`}
                            className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold"
                          >
                            Scorecard <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">
                No Gully match appearances recorded yet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
