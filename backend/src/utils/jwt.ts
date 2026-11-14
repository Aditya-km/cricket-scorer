import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'cricket_scorer_super_secure_jwt_secret_key_2026';

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
