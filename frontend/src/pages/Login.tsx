import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { authApi } from '../services/api.js';
import { Trophy, LogIn, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authApi.login({ usernameOrEmail, password });
      login(res.data.token, res.data.team);
      if (res.data.team?.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-8 shadow-2xl relative">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 mx-auto mb-4">
            <Trophy className="w-7 h-7 text-slate-950 font-bold" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">PavilionPro Sign In</h1>
          <p className="text-xs text-slate-400 mt-1">Sign in with your Team or Administrator credentials</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Username or Email
            </label>
            <input
              type="text"
              required
              value={usernameOrEmail}
              onChange={e => setUsernameOrEmail(e.target.value)}
              placeholder="e.g. mumbai_titans or team@cricket.com"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center mt-6 pt-6 border-t border-slate-800 text-xs text-slate-400">
          Don't have a team account yet?{' '}
          <Link to="/register" className="font-semibold text-emerald-400 hover:underline">
            Register your team
          </Link>
        </div>
      </div>
    </div>
  );
};
