import {
  GullyMatchType,
  BowlingAllocationRule,
  SinglesDismissalRule,
  BowlerOrderRule,
  MatchStatus,
  TossDecision,
  DismissalType,
  ExtraType,
} from '@prisma/client';

export interface GullyScoreDeliveryDto {
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

export interface CreateGullyTeamMatchDto {
  venue?: string | null;
  matchDate?: string;
  totalOvers: number;
  bowlingAllocationRule: BowlingAllocationRule;
  teamA: {
    teamName: string;
    playerIds: string[];
    captainPlayerId?: string | null;
    bowlingAllocations?: { playerId: string; allocatedOvers: number }[];
  };
  teamB: {
    teamName: string;
    playerIds: string[];
    captainPlayerId?: string | null;
    bowlingAllocations?: { playerId: string; allocatedOvers: number }[];
  };
  toss?: {
    tossWinnerTeam: 'teamA' | 'teamB';
    tossDecision: TossDecision;
  };
  openingPlayers?: {
    strikerId: string;
    nonStrikerId: string;
    bowlerId: string;
  };
}

export interface CreateGullySinglesMatchDto {
  venue?: string | null;
  matchDate?: string;
  totalOvers: number;
  selectedBatterId?: string;
  battingOrderPlayerIds?: string[];
  draftShuffled?: boolean;
  bowlerPlayerIds?: string[];
  bowlingAllocations?: { playerId: string; allocatedOvers: number }[];
  bowlingAllocationRule?: BowlingAllocationRule;
  singlesDismissalRule: SinglesDismissalRule;
  bowlerOrderRule: BowlerOrderRule;
  openingBowlerId?: string;
}
