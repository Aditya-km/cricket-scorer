import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import {
  LayoutDashboard,
  Users,
  PlusCircle,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  Trophy,
  Flame,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { team, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Admin sees Platform Dashboard, Create Match, Match History, Settings
  // Team sees My Team Dashboard, Gully Cricket, My Squad, Match History, Settings
  const navLinks = isAdmin
    ? [
        { name: 'Admin Dashboard', path: '/admin', icon: LayoutDashboard },
        { name: 'Create Match', path: '/create-match', icon: PlusCircle },
        { name: 'Match History', path: '/history', icon: History },
        { name: 'Settings', path: '/settings', icon: Settings },
      ]
    : [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Gully Cricket', path: '/gully', icon: Flame, isGully: true },
        { name: 'My Squad', path: '/squad', icon: Users },
        { name: 'Match History', path: '/history', icon: History },
        { name: 'Settings', path: '/settings', icon: Settings },
      ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md bg-opacity-90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link to={isAdmin ? '/admin' : '/dashboard'} className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Trophy className="w-5 h-5 text-slate-950 font-bold" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg text-white tracking-tight flex items-center gap-1.5">
                  Pavilion<span className="text-emerald-400">Pro</span>
                  {isAdmin && (
                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-400 border border-amber-400/40 px-1.5 py-0.5 rounded">
                      ADMIN
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                  {isAdmin ? 'Admin Console' : 'Cricket Engine'}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1 ml-8">
              {navLinks.map((link: any) => {
                const Icon = link.icon;
                const isActive =
                  location.pathname === link.path || (link.isGully && location.pathname.startsWith('/gully'));
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? link.isGully
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? (link.isGully ? 'text-amber-400' : 'text-emerald-400') : 'text-slate-400'
                      }`}
                    />
                    {link.name}
                    {link.isGully && (
                      <span className="text-[9px] font-black uppercase bg-amber-500 text-slate-950 px-1 py-0.5 rounded font-mono">
                        NEW
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right Side - Team Profile & Logout */}
          <div className="hidden md:flex items-center gap-4">
            {team ? (
              <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/60 px-3.5 py-1.5 rounded-full">
                <div className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center ${
                  isAdmin ? 'bg-amber-400 text-slate-950' : 'bg-emerald-500 text-slate-950'
                }`}>
                  {getInitials(team.teamName)}
                </div>
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-200 leading-tight">
                      {team.teamName}
                    </span>
                    {isAdmin && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-400/10 text-amber-400 border border-amber-400/30">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    @{team.username}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="ml-2 text-slate-400 hover:text-red-400 transition-colors p-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-medium bg-emerald-500 text-slate-950 font-semibold px-4 py-1.5 rounded-lg hover:bg-emerald-400 transition-colors"
                >
                  Register Team
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-slate-900/95 px-4 pt-2 pb-4 space-y-2">
          {team && (
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800 mb-2">
              <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center ${
                isAdmin ? 'bg-amber-400 text-slate-950' : 'bg-emerald-500 text-slate-950'
              }`}>
                {getInitials(team.teamName)}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-white">{team.teamName}</span>
                  {isAdmin && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-400 border border-amber-400/40">
                      ADMIN
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400">@{team.username}</span>
              </div>
            </div>
          )}
          {navLinks.map(link => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {link.name}
              </Link>
            );
          })}
          {team && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          )}
        </div>
      )}
    </nav>
  );
};
