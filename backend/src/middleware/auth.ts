import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { verifyToken } from '../utils/jwt.js';

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyToken(token);
    req.team = payload;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.team) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  if (req.team.role !== 'ADMIN') {
    res.status(403).json({ message: 'Access denied: Administrator privileges required' });
    return;
  }

  next();
}

export function requireTeam(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.team) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  if (req.team.role !== 'TEAM') {
    res.status(403).json({ message: 'Access denied: Team privileges required' });
    return;
  }

  next();
}

export function optionalAuthenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = verifyToken(token);
      req.team = payload;
    } catch {
      // Ignore invalid token in optional auth
    }
  }
  next();
}
