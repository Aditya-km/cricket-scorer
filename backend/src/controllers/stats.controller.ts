import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import * as statsService from '../services/stats.service.js';

export async function getPlayerProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const playerId = req.params.id;
    const profile = await statsService.getPlayerProfile(playerId);
    res.json(profile);
  } catch (error) {
    next(error);
  }
}

export async function getTeamStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const teamId = req.params.teamId || req.team!.teamId;
    const stats = await statsService.getTeamStatistics(teamId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
}
