import { z } from 'zod';
import { MatchFormat, TossDecision } from '@prisma/client';

export const createMatchSchema = z.object({
  format: z.nativeEnum(MatchFormat, { errorMap: () => ({ message: 'Invalid match format' }) }),
  teamAId: z.string().optional(),
  teamBId: z.string().optional(),
  opponentTeamId: z.string().optional(),
  matchDate: z.string().datetime({ offset: true }).or(z.string().min(10)),
  venue: z.string().max(100).optional().nullable()
}).refine(data => {
  const teamA = data.teamAId;
  const teamB = data.teamBId || data.opponentTeamId;
  return !!teamA && !!teamB && teamA !== teamB;
}, {
  message: 'Team A and Team B are both required and cannot be the same team',
  path: ['teamBId']
});

export const playingXISchema = z.object({
  teamAPlayingXI: z.array(z.string()).min(2, 'At least 2 players required for casual match').max(11, 'Maximum 11 players'),
  teamBPlayingXI: z.array(z.string()).min(2, 'At least 2 players required for casual match').max(11, 'Maximum 11 players')
});

export const tossSchema = z.object({
  tossWinnerId: z.string().min(1, 'Toss winner is required'),
  tossDecision: z.nativeEnum(TossDecision, { errorMap: () => ({ message: 'Decision must be BAT or BOWL' }) })
});

export const openingPlayersSchema = z.object({
  strikerId: z.string().min(1, 'Striker is required'),
  nonStrikerId: z.string().min(1, 'Non-striker is required'),
  bowlerId: z.string().min(1, 'Opening bowler is required'),
  inningsNumber: z.number().int().positive().optional(),
}).refine(data => data.strikerId !== data.nonStrikerId, {
  message: 'Striker and non-striker must be different players',
  path: ['nonStrikerId']
});
