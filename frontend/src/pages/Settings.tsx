import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../services/api.js';
import { Settings as SettingsIcon, Shield, Trophy, Users, Mail, User } from 'lucide-react';

export const Settings: React.FC = () => {
  const { team } = useAuth();

  const { data: teamStats } = useQuery({
    queryKey: ['teamStats', team?.id],
    queryFn: async () => {
      const res = await statsApi.getTeamStats(team!.id);
      return res.data;
    },
    enabled: !!team?.id,
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-emerald-400" />
          Team Settings & Profile
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Review your registered team account credentials and lifetime performance stats.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Account Details */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
            <Shield className="w-4 h-4 text-emerald-400" />
            Account Information
          </h2>

          <div className="space-y-4 text-xs">
            <div>
              <span className="text-slate-400 uppercase tracking-wider block font-semibold mb-1">
                Official Team Name
              </span>
              <div className="bg-slate-800/80 px-4 py-3 rounded-xl border border-slate-700/60 font-bold text-white text-sm">
                {team?.teamName}
              </div>
            </div>

            <div>
              <span className="text-slate-400 uppercase tracking-wider block font-semibold mb-1">
                Unique Handle
              </span>
              <div className="bg-slate-800/80 px-4 py-3 rounded-xl border border-slate-700/60 font-mono text-emerald-400 text-sm">
                @{team?.username}
              </div>
            </div>

            <div>
              <span className="text-slate-400 uppercase tracking-wider block font-semibold mb-1">
                Registered Email
              </span>
              <div className="bg-slate-800/80 px-4 py-3 rounded-xl border border-slate-700/60 text-slate-200 text-sm">
                {team?.email}
              </div>
            </div>

            <div className="pt-2 text-[11px] text-slate-500">
              Team data is isolated with MySQL relational foreign keys and JWT security. Individual player login is disallowed by design.
            </div>
          </div>
        </div>

        {/* Lifetime Team Stats Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
            <Trophy className="w-4 h-4 text-amber-400" />
            Lifetime Statistics
          </h2>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60">
              <span className="text-slate-400 uppercase tracking-wider block">Total Matches</span>
              <span className="text-xl font-bold text-white mt-1 block">
                {teamStats?.totalMatches || 0}
              </span>
            </div>

            <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60">
              <span className="text-slate-400 uppercase tracking-wider block">Total Runs</span>
              <span className="text-xl font-bold text-emerald-400 mt-1 block">
                {teamStats?.totalRunsScored || 0}
              </span>
            </div>

            <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60">
              <span className="text-slate-400 uppercase tracking-wider block">Wickets Taken</span>
              <span className="text-xl font-bold text-blue-400 mt-1 block">
                {teamStats?.totalWicketsTaken || 0}
              </span>
            </div>

            <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60">
              <span className="text-slate-400 uppercase tracking-wider block">Highest Total</span>
              <span className="text-xl font-bold text-amber-400 mt-1 block">
                {teamStats?.highestTotal || 0}
              </span>
            </div>
          </div>

          <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-800 text-xs text-slate-400">
            <span className="font-semibold text-slate-200 block mb-1">Cricket Scoring Integrity</span>
            All player and team stats are dynamically aggregated from ball-by-ball deliveries and scorecards. Manual score entry is prohibited.
          </div>
        </div>
      </div>
    </div>
  );
};
