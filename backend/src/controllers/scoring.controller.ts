import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { scoreDeliverySchema, changeBowlerSchema } from '../validators/scoring.validator.js';
import * as scoringService from '../services/scoring.service.js';
import { getMatchDetails } from '../services/match.service.js';
import { broadcastMatchUpdate } from '../sockets/matchSocket.js';

export async function scoreDelivery(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const validated = scoreDeliverySchema.parse(req.body);
    const result = await scoringService.scoreDelivery(matchId, validated);

    // Fetch fresh match details and broadcast
    const freshMatch = await getMatchDetails(matchId);
    broadcastMatchUpdate(matchId, freshMatch);

    res.json({ ...result, match: freshMatch });
  } catch (error) {
    next(error);
  }
}

export async function changeBowler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const validated = changeBowlerSchema.parse(req.body);
    const result = await scoringService.changeBowler(matchId, validated.bowlerId);

    const freshMatch = await getMatchDetails(matchId);
    broadcastMatchUpdate(matchId, freshMatch);

    res.json({ ...result, match: freshMatch });
  } catch (error) {
    next(error);
  }
}

export async function undoLastDelivery(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const result = await scoringService.undoLastDelivery(matchId);

    const freshMatch = await getMatchDetails(matchId);
    broadcastMatchUpdate(matchId, freshMatch);

    res.json({ ...result, match: freshMatch });
  } catch (error) {
    next(error);
  }
}
