import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { signToken } from '../utils/jwt.js';
import { UserRole } from '@prisma/client';

export async function registerTeam(data: {
  teamName: string;
  username: string;
  email: string;
  password: string;
}) {
  const existingUsername = await prisma.team.findUnique({
    where: { username: data.username.toLowerCase() },
  });
  if (existingUsername) {
    throw { statusCode: 400, message: 'Username is already taken' };
  }

  const existingEmail = await prisma.team.findUnique({
    where: { email: data.email.toLowerCase() },
  });
  if (existingEmail) {
    throw { statusCode: 400, message: 'Email is already registered' };
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(data.password, salt);

  const team = await prisma.team.create({
    data: {
      teamName: data.teamName.trim(),
      username: data.username.toLowerCase().trim(),
      email: data.email.toLowerCase().trim(),
      passwordHash,
      role: UserRole.TEAM,
      isActive: true,
    },
  });

  const token = signToken({
    teamId: team.id,
    username: team.username,
    teamName: team.teamName,
    role: team.role,
    isActive: team.isActive,
  });

  return {
    token,
    team: {
      id: team.id,
      teamName: team.teamName,
      username: team.username,
      email: team.email,
      role: team.role,
      isActive: team.isActive,
    },
  };
}

export async function loginTeam(data: {
  usernameOrEmail: string;
  password: string;
}) {
  const identifier = data.usernameOrEmail.toLowerCase().trim();
  const team = await prisma.team.findFirst({
    where: {
      OR: [{ username: identifier }, { email: identifier }],
    },
  });

  if (!team) {
    throw { statusCode: 401, message: 'Invalid credentials' };
  }

  if (!team.isActive) {
    throw { statusCode: 403, message: 'This team account has been deactivated by the administrator.' };
  }

  const isMatch = await bcrypt.compare(data.password, team.passwordHash);
  if (!isMatch) {
    throw { statusCode: 401, message: 'Invalid credentials' };
  }

  const token = signToken({
    teamId: team.id,
    username: team.username,
    teamName: team.teamName,
    role: team.role,
    isActive: team.isActive,
  });

  return {
    token,
    team: {
      id: team.id,
      teamName: team.teamName,
      username: team.username,
      email: team.email,
      role: team.role,
      isActive: team.isActive,
    },
  };
}

export async function getTeamDashboard(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, teamName: true, username: true, email: true, role: true, isActive: true },
  });

  if (!team) {
    throw { statusCode: 404, message: 'Team not found' };
  }

  const totalPlayers = await prisma.player.count({
    where: { teamId },
  });

  const matches = await prisma.match.findMany({
    where: {
      OR: [{ teamAId: teamId }, { teamBId: teamId }],
    },
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
        },
      },
    },
    orderBy: { matchDate: 'desc' },
  });

  const totalMatches = matches.filter(m => m.status === 'COMPLETED').length;
  let won = 0;
  let lost = 0;
  let tied = 0;
  let drawn = 0;

  matches.forEach(m => {
    if (m.status === 'COMPLETED') {
      if (m.resultType === 'TIE') {
        tied++;
      } else if (m.resultType === 'DRAW') {
        drawn++;
      } else if (m.winnerId === teamId) {
        won++;
      } else if (m.winnerId && m.winnerId !== teamId) {
        lost++;
      }
    }
  });

  const recentMatches = matches.slice(0, 5).map(m => {
    const isHome = m.teamAId === teamId;
    const opponent = isHome ? m.teamB : m.teamA;
    return {
      id: m.id,
      format: m.format,
      opponentName: opponent.teamName,
      matchDate: m.matchDate,
      status: m.status,
      resultDescription: m.resultDescription,
      innings: m.innings,
    };
  });

  return {
    team,
    totalPlayers,
    totalMatches,
    won,
    lost,
    tied,
    drawn,
    recentMatches,
  };
}

export async function getAllOpponentTeams(currentTeamId: string) {
  return prisma.team.findMany({
    where: {
      id: { not: currentTeamId },
      role: UserRole.TEAM,
      isActive: true,
    },
    select: { id: true, teamName: true, username: true },
    orderBy: { teamName: 'asc' },
  });
}
