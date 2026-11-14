import { prisma } from '../config/db.js';
import { MatchFormat, MatchStatus, UserRole } from '@prisma/client';

export async function getAdminDashboard() {
  const totalTeams = await prisma.team.count({
    where: { role: UserRole.TEAM },
  });

  const totalPlayers = await prisma.player.count();
  const totalMatches = await prisma.match.count();
  const upcomingMatches = await prisma.match.count({
    where: { status: MatchStatus.UPCOMING },
  });
  const liveMatches = await prisma.match.count({
    where: { status: MatchStatus.LIVE },
  });
  const completedMatches = await prisma.match.count({
    where: { status: MatchStatus.COMPLETED },
  });

  const recentMatches = await prisma.match.findMany({
    take: 10,
    orderBy: { matchDate: 'desc' },
    include: {
      teamA: { select: { id: true, teamName: true } },
      teamB: { select: { id: true, teamName: true } },
      innings: {
        select: {
          inningsNumber: true,
          totalRuns: true,
          wickets: true,
          oversCompletedText: true,
        },
      },
    },
  });

  return {
    totalTeams,
    totalPlayers,
    totalMatches,
    upcomingMatches,
    liveMatches,
    completedMatches,
    recentMatches,
  };
}

export async function getAllTeams() {
  const teams = await prisma.team.findMany({
    where: { role: UserRole.TEAM },
    orderBy: { createdAt: 'desc' },
    include: {
      players: {
        select: { id: true, playerName: true, jerseyNumber: true, role: true },
      },
      homeMatches: {
        where: { status: MatchStatus.COMPLETED },
        select: { id: true, winnerId: true, resultType: true },
      },
      awayMatches: {
        where: { status: MatchStatus.COMPLETED },
        select: { id: true, winnerId: true, resultType: true },
      },
    },
  });

  return teams.map(t => {
    const allMatches = [...t.homeMatches, ...t.awayMatches];
    const wins = allMatches.filter(m => m.winnerId === t.id).length;
    const losses = allMatches.filter(m => m.winnerId && m.winnerId !== t.id).length;
    const ties = allMatches.filter(m => m.resultType === 'TIE').length;
    const draws = allMatches.filter(m => m.resultType === 'DRAW').length;

    return {
      id: t.id,
      teamName: t.teamName,
      username: t.username,
      email: t.email,
      isActive: t.isActive,
      createdAt: t.createdAt,
      totalPlayers: t.players.length,
      matchesPlayed: allMatches.length,
      wins,
      losses,
      ties,
      draws,
    };
  });
}

export async function getTeamDetails(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      players: {
        orderBy: { jerseyNumber: 'asc' },
        include: {
          matchPlayers: {
            where: { match: { status: MatchStatus.COMPLETED } },
          },
          battingScorecards: {
            where: { innings: { match: { status: MatchStatus.COMPLETED } } },
            select: { runs: true },
          },
          bowlingScorecards: {
            where: { innings: { match: { status: MatchStatus.COMPLETED } } },
            select: { wickets: true },
          },
        },
      },
    },
  });

  if (!team) {
    throw { statusCode: 404, message: 'Team not found' };
  }

  const players = team.players.map(p => ({
    id: p.id,
    playerName: p.playerName,
    jerseyNumber: p.jerseyNumber,
    role: p.role,
    matchesPlayed: p.matchPlayers.length,
    runsScored: p.battingScorecards.reduce((sum, b) => sum + b.runs, 0),
    wicketsTaken: p.bowlingScorecards.reduce((sum, b) => sum + b.wickets, 0),
  }));

  return {
    id: team.id,
    teamName: team.teamName,
    username: team.username,
    email: team.email,
    isActive: team.isActive,
    createdAt: team.createdAt,
    players,
  };
}

export async function updateTeamStatus(teamId: string, isActive: boolean) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw { statusCode: 404, message: 'Team not found' };
  if (team.role === UserRole.ADMIN) {
    throw { statusCode: 400, message: 'Cannot deactivate Admin account' };
  }

  return prisma.team.update({
    where: { id: teamId },
    data: { isActive },
    select: { id: true, teamName: true, username: true, isActive: true },
  });
}

export async function getAllMatches(filter?: { status?: MatchStatus; format?: MatchFormat }) {
  const whereClause: any = {};
  if (filter?.status) whereClause.status = filter.status;
  if (filter?.format) whereClause.format = filter.format;

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

export async function updateMatchDetails(matchId: string, data: { venue?: string; matchDate?: string }) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw { statusCode: 404, message: 'Match not found' };

  if (match.status === MatchStatus.COMPLETED) {
    throw { statusCode: 400, message: 'Cannot edit details of a completed match' };
  }

  return prisma.match.update({
    where: { id: matchId },
    data: {
      venue: data.venue !== undefined ? data.venue : match.venue,
      matchDate: data.matchDate ? new Date(data.matchDate) : match.matchDate,
    },
  });
}

export async function cancelMatch(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw { statusCode: 404, message: 'Match not found' };

  if (match.status === MatchStatus.COMPLETED) {
    throw { statusCode: 400, message: 'Cannot cancel a completed match' };
  }

  return prisma.match.update({
    where: { id: matchId },
    data: {
      status: MatchStatus.ABANDONED,
      resultDescription: 'Match cancelled by Administrator',
    },
  });
}

export async function deleteMatchPermanent(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw { statusCode: 404, message: 'Match not found' };
  await prisma.match.delete({ where: { id: matchId } });
  return { message: 'Match deleted permanently' };
}
