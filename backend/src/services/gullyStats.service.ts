import { prisma } from '../config/db.js';
import {
  ballsToOversText,
  calculateBattingAverage,
  calculateBowlingAverage,
  calculateEconomyRate,
  calculateStrikeRate,
} from '../utils/cricket.js';
import { GullyMatchType } from '@prisma/client';

export async function getPlayerGullyProfile(playerId: string, teamId: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      team: { select: { id: true, teamName: true } },
      gullyMatchParticipations: {
        where: {
          gullyMatch: {
            registeredTeamId: teamId,
            status: 'COMPLETED',
          },
        },
        include: {
          gullyMatch: {
            include: {
              temporaryTeams: true,
              selectedBatter: { select: { id: true, playerName: true } },
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
      gullyBattingScores: {
        where: {
          innings: {
            gullyMatch: {
              registeredTeamId: teamId,
              status: 'COMPLETED',
            },
          },
        },
        include: {
          innings: {
            include: {
              gullyMatch: true,
            },
          },
        },
      },
      gullyBowlingScores: {
        where: {
          innings: {
            gullyMatch: {
              registeredTeamId: teamId,
              status: 'COMPLETED',
            },
          },
        },
        include: {
          innings: {
            include: {
              gullyMatch: true,
            },
          },
        },
      },
      gullyCatchesRunOuts: {
        where: {
          innings: {
            gullyMatch: {
              registeredTeamId: teamId,
              status: 'COMPLETED',
            },
          },
        },
      },
    },
  });

  if (!player) {
    throw { statusCode: 404, message: 'Player not found' };
  }

  // --- OVERALL GULLY STATS ---
  const batting = player.gullyBattingScores;
  const inningsBatted = batting.length;
  const totalRuns = batting.reduce((sum, b) => sum + b.runs, 0);
  const totalBalls = batting.reduce((sum, b) => sum + b.balls, 0);
  const fours = batting.reduce((sum, b) => sum + b.fours, 0);
  const sixes = batting.reduce((sum, b) => sum + b.sixes, 0);
  const notOuts = batting.filter(b => b.notOut).length;
  const dismissals = inningsBatted - notOuts;
  const highestScoreRecord = batting.reduce(
    (max, b) => (b.runs > max.runs ? b : max),
    { runs: 0, notOut: false }
  );
  const highestScore =
    batting.length > 0
      ? `${highestScoreRecord.runs}${highestScoreRecord.notOut ? '*' : ''}`
      : '0';
  const battingAverage = calculateBattingAverage(totalRuns, dismissals);
  const strikeRate = calculateStrikeRate(totalRuns, totalBalls);
  const halfCenturies = batting.filter(b => b.runs >= 50 && b.runs < 100).length;
  const centuries = batting.filter(b => b.runs >= 100).length;
  const ducks = batting.filter(b => b.runs === 0 && !b.notOut).length;

  const bowling = player.gullyBowlingScores;
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
    const sorted = [...bowling].sort((a, b) => {
      if (b.wickets !== a.wickets) return b.wickets - a.wickets;
      return a.runsConceded - b.runsConceded;
    });
    if (sorted[0].wickets > 0 || sorted[0].legalBalls > 0) {
      bestBowling = `${sorted[0].wickets}/${sorted[0].runsConceded}`;
    }
  }

  // --- TEAM MATCH BREAKDOWN ---
  const teamBatting = batting.filter(
    b => b.innings.gullyMatch.matchType === GullyMatchType.TEAM_MATCH
  );
  const teamRuns = teamBatting.reduce((s, b) => s + b.runs, 0);
  const teamBalls = teamBatting.reduce((s, b) => s + b.balls, 0);
  const teamNotOuts = teamBatting.filter(b => b.notOut).length;
  const teamDismissals = teamBatting.length - teamNotOuts;
  const teamHighestRecord = teamBatting.reduce(
    (max, b) => (b.runs > max.runs ? b : max),
    { runs: 0, notOut: false }
  );

  const teamBowling = bowling.filter(
    b => b.innings.gullyMatch.matchType === GullyMatchType.TEAM_MATCH
  );
  const teamWickets = teamBowling.reduce((s, b) => s + b.wickets, 0);
  const teamBallsBowled = teamBowling.reduce((s, b) => s + b.legalBalls, 0);
  const teamRunsConceded = teamBowling.reduce((s, b) => s + b.runsConceded, 0);

  // --- SINGLES MATCH BREAKDOWN ---
  const singlesBatting = batting.filter(
    b => b.innings.gullyMatch.matchType === GullyMatchType.SINGLES_MATCH
  );
  const singlesRuns = singlesBatting.reduce((s, b) => s + b.runs, 0);
  const singlesBalls = singlesBatting.reduce((s, b) => s + b.balls, 0);
  const singlesHighestRecord = singlesBatting.reduce(
    (max, b) => (b.runs > max.runs ? b : max),
    { runs: 0, notOut: false }
  );

  const singlesBowling = bowling.filter(
    b => b.innings.gullyMatch.matchType === GullyMatchType.SINGLES_MATCH
  );
  const singlesWickets = singlesBowling.reduce((s, b) => s + b.wickets, 0);
  const singlesBallsBowled = singlesBowling.reduce((s, b) => s + b.legalBalls, 0);
  const singlesRunsConceded = singlesBowling.reduce((s, b) => s + b.runsConceded, 0);

  // --- MATCH PARTICIPATION HISTORY ---
  const matchHistory = player.gullyMatchParticipations.map(mp => {
    const m = mp.gullyMatch;
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

    const isSingles = m.matchType === GullyMatchType.SINGLES_MATCH;
    const opponent = isSingles
      ? `Solo: ${m.selectedBatter?.playerName}`
      : m.temporaryTeams.map(t => t.teamName).join(' vs ');

    return {
      matchId: m.id,
      matchDate: m.matchDate,
      matchType: m.matchType,
      opponent,
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
    gullyBattingStats: {
      matchesPlayed: player.gullyMatchParticipations.length,
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
    gullyBowlingStats: {
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
    teamMatchBreakdown: {
      matches: player.gullyMatchParticipations.filter(
        mp => mp.gullyMatch.matchType === GullyMatchType.TEAM_MATCH
      ).length,
      runs: teamRuns,
      highestScore:
        teamBatting.length > 0
          ? `${teamHighestRecord.runs}${teamHighestRecord.notOut ? '*' : ''}`
          : '0',
      battingAverage: calculateBattingAverage(teamRuns, teamDismissals),
      strikeRate: calculateStrikeRate(teamRuns, teamBalls),
      wickets: teamWickets,
      bowlingAverage: calculateBowlingAverage(teamRunsConceded, teamWickets),
      economy: calculateEconomyRate(teamRunsConceded, teamBallsBowled),
    },
    singlesMatchBreakdown: {
      matchesAsBatter: singlesBatting.length,
      runsAsBatter: singlesRuns,
      highestScore:
        singlesBatting.length > 0
          ? `${singlesHighestRecord.runs}${singlesHighestRecord.notOut ? '*' : ''}`
          : '0',
      strikeRate: calculateStrikeRate(singlesRuns, singlesBalls),
      matchesAsBowler: singlesBowling.length,
      wicketsAsBowler: singlesWickets,
      bowlingAverage: calculateBowlingAverage(singlesRunsConceded, singlesWickets),
      economy: calculateEconomyRate(singlesRunsConceded, singlesBallsBowled),
    },
    matchHistory,
  };
}

export async function getTeamGullyStatistics(teamId: string) {
  const matches = await prisma.gullyMatch.findMany({
    where: {
      registeredTeamId: teamId,
      status: 'COMPLETED',
    },
    include: {
      innings: true,
      matchPlayers: {
        include: { player: { select: { id: true, playerName: true } } },
      },
    },
  });

  const totalMatches = matches.length;
  const teamMatchesCount = matches.filter(m => m.matchType === GullyMatchType.TEAM_MATCH).length;
  const singlesMatchesCount = matches.filter(m => m.matchType === GullyMatchType.SINGLES_MATCH).length;

  let totalRuns = 0;
  let highestScore = 0;

  matches.forEach(m => {
    m.innings.forEach(inn => {
      totalRuns += inn.totalRuns;
      if (inn.totalRuns > highestScore) highestScore = inn.totalRuns;
    });
  });

  return {
    totalMatches,
    teamMatchesCount,
    singlesMatchesCount,
    totalRunsScored: totalRuns,
    highestScore,
  };
}
