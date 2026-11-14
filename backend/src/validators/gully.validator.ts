import { z } from 'zod';

export const createGullyTeamMatchSchema = z.object({
  venue: z.string().optional().nullable(),
  matchDate: z.string().optional(),
  totalOvers: z.number().int().min(1).max(50),
  bowlingAllocationRule: z.enum(['EXACT', 'MAX_LIMIT']).default('MAX_LIMIT'),
  teamA: z.object({
    teamName: z.string().min(1, 'Team A name is required'),
    playerIds: z.array(z.string().uuid()).min(1, 'Team A must have at least 1 player'),
    captainPlayerId: z.string().uuid().optional().nullable(),
    bowlingAllocations: z
      .array(
        z.object({
          playerId: z.string().uuid(),
          allocatedOvers: z.number().int().min(1),
        })
      )
      .optional(),
  }),
  teamB: z.object({
    teamName: z.string().min(1, 'Team B name is required'),
    playerIds: z.array(z.string().uuid()).min(1, 'Team B must have at least 1 player'),
    captainPlayerId: z.string().uuid().optional().nullable(),
    bowlingAllocations: z
      .array(
        z.object({
          playerId: z.string().uuid(),
          allocatedOvers: z.number().int().min(1),
        })
      )
      .optional(),
  }),
  toss: z
    .object({
      tossWinnerTeam: z.enum(['teamA', 'teamB']),
      tossDecision: z.enum(['BAT', 'BOWL']),
    })
    .optional(),
  openingPlayers: z
    .object({
      strikerId: z.string().uuid(),
      nonStrikerId: z.string().uuid(),
      bowlerId: z.string().uuid(),
    })
    .optional(),
});

export const createGullySinglesMatchSchema = z.object({
  venue: z.string().optional().nullable(),
  matchDate: z.string().optional(),
  totalOvers: z.number().int().min(1).max(50).default(2),
  selectedBatterId: z.string().uuid().optional(),
  battingOrderPlayerIds: z.array(z.string().uuid()).min(2, 'At least 2 participating players required').optional(),
  draftShuffled: z.boolean().default(false),
  bowlerPlayerIds: z.array(z.string().uuid()).optional(),
  bowlingAllocations: z
    .array(
      z.object({
        playerId: z.string().uuid(),
        allocatedOvers: z.number().int().min(1),
      })
    )
    .optional(),
  bowlingAllocationRule: z.enum(['EXACT', 'MAX_LIMIT']).default('MAX_LIMIT'),
  singlesDismissalRule: z.enum(['LAST_WICKET_ENDS_INNINGS', 'BATTER_CONTINUES']).default('LAST_WICKET_ENDS_INNINGS'),
  bowlerOrderRule: z.enum(['FREE_SELECTION', 'PREDEFINED_ORDER']).default('FREE_SELECTION'),
  openingBowlerId: z.string().uuid().optional(),
});

export const singlesNextBatterSchema = z.object({
  openingBowlerId: z.string().uuid().optional(),
});

export const gullyDraftSchema = z.object({
  playerIds: z.array(z.string().uuid()).min(2, 'At least 2 players are needed for a draft'),
});

export const gullyTossSchema = z.object({
  tossWinnerTeamId: z.string().uuid(),
  tossDecision: z.enum(['BAT', 'BOWL']),
});

export const gullyOpeningPlayersSchema = z.object({
  strikerId: z.string().uuid(),
  nonStrikerId: z.string().uuid().optional().nullable(),
  bowlerId: z.string().uuid(),
  inningsNumber: z.number().int().optional(),
});

export const gullyScoreDeliverySchema = z.object({
  batterRuns: z.number().int().min(0).max(6).default(0),
  extraType: z.enum(['NONE', 'WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY']).default('NONE'),
  extraRuns: z.number().int().min(0).default(0),
  isWicket: z.boolean().default(false),
  dismissalType: z
    .enum([
      'BOWLED',
      'CAUGHT',
      'LBW',
      'RUN_OUT',
      'STUMPED',
      'HIT_WICKET',
      'RETIRED_OUT',
      'OBSTRUCTING_FIELD',
    ])
    .optional()
    .nullable(),
  dismissedPlayerId: z.string().uuid().optional().nullable(),
  fielderId: z.string().uuid().optional().nullable(),
  incomingBatterId: z.string().uuid().optional().nullable(),
  runsCompletedBeforeDismissal: z.number().int().min(0).default(0),
});

export const gullyChangeBowlerSchema = z.object({
  bowlerId: z.string().uuid(),
});
