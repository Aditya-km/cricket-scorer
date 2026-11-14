export type PlayerRole = 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKETKEEPER';
export type MatchFormat = 'T10' | 'T20' | 'ODI' | 'TEST';
export type MatchStatus = 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'ABANDONED';
export type TossDecision = 'BAT' | 'BOWL';
export type ExtraType = 'NONE' | 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | 'PENALTY';
export type DismissalType =
  | 'BOWLED'
  | 'CAUGHT'
  | 'LBW'
  | 'RUN_OUT'
  | 'STUMPED'
  | 'HIT_WICKET'
  | 'RETIRED_OUT'
  | 'OBSTRUCTING_FIELD';

export type UserRole = 'ADMIN' | 'TEAM';

export interface Team {
  id: string;
  teamName: string;
  username: string;
  email: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface Player {
  id: string;
  playerName: string;
  jerseyNumber: number;
  role: PlayerRole;
  teamId?: string;
  matchesPlayed?: number;
  runsScored?: number;
  wicketsTaken?: number;
  createdAt?: string;
}

export interface BattingScorecard {
  id: string;
  playerId: string;
  battingOrder: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  notOut: boolean;
  dismissalType?: DismissalType | null;
  dismissalText?: string | null;
  bowlerId?: string | null;
  fielderId?: string | null;
  player: {
    id: string;
    playerName: string;
    jerseyNumber: number;
    role: PlayerRole;
  };
}

export interface BowlingScorecard {
  id: string;
  playerId: string;
  bowlingOrder: number;
  legalBalls: number;
  oversText: string;
  maidens: number;
  runsConceded: number;
  wickets: number;
  economy: number;
  wides: number;
  noBalls: number;
  player: {
    id: string;
    playerName: string;
    jerseyNumber: number;
    role: PlayerRole;
  };
}

export interface WicketRecord {
  id: string;
  playerId: string;
  dismissalType: DismissalType;
  bowlerCredited: boolean;
  bowlerId?: string | null;
  fielderId?: string | null;
  overBallText: string;
  teamRunsAtFall: number;
  wicketNumber: number;
  player: { id: string; playerName: string };
  bowler?: { id: string; playerName: string } | null;
  fielder?: { id: string; playerName: string } | null;
}

export interface Delivery {
  id: string;
  overNumber: number;
  ballNumber: number;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  batterRuns: number;
  extraRuns: number;
  extraType: ExtraType;
  totalRuns: number;
  isLegalDelivery: boolean;
  isWicket: boolean;
  dismissalType?: DismissalType | null;
  dismissedPlayerId?: string | null;
  createdAt: string;
}

export interface Innings {
  id: string;
  inningsNumber: number;
  battingTeamId: string;
  bowlingTeamId: string;
  totalRuns: number;
  wickets: number;
  legalBalls: number;
  oversCompletedText: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'DECLARED';
  targetRuns?: number | null;
  isDeclared: boolean;
  byes: number;
  legByes: number;
  wides: number;
  noBalls: number;
  penaltyRuns: number;
  currentStrikerId?: string | null;
  currentNonStrikerId?: string | null;
  currentBowlerId?: string | null;
  lastBowlerId?: string | null;
  battingScorecards: BattingScorecard[];
  bowlingScorecards: BowlingScorecard[];
  wicketsList: WicketRecord[];
  deliveries: Delivery[];
}

export interface MatchDetails {
  id: string;
  format: MatchFormat;
  teamAId: string;
  teamBId: string;
  matchDate: string;
  venue?: string | null;
  tossWinnerId?: string | null;
  tossDecision?: TossDecision | null;
  status: MatchStatus;
  resultType?: string | null;
  resultDescription?: string | null;
  winnerId?: string | null;
  currentInningsNumber: number;
  followOnEnforced: boolean;
  currentDay: number;
  currentSession: number;
  dayOvers: number;
  sessionOvers: number;
  teamA: {
    id: string;
    teamName: string;
    players: Player[];
  };
  teamB: {
    id: string;
    teamName: string;
    players: Player[];
  };
  matchPlayers: {
    playerId: string;
    teamId: string;
    isPlayingXI: boolean;
    player: Player;
  }[];
  innings: Innings[];
  sessions: {
    id: string;
    dayNumber: number;
    sessionNumber: number;
    oversBowled: number;
  }[];
}

export interface PlayerProfileData {
  player: {
    id: string;
    playerName: string;
    jerseyNumber: number;
    role: PlayerRole;
    teamId: string;
    teamName: string;
  };
  battingStats: {
    matchesPlayed: number;
    inningsBatted: number;
    totalRuns: number;
    highestScore: string;
    battingAverage: number | null;
    strikeRate: number;
    ballsFaced: number;
    fours: number;
    sixes: number;
    notOuts: number;
    centuries: number;
    halfCenturies: number;
    ducks: number;
  };
  bowlingStats: {
    bowlingInnings: number;
    totalWickets: number;
    oversBowled: string;
    legalBalls: number;
    runsConceded: number;
    bowlingAverage: number | null;
    economyRate: number;
    bestBowling: string;
    maidens: number;
  };
  fieldingStats: {
    catches: number;
    runOuts: number;
  };
  matchHistory: {
    matchId: string;
    matchDate: string;
    format: MatchFormat;
    opponent: string;
    runsScored: number;
    ballsFaced: number;
    wicketsTaken: number;
    oversBowled: string;
    resultDescription?: string | null;
  }[];
}

// ==========================================
// GULLY CRICKET TYPES
// ==========================================

export type GullyMatchType = 'TEAM_MATCH' | 'SINGLES_MATCH';
export type BowlingAllocationRule = 'EXACT' | 'MAX_LIMIT';
export type SinglesDismissalRule = 'LAST_WICKET_ENDS_INNINGS' | 'BATTER_CONTINUES';
export type BowlerOrderRule = 'FREE_SELECTION' | 'PREDEFINED_ORDER';

export interface GullyTemporaryTeam {
  id: string;
  gullyMatchId: string;
  teamName: string;
  isTeamA: boolean;
  captainPlayerId?: string | null;
  captain?: { id: string; playerName: string } | null;
  players?: {
    id: string;
    playerId: string;
    isBatter: boolean;
    isBowler: boolean;
    allocatedOvers: number;
    player: Player;
  }[];
}

export interface GullyMatchPlayer {
  id: string;
  gullyMatchId: string;
  playerId: string;
  temporaryTeamId?: string | null;
  isBatter: boolean;
  isBowler: boolean;
  allocatedOvers: number;
  bowlingOrder?: number | null;
  player: Player;
}

export interface GullyBattingScorecard {
  id: string;
  inningsId: string;
  playerId: string;
  battingOrder: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  notOut: boolean;
  dismissalType?: DismissalType | null;
  dismissalText?: string | null;
  bowlerId?: string | null;
  fielderId?: string | null;
  player: {
    id: string;
    playerName: string;
    jerseyNumber: number;
    role: PlayerRole;
  };
}

export interface GullyBowlingScorecard {
  id: string;
  inningsId: string;
  playerId: string;
  bowlingOrder: number;
  legalBalls: number;
  oversText: string;
  maidens: number;
  runsConceded: number;
  wickets: number;
  economy: number;
  wides: number;
  noBalls: number;
  allocatedOvers: number;
  player: {
    id: string;
    playerName: string;
    jerseyNumber: number;
    role: PlayerRole;
  };
}

export interface GullyDelivery {
  id: string;
  overNumber: number;
  ballNumber: number;
  strikerId: string;
  nonStrikerId?: string | null;
  bowlerId: string;
  batterRuns: number;
  extraRuns: number;
  extraType: ExtraType;
  totalRuns: number;
  isLegalDelivery: boolean;
  isWicket: boolean;
  dismissalType?: DismissalType | null;
  dismissedPlayerId?: string | null;
  fielderId?: string | null;
  createdAt: string;
}

export interface GullyInnings {
  id: string;
  gullyMatchId: string;
  inningsNumber: number;
  roundNumber?: number;
  batterId?: string | null;
  battingTeamName: string;
  bowlingTeamName: string;
  battingTempTeamId?: string | null;
  bowlingTempTeamId?: string | null;
  totalRuns: number;
  wickets: number;
  legalBalls: number;
  oversCompletedText: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'DECLARED';
  targetRuns?: number | null;
  byes: number;
  legByes: number;
  wides: number;
  noBalls: number;
  penaltyRuns: number;
  currentStrikerId?: string | null;
  currentNonStrikerId?: string | null;
  currentBowlerId?: string | null;
  lastBowlerId?: string | null;
  battingScorecards: GullyBattingScorecard[];
  bowlingScorecards: GullyBowlingScorecard[];
  wicketsList: WicketRecord[];
  deliveries: GullyDelivery[];
}

export interface GullySinglesQueueItem {
  order: number;
  playerId: string;
  playerName: string;
  jerseyNumber?: number;
  hasBatted: boolean;
  isCurrentlyBatting: boolean;
  runsScored?: number | null;
  oversFaced?: string | null;
}

export interface GullyRoundLeaderboardItem {
  rank: number;
  inningsId: string;
  inningsNumber: number;
  batterId: string;
  playerName: string;
  jerseyNumber?: number;
  role?: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  notOut: boolean;
  dismissalText?: string | null;
  wicketsLost: number;
  oversFacedText: string;
  status: string;
}

export interface GullyRoundGroup {
  roundNumber: number;
  inningsList: GullyInnings[];
  roundLeaderboard: GullyRoundLeaderboardItem[];
}

export interface GullyCumulativePlayerStats {
  rank: number;
  playerId: string;
  playerName: string;
  jerseyNumber?: number;
  role?: string;
  totalRuns: number;
  totalBalls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  inningsBatted: number;
  highestScore: number;
  totalWickets: number;
  runsConceded: number;
  legalBalls: number;
  oversText: string;
  maidens: number;
  economy: number;
}

export interface GullyMatchDetails {
  id: string;
  registeredTeamId: string;
  matchType: GullyMatchType;
  matchDate: string;
  venue?: string | null;
  status: MatchStatus;
  totalOvers: number;
  playersPerTeam?: number | null;
  bowlingAllocationRule: BowlingAllocationRule;
  singlesDismissalRule?: SinglesDismissalRule | null;
  bowlerOrderRule?: BowlerOrderRule | null;
  selectedBatterId?: string | null;
  selectedBatter?: Player | null;
  draftShuffled: boolean;
  tossWinnerTeamId?: string | null;
  tossDecision?: TossDecision | null;
  currentInningsNumber: number;
  currentRoundNumber?: number;
  singlesBattingOrder?: string | null;
  resultType?: string | null;
  resultDescription?: string | null;
  winnerName?: string | null;
  registeredTeam: {
    id: string;
    teamName: string;
    username: string;
  };
  temporaryTeams: GullyTemporaryTeam[];
  matchPlayers: GullyMatchPlayer[];
  innings: GullyInnings[];
  rounds?: GullyRoundGroup[];
  cumulativeLeaderboard?: GullyCumulativePlayerStats[];
  singlesQueue?: GullySinglesQueueItem[];
  isRoundComplete?: boolean;
}

export interface PlayerGullyProfileData {
  player: {
    id: string;
    playerName: string;
    jerseyNumber: number;
    role: PlayerRole;
    teamId: string;
    teamName: string;
  };
  gullyBattingStats: {
    matchesPlayed: number;
    inningsBatted: number;
    totalRuns: number;
    highestScore: string;
    battingAverage: number | null;
    strikeRate: number;
    ballsFaced: number;
    fours: number;
    sixes: number;
    notOuts: number;
    centuries: number;
    halfCenturies: number;
    ducks: number;
  };
  gullyBowlingStats: {
    bowlingInnings: number;
    totalWickets: number;
    oversBowled: string;
    legalBalls: number;
    runsConceded: number;
    bowlingAverage: number | null;
    economyRate: number;
    bestBowling: string;
    maidens: number;
  };
  teamMatchBreakdown: {
    matches: number;
    runs: number;
    highestScore: string;
    battingAverage: number | null;
    strikeRate: number;
    wickets: number;
    bowlingAverage: number | null;
    economy: number;
  };
  singlesMatchBreakdown: {
    matchesAsBatter: number;
    runsAsBatter: number;
    highestScore: string;
    strikeRate: number;
    matchesAsBowler: number;
    wicketsAsBowler: number;
    bowlingAverage: number | null;
    economy: number;
  };
  matchHistory: {
    matchId: string;
    matchDate: string;
    matchType: GullyMatchType;
    opponent: string;
    runsScored: number;
    ballsFaced: number;
    wicketsTaken: number;
    oversBowled: string;
    resultDescription?: string | null;
  }[];
}

export interface TeamGullyStatsData {
  totalMatches: number;
  teamMatchesCount: number;
  singlesMatchesCount: number;
  totalRunsScored: number;
  highestScore: number;
}

