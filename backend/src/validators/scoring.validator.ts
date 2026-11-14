import { z } from 'zod';
import { ExtraType, DismissalType } from '@prisma/client';

export const scoreDeliverySchema = z.object({
  batterRuns: z.number().int().min(0).max(6).default(0),
  extraType: z.nativeEnum(ExtraType).default(ExtraType.NONE),
  extraRuns: z.number().int().min(0).max(7).default(0),
  isWicket: z.boolean().default(false),
  dismissalType: z.nativeEnum(DismissalType).optional().nullable(),
  dismissedPlayerId: z.string().optional().nullable(),
  fielderId: z.string().optional().nullable(),
  incomingBatterId: z.string().optional().nullable(),
  runsCompletedBeforeDismissal: z.number().int().min(0).max(6).default(0)
});

export const changeBowlerSchema = z.object({
  bowlerId: z.string().min(1, 'Bowler ID is required')
});
