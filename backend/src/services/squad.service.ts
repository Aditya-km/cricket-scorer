import { PlayerRole } from '@prisma/client';
import { prisma } from '../config/db.js';

export async function addPlayer(teamId: string, data: {
  playerName: string;
  jerseyNumber: number;
  role: PlayerRole;
}) {
  const existingPlayer = await prisma.player.findUnique({
    where: {
      teamId_jerseyNumber: {
        teamId,
        jerseyNumber: data.jerseyNumber,
      },
    },
  });

  if (existingPlayer) {
    throw { statusCode: 400, message: `Jersey number ${data.jerseyNumber} is already assigned to ${existingPlayer.playerName} in your team` };
  }

  return prisma.player.create({
    data: {
      teamId,
      playerName: data.playerName.trim(),
      jerseyNumber: data.jerseyNumber,
      role: data.role,
    },
  });
}

export async function updatePlayer(teamId: string, playerId: string, data: {
  playerName: string;
  jerseyNumber: number;
  role: PlayerRole;
}) {
  const player = await prisma.player.findFirst({
    where: { id: playerId, teamId },
  });

  if (!player) {
    throw { statusCode: 404, message: 'Player not found in your team' };
  }

  if (data.jerseyNumber !== player.jerseyNumber) {
    const existingJersey = await prisma.player.findUnique({
      where: {
        teamId_jerseyNumber: {
          teamId,
          jerseyNumber: data.jerseyNumber,
        },
      },
    });
    if (existingJersey) {
      throw { statusCode: 400, message: `Jersey number ${data.jerseyNumber} is already taken by ${existingJersey.playerName}` };
    }
  }

  return prisma.player.update({
    where: { id: playerId },
    data: {
      playerName: data.playerName.trim(),
      jerseyNumber: data.jerseyNumber,
      role: data.role,
    },
  });
}

export async function deletePlayer(teamId: string, playerId: string) {
  const player = await prisma.player.findFirst({
    where: { id: playerId, teamId },
    include: {
      matchPlayers: {
        where: {
          match: { status: 'COMPLETED' },
        },
      },
    },
  });

  if (!player) {
    throw { statusCode: 404, message: 'Player not found in your team' };
  }

  if (player.matchPlayers.length > 0) {
    throw {
      statusCode: 400,
      message: 'Cannot delete player with completed match history. Player statistics must be preserved.',
    };
  }

  await prisma.player.delete({
    where: { id: playerId },
  });

  return { message: 'Player deleted successfully' };
}

export async function getTeamSquad(
  teamId: string,
  filter?: { role?: PlayerRole; search?: string }
) {
  const whereClause: any = { teamId };

  if (filter?.role) {
    whereClause.role = filter.role;
  }

  if (filter?.search) {
    const query = filter.search.trim();
    const asNum = parseInt(query, 10);
    if (!isNaN(asNum)) {
      whereClause.OR = [
        { playerName: { contains: query } },
        { jerseyNumber: asNum },
      ];
    } else {
      whereClause.playerName = { contains: query };
    }
  }

  const players = await prisma.player.findMany({
    where: whereClause,
    orderBy: { jerseyNumber: 'asc' },
    include: {
      matchPlayers: {
        where: {
          match: { status: 'COMPLETED' },
          isPlayingXI: true,
        },
        select: { id: true },
      },
      battingScorecards: {
        where: {
          innings: { match: { status: 'COMPLETED' } },
        },
        select: { runs: true },
      },
      bowlingScorecards: {
        where: {
          innings: { match: { status: 'COMPLETED' } },
        },
        select: { wickets: true },
      },
    },
  });

  return players.map(p => ({
    id: p.id,
    playerName: p.playerName,
    jerseyNumber: p.jerseyNumber,
    role: p.role,
    matchesPlayed: p.matchPlayers.length,
    runsScored: p.battingScorecards.reduce((sum, b) => sum + b.runs, 0),
    wicketsTaken: p.bowlingScorecards.reduce((sum, b) => sum + b.wickets, 0),
    createdAt: p.createdAt,
  }));
}
