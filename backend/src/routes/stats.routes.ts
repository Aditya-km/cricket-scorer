import { Router } from 'express';
import * as statsController from '../controllers/stats.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/players/:id', statsController.getPlayerProfile);
router.get('/teams/:teamId', statsController.getTeamStats);

export default router;
