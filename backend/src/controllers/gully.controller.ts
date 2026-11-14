import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import * as gullyService from '../services/gullyMatch.service.js';
import * as gullyScoringService from '../services/gullyScoring.service.js';
import * as gullyStatsService from '../services/gullyStats.service.js';
import {
  createGullyTeamMatchSchema,
  createGullySinglesMatchSchema,
  gullyDraftSchema,
  gullyTossSchema,
  gullyOpeningPlayersSchema,
  gullyScoreDeliverySchema,
  gullyChangeBowlerSchema,
  singlesNextBatterSchema,
} from '../validators/gully.validator.js';
import { broadcastMatchUpdate } from '../sockets/matchSocket.js';
import { GullyMatchType, MatchStatus } from '@prisma/client';

export async function createTeamMatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.team?.role !== 'TEAM') {
      res.status(403).json({ message: 'Access denied: Only registered teams can create Gully matches' });
      return;
    }

    const validated = createGullyTeamMatchSchema.parse(req.body);
    const match = await gullyService.createTeamMatch(req.team.teamId, validated);
    res.status(201).json(match);
  } catch (error) {
    next(error);
  }
}

export async function createSinglesMatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.team?.role !== 'TEAM') {
      res.status(403).json({ message: 'Access denied: Only registered teams can create Gully matches' });
      return;
    }

    const validated = createGullySinglesMatchSchema.parse(req.body);
    const match = await gullyService.createSinglesMatch(req.team.teamId, validated);
    res.status(201).json(match);
  } catch (error) {
    next(error);
  }
}

export async function performGullyDraft(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.team?.role !== 'TEAM') {
      res.status(403).json({ message: 'Access denied: Only registered teams can use Gully Draft' });
      return;
    }

    const validated = gullyDraftSchema.parse(req.body);
    const result = await gullyService.performGullyDraft(req.team.teamId, validated.playerIds);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getMatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const match = await gullyService.getGullyMatchDetails(matchId);

    // Permission check: only owning team can access
    if (req.team?.role === 'ADMIN' || match.registeredTeamId !== req.team?.teamId) {
      res.status(403).json({ message: 'Access denied: You do not have permission to view this Gully match' });
      return;
    }

    res.json(match);
  } catch (error) {
    next(error);
  }
}

export async function listMatches(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.team?.role !== 'TEAM') {
      res.status(403).json({ message: 'Access denied: Gully matches are only accessible to team accounts' });
      return;
    }

    const matchType = req.query.matchType as GullyMatchType | undefined;
    const status = req.query.status as MatchStatus | undefined;

    const matches = await gullyService.listGullyMatches(req.team.teamId, { matchType, status });
    res.json(matches);
  } catch (error) {
    next(error);
  }
}

export async function conductToss(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.team?.role !== 'TEAM') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const matchId = req.params.id;
    const validated = gullyTossSchema.parse(req.body);
    const match = await gullyService.conductGullyToss(matchId, req.team.teamId, validated);
    broadcastMatchUpdate(matchId, match);
    res.json(match);
  } catch (error) {
    next(error);
  }
}

export async function selectOpeningPlayers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.team?.role !== 'TEAM') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const matchId = req.params.id;
    const validated = gullyOpeningPlayersSchema.parse(req.body);
    const match = await gullyService.selectGullyOpeningPlayers(matchId, req.team.teamId, validated);
    broadcastMatchUpdate(matchId, match);
    res.json(match);
  } catch (error) {
    next(error);
  }
}

export async function scoreDelivery(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.team?.role !== 'TEAM') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const matchId = req.params.id;
    const validated = gullyScoreDeliverySchema.parse(req.body);
    const result = await gullyScoringService.scoreGullyDelivery(matchId, req.team.teamId, validated);
    const freshMatch = await gullyService.getGullyMatchDetails(matchId);
    broadcastMatchUpdate(matchId, freshMatch);
    res.json({ ...result, match: freshMatch });
  } catch (error) {
    next(error);
  }
}

export async function changeBowler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.team?.role !== 'TEAM') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const matchId = req.params.id;
    const validated = gullyChangeBowlerSchema.parse(req.body);
    await gullyScoringService.changeGullyBowler(matchId, req.team.teamId, validated.bowlerId);
    const freshMatch = await gullyService.getGullyMatchDetails(matchId);
    broadcastMatchUpdate(matchId, freshMatch);
    res.json(freshMatch);
  } catch (error) {
    next(error);
  }
}

export async function undoLastDelivery(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.team?.role !== 'TEAM') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const matchId = req.params.id;
    const result = await gullyScoringService.undoLastGullyDelivery(matchId, req.team.teamId);
    const freshMatch = await gullyService.getGullyMatchDetails(matchId);
    broadcastMatchUpdate(matchId, freshMatch);
    res.json({ ...result, match: freshMatch });
  } catch (error) {
    next(error);
  }
}

export async function getPlayerGullyProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.team?.role !== 'TEAM') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const playerId = req.params.id;
    const profile = await gullyStatsService.getPlayerGullyProfile(playerId, req.team.teamId);
    res.json(profile);
  } catch (error) {
    next(error);
  }
}

export async function getTeamGullyStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.team?.role !== 'TEAM') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const stats = await gullyStatsService.getTeamGullyStatistics(req.team.teamId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
}

export async function endMatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.team?.role !== 'TEAM') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const matchId = req.params.id;
    const match = await gullyService.endGullyMatch(matchId, req.team.teamId);
    broadcastMatchUpdate(matchId, match);
    res.json(match);
  } catch (error) {
    next(error);
  }
}

export async function startNextSinglesBatter(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.team?.role !== 'TEAM') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const matchId = req.params.id;
    const validated = singlesNextBatterSchema.parse(req.body);
    const match = await gullyService.startNextSinglesBatter(matchId, req.team.teamId, validated);
    broadcastMatchUpdate(matchId, match);
    res.json(match);
  } catch (error) {
    next(error);
  }
}

export async function startNextSinglesRound(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.team?.role !== 'TEAM') {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const matchId = req.params.id;
    const match = await gullyService.startNextSinglesRound(matchId, req.team.teamId);
    broadcastMatchUpdate(matchId, match);
    res.json(match);
  } catch (error) {
    next(error);
  }
}

export async function deleteMatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.team) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const matchId = req.params.id;
    const result = await gullyService.deleteGullyMatch(matchId, req.team.teamId, req.team.role);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
