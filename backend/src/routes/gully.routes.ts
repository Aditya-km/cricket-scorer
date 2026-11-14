import { Router } from 'express';
import * as gullyController from '../controllers/gully.controller.js';
import { authenticate, requireTeam } from '../middleware/auth.js';

const router = Router();

// All Gully routes require authenticated registered team
router.use(authenticate, requireTeam);

// Match creation & listing
router.post('/matches/team', gullyController.createTeamMatch);
router.post('/matches/singles', gullyController.createSinglesMatch);
router.post('/draft', gullyController.performGullyDraft);
router.get('/matches', gullyController.listMatches);
router.get('/matches/:id', gullyController.getMatch);
router.delete('/matches/:id', gullyController.deleteMatch);

// Match lifecycle & scoring
router.post('/matches/:id/toss', gullyController.conductToss);
router.post('/matches/:id/opening-players', gullyController.selectOpeningPlayers);
router.post('/matches/:id/score', gullyController.scoreDelivery);
router.post('/matches/:id/bowler', gullyController.changeBowler);
router.post('/matches/:id/undo', gullyController.undoLastDelivery);
router.post('/matches/:id/end', gullyController.endMatch);
router.post('/matches/:id/singles/next-batter', gullyController.startNextSinglesBatter);
router.post('/matches/:id/singles/next-round', gullyController.startNextSinglesRound);

// Gully Statistics
router.get('/stats/players/:id', gullyController.getPlayerGullyProfile);
router.get('/stats/team', gullyController.getTeamGullyStats);

export default router;
