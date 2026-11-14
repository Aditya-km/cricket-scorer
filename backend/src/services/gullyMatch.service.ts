import {
  GullyMatchType,
  MatchStatus,
  TossDecision,
  InningsStatus,
  MatchResultType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../config/db.js';
import {
  CreateGullyTeamMatchDto,
  CreateGullySinglesMatchDto,
} from '../types/gully.types.js';

export async function createTeamMatch(registeredTeamId: string, data: CreateGullyTeamMatchDto) {
  const team = await prisma.team.findUnique({
    where: { id: registeredTeamId },
  });

  if (!team || !team.isActive) {
    throw { statusCode: 404, message: 'Registered team not found or is inactive' };
  }

  // Combine all selected players
  const allSelectedPlayerIds = [...data.teamA.playerIds, ...data.teamB.playerIds];

  // Prevent duplicate players across teams
  const uniquePlayerIds = new Set(allSelectedPlayerIds);
  if (uniquePlayerIds.size !== allSelectedPlayerIds.length) {
    throw { statusCode: 400, message: 'A player cannot be selected in both teams' };
  }

  // Validate that all players belong to this registered squad
  const registeredPlayers = await prisma.player.findMany({
    where: {
      id: { in: allSelectedPlayerIds },
      teamId: registeredTeamId,
    },
  });

  if (registeredPlayers.length !== allSelectedPlayerIds.length) {
    throw {
      statusCode: 400,
      message: 'All selected players must belong to your registered team squad',
    };
  }

  return prisma.$transaction(async tx => {
    // Determine initial match status
    const hasToss = !!data.toss;
    const hasOpeners = !!data.openingPlayers;
    const initialStatus = hasToss && hasOpeners ? MatchStatus.LIVE : MatchStatus.UPCOMING;

    // Create GullyMatch
    const match = await tx.gullyMatch.create({
      data: {
        registeredTeamId,
        matchType: GullyMatchType.TEAM_MATCH,
        matchDate: data.matchDate ? new Date(data.matchDate) : new Date(),
        venue: data.venue?.trim() || null,
        status: initialStatus,
        totalOvers: data.totalOvers,
        playersPerTeam: Math.max(data.teamA.playerIds.length, data.teamB.playerIds.length),
        bowlingAllocationRule: data.bowlingAllocationRule,
        tossDecision: data.toss?.tossDecision || null,
      },
    });

    // Create Temporary Teams
    const tempTeamA = await tx.gullyTemporaryTeam.create({
      data: {
        gullyMatchId: match.id,
        teamName: data.teamA.teamName.trim(),
        isTeamA: true,
        captainPlayerId: data.teamA.captainPlayerId || null,
      },
    });

    const tempTeamB = await tx.gullyTemporaryTeam.create({
      data: {
        gullyMatchId: match.id,
        teamName: data.teamB.teamName.trim(),
        isTeamA: false,
        captainPlayerId: data.teamB.captainPlayerId || null,
      },
    });

    // Create Match Players with Bowling Allocations
    const teamAAllocations = new Map(
      (data.teamA.bowlingAllocations || []).map(a => [a.playerId, a.allocatedOvers])
    );
    const teamBAllocations = new Map(
      (data.teamB.bowlingAllocations || []).map(a => [a.playerId, a.allocatedOvers])
    );

    const matchPlayersData: Prisma.GullyMatchPlayerCreateManyInput[] = [
      ...data.teamA.playerIds.map(pId => ({
        gullyMatchId: match.id,
        playerId: pId,
        temporaryTeamId: tempTeamA.id,
        isBatter: true,
        isBowler: true,
        allocatedOvers: teamAAllocations.get(pId) || Math.max(1, Math.ceil(data.totalOvers / data.teamA.playerIds.length)),
      })),
      ...data.teamB.playerIds.map(pId => ({
        gullyMatchId: match.id,
        playerId: pId,
        temporaryTeamId: tempTeamB.id,
        isBatter: true,
        isBowler: true,
        allocatedOvers: teamBAllocations.get(pId) || Math.max(1, Math.ceil(data.totalOvers / data.teamB.playerIds.length)),
      })),
    ];

    await tx.gullyMatchPlayer.createMany({ data: matchPlayersData });

    // Handle Toss and Initial Innings Setup if provided
    if (data.toss) {
      const tossWinnerTempTeam = data.toss.tossWinnerTeam === 'teamA' ? tempTeamA : tempTeamB;
      const tossLoserTempTeam = data.toss.tossWinnerTeam === 'teamA' ? tempTeamB : tempTeamA;

      let firstBattingTeam = tossWinnerTempTeam;
      let firstBowlingTeam = tossLoserTempTeam;

      if (data.toss.tossDecision === 'BOWL') {
        firstBattingTeam = tossLoserTempTeam;
        firstBowlingTeam = tossWinnerTempTeam;
      }

      await tx.gullyMatch.update({
        where: { id: match.id },
        data: {
          tossWinnerTeamId: tossWinnerTempTeam.id,
          tossDecision: data.toss.tossDecision,
        },
      });

      const innings1 = await tx.gullyInnings.create({
        data: {
          gullyMatchId: match.id,
          inningsNumber: 1,
          battingTeamName: firstBattingTeam.teamName,
          bowlingTeamName: firstBowlingTeam.teamName,
          battingTempTeamId: firstBattingTeam.id,
          bowlingTempTeamId: firstBowlingTeam.id,
          status: InningsStatus.IN_PROGRESS,
          currentStrikerId: data.openingPlayers?.strikerId || null,
          currentNonStrikerId: data.openingPlayers?.nonStrikerId || null,
          currentBowlerId: data.openingPlayers?.bowlerId || null,
        },
      });

      if (data.openingPlayers) {
        // Create initial scorecards
        await tx.gullyBattingScorecard.create({
          data: {
            inningsId: innings1.id,
            playerId: data.openingPlayers.strikerId,
            battingOrder: 1,
            notOut: true,
          },
        });

        await tx.gullyBattingScorecard.create({
          data: {
            inningsId: innings1.id,
            playerId: data.openingPlayers.nonStrikerId,
            battingOrder: 2,
            notOut: true,
          },
        });

        const bowlerAlloc =
          firstBowlingTeam.id === tempTeamA.id
            ? teamAAllocations.get(data.openingPlayers.bowlerId) || 1
            : teamBAllocations.get(data.openingPlayers.bowlerId) || 1;

        await tx.gullyBowlingScorecard.create({
          data: {
            inningsId: innings1.id,
            playerId: data.openingPlayers.bowlerId,
            bowlingOrder: 1,
            allocatedOvers: bowlerAlloc,
          },
        });
      }
    }

    return getGullyMatchDetails(match.id, tx);
  });
}

export async function createSinglesMatch(registeredTeamId: string, data: CreateGullySinglesMatchDto) {
  const team = await prisma.team.findUnique({
    where: { id: registeredTeamId },
  });

  if (!team || !team.isActive) {
    throw { statusCode: 404, message: 'Registered team not found or is inactive' };
  }

  // Derive batting queue of all participating players
  let battingOrderPlayerIds = data.battingOrderPlayerIds && data.battingOrderPlayerIds.length >= 2
    ? [...data.battingOrderPlayerIds]
    : [];

  if (battingOrderPlayerIds.length === 0 && data.selectedBatterId) {
    battingOrderPlayerIds = [data.selectedBatterId, ...(data.bowlerPlayerIds || [])];
  }

  // Remove any duplicates while preserving order
  battingOrderPlayerIds = Array.from(new Set(battingOrderPlayerIds));

  if (battingOrderPlayerIds.length < 2) {
    throw { statusCode: 400, message: 'At least 2 participating players are required for Singles Match' };
  }

  const allPlayerIds = battingOrderPlayerIds;
  const registeredPlayers = await prisma.player.findMany({
    where: {
      id: { in: allPlayerIds },
      teamId: registeredTeamId,
    },
  });

  if (registeredPlayers.length !== allPlayerIds.length) {
    throw {
      statusCode: 400,
      message: 'All participating players must belong to your registered team squad',
    };
  }

  const totalOvers = data.totalOvers || 2;
  const firstBatterId = battingOrderPlayerIds[0];
  const firstBatter = registeredPlayers.find(p => p.id === firstBatterId)!;
  const firstBowlerIds = allPlayerIds.filter(id => id !== firstBatterId);

  // Bowling allocations
  const allocationMap = new Map((data.bowlingAllocations || []).map(a => [a.playerId, a.allocatedOvers]));
  const defaultAllocPerBowler = Math.max(1, Math.ceil(totalOvers / firstBowlerIds.length));

  return prisma.$transaction(async tx => {
    const openingBowlerId =
      data.openingBowlerId && firstBowlerIds.includes(data.openingBowlerId)
        ? data.openingBowlerId
        : firstBowlerIds[0];

    // Create GullyMatch
    const match = await tx.gullyMatch.create({
      data: {
        registeredTeamId,
        matchType: GullyMatchType.SINGLES_MATCH,
        matchDate: data.matchDate ? new Date(data.matchDate) : new Date(),
        venue: data.venue?.trim() || null,
        status: MatchStatus.LIVE,
        totalOvers,
        selectedBatterId: firstBatterId,
        draftShuffled: !!data.draftShuffled,
        currentInningsNumber: 1,
        currentRoundNumber: 1,
        singlesBattingOrder: JSON.stringify(battingOrderPlayerIds),
        bowlingAllocationRule: data.bowlingAllocationRule || 'MAX_LIMIT',
        singlesDismissalRule: data.singlesDismissalRule || 'LAST_WICKET_ENDS_INNINGS',
        bowlerOrderRule: data.bowlerOrderRule || 'FREE_SELECTION',
      },
    });

    // Create Match Players for ALL participating players (all can bat and bowl)
    const matchPlayersData: Prisma.GullyMatchPlayerCreateManyInput[] = battingOrderPlayerIds.map((pId, idx) => ({
      gullyMatchId: match.id,
      playerId: pId,
      isBatter: true,
      isBowler: true,
      battingOrder: idx + 1,
      allocatedOvers: allocationMap.get(pId) || defaultAllocPerBowler,
    }));

    await tx.gullyMatchPlayer.createMany({ data: matchPlayersData });

    // Create 1st Innings (Round 1, Batter #1)
    const innings = await tx.gullyInnings.create({
      data: {
        gullyMatchId: match.id,
        inningsNumber: 1,
        roundNumber: 1,
        batterId: firstBatterId,
        battingTeamName: `${firstBatter.playerName} (Round 1)`,
        bowlingTeamName: 'Bowling Attack',
        status: InningsStatus.IN_PROGRESS,
        currentStrikerId: firstBatterId,
        currentNonStrikerId: null, // Singles match has NO non-striker
        currentBowlerId: openingBowlerId,
      },
    });

    // Create Batting Scorecard for Solo Batter
    await tx.gullyBattingScorecard.create({
      data: {
        inningsId: innings.id,
        playerId: firstBatterId,
        battingOrder: 1,
        notOut: true,
      },
    });

    // Create Bowling Scorecards for all bowlers facing this batter
    for (let i = 0; i < firstBowlerIds.length; i++) {
      const bId = firstBowlerIds[i];
      await tx.gullyBowlingScorecard.create({
        data: {
          inningsId: innings.id,
          playerId: bId,
          bowlingOrder: i + 1,
          allocatedOvers: allocationMap.get(bId) || defaultAllocPerBowler,
        },
      });
    }

    return getGullyMatchDetails(match.id, tx);
  });
}

export async function performGullyDraft(registeredTeamId: string, playerIds: string[]) {
  const registeredPlayers = await prisma.player.findMany({
    where: {
      id: { in: playerIds },
      teamId: registeredTeamId,
    },
    select: {
      id: true,
      playerName: true,
      jerseyNumber: true,
      role: true,
    },
  });

  if (registeredPlayers.length < 2) {
    throw { statusCode: 400, message: 'At least 2 players are needed for a Gully Draft' };
  }

  // Fisher-Yates fair shuffle of ALL players into an ordered batting queue
  const shuffled = [...registeredPlayers];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Batter is randomly selected (index 0)
  const selectedBatter = shuffled[0];
  const bowlers = shuffled.slice(1);

  return {
    selectedBatter,
    bowlers,
    battingOrder: shuffled,
    totalPlayers: shuffled.length,
  };
}

export async function startNextSinglesBatter(
  matchId: string,
  registeredTeamId: string,
  data?: { openingBowlerId?: string }
) {
  return prisma.$transaction(async tx => {
    const match = await tx.gullyMatch.findUnique({
      where: { id: matchId },
      include: {
        matchPlayers: { include: { player: true } },
        innings: true,
      },
    });

    if (!match) throw { statusCode: 404, message: 'Gully match not found' };
    if (match.registeredTeamId !== registeredTeamId) {
      throw { statusCode: 403, message: 'Access denied: You do not own this Gully match' };
    }
    if (match.matchType !== GullyMatchType.SINGLES_MATCH) {
      throw { statusCode: 400, message: 'Next batter is only applicable for Singles Match' };
    }
    if (match.status === MatchStatus.COMPLETED) {
      throw { statusCode: 400, message: 'Match is already completed' };
    }

    const currentRound = match.currentRoundNumber || 1;
    const battingOrder: string[] = JSON.parse(match.singlesBattingOrder || '[]');

    // Mark any in-progress innings as completed
    const activeInnings = match.innings.find(i => i.status === InningsStatus.IN_PROGRESS);
    if (activeInnings) {
      await tx.gullyInnings.update({
        where: { id: activeInnings.id },
        data: { status: InningsStatus.COMPLETED },
      });
    }

    // Find who has already batted in currentRound
    const inningsInThisRound = await tx.gullyInnings.findMany({
      where: { gullyMatchId: matchId, roundNumber: currentRound },
    });
    const alreadyBattedIds = new Set(inningsInThisRound.map(i => i.batterId).filter(Boolean));

    // Next batter in queue
    const nextBatterId = battingOrder.find(id => !alreadyBattedIds.has(id));
    if (!nextBatterId) {
      throw {
        statusCode: 400,
        message: `All batters have completed batting in Round ${currentRound}. Please start Round ${currentRound + 1} or click End Match.`,
      };
    }

    const nextBatter = match.matchPlayers.find(p => p.playerId === nextBatterId)?.player;
    if (!nextBatter) throw { statusCode: 400, message: 'Next batter not found in match players' };

    const bowlers = match.matchPlayers.filter(p => p.playerId !== nextBatterId);
    const chosenBowlerId =
      data?.openingBowlerId && bowlers.some(b => b.playerId === data.openingBowlerId)
        ? data.openingBowlerId
        : bowlers[0].playerId;

    const nextInningsNumber = match.innings.length + 1;

    const newInnings = await tx.gullyInnings.create({
      data: {
        gullyMatchId: match.id,
        inningsNumber: nextInningsNumber,
        roundNumber: currentRound,
        batterId: nextBatterId,
        battingTeamName: `${nextBatter.playerName} (Round ${currentRound})`,
        bowlingTeamName: 'Bowling Attack',
        status: InningsStatus.IN_PROGRESS,
        currentStrikerId: nextBatterId,
        currentNonStrikerId: null,
        currentBowlerId: chosenBowlerId,
      },
    });

    await tx.gullyBattingScorecard.create({
      data: {
        inningsId: newInnings.id,
        playerId: nextBatterId,
        battingOrder: 1,
        notOut: true,
      },
    });

    const defaultAllocPerBowler = Math.max(1, Math.ceil(match.totalOvers / bowlers.length));
    for (let i = 0; i < bowlers.length; i++) {
      const b = bowlers[i];
      await tx.gullyBowlingScorecard.create({
        data: {
          inningsId: newInnings.id,
          playerId: b.playerId,
          bowlingOrder: i + 1,
          allocatedOvers: b.allocatedOvers || defaultAllocPerBowler,
        },
      });
    }

    await tx.gullyMatch.update({
      where: { id: matchId },
      data: {
        currentInningsNumber: nextInningsNumber,
        selectedBatterId: nextBatterId,
      },
    });

    return getGullyMatchDetails(matchId, tx);
  });
}

export async function startNextSinglesRound(matchId: string, registeredTeamId: string) {
  return prisma.$transaction(async tx => {
    const match = await tx.gullyMatch.findUnique({
      where: { id: matchId },
      include: {
        matchPlayers: { include: { player: true } },
        innings: {
          include: { battingScorecards: true },
        },
      },
    });

    if (!match) throw { statusCode: 404, message: 'Gully match not found' };
    if (match.registeredTeamId !== registeredTeamId) {
      throw { statusCode: 403, message: 'Access denied' };
    }
    if (match.matchType !== GullyMatchType.SINGLES_MATCH) {
      throw { statusCode: 400, message: 'Rounds are only applicable for Singles Match' };
    }
    if (match.status === MatchStatus.COMPLETED) {
      throw { statusCode: 400, message: 'Match is already completed' };
    }

    const currentRound = match.currentRoundNumber || 1;

    // Mark any active innings as completed
    const activeInnings = match.innings.find(i => i.status === InningsStatus.IN_PROGRESS);
    if (activeInnings) {
      await tx.gullyInnings.update({
        where: { id: activeInnings.id },
        data: { status: InningsStatus.COMPLETED },
      });
    }

    // Compute previous round scores for all participating players
    const roundInnings = await tx.gullyInnings.findMany({
      where: { gullyMatchId: matchId, roundNumber: currentRound },
      include: { battingScorecards: true },
    });

    // Score map for each player in this round
    const scoreMap = new Map<string, { runs: number; balls: number; strikeRate: number }>();
    for (const inn of roundInnings) {
      for (const card of inn.battingScorecards) {
        scoreMap.set(card.playerId, {
          runs: card.runs,
          balls: card.balls,
          strikeRate: card.strikeRate,
        });
      }
    }

    // Sort all match players according to highest score from previous round
    const sortedPlayers = [...match.matchPlayers].sort((a, b) => {
      const scoreA = scoreMap.get(a.playerId) || { runs: 0, balls: 0, strikeRate: 0 };
      const scoreB = scoreMap.get(b.playerId) || { runs: 0, balls: 0, strikeRate: 0 };
      // Primary: highest runs descending
      if (scoreB.runs !== scoreA.runs) return scoreB.runs - scoreA.runs;
      // Secondary: highest strike rate descending
      if (scoreB.strikeRate !== scoreA.strikeRate) return scoreB.strikeRate - scoreA.strikeRate;
      // Tertiary: fewest balls faced
      return scoreA.balls - scoreB.balls;
    });

    const newBattingOrder = sortedPlayers.map(p => p.playerId);
    const nextRound = currentRound + 1;

    await tx.gullyMatch.update({
      where: { id: matchId },
      data: {
        currentRoundNumber: nextRound,
        singlesBattingOrder: JSON.stringify(newBattingOrder),
      },
    });

    // Now start the first batter of the new round (the highest scorer from previous round!)
    const firstBatterId = newBattingOrder[0];
    const firstBatter = match.matchPlayers.find(p => p.playerId === firstBatterId)?.player!;
    const bowlers = match.matchPlayers.filter(p => p.playerId !== firstBatterId);
    const nextInningsNumber = match.innings.length + 1;

    const newInnings = await tx.gullyInnings.create({
      data: {
        gullyMatchId: match.id,
        inningsNumber: nextInningsNumber,
        roundNumber: nextRound,
        batterId: firstBatterId,
        battingTeamName: `${firstBatter.playerName} (Round ${nextRound})`,
        bowlingTeamName: 'Bowling Attack',
        status: InningsStatus.IN_PROGRESS,
        currentStrikerId: firstBatterId,
        currentNonStrikerId: null,
        currentBowlerId: bowlers[0].playerId,
      },
    });

    await tx.gullyBattingScorecard.create({
      data: {
        inningsId: newInnings.id,
        playerId: firstBatterId,
        battingOrder: 1,
        notOut: true,
      },
    });

    const defaultAllocPerBowler = Math.max(1, Math.ceil(match.totalOvers / bowlers.length));
    for (let i = 0; i < bowlers.length; i++) {
      const b = bowlers[i];
      await tx.gullyBowlingScorecard.create({
        data: {
          inningsId: newInnings.id,
          playerId: b.playerId,
          bowlingOrder: i + 1,
          allocatedOvers: b.allocatedOvers || defaultAllocPerBowler,
        },
      });
    }

    await tx.gullyMatch.update({
      where: { id: matchId },
      data: {
        currentInningsNumber: nextInningsNumber,
        selectedBatterId: firstBatterId,
      },
    });

    return getGullyMatchDetails(matchId, tx);
  });
}

export async function endGullyMatch(matchId: string, registeredTeamId: string) {
  return prisma.$transaction(async tx => {
    const match = await tx.gullyMatch.findUnique({
      where: { id: matchId },
      include: {
        temporaryTeams: true,
        matchPlayers: { include: { player: true } },
        innings: {
          include: {
            battingScorecards: { include: { player: true } },
            bowlingScorecards: { include: { player: true } },
          },
        },
      },
    });

    if (!match) throw { statusCode: 404, message: 'Gully match not found' };
    if (match.registeredTeamId !== registeredTeamId) {
      throw { statusCode: 403, message: 'Access denied: You do not own this Gully match' };
    }

    // Mark current in-progress innings as completed
    await tx.gullyInnings.updateMany({
      where: { gullyMatchId: matchId, status: InningsStatus.IN_PROGRESS },
      data: { status: InningsStatus.COMPLETED },
    });

    let resultDescription = '';
    let winnerName = '';

    if (match.matchType === GullyMatchType.SINGLES_MATCH) {
      // Calculate total runs and wickets for each player across all rounds
      const playerStats = new Map<string, { playerName: string; runs: number; balls: number; wickets: number; runsConceded: number }>();

      for (const p of match.matchPlayers) {
        playerStats.set(p.playerId, {
          playerName: p.player.playerName,
          runs: 0,
          balls: 0,
          wickets: 0,
          runsConceded: 0,
        });
      }

      for (const inn of match.innings) {
        for (const bCard of inn.battingScorecards) {
          const s = playerStats.get(bCard.playerId);
          if (s) {
            s.runs += bCard.runs;
            s.balls += bCard.balls;
          }
        }
        for (const bowlCard of inn.bowlingScorecards) {
          const s = playerStats.get(bowlCard.playerId);
          if (s) {
            s.wickets += bowlCard.wickets;
            s.runsConceded += bowlCard.runsConceded;
          }
        }
      }

      const ranked = Array.from(playerStats.values()).sort((a, b) => {
        if (b.runs !== a.runs) return b.runs - a.runs;
        return b.wickets - a.wickets;
      });

      const champion = ranked[0];
      winnerName = champion?.playerName || 'Singles Champion';
      resultDescription = `${winnerName} emerged as Champion with ${champion?.runs || 0} total runs scored across ${match.currentRoundNumber || 1} round(s)!`;
    } else {
      // Team Match
      const inn1 = match.innings.find(i => i.inningsNumber === 1);
      const inn2 = match.innings.find(i => i.inningsNumber === 2);
      if (inn1 && inn2) {
        if (inn2.totalRuns > inn1.totalRuns) {
          winnerName = inn2.battingTeamName;
          resultDescription = `${winnerName} won by chasing target in Gully match`;
        } else if (inn1.totalRuns > inn2.totalRuns) {
          winnerName = inn1.battingTeamName;
          resultDescription = `${winnerName} won by defending score in Gully match`;
        } else {
          winnerName = 'Tie';
          resultDescription = 'Match ended in a thrilling Tie!';
        }
      } else {
        winnerName = inn1?.battingTeamName || 'Match Ended';
        resultDescription = 'Match concluded by scorer';
      }
    }

    await tx.gullyMatch.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.COMPLETED,
        resultType: MatchResultType.NORMAL,
        resultDescription,
        winnerName,
      },
    });

    return getGullyMatchDetails(matchId, tx);
  });
}

export async function conductGullyToss(
  matchId: string,
  registeredTeamId: string,
  data: { tossWinnerTeamId: string; tossDecision: TossDecision }
) {
  const match = await prisma.gullyMatch.findUnique({
    where: { id: matchId },
    include: { temporaryTeams: true },
  });

  if (!match) throw { statusCode: 404, message: 'Gully match not found' };
  if (match.registeredTeamId !== registeredTeamId) {
    throw { statusCode: 403, message: 'Access denied: You do not own this Gully match' };
  }
  if (match.matchType !== GullyMatchType.TEAM_MATCH) {
    throw { statusCode: 400, message: 'Toss is only applicable for Team Matches' };
  }

  const winnerTeam = match.temporaryTeams.find(t => t.id === data.tossWinnerTeamId);
  const loserTeam = match.temporaryTeams.find(t => t.id !== data.tossWinnerTeamId);

  if (!winnerTeam || !loserTeam) {
    throw { statusCode: 400, message: 'Invalid toss winner team ID' };
  }

  let firstBattingTeam = winnerTeam;
  let firstBowlingTeam = loserTeam;

  if (data.tossDecision === 'BOWL') {
    firstBattingTeam = loserTeam;
    firstBowlingTeam = winnerTeam;
  }

  return prisma.$transaction(async tx => {
    await tx.gullyMatch.update({
      where: { id: matchId },
      data: {
        tossWinnerTeamId: winnerTeam.id,
        tossDecision: data.tossDecision,
        status: MatchStatus.LIVE,
      },
    });

    // Check if 1st innings already exists
    let innings1 = await tx.gullyInnings.findUnique({
      where: { gullyMatchId_inningsNumber: { gullyMatchId: matchId, inningsNumber: 1 } },
    });

    if (!innings1) {
      innings1 = await tx.gullyInnings.create({
        data: {
          gullyMatchId: matchId,
          inningsNumber: 1,
          battingTeamName: firstBattingTeam.teamName,
          bowlingTeamName: firstBowlingTeam.teamName,
          battingTempTeamId: firstBattingTeam.id,
          bowlingTempTeamId: firstBowlingTeam.id,
          status: InningsStatus.IN_PROGRESS,
        },
      });
    }

    return getGullyMatchDetails(matchId, tx);
  });
}

export async function selectGullyOpeningPlayers(
  matchId: string,
  registeredTeamId: string,
  data: {
    strikerId: string;
    nonStrikerId?: string | null;
    bowlerId: string;
    inningsNumber?: number;
  }
) {
  const match = await prisma.gullyMatch.findUnique({
    where: { id: matchId },
    include: {
      matchPlayers: true,
      temporaryTeams: true,
    },
  });

  if (!match) throw { statusCode: 404, message: 'Gully match not found' };
  if (match.registeredTeamId !== registeredTeamId) {
    throw { statusCode: 403, message: 'Access denied: You do not own this Gully match' };
  }

  const innNum = data.inningsNumber || match.currentInningsNumber || 1;
  const innings = await prisma.gullyInnings.findUnique({
    where: { gullyMatchId_inningsNumber: { gullyMatchId: matchId, inningsNumber: innNum } },
  });

  if (!innings) {
    throw { statusCode: 404, message: `Innings ${innNum} not found` };
  }

  return prisma.$transaction(async tx => {
    // Update Innings active players
    await tx.gullyInnings.update({
      where: { id: innings.id },
      data: {
        currentStrikerId: data.strikerId,
        currentNonStrikerId: data.nonStrikerId || null,
        currentBowlerId: data.bowlerId,
      },
    });

    // Batting scorecard for Striker
    const existingStrikerCard = await tx.gullyBattingScorecard.findUnique({
      where: { inningsId_playerId: { inningsId: innings.id, playerId: data.strikerId } },
    });
    if (!existingStrikerCard) {
      await tx.gullyBattingScorecard.create({
        data: {
          inningsId: innings.id,
          playerId: data.strikerId,
          battingOrder: 1,
          notOut: true,
        },
      });
    }

    // Batting scorecard for Non-Striker (if team match)
    if (data.nonStrikerId) {
      const existingNonStrikerCard = await tx.gullyBattingScorecard.findUnique({
        where: { inningsId_playerId: { inningsId: innings.id, playerId: data.nonStrikerId } },
      });
      if (!existingNonStrikerCard) {
        await tx.gullyBattingScorecard.create({
          data: {
            inningsId: innings.id,
            playerId: data.nonStrikerId,
            battingOrder: 2,
            notOut: true,
          },
        });
      }
    }

    // Bowling scorecard for Bowler
    const matchPlayer = match.matchPlayers.find(p => p.playerId === data.bowlerId);
    const allocated = matchPlayer?.allocatedOvers || 1;

    const existingBowlerCard = await tx.gullyBowlingScorecard.findUnique({
      where: { inningsId_playerId: { inningsId: innings.id, playerId: data.bowlerId } },
    });
    if (!existingBowlerCard) {
      await tx.gullyBowlingScorecard.create({
        data: {
          inningsId: innings.id,
          playerId: data.bowlerId,
          bowlingOrder: 1,
          allocatedOvers: allocated,
        },
      });
    }

    return getGullyMatchDetails(matchId, tx);
  });
}

export async function getGullyMatchDetails(matchId: string, tx: any = prisma) {
  const match = await tx.gullyMatch.findUnique({
    where: { id: matchId },
    include: {
      registeredTeam: {
        select: { id: true, teamName: true, username: true },
      },
      selectedBatter: {
        select: { id: true, playerName: true, jerseyNumber: true, role: true },
      },
      temporaryTeams: {
        include: {
          captain: { select: { id: true, playerName: true } },
          players: {
            include: {
              player: { select: { id: true, playerName: true, jerseyNumber: true, role: true } },
            },
          },
        },
      },
      matchPlayers: {
        include: {
          player: { select: { id: true, playerName: true, jerseyNumber: true, role: true } },
        },
      },
      innings: {
        orderBy: { inningsNumber: 'asc' },
        include: {
          battingScorecards: {
            orderBy: { battingOrder: 'asc' },
            include: {
              player: { select: { id: true, playerName: true, jerseyNumber: true, role: true } },
            },
          },
          bowlingScorecards: {
            orderBy: { bowlingOrder: 'asc' },
            include: {
              player: { select: { id: true, playerName: true, jerseyNumber: true, role: true } },
            },
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
            take: 30,
          },
        },
      },
    },
  });

  if (!match) {
    throw { statusCode: 404, message: 'Gully match not found' };
  }

  // If SINGLES_MATCH, attach round-by-round breakdown and cumulative tournament leaderboard
  if (match.matchType === GullyMatchType.SINGLES_MATCH) {
    const battingOrder: string[] = JSON.parse(match.singlesBattingOrder || '[]');
    const roundMap = new Map<number, typeof match.innings>();

    for (const inn of match.innings) {
      const r = (inn as any).roundNumber || 1;
      if (!roundMap.has(r)) roundMap.set(r, []);
      roundMap.get(r)!.push(inn);
    }

    const rounds = Array.from(roundMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([roundNumber, inningsList]) => {
        const roundLeaderboard = inningsList
          .map(inn => {
            const card = inn.battingScorecards[0];
            return {
              inningsId: inn.id,
              inningsNumber: inn.inningsNumber,
              batterId: inn.batterId || card?.playerId,
              playerName: card?.player?.playerName || inn.battingTeamName,
              jerseyNumber: card?.player?.jerseyNumber,
              role: card?.player?.role,
              runs: card?.runs || inn.totalRuns || 0,
              balls: card?.balls || 0,
              fours: card?.fours || 0,
              sixes: card?.sixes || 0,
              strikeRate: card?.strikeRate || 0,
              notOut: card?.notOut ?? true,
              dismissalText: card?.dismissalText || null,
              wicketsLost: inn.wickets,
              oversFacedText: inn.oversCompletedText,
              status: inn.status,
            };
          })
          .sort((a, b) => {
            if (b.runs !== a.runs) return b.runs - a.runs;
            if (b.strikeRate !== a.strikeRate) return b.strikeRate - a.strikeRate;
            return a.balls - b.balls;
          })
          .map((item, idx) => ({ ...item, rank: idx + 1 }));

        return {
          roundNumber,
          inningsList,
          roundLeaderboard,
        };
      });

    // Build cumulative grand summary across ALL rounds
    const cumulativeMap = new Map<string, any>();
    for (const mp of match.matchPlayers) {
      cumulativeMap.set(mp.playerId, {
        playerId: mp.playerId,
        playerName: mp.player.playerName,
        jerseyNumber: mp.player.jerseyNumber,
        role: mp.player.role,
        totalRuns: 0,
        totalBalls: 0,
        fours: 0,
        sixes: 0,
        inningsBatted: 0,
        highestScore: 0,
        totalWickets: 0,
        runsConceded: 0,
        legalBalls: 0,
        maidens: 0,
      });
    }

    for (const inn of match.innings) {
      for (const bCard of inn.battingScorecards) {
        const stats = cumulativeMap.get(bCard.playerId);
        if (stats) {
          stats.totalRuns += bCard.runs;
          stats.totalBalls += bCard.balls;
          stats.fours += bCard.fours;
          stats.sixes += bCard.sixes;
          stats.inningsBatted += 1;
          if (bCard.runs > stats.highestScore) stats.highestScore = bCard.runs;
        }
      }
      for (const bowlCard of inn.bowlingScorecards) {
        const stats = cumulativeMap.get(bowlCard.playerId);
        if (stats) {
          stats.totalWickets += bowlCard.wickets;
          stats.runsConceded += bowlCard.runsConceded;
          stats.legalBalls += bowlCard.legalBalls;
          stats.maidens += bowlCard.maidens;
        }
      }
    }

    const cumulativeLeaderboard = Array.from(cumulativeMap.values())
      .map(p => ({
        ...p,
        strikeRate: p.totalBalls > 0 ? parseFloat(((p.totalRuns / p.totalBalls) * 100).toFixed(2)) : 0,
        oversText: `${Math.floor(p.legalBalls / 6)}.${p.legalBalls % 6}`,
        economy: p.legalBalls > 0 ? parseFloat(((p.runsConceded / p.legalBalls) * 6).toFixed(2)) : 0,
      }))
      .sort((a, b) => {
        if (b.totalRuns !== a.totalRuns) return b.totalRuns - a.totalRuns;
        if (b.totalWickets !== a.totalWickets) return b.totalWickets - a.totalWickets;
        return a.runsConceded - b.runsConceded;
      })
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    // Current round status & queue
    const currentRound = match.currentRoundNumber || 1;
    const currentRoundInnings = match.innings.filter(i => ((i as any).roundNumber || 1) === currentRound);
    const completedBatterIdsInRound = new Set(
      currentRoundInnings.filter(i => i.status === InningsStatus.COMPLETED).map(i => i.batterId).filter(Boolean)
    );
    const activeInnings = match.innings.find(i => i.inningsNumber === match.currentInningsNumber);
    const isRoundComplete =
      battingOrder.length > 0 && battingOrder.every(id => completedBatterIdsInRound.has(id));

    const singlesQueue = battingOrder.map((id, idx) => {
      const p = match.matchPlayers.find(mp => mp.playerId === id)?.player;
      const inn = currentRoundInnings.find(i => i.batterId === id);
      const isBattingNow =
        activeInnings?.batterId === id && activeInnings?.status === InningsStatus.IN_PROGRESS;
      const hasFinished = completedBatterIdsInRound.has(id);
      return {
        order: idx + 1,
        playerId: id,
        playerName: p?.playerName || 'Player',
        jerseyNumber: p?.jerseyNumber,
        hasBatted: hasFinished,
        isCurrentlyBatting: isBattingNow,
        runsScored: inn?.totalRuns ?? null,
        oversFaced: inn?.oversCompletedText ?? null,
      };
    });

    return {
      ...match,
      rounds,
      cumulativeLeaderboard,
      singlesQueue,
      isRoundComplete,
    };
  }

  return match;
}

export async function listGullyMatches(
  registeredTeamId: string,
  filter?: { matchType?: GullyMatchType; status?: MatchStatus }
) {
  const whereClause: Prisma.GullyMatchWhereInput = {
    registeredTeamId,
  };

  if (filter?.matchType) {
    whereClause.matchType = filter.matchType;
  }

  if (filter?.status) {
    whereClause.status = filter.status;
  }

  return prisma.gullyMatch.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      selectedBatter: {
        select: { id: true, playerName: true, jerseyNumber: true },
      },
      temporaryTeams: {
        select: { id: true, teamName: true, isTeamA: true },
      },
      innings: {
        select: {
          inningsNumber: true,
          battingTeamName: true,
          bowlingTeamName: true,
          totalRuns: true,
          wickets: true,
          oversCompletedText: true,
          status: true,
        },
      },
    },
  });
}

export async function deleteGullyMatch(matchId: string, teamId: string, role?: string) {
  const match = await prisma.gullyMatch.findUnique({ where: { id: matchId } });
  if (!match) throw { statusCode: 404, message: 'Gully match not found' };

  if (role !== 'ADMIN' && match.registeredTeamId !== teamId) {
    throw { statusCode: 403, message: 'Access denied: You do not have permission to delete this Gully match' };
  }

  await prisma.gullyMatch.delete({ where: { id: matchId } });
  return { message: 'Gully match deleted successfully' };
}
