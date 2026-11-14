import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api.js';
import { UserRole } from '../types/index.js';

export interface TeamInfo {
  id: string;
  teamName: string;
  username: string;
  email: string;
  role?: UserRole;
  isActive?: boolean;
}

interface AuthContextType {
  team: TeamInfo | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (token: string, team: TeamInfo) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [team, setTeam] = useState<TeamInfo | null>(() => {
    const saved = localStorage.getItem('cricket_team');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('cricket_auth_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await authApi.getMe();
      if (res.data?.team) {
        setTeam(res.data.team);
        localStorage.setItem('cricket_team', JSON.stringify(res.data.team));
      }
    } catch (err) {
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [token]);

  const login = (newToken: string, newTeam: TeamInfo) => {
    setToken(newToken);
    setTeam(newTeam);
    localStorage.setItem('cricket_auth_token', newToken);
    localStorage.setItem('cricket_team', JSON.stringify(newTeam));
  };

  const logout = () => {
    setToken(null);
    setTeam(null);
    localStorage.removeItem('cricket_auth_token');
    localStorage.removeItem('cricket_team');
  };

  const isAdmin = team?.role === 'ADMIN';

  return (
    <AuthContext.Provider value={{ team, token, isLoading, isAdmin, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
