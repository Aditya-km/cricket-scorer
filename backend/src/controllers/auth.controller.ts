import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';
import * as authService from '../services/auth.service.js';

export async function register(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const validated = registerSchema.parse(req.body);
    const result = await authService.registerTeam(validated);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function login(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const validated = loginSchema.parse(req.body);
    const result = await authService.loginTeam(validated);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.team) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const dashboard = await authService.getTeamDashboard(req.team.teamId);
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
}

export async function getOpponents(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const currentTeamId = req.team?.teamId || '';
    const opponents = await authService.getAllOpponentTeams(currentTeamId);
    res.json(opponents);
  } catch (error) {
    next(error);
  }
}
