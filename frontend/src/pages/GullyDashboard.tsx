import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gullyApi } from '../services/api.js';
import { GullyMatchDetails, GullyMatchType, MatchStatus } from '../types/index.js';
import {
  Flame,
  Users,
  User,
  PlusCircle,
  Play,
  FileText,
  Calendar,
  Sparkles,
  Trophy,
  Shuffle,
  Shield,
  Layers,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';

export const GullyDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'ALL' | 'TEAM_MATCH' | 'SINGLES_MATCH' | 'LIVE' | 'COMPLETED'>('ALL');

  const deleteMutation = useMutation({
    mutationFn: (matchId: string) => gullyApi.deleteMatch(matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gullyMatches'] });
      queryClient.invalidateQueries({ queryKey: ['gullyTeamStats'] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || 'Failed to delete Gully match');
    },
  });

  const handleDeleteMatch = (matchId: string) => {
    if (
      window.confirm(
        'Are you sure you want to permanently delete this Gully match? All scorecards, overs, and match records will be removed.'
      )
    ) {
      deleteMutation.mutate(matchId);
    }
  };

  // Fetch Gully matches
  const { data: matches, isLoading: matchesLoading } = useQuery<GullyMatchDetails[]>({
    queryKey: ['gullyMatches'],
    queryFn: async () => {
      const res = await gullyApi.listMatches();
      return res.data;
    },
  });

  // Fetch Team Gully Stats
  const { data: stats } = useQuery({
    queryKey: ['teamGullyStats'],
    queryFn: async () => {
      const res = await gullyApi.getTeamGullyStats();
      return res.data;
    },
  });

  const filteredMatches = (matches || []).filter(m => {
    if (activeTab === 'TEAM_MATCH') return m.matchType === 'TEAM_MATCH';
    if (activeTab === 'SINGLES_MATCH') return m.matchType === 'SINGLES_MATCH';
    if (activeTab === 'LIVE') return m.status === 'LIVE';
    if (activeTab === 'COMPLETED') return m.status === 'COMPLETED';
    return true;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Gully Cricket Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-900 border border-amber-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold tracking-wide">
              <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              GULLY CRICKET ARENA
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
              Street & Singles Cricket
              <span className="text-xs uppercase bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded shadow">
                CUSTOM RULES
              </span>
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Play flexible friendly matches with your squad. Divide into temporary teams anytime or play intense Singles Matches with our interactive Gully Draft!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/gully/create-team"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 transition-all shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Users className="w-4 h-4 font-bold" />
              Create Team Match
            </Link>
            <Link
              to="/gully/create-singles"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            >
              <Shuffle className="w-4 h-4 text-amber-400" />
              Singles & Gully Draft
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Gully</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">{stats?.totalMatches || 0}</span>
            <span className="text-xs text-slate-400 ml-1.5">Matches</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Team Matches</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">{stats?.teamMatchesCount || 0}</span>
            <span className="text-xs text-slate-400 ml-1.5">Played</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Singles Matches</span>
            <User className="w-4 h-4 text-orange-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">{stats?.singlesMatchesCount || 0}</span>
            <span className="text-xs text-slate-400 ml-1.5">Drafted</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Gully Runs</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">{stats?.totalRunsScored || 0}</span>
            <span className="text-xs text-slate-400 ml-1.5">Runs</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">High Score</span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">{stats?.highestScore || 0}</span>
            <span className="text-xs text-slate-400 ml-1.5">Best Total</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Match Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
            {[
              { id: 'ALL', label: 'All Gully' },
              { id: 'TEAM_MATCH', label: 'Team Matches' },
              { id: 'SINGLES_MATCH', label: 'Singles Matches' },
              { id: 'LIVE', label: 'Live' },
              { id: 'COMPLETED', label: 'Completed' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Link
            to="/gully/history"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:underline"
          >
            View Full Gully Match History <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Matches Grid */}
        {matchesLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <Flame className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">No Gully Matches Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Start your first Gully match! You can divide your registered squad into temporary teams or challenge a friend to a solo Singles match.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                to="/gully/create-team"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all"
              >
                Create Team Match
              </Link>
              <Link
                to="/gully/create-singles"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all"
              >
                Create Singles Match
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMatches.map(match => {
              const isSingles = match.matchType === 'SINGLES_MATCH';
              const isLive = match.status === 'LIVE';
              const isCompleted = match.status === 'COMPLETED';

              const teamA = match.temporaryTeams?.find(t => t.isTeamA)?.teamName || 'Team A';
              const teamB = match.temporaryTeams?.find(t => !t.isTeamA)?.teamName || 'Team B';

              const inn1 = match.innings?.[0];
              const inn2 = match.innings?.[1];

              return (
                <div
                  key={match.id}
                  className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all group"
                >
                  <div className="space-y-4">
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider border ${
                            isSingles
                              ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {isSingles ? 'Singles Match' : 'Team Match'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                          {match.totalOvers} Overs
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded flex items-center gap-1 ${
                          isLive
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
                            : isCompleted
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                        }`}
                      >
                        {isLive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
                        {match.status}
                      </span>
                    </div>

                    {/* Match Participants & Scores */}
                    <div className="space-y-2 py-1">
                      {isSingles ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
                                🏏
                              </div>
                              <div>
                                <div className="text-sm font-bold text-white">
                                  {match.selectedBatter?.playerName || 'Solo Batter'}
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium">Solo Batter</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-base font-black text-amber-400">
                                {inn1 ? `${inn1.totalRuns}/${inn1.wickets}` : '0/0'}
                              </span>
                              <div className="text-[10px] text-slate-400 font-mono">
                                ({inn1?.oversCompletedText || '0.0'} ov)
                              </div>
                            </div>
                          </div>

                          <div className="text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
                            <span>Opposition: Bowlers XI</span>
                            <span className="text-[10px] text-slate-500">{match.venue || 'Local Street'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* Team A */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-white truncate max-w-[150px]">
                              {teamA}
                            </span>
                            <span className="text-sm font-black text-slate-200">
                              {inn1?.battingTempTeamId && match.temporaryTeams?.find(t => t.id === inn1.battingTempTeamId)?.isTeamA
                                ? `${inn1.totalRuns}/${inn1.wickets} (${inn1.oversCompletedText})`
                                : inn2?.battingTempTeamId && match.temporaryTeams?.find(t => t.id === inn2.battingTempTeamId)?.isTeamA
                                ? `${inn2.totalRuns}/${inn2.wickets} (${inn2.oversCompletedText})`
                                : '-'}
                            </span>
                          </div>

                          {/* Team B */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-white truncate max-w-[150px]">
                              {teamB}
                            </span>
                            <span className="text-sm font-black text-slate-200">
                              {inn1?.battingTempTeamId && !match.temporaryTeams?.find(t => t.id === inn1.battingTempTeamId)?.isTeamA
                                ? `${inn1.totalRuns}/${inn1.wickets} (${inn1.oversCompletedText})`
                                : inn2?.battingTempTeamId && !match.temporaryTeams?.find(t => t.id === inn2.battingTempTeamId)?.isTeamA
                                ? `${inn2.totalRuns}/${inn2.wickets} (${inn2.oversCompletedText})`
                                : '-'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Result or status note */}
                    {match.resultDescription ? (
                      <div className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl">
                        {match.resultDescription}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {format(new Date(match.matchDate), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2">
                    {match.status === 'COMPLETED' ? (
                      <Link
                        to={`/gully/scorecard/${match.id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        View Scorecard
                      </Link>
                    ) : (
                      <Link
                        to={`/gully/live/${match.id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-md shadow-amber-500/20"
                      >
                        <Play className="w-3.5 h-3.5 fill-slate-950 font-bold" />
                        Resume Scoring
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteMatch(match.id)}
                      disabled={deleteMutation.isPending}
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 hover:border-rose-500/40 transition-colors shrink-0 disabled:opacity-50"
                      title="Delete Match"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
