import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Protect all admin routes with authentication and requireAdmin middleware
router.use(authenticate, requireAdmin);

router.get('/dashboard', adminController.getDashboard);
router.get('/teams', adminController.getAllTeams);
router.get('/teams/:id', adminController.getTeamDetails);
router.patch('/teams/:id/status', adminController.updateTeamStatus);
router.get('/matches', adminController.getAllMatches);
router.put('/matches/:id', adminController.updateMatchDetails);
router.delete('/matches/:id', adminController.cancelMatch);
router.delete('/matches/:id/permanent', adminController.deleteMatchPermanent);

export default router;
