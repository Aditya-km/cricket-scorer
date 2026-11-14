import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import {
  createMatchSchema,
  playingXISchema,
  tossSchema,
  openingPlayersSchema,
} from '../validators/match.validator.js';
import * as matchService from '../services/match.service.js';
import { broadcastMatchUpdate } from '../sockets/matchSocket.js';
import { MatchFormat, MatchStatus } from '@prisma/client';

export async function createMatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (req.team?.role !== 'ADMIN') {
      res.status(403).json({ message: 'Access denied: Only administrators can create matches' });
      return;
    }
    const validated = createMatchSchema.parse(req.body);
    const teamAId = (validated.teamAId || req.team.teamId)!;
    const teamBId = (validated.teamBId || validated.opponentTeamId)!;

    const match = await matchService.createMatch({
      format: validated.format,
      teamAId,
      teamBId,
      matchDate: validated.matchDate,
      venue: validated.venue,
    });
    res.status(201).json(match);
  } catch (error) {
    next(error);
  }
}

export async function getMatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const match = await matchService.getMatchDetails(matchId);
    res.json(match);
  } catch (error) {
    next(error);
  }
}

export async function setupPlayingXI(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const validated = playingXISchema.parse(req.body);
    const result = await matchService.setupPlayingXI(
      matchId,
      validated.teamAPlayingXI,
      validated.teamBPlayingXI
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function conductToss(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const validated = tossSchema.parse(req.body);
    const result = await matchService.conductToss(matchId, validated);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function selectOpeningPlayers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const validated = openingPlayersSchema.parse(req.body);
    const inningsNumber = req.body.inningsNumber ? Number(req.body.inningsNumber) : undefined;
    const result = await matchService.selectOpeningPlayers(matchId, {
      ...validated,
      inningsNumber,
    });
    const freshMatch = await matchService.getMatchDetails(matchId);
    broadcastMatchUpdate(matchId, freshMatch);
    res.json({ ...result, match: freshMatch });
  } catch (error) {
    next(error);
  }
}

export async function listMatches(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const teamId = req.team!.teamId;
    const format = req.query.format as MatchFormat | undefined;
    const status = req.query.status as MatchStatus | undefined;
    const isAdmin = req.team?.role === 'ADMIN';

    const matches = await matchService.getTeamMatches(teamId, { format, status }, isAdmin);
    res.json(matches);
  } catch (error) {
    next(error);
  }
}

export async function deleteMatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const teamId = req.team?.teamId;
    const isAdmin = req.team?.role === 'ADMIN';

    const result = await matchService.deleteMatch(matchId, teamId, isAdmin);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
