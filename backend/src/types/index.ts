import { Request } from 'express';
import { PlayerRole, MatchFormat, TossDecision, DismissalType, ExtraType, MatchStatus, MatchResultType, UserRole } from '@prisma/client';

export interface JwtPayload {
  teamId: string;
  username: string;
  teamName: string;
  role: UserRole;
  isActive?: boolean;
}

export interface AuthenticatedRequest extends Request {
  team?: JwtPayload;
}

export interface ScoreDeliveryDto {
  batterRuns: number; // 0-6
  extraType: ExtraType; // NONE, WIDE, NO_BALL, BYE, LEG_BYE, PENALTY
  extraRuns?: number; // completed runs for bye/legbye/wide or penalty runs
  isWicket?: boolean;
  dismissalType?: DismissalType | null;
  dismissedPlayerId?: string | null;
  fielderId?: string | null;
  incomingBatterId?: string | null;
  runsCompletedBeforeDismissal?: number;
}
