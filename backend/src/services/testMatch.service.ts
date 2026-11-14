import {
  InningsStatus,
  MatchFormat,
  MatchResultType,
  MatchStatus,
} from '@prisma/client';
import { prisma } from '../config/db.js';

export async function calculateTestMatchStatus(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: { select: { id: true, teamName: true } },
      teamB: { select: { id: true, teamName: true } },
      innings: {
        orderBy: { inningsNumber: 'asc' },
      },
      sessions: true,
    },
  });

  if (!match) throw { statusCode: 404, message: 'Match not found' };
  if (match.format !== MatchFormat.TEST) {
    throw { statusCode: 400, message: 'Not a test match' };
  }

  // Calculate cumulative scores
  let teamARuns = 0;
  let teamBRuns = 0;
  let teamAWickets = 0;
  let teamBWickets = 0;

  match.innings.forEach(inn => {
    if (inn.battingTeamId === match.teamAId) {
      teamARuns += inn.totalRuns;
      teamAWickets += inn.wickets;
    } else {
      teamBRuns += inn.totalRuns;
      teamBWickets += inn.wickets;
    }
  });

  const diff = teamARuns - teamBRuns;
  let leaderTeam: { id: string; teamName: string } | null = null;
  let leadRuns = 0;
  let trailRuns = 0;

  if (diff > 0) {
    leaderTeam = match.teamA;
    leadRuns = diff;
    trailRuns = diff;
  } else if (diff < 0) {
    leaderTeam = match.teamB;
    leadRuns = Math.abs(diff);
    trailRuns = Math.abs(diff);
  }

  // Follow-on eligibility check:
  // After Innings 2 (Team B 1st innings), check if Team B trails Team A by >= 200 runs
  let canEnforceFollowOn = false;
  if (match.innings.length === 2 && match.innings[1].status === InningsStatus.COMPLETED) {
    const inn1 = match.innings[0];
    const inn2 = match.innings[1];
    const trail = inn1.totalRuns - inn2.totalRuns;
    if (trail >= 200 && !match.followOnEnforced) {
      canEnforceFollowOn = true;
    }
  }

  // 4th innings target
  let targetRuns: number | null = null;
  if (match.innings.length === 4) {
    const inn4 = match.innings[3];
    targetRuns = inn4.targetRuns;
  }

  return {
    matchId: match.id,
    currentDay: match.currentDay,
    currentSession: match.currentSession,
    dayOvers: match.dayOvers,
    sessionOvers: match.sessionOvers,
    teamA: { id: match.teamA.id, name: match.teamA.teamName, cumulativeRuns: teamARuns },
    teamB: { id: match.teamB.id, name: match.teamB.teamName, cumulativeRuns: teamBRuns },
    leaderTeam,
    leadRuns,
    trailRuns,
    canEnforceFollowOn,
    followOnEnforced: match.followOnEnforced,
    targetRuns,
  };
}

export async function advanceSession(matchId: string) {
  return prisma.$transaction(async tx => {
    const match = await tx.match.findUnique({
      where: { id: matchId },
      include: {
        innings: true,
      },
    });

    if (!match) throw { statusCode: 404, message: 'Match not found' };
    if (match.status === MatchStatus.COMPLETED) {
      throw { statusCode: 400, message: 'Match is already completed' };
    }

    // Save current session record
    await tx.matchSession.create({
      data: {
        matchId,
        dayNumber: match.currentDay,
        sessionNumber: match.currentSession,
        oversBowled: match.sessionOvers,
        status: 'COMPLETED',
      },
    });

    let nextSession = match.currentSession + 1;
    let nextDay = match.currentDay;
    let nextDayOvers = match.dayOvers;

    if (nextSession > 3) {
      // Advance to next day
      nextSession = 1;
      nextDay += 1;
      nextDayOvers = 0;
    }

    // Check if 5-day limit reached without result
    if (nextDay > 5) {
      // Match drawn!
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.COMPLETED,
          resultType: MatchResultType.DRAW,
          resultDescription: 'Match drawn (5-day limit expired)',
        },
      });
      return { message: '5-day duration completed: Match drawn' };
    }

    await tx.match.update({
      where: { id: matchId },
      data: {
        currentDay: nextDay,
        currentSession: nextSession,
        sessionOvers: 0,
        dayOvers: nextDayOvers,
      },
    });

    return {
      message: `Advanced to Day ${nextDay}, Session ${nextSession}`,
      day: nextDay,
      session: nextSession,
    };
  });
}

export async function advanceDay(matchId: string) {
  return prisma.$transaction(async tx => {
    const match = await tx.match.findUnique({ where: { id: matchId } });
    if (!match) throw { statusCode: 404, message: 'Match not found' };

    const nextDay = match.currentDay + 1;
    if (nextDay > 5) {
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.COMPLETED,
          resultType: MatchResultType.DRAW,
          resultDescription: 'Match drawn (5-day limit expired)',
        },
      });
      return { message: '5-day duration completed: Match drawn' };
    }

    await tx.match.update({
      where: { id: matchId },
      data: {
        currentDay: nextDay,
        currentSession: 1,
        dayOvers: 0,
        sessionOvers: 0,
      },
    });

    return {
      message: `Advanced to Day ${nextDay}`,
      day: nextDay,
      session: 1,
    };
  });
}

export async function handleFollowOn(matchId: string, enforce: boolean) {
  return prisma.$transaction(async tx => {
    const match = await tx.match.findUnique({
      where: { id: matchId },
      include: {
        innings: { orderBy: { inningsNumber: 'asc' } },
        teamA: { select: { id: true, teamName: true } },
        teamB: { select: { id: true, teamName: true } },
      },
    });

    if (!match) throw { statusCode: 404, message: 'Match not found' };
    if (match.innings.length !== 2) {
      throw { statusCode: 400, message: 'Follow-on can only be decided after the 2nd innings' };
    }

    const inn1 = match.innings[0];
    const inn2 = match.innings[1];
    const trail = inn1.totalRuns - inn2.totalRuns;

    if (trail < 200) {
      throw { statusCode: 400, message: 'Follow-on requires a trail of at least 200 runs' };
    }

    await tx.match.update({
      where: { id: matchId },
      data: {
        followOnEnforced: enforce,
        currentInningsNumber: 3,
      },
    });

    // Determine batting & bowling teams for 3rd innings
    let battingTeamId = inn1.battingTeamId; // Standard: Team A bats again
    let bowlingTeamId = inn1.bowlingTeamId;

    if (enforce) {
      // Follow-on enforced: Team B bats again immediately
      battingTeamId = inn2.battingTeamId;
      bowlingTeamId = inn2.bowlingTeamId;
    }

    await tx.innings.create({
      data: {
        matchId,
        inningsNumber: 3,
        battingTeamId,
        bowlingTeamId,
      },
    });

    return {
      message: enforce ? 'Follow-on enforced. Team B bats again.' : 'Follow-on declined. Team A bats in 3rd innings.',
      followOnEnforced: enforce,
    };
  });
}

export async function declareInnings(matchId: string) {
  return prisma.$transaction(async tx => {
    const match = await tx.match.findUnique({
      where: { id: matchId },
      include: {
        innings: { orderBy: { inningsNumber: 'asc' } },
        teamA: { select: { id: true, teamName: true } },
        teamB: { select: { id: true, teamName: true } },
      },
    });

    if (!match) throw { statusCode: 404, message: 'Match not found' };

    const currentInnings = match.innings.find(i => i.inningsNumber === match.currentInningsNumber);
    if (!currentInnings) throw { statusCode: 404, message: 'Current innings not found' };

    // Mark current innings declared & completed
    await tx.innings.update({
      where: { id: currentInnings.id },
      data: {
        isDeclared: true,
        status: InningsStatus.DECLARED,
      },
    });

    // Check if match transitions to next innings or match ends
    const nextInningsNumber = match.currentInningsNumber + 1;

    if (match.format === MatchFormat.TEST) {
      if (nextInningsNumber <= 4) {
        // Create next innings
        let battingTeamId = currentInnings.bowlingTeamId;
        let bowlingTeamId = currentInnings.battingTeamId;
        let targetRuns: number | null = null;

        if (nextInningsNumber === 4) {
          // Calculate target for 4th innings
          let teamARuns = 0;
          let teamBRuns = 0;
          match.innings.forEach(inn => {
            if (inn.battingTeamId === match.teamAId) teamARuns += inn.totalRuns;
            else teamBRuns += inn.totalRuns;
          });

          // Innings 4 target is (cumulative runs of defending team) - (cumulative runs of chasing team) + 1
          if (battingTeamId === match.teamAId) {
            targetRuns = teamBRuns - teamARuns + 1;
          } else {
            targetRuns = teamARuns - teamBRuns + 1;
          }
        }

        await tx.innings.create({
          data: {
            matchId,
            inningsNumber: nextInningsNumber,
            battingTeamId,
            bowlingTeamId,
            targetRuns,
          },
        });

        await tx.match.update({
          where: { id: matchId },
          data: { currentInningsNumber: nextInningsNumber },
        });

        return { message: `Innings declared. Innings ${nextInningsNumber} initialized.` };
      }
    } else {
      // Limited overs declaration
      if (match.currentInningsNumber === 1) {
        const targetRuns = currentInnings.totalRuns + 1;
        await tx.innings.create({
          data: {
            matchId,
            inningsNumber: 2,
            battingTeamId: currentInnings.bowlingTeamId,
            bowlingTeamId: currentInnings.battingTeamId,
            targetRuns,
          },
        });
        await tx.match.update({
          where: { id: matchId },
          data: { currentInningsNumber: 2 },
        });
        return { message: '1st Innings declared. 2nd Innings initialized with target ' + targetRuns };
      }
    }

    return { message: 'Innings declared' };
  });
}
