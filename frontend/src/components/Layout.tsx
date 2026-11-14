import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar.js';

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PavilionPro &copy; {new Date().getFullYear()} - Professional Cricket Scoring & Management Engine</span>
          <span className="flex items-center gap-4 text-slate-400">
            <span>T10</span> • <span>T20</span> • <span>ODI</span> • <span>5-Day Test</span>
          </span>
        </div>
      </footer>
    </div>
  );
};
