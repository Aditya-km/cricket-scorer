import { Router } from 'express';
import authRoutes from './auth.routes.js';
import squadRoutes from './squad.routes.js';
import matchRoutes from './match.routes.js';
import statsRoutes from './stats.routes.js';
import adminRoutes from './admin.routes.js';
import gullyRoutes from './gully.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/squad', squadRoutes);
router.use('/matches', matchRoutes);
router.use('/stats', statsRoutes);
router.use('/admin', adminRoutes);
router.use('/gully', gullyRoutes);

export default router;
