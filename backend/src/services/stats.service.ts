import { prisma } from '../config/db.js';
import {
  ballsToOversText,
  calculateBattingAverage,
  calculateBowlingAverage,
  calculateEconomyRate,
  calculateStrikeRate,
} from '../utils/cricket.js';

export async function getPlayerProfile(playerId: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      team: { select: { id: true, teamName: true } },
      matchPlayers: {
        where: {
          match: { status: 'COMPLETED' },
          isPlayingXI: true,
        },
        include: {
          match: {
            include: {
              teamA: { select: { id: true, teamName: true } },
              teamB: { select: { id: true, teamName: true } },
              innings: {
                include: {
                  battingScorecards: { where: { playerId } },
                  bowlingScorecards: { where: { playerId } },
                },
              },
            },
          },
        },
      },
      battingScorecards: {
        where: {
          innings: { match: { status: 'COMPLETED' } },
        },
      },
      bowlingScorecards: {
        where: {
          innings: { match: { status: 'COMPLETED' } },
        },
      },
      catchesRunOuts: {
        where: {
          innings: { match: { status: 'COMPLETED' } },
        },
      },
    },
  });

  if (!player) {
    throw { statusCode: 404, message: 'Player not found' };
  }

  // Batting stats calculations
  const batting = player.battingScorecards;
  const inningsBatted = batting.length;
  const totalRuns = batting.reduce((sum, b) => sum + b.runs, 0);
  const totalBalls = batting.reduce((sum, b) => sum + b.balls, 0);
  const fours = batting.reduce((sum, b) => sum + b.fours, 0);
  const sixes = batting.reduce((sum, b) => sum + b.sixes, 0);
  const notOuts = batting.filter(b => b.notOut).length;
  const dismissals = inningsBatted - notOuts;
  const highestScoreRecord = batting.reduce((max, b) => (b.runs > max.runs ? b : max), { runs: 0, notOut: false });
  const highestScore = batting.length > 0 ? `${highestScoreRecord.runs}${highestScoreRecord.notOut ? '*' : ''}` : '0';
  const centuries = batting.filter(b => b.runs >= 100).length;
  const halfCenturies = batting.filter(b => b.runs >= 50 && b.runs < 100).length;
  const ducks = batting.filter(b => b.runs === 0 && !b.notOut).length;
  const battingAverage = calculateBattingAverage(totalRuns, dismissals);
  const strikeRate = calculateStrikeRate(totalRuns, totalBalls);

  // Bowling stats calculations
  const bowling = player.bowlingScorecards;
  const bowlingInnings = bowling.length;
  const totalWickets = bowling.reduce((sum, b) => sum + b.wickets, 0);
  const totalLegalBalls = bowling.reduce((sum, b) => sum + b.legalBalls, 0);
  const totalRunsConceded = bowling.reduce((sum, b) => sum + b.runsConceded, 0);
  const maidens = bowling.reduce((sum, b) => sum + b.maidens, 0);
  const bowlingAverage = calculateBowlingAverage(totalRunsConceded, totalWickets);
  const economyRate = calculateEconomyRate(totalRunsConceded, totalLegalBalls);
  const oversBowledText = ballsToOversText(totalLegalBalls);

  let bestBowling = '-';
  if (bowling.length > 0) {
    const sortedBowling = [...bowling].sort((a, b) => {
      if (b.wickets !== a.wickets) return b.wickets - a.wickets;
      return a.runsConceded - b.runsConceded;
    });
    if (sortedBowling[0].wickets > 0 || sortedBowling[0].legalBalls > 0) {
      bestBowling = `${sortedBowling[0].wickets}/${sortedBowling[0].runsConceded}`;
    }
  }

  // Fielding stats
  const catches = player.catchesRunOuts.filter(w => w.dismissalType === 'CAUGHT').length;
  const runOuts = player.catchesRunOuts.filter(w => w.dismissalType === 'RUN_OUT').length;

  // Match Participation History
  const matchHistory = player.matchPlayers.map(mp => {
    const m = mp.match;
    const isTeamA = m.teamAId === player.teamId;
    const opponent = isTeamA ? m.teamB : m.teamA;

    // Aggregate performances in this match
    let matchRuns = 0;
    let matchBalls = 0;
    let matchWickets = 0;
    let matchLegalBalls = 0;

    m.innings.forEach(inn => {
      inn.battingScorecards.forEach(b => {
        matchRuns += b.runs;
        matchBalls += b.balls;
      });
      inn.bowlingScorecards.forEach(b => {
        matchWickets += b.wickets;
        matchLegalBalls += b.legalBalls;
      });
    });

    return {
      matchId: m.id,
      matchDate: m.matchDate,
      format: m.format,
      opponent: opponent.teamName,
      runsScored: matchRuns,
      ballsFaced: matchBalls,
      wicketsTaken: matchWickets,
      oversBowled: ballsToOversText(matchLegalBalls),
      resultDescription: m.resultDescription,
    };
  });

  return {
    player: {
      id: player.id,
      playerName: player.playerName,
      jerseyNumber: player.jerseyNumber,
      role: player.role,
      teamId: player.teamId,
      teamName: player.team.teamName,
    },
    battingStats: {
      matchesPlayed: player.matchPlayers.length,
      inningsBatted,
      totalRuns,
      highestScore,
      battingAverage,
      strikeRate,
      ballsFaced: totalBalls,
      fours,
      sixes,
      notOuts,
      centuries,
      halfCenturies,
      ducks,
    },
    bowlingStats: {
      bowlingInnings,
      totalWickets,
      oversBowled: oversBowledText,
      legalBalls: totalLegalBalls,
      runsConceded: totalRunsConceded,
      bowlingAverage,
      economyRate,
      bestBowling,
      maidens,
    },
    fieldingStats: {
      catches,
      runOuts,
    },
    matchHistory,
  };
}

export async function getTeamStatistics(teamId: string) {
  const matches = await prisma.match.findMany({
    where: {
      OR: [{ teamAId: teamId }, { teamBId: teamId }],
      status: 'COMPLETED',
    },
    include: {
      innings: {
        where: { battingTeamId: teamId },
      },
    },
  });

  const totalMatches = matches.length;
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let draws = 0;
  let totalRuns = 0;
  let highestTotal = 0;
  let lowestTotal = Infinity;

  matches.forEach(m => {
    if (m.resultType === 'TIE') ties++;
    else if (m.resultType === 'DRAW') draws++;
    else if (m.winnerId === teamId) wins++;
    else if (m.winnerId) losses++;

    m.innings.forEach(inn => {
      totalRuns += inn.totalRuns;
      if (inn.totalRuns > highestTotal) highestTotal = inn.totalRuns;
      if (inn.totalRuns < lowestTotal) lowestTotal = inn.totalRuns;
    });
  });

  // Calculate total wickets taken by bowling innings
  const bowlingScorecards = await prisma.bowlingScorecard.findMany({
    where: {
      player: { teamId },
      innings: { match: { status: 'COMPLETED' } },
    },
    select: { wickets: true },
  });
  const totalWickets = bowlingScorecards.reduce((sum, b) => sum + b.wickets, 0);

  return {
    totalMatches,
    wins,
    losses,
    ties,
    draws,
    highestTotal: highestTotal > 0 ? highestTotal : 0,
    lowestTotal: lowestTotal !== Infinity ? lowestTotal : 0,
    totalRunsScored: totalRuns,
    totalWicketsTaken: totalWickets,
  };
}
