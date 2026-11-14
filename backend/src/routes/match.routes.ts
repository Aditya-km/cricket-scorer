import { Router } from 'express';
import * as matchController from '../controllers/match.controller.js';
import * as scoringController from '../controllers/scoring.controller.js';
import * as testMatchController from '../controllers/testMatch.controller.js';
import * as pdfController from '../controllers/pdf.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Matches listing & creation
router.get('/', authenticate, matchController.listMatches);
router.post('/', authenticate, requireAdmin, matchController.createMatch);
router.get('/:id', matchController.getMatch);
router.delete('/:id', authenticate, matchController.deleteMatch);

// Match Setup
router.post('/:id/playing-xi', authenticate, matchController.setupPlayingXI);
router.post('/:id/toss', authenticate, matchController.conductToss);
router.post('/:id/opening-players', authenticate, matchController.selectOpeningPlayers);

// Scoring actions
router.post('/:id/score', authenticate, scoringController.scoreDelivery);
router.post('/:id/bowler', authenticate, scoringController.changeBowler);
router.post('/:id/undo', authenticate, scoringController.undoLastDelivery);

// Test Match actions
router.get('/:id/test-status', testMatchController.getTestStatus);
router.post('/:id/session', authenticate, testMatchController.advanceSession);
router.post('/:id/day', authenticate, testMatchController.advanceDay);
router.post('/:id/follow-on', authenticate, testMatchController.handleFollowOn);
router.post('/:id/declare', authenticate, testMatchController.declareInnings);

// Scorecard PDF Export
router.get('/:id/pdf', pdfController.downloadMatchPdf);

export default router;
