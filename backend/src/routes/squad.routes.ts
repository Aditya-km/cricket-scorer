import { Router } from 'express';
import * as squadController from '../controllers/squad.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, squadController.getSquad);
router.post('/', authenticate, squadController.addPlayer);
router.put('/:id', authenticate, squadController.updatePlayer);
router.delete('/:id', authenticate, squadController.deletePlayer);

export default router;
