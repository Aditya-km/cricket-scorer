import { MatchFormat, TossDecision, MatchStatus } from '@prisma/client';
import { prisma } from '../config/db.js';

export async function createMatch(
  arg1:
    | string
    | {
        format: MatchFormat;
        teamAId?: string;
        teamBId?: string;
        opponentTeamId?: string;
        matchDate: string;
        venue?: string | null;
      },
  arg2?: {
    format: MatchFormat;
    teamBId?: string;
    opponentTeamId?: string;
    matchDate: string;
    venue?: string | null;
  }
) {
  let format: MatchFormat;
  let teamAId: string;
  let teamBId: string;
  let matchDate: string;
  let venue: string | null | undefined;

  if (typeof arg1 === 'string') {
    teamAId = arg1;
    format = arg2!.format;
    teamBId = (arg2!.teamBId || arg2!.opponentTeamId)!;
    matchDate = arg2!.matchDate;
    venue = arg2!.venue;
  } else {
    teamAId = arg1.teamAId!;
    teamBId = (arg1.teamBId || arg1.opponentTeamId)!;
    format = arg1.format;
    matchDate = arg1.matchDate;
    venue = arg1.venue;
  }

  if (!teamAId || !teamBId) {
    throw { statusCode: 400, message: 'Both Team A and Team B are required' };
  }

  if (teamAId === teamBId) {
    throw { statusCode: 400, message: 'A team cannot play against itself' };
  }

  const teamA = await prisma.team.findUnique({
    where: { id: teamAId },
  });
  if (!teamA || !teamA.isActive) {
    throw { statusCode: 404, message: 'Team A not found or is inactive' };
  }

  const teamB = await prisma.team.findUnique({
    where: { id: teamBId },
  });
  if (!teamB || !teamB.isActive) {
    throw { statusCode: 404, message: 'Team B not found or is inactive' };
  }

  return prisma.match.create({
    data: {
      format,
      teamAId,
      teamBId,
      matchDate: new Date(matchDate),
      venue: venue?.trim() || null,
      status: MatchStatus.UPCOMING,
    },
    include: {
      teamA: { select: { id: true, teamName: true } },
      teamB: { select: { id: true, teamName: true } },
    },
  });
}

export async function getMatchDetails(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: {
        select: {
          id: true,
          teamName: true,
          players: { select: { id: true, playerName: true, jerseyNumber: true, role: true } },
        },
      },
      teamB: {
        select: {
          id: true,
          teamName: true,
          players: { select: { id: true, playerName: true, jerseyNumber: true, role: true } },
        },
      },
      matchPlayers: {
        include: {
          player: { select: { id: true, playerName: true, jerseyNumber: true, role: true, teamId: true } },
        },
      },
      innings: {
        orderBy: { inningsNumber: 'asc' },
        include: {
          battingScorecards: {
            orderBy: { battingOrder: 'asc' },
            include: { player: { select: { id: true, playerName: true, jerseyNumber: true, role: true } } },
          },
          bowlingScorecards: {
            orderBy: { bowlingOrder: 'asc' },
            include: { player: { select: { id: true, playerName: true, jerseyNumber: true, role: true } } },
          },
          wicketsList: {
            orderBy: { wicketNumber: 'asc' },
            include: {
              player: { select: { id: true, playerName: true } },
              bowler: { select: { id: true, playerName: true } },
              fielder: { select: { id: true, playerName: true } },
            },
          },
          deliveries: {
            orderBy: { createdAt: 'desc' },
            take: 20, // for recent ball display
          },
        },
      },
      sessions: {
        orderBy: [{ dayNumber: 'asc' }, { sessionNumber: 'asc' }],
      },
    },
  });

  if (!match) {
    throw { statusCode: 404, message: 'Match not found' };
  }

  return match;
}

export async function setupPlayingXI(matchId: string, teamAPlayerIds: string[], teamBPlayerIds: string[]) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });
  if (!match) {
    throw { statusCode: 404, message: 'Match not found' };
  }

  // Validate Team A players belong to Team A
  const teamAPlayers = await prisma.player.findMany({
    where: { id: { in: teamAPlayerIds }, teamId: match.teamAId },
  });
  if (teamAPlayers.length !== teamAPlayerIds.length) {
    throw { statusCode: 400, message: 'Invalid player selection for Team A' };
  }

  // Validate Team B players belong to Team B
  const teamBPlayers = await prisma.player.findMany({
    where: { id: { in: teamBPlayerIds }, teamId: match.teamBId },
  });
  if (teamBPlayers.length !== teamBPlayerIds.length) {
    throw { statusCode: 400, message: 'Invalid player selection for Team B' };
  }

  // Transactionally save Playing XIs
  await prisma.$transaction([
    prisma.matchPlayer.deleteMany({ where: { matchId } }),
    prisma.matchPlayer.createMany({
      data: [
        ...teamAPlayerIds.map(playerId => ({
          matchId,
          playerId,
          teamId: match.teamAId,
          isPlayingXI: true,
        })),
        ...teamBPlayerIds.map(playerId => ({
          matchId,
          playerId,
          teamId: match.teamBId,
          isPlayingXI: true,
        })),
      ],
    }),
  ]);

  return { message: 'Playing XI saved successfully' };
}

export async function conductToss(matchId: string, data: {
  tossWinnerId: string;
  tossDecision: TossDecision;
}) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });
  if (!match) {
    throw { statusCode: 404, message: 'Match not found' };
  }

  if (data.tossWinnerId !== match.teamAId && data.tossWinnerId !== match.teamBId) {
    throw { statusCode: 400, message: 'Toss winner must be one of the participating teams' };
  }

  // Determine first batting team
  let firstBattingTeamId = data.tossWinnerId;
  let firstBowlingTeamId = data.tossWinnerId === match.teamAId ? match.teamBId : match.teamAId;

  if (data.tossDecision === 'BOWL') {
    firstBattingTeamId = data.tossWinnerId === match.teamAId ? match.teamBId : match.teamAId;
    firstBowlingTeamId = data.tossWinnerId;
  }

  await prisma.$transaction(async tx => {
    await tx.match.update({
      where: { id: matchId },
      data: {
        tossWinnerId: data.tossWinnerId,
        tossDecision: data.tossDecision,
        status: MatchStatus.LIVE,
      },
    });

    // Create 1st innings if not already existing
    const existingInnings = await tx.innings.findUnique({
      where: { matchId_inningsNumber: { matchId, inningsNumber: 1 } },
    });

    if (!existingInnings) {
      await tx.innings.create({
        data: {
          matchId,
          inningsNumber: 1,
          battingTeamId: firstBattingTeamId,
          bowlingTeamId: firstBowlingTeamId,
        },
      });
    }
  });

  return {
    firstBattingTeamId,
    firstBowlingTeamId,
  };
}

export async function selectOpeningPlayers(matchId: string, data: {
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  inningsNumber?: number;
}) {
  const innNum = data.inningsNumber || 1;
  const innings = await prisma.innings.findUnique({
    where: { matchId_inningsNumber: { matchId, inningsNumber: innNum } },
  });

  if (!innings) {
    throw { statusCode: 404, message: `Innings ${innNum} not found` };
  }

  // Validate striker and nonStriker belong to batting team XI
  const battingPlayers = await prisma.matchPlayer.findMany({
    where: {
      matchId,
      teamId: innings.battingTeamId,
      playerId: { in: [data.strikerId, data.nonStrikerId] },
      isPlayingXI: true,
    },
  });

  if (battingPlayers.length !== 2) {
    throw { statusCode: 400, message: 'Opening batters must belong to batting team Playing XI' };
  }

  // Validate bowler belongs to bowling team XI
  const bowlerPlayer = await prisma.matchPlayer.findFirst({
    where: {
      matchId,
      teamId: innings.bowlingTeamId,
      playerId: data.bowlerId,
      isPlayingXI: true,
    },
  });

  if (!bowlerPlayer) {
    throw { statusCode: 400, message: 'Opening bowler must belong to bowling team Playing XI' };
  }

  await prisma.$transaction(async tx => {
    // Update innings active players
    await tx.innings.update({
      where: { id: innings.id },
      data: {
        currentStrikerId: data.strikerId,
        currentNonStrikerId: data.nonStrikerId,
        currentBowlerId: data.bowlerId,
      },
    });

    // Ensure batting scorecard entries exist for both openers
    const existingStrikerCard = await tx.battingScorecard.findUnique({
      where: { inningsId_playerId: { inningsId: innings.id, playerId: data.strikerId } },
    });
    if (!existingStrikerCard) {
      await tx.battingScorecard.create({
        data: {
          inningsId: innings.id,
          playerId: data.strikerId,
          battingOrder: 1,
          notOut: true,
        },
      });
    }

    const existingNonStrikerCard = await tx.battingScorecard.findUnique({
      where: { inningsId_playerId: { inningsId: innings.id, playerId: data.nonStrikerId } },
    });
    if (!existingNonStrikerCard) {
      await tx.battingScorecard.create({
        data: {
          inningsId: innings.id,
          playerId: data.nonStrikerId,
          battingOrder: 2,
          notOut: true,
        },
      });
    }

    // Ensure bowling scorecard entry exists for bowler
    const existingBowlerCard = await tx.bowlingScorecard.findUnique({
      where: { inningsId_playerId: { inningsId: innings.id, playerId: data.bowlerId } },
    });
    if (!existingBowlerCard) {
      await tx.bowlingScorecard.create({
        data: {
          inningsId: innings.id,
          playerId: data.bowlerId,
          bowlingOrder: 1,
        },
      });
    }
  });

  return { message: 'Opening players configured' };
}

export async function getTeamMatches(
  teamId: string,
  filter?: { format?: MatchFormat; status?: MatchStatus },
  isAdmin: boolean = false
) {
  const whereClause: any = isAdmin
    ? {}
    : {
        OR: [{ teamAId: teamId }, { teamBId: teamId }],
      };

  if (filter?.format) {
    whereClause.format = filter.format;
  }

  if (filter?.status) {
    whereClause.status = filter.status;
  }

  return prisma.match.findMany({
    where: whereClause,
    orderBy: { matchDate: 'desc' },
    include: {
      teamA: { select: { id: true, teamName: true } },
      teamB: { select: { id: true, teamName: true } },
      innings: {
        select: {
          inningsNumber: true,
          battingTeamId: true,
          totalRuns: true,
          wickets: true,
          oversCompletedText: true,
          status: true,
        },
      },
    },
  });
}

export async function deleteMatch(matchId: string, teamId?: string, isAdmin: boolean = false) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw { statusCode: 404, message: 'Match not found' };

  if (!isAdmin && match.teamAId !== teamId && match.teamBId !== teamId) {
    throw { statusCode: 403, message: 'Access denied: You do not have permission to delete this match' };
  }

  await prisma.match.delete({ where: { id: matchId } });
  return { message: 'Match deleted successfully' };
}
