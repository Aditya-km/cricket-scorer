import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext.js';
import { authApi, matchApi } from '../services/api.js';
import {
  Users,
  Trophy,
  History,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  Flame,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';

export const Dashboard: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (matchId: string) => matchApi.deleteMatch(matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['matchHistory'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to delete match');
    },
  });

  const handleDeleteMatch = (matchId: string, opponentName?: string) => {
    const label = opponentName ? ` vs ${opponentName}` : '';
    if (confirm(`Are you sure you want to delete this match${label}? All innings and scoring data will be permanently removed.`)) {
      deleteMutation.mutate(matchId);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['teamDashboard'],
    queryFn: async () => {
      const res = await authApi.getMe();
      return res.data;
    },
  });

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const { team, totalPlayers, totalMatches, won, lost, tied, drawn, recentMatches } = data || {};

  return (
    <div className="space-y-8">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/20 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              Verified Team Account
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {team?.teamName}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Team Handle: <span className="text-slate-300 font-mono">@{team?.username}</span> • {team?.email}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/squad"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Users className="w-4 h-4 text-slate-950 font-bold" />
              Manage Squad
            </Link>
            <Link
              to="/gully"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 transition-all shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Flame className="w-4 h-4 text-slate-950 fill-slate-950" />
              Gully Cricket Mode
            </Link>
          </div>
        </div>
      </div>

      {/* Two Modes Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* International Cricket Mode Card */}
        <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                MODE 1
              </span>
              <Trophy className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-xl font-black text-white">International Cricket</h3>
            <p className="text-xs text-slate-400">
              Formal international matches (T10, T20, ODI, Test). Admin schedules matches, formal Playing XI and ICC-standard statistics.
            </p>
          </div>
          <div className="pt-4 mt-2 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">
              {totalMatches || 0} Matches Completed
            </span>
            <Link
              to="/history"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:underline"
            >
              View Fixtures <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Gully Cricket Mode Card */}
        <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/40 rounded-3xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                MODE 2 • GULLY CRICKET
              </span>
              <Flame className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="text-xl font-black text-white">Gully Cricket Arena</h3>
            <p className="text-xs text-slate-400">
              Team matches with temporary squads & customizable overs, plus Singles matches with our interactive Gully Draft!
            </p>
          </div>
          <div className="pt-4 mt-2 border-t border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                to="/gully/create-team"
                className="text-[11px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/20"
              >
                + Team Match
              </Link>
              <Link
                to="/gully/create-singles"
                className="text-[11px] font-bold text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 px-2.5 py-1 rounded-lg border border-orange-500/20"
              >
                + Singles Draft
              </Link>
            </div>
            <Link
              to="/gully"
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:underline"
            >
              Enter Arena <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Squad Size */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Squad</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">{totalPlayers || 0}</span>
            <span className="text-xs text-slate-400 ml-1.5">Registered</span>
          </div>
        </div>

        {/* Matches Played */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Matches</span>
            <Trophy className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">{totalMatches || 0}</span>
            <span className="text-xs text-slate-400 ml-1.5">Completed</span>
          </div>
        </div>

        {/* Won */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Won</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">{won || 0}</span>
            <span className="text-xs text-slate-400 ml-1.5">Victories</span>
          </div>
        </div>

        {/* Lost */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-red-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Lost</span>
            <XCircle className="w-4 h-4" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-red-400">{lost || 0}</span>
            <span className="text-xs text-slate-400 ml-1.5">Defeats</span>
          </div>
        </div>

        {/* Tied */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Tied</span>
            <Flame className="w-4 h-4" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-amber-400">{tied || 0}</span>
            <span className="text-xs text-slate-400 ml-1.5">Ties</span>
          </div>
        </div>

        {/* Drawn */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Drawn</span>
            <HelpCircle className="w-4 h-4" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-purple-400">{drawn || 0}</span>
            <span className="text-xs text-slate-400 ml-1.5">Tests</span>
          </div>
        </div>
      </div>

      {/* Recent Matches Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-400" />
              Recent Matches
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Your team's latest fixtures and scorecards</p>
          </div>
          <Link
            to="/history"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            Full Match History <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {recentMatches && recentMatches.length > 0 ? (
          <div className="space-y-3">
            {recentMatches.map((m: any) => (
              <div
                key={m.id}
                className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center font-bold text-xs shrink-0">
                    <span className="text-emerald-400">{m.format}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {m.matchDate ? format(new Date(m.matchDate), 'dd MMM') : ''}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white">
                      vs {m.opponentName}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {m.resultDescription || (m.status === 'LIVE' ? 'Match Live in Progress' : 'Upcoming Match')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Link
                    to={m.status === 'LIVE' ? `/live/${m.id}` : `/scorecard/${m.id}`}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                      m.status === 'LIVE'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                    }`}
                  >
                    {m.status === 'LIVE' ? 'Go to Live Scoring' : 'View Scorecard'}
                  </Link>
                  <button
                    onClick={() => handleDeleteMatch(m.id, m.opponentName)}
                    disabled={deleteMutation.isPending}
                    className="p-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-all hover:scale-105 disabled:opacity-50"
                    title="Delete Match"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30 text-emerald-400" />
            <p className="text-sm font-medium text-slate-300">No matches recorded yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Matches are scheduled and configured by tournament administrators. Keep your squad roster updated!
            </p>
            <Link
              to="/squad"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Users className="w-4 h-4 text-emerald-400" /> Manage Squad
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
