import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { playerSchema } from '../validators/squad.validator.js';
import * as squadService from '../services/squad.service.js';
import { PlayerRole } from '@prisma/client';

export async function addPlayer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const teamId = req.team!.teamId;
    const validated = playerSchema.parse(req.body);
    const player = await squadService.addPlayer(teamId, validated);
    res.status(201).json(player);
  } catch (error) {
    next(error);
  }
}

export async function updatePlayer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const teamId = req.team!.teamId;
    const playerId = req.params.id;
    const validated = playerSchema.parse(req.body);
    const updated = await squadService.updatePlayer(teamId, playerId, validated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function deletePlayer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const teamId = req.team!.teamId;
    const playerId = req.params.id;
    const result = await squadService.deletePlayer(teamId, playerId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getSquad(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    let teamId = req.team!.teamId;
    if (req.team?.role === 'ADMIN' && req.query.teamId) {
      teamId = String(req.query.teamId);
    }
    const role = req.query.role as PlayerRole | undefined;
    const search = req.query.search as string | undefined;

    const squad = await squadService.getTeamSquad(teamId, { role, search });
    res.json(squad);
  } catch (error) {
    next(error);
  }
}
