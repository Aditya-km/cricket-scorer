import axios from 'axios';
import {
  MatchFormat,
  MatchStatus,
  PlayerRole,
  TossDecision,
  ExtraType,
  DismissalType,
} from '../types/index.js';

export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('cricket_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authApi = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  getOpponents: () => api.get('/auth/opponents'),
};

// Admin API
export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),
  getAllTeams: () => api.get('/admin/teams'),
  getTeamDetails: (id: string) => api.get(`/admin/teams/${id}`),
  updateTeamStatus: (id: string, isActive: boolean) => api.patch(`/admin/teams/${id}/status`, { isActive }),
  getAllMatches: (params?: { format?: MatchFormat; status?: MatchStatus }) => api.get('/admin/matches', { params }),
  updateMatch: (id: string, data: { venue?: string; matchDate?: string }) => api.put(`/admin/matches/${id}`, data),
  cancelMatch: (id: string) => api.delete(`/admin/matches/${id}`),
  deleteMatch: (id: string) => api.delete(`/admin/matches/${id}/permanent`),
};

// Squad API
export const squadApi = {
  getSquad: (params?: { teamId?: string; role?: PlayerRole; search?: string }) =>
    api.get('/squad', { params }),
  addPlayer: (data: { playerName: string; jerseyNumber: number; role: PlayerRole }) =>
    api.post('/squad', data),
  updatePlayer: (id: string, data: { playerName: string; jerseyNumber: number; role: PlayerRole }) =>
    api.put(`/squad/${id}`, data),
  deletePlayer: (id: string) => api.delete(`/squad/${id}`),
};

// Match API
export const matchApi = {
  createMatch: (data: {
    format: MatchFormat;
    teamAId?: string;
    teamBId?: string;
    opponentTeamId?: string;
    matchDate: string;
    venue?: string;
  }) => api.post('/matches', data),
  getMatch: (id: string) => api.get(`/matches/${id}`),
  listMatches: (params?: { format?: MatchFormat; status?: MatchStatus }) =>
    api.get('/matches', { params }),
  deleteMatch: (id: string) => api.delete(`/matches/${id}`),
  setupPlayingXI: (matchId: string, data: { teamAPlayingXI: string[]; teamBPlayingXI: string[] }) =>
    api.post(`/matches/${matchId}/playing-xi`, data),
  conductToss: (matchId: string, data: { tossWinnerId: string; tossDecision: TossDecision }) =>
    api.post(`/matches/${matchId}/toss`, data),
  selectOpeningPlayers: (
    matchId: string,
    data: { strikerId: string; nonStrikerId: string; bowlerId: string; inningsNumber?: number }
  ) => api.post(`/matches/${matchId}/opening-players`, data),
  scoreDelivery: (
    matchId: string,
    data: {
      batterRuns: number;
      extraType: ExtraType;
      extraRuns?: number;
      isWicket?: boolean;
      dismissalType?: DismissalType | null;
      dismissedPlayerId?: string | null;
      fielderId?: string | null;
      incomingBatterId?: string | null;
      runsCompletedBeforeDismissal?: number;
    }
  ) => api.post(`/matches/${matchId}/score`, data),
  changeBowler: (matchId: string, bowlerId: string) =>
    api.post(`/matches/${matchId}/bowler`, { bowlerId }),
  undoLastDelivery: (matchId: string) => api.post(`/matches/${matchId}/undo`),

  // Test Match endpoints
  getTestStatus: (matchId: string) => api.get(`/matches/${matchId}/test-status`),
  advanceSession: (matchId: string) => api.post(`/matches/${matchId}/session`),
  advanceDay: (matchId: string) => api.post(`/matches/${matchId}/day`),
  handleFollowOn: (matchId: string, enforce: boolean) =>
    api.post(`/matches/${matchId}/follow-on`, { enforce }),
  declareInnings: (matchId: string) => api.post(`/matches/${matchId}/declare`),

  // PDF
  downloadPdfUrl: (matchId: string) => `/api/matches/${matchId}/pdf`,
};

// Stats API
export const statsApi = {
  getPlayerProfile: (id: string) => api.get(`/stats/players/${id}`),
  getTeamStats: (teamId: string) => api.get(`/stats/teams/${teamId}`),
};

// Gully Cricket API
export const gullyApi = {
  createTeamMatch: (data: any) => api.post('/gully/matches/team', data),
  createSinglesMatch: (data: any) => api.post('/gully/matches/singles', data),
  performDraft: (playerIds: string[]) => api.post('/gully/draft', { playerIds }),
  getMatch: (id: string) => api.get(`/gully/matches/${id}`),
  listMatches: (params?: { matchType?: any; status?: any }) =>
    api.get('/gully/matches', { params }),
  conductToss: (id: string, data: { tossWinnerTeamId: string; tossDecision: TossDecision }) =>
    api.post(`/gully/matches/${id}/toss`, data),
  selectOpeningPlayers: (
    id: string,
    data: { strikerId: string; nonStrikerId?: string | null; bowlerId: string; inningsNumber?: number }
  ) => api.post(`/gully/matches/${id}/opening-players`, data),
  scoreDelivery: (id: string, data: any) => api.post(`/gully/matches/${id}/score`, data),
  changeBowler: (id: string, bowlerId: string) => api.post(`/gully/matches/${id}/bowler`, { bowlerId }),
  undoLastDelivery: (id: string) => api.post(`/gully/matches/${id}/undo`),
  endMatch: (id: string) => api.post(`/gully/matches/${id}/end`),
  startNextSinglesBatter: (id: string, data?: { openingBowlerId?: string }) =>
    api.post(`/gully/matches/${id}/singles/next-batter`, data || {}),
  startNextSinglesRound: (id: string) => api.post(`/gully/matches/${id}/singles/next-round`),
  getPlayerGullyProfile: (id: string) => api.get(`/gully/stats/players/${id}`),
  getTeamGullyStats: () => api.get('/gully/stats/team'),
  deleteMatch: (id: string) => api.delete(`/gully/matches/${id}`),
};
