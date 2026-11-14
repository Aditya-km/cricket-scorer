import { z } from 'zod';
import { PlayerRole } from '@prisma/client';

export const playerSchema = z.object({
  playerName: z.string().min(2, 'Player name must be at least 2 characters').max(50),
  jerseyNumber: z.coerce.number().int().min(1, 'Jersey number must be at least 1').max(999, 'Jersey number cannot exceed 999'),
  role: z.nativeEnum(PlayerRole, { errorMap: () => ({ message: 'Invalid player role' }) })
});
