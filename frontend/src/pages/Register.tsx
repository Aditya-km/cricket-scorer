import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { authApi } from '../services/api.js';
import { Trophy, UserPlus, AlertCircle } from 'lucide-react';

export const Register: React.FC = () => {
  const [teamName, setTeamName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.register({
        teamName,
        username,
        email,
        password,
        confirmPassword,
      });
      login(res.data.token, res.data.team);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-8 shadow-2xl relative">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 mx-auto mb-4">
            <Trophy className="w-7 h-7 text-slate-950 font-bold" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Register Team</h1>
          <p className="text-xs text-slate-400 mt-1">Create an official team account to manage squad & fixtures</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Official Team Name
            </label>
            <input
              type="text"
              required
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="e.g. Royal Challengers"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Team Handle / Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. royal_challengers"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Team Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="contact@royalchallengers.com"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Confirm
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            {loading ? 'Registering Team...' : 'Create Team Account'}
          </button>
        </form>

        <div className="text-center mt-5 pt-5 border-t border-slate-800 text-xs text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-emerald-400 hover:underline">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
};
