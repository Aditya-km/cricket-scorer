import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import * as adminService from '../services/admin.service.js';
import { MatchFormat, MatchStatus } from '@prisma/client';

export async function getDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await adminService.getAdminDashboard();
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function getAllTeams(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const teams = await adminService.getAllTeams();
    res.json(teams);
  } catch (error) {
    next(error);
  }
}

export async function getTeamDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const teamId = req.params.id;
    const team = await adminService.getTeamDetails(teamId);
    res.json(team);
  } catch (error) {
    next(error);
  }
}

export async function updateTeamStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const teamId = req.params.id;
    const isActive = !!req.body.isActive;
    const updated = await adminService.updateTeamStatus(teamId, isActive);
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function getAllMatches(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const status = req.query.status as MatchStatus | undefined;
    const format = req.query.format as MatchFormat | undefined;
    const matches = await adminService.getAllMatches({ status, format });
    res.json(matches);
  } catch (error) {
    next(error);
  }
}

export async function updateMatchDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const updated = await adminService.updateMatchDetails(matchId, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function cancelMatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const result = await adminService.cancelMatch(matchId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteMatchPermanent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const result = await adminService.deleteMatchPermanent(matchId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
