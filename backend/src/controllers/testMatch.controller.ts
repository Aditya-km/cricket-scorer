import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import * as testMatchService from '../services/testMatch.service.js';
import { getMatchDetails } from '../services/match.service.js';
import { broadcastMatchUpdate } from '../sockets/matchSocket.js';

export async function getTestStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const status = await testMatchService.calculateTestMatchStatus(matchId);
    res.json(status);
  } catch (error) {
    next(error);
  }
}

export async function advanceSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const result = await testMatchService.advanceSession(matchId);
    const freshMatch = await getMatchDetails(matchId);
    broadcastMatchUpdate(matchId, freshMatch);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function advanceDay(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const result = await testMatchService.advanceDay(matchId);
    const freshMatch = await getMatchDetails(matchId);
    broadcastMatchUpdate(matchId, freshMatch);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleFollowOn(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const enforce = !!req.body.enforce;
    const result = await testMatchService.handleFollowOn(matchId, enforce);
    const freshMatch = await getMatchDetails(matchId);
    broadcastMatchUpdate(matchId, freshMatch);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function declareInnings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const result = await testMatchService.declareInnings(matchId);
    const freshMatch = await getMatchDetails(matchId);
    broadcastMatchUpdate(matchId, freshMatch);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
