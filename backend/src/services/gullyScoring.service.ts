import {
  DismissalType,
  ExtraType,
  GullyMatchType,
  InningsStatus,
  MatchResultType,
  MatchStatus,
  SinglesDismissalRule,
} from '@prisma/client';
import { prisma } from '../config/db.js';
import {
  ballsToOversText,
  calculateEconomyRate,
  calculateStrikeRate,
} from '../utils/cricket.js';
import { GullyScoreDeliveryDto } from '../types/gully.types.js';

function formatDismissalText(
  dismissalType: DismissalType,
  bowlerCredited: boolean,
  bowlerName?: string | null,
  fielderName?: string | null
): string {
  switch (dismissalType) {
    case DismissalType.BOWLED:
      return bowlerName ? `b ${bowlerName}` : 'b Bowler';
    case DismissalType.CAUGHT:
      if (fielderName && bowlerName && fielderName === bowlerName) {
        return `c & b ${bowlerName}`;
      }
      return fielderName && bowlerName ? `c ${fielderName} b ${bowlerName}` : 'c Fielder';
    case DismissalType.LBW:
      return bowlerName ? `lbw b ${bowlerName}` : 'lbw';
    case DismissalType.RUN_OUT:
      return fielderName ? `run out (${fielderName})` : 'run out';
    case DismissalType.STUMPED:
      return fielderName && bowlerName
        ? `st ${fielderName} b ${bowlerName}`
        : 'stumped';
    case DismissalType.HIT_WICKET:
      return bowlerName ? `hit wicket b ${bowlerName}` : 'hit wicket';
    case DismissalType.RETIRED_OUT:
      return 'retired out';
    case DismissalType.OBSTRUCTING_FIELD:
      return 'obstructing the field';
    default:
      return 'out';
  }
}

export async function scoreGullyDelivery(
  matchId: string,
  registeredTeamId: string,
  dto: GullyScoreDeliveryDto
) {
  return prisma.$transaction(async tx => {
    const match = await tx.gullyMatch.findUnique({
      where: { id: matchId },
      include: {
        temporaryTeams: true,
        matchPlayers: {
          include: {
            player: { select: { id: true, playerName: true } },
          },
        },
      },
    });

    if (!match) throw { statusCode: 404, message: 'Gully match not found' };
    if (match.registeredTeamId !== registeredTeamId) {
      throw { statusCode: 403, message: 'Access denied: You do not own this Gully match' };
    }
    if (match.status === MatchStatus.COMPLETED) {
      throw { statusCode: 400, message: 'Match is already completed' };
    }

    const currentInnings = await tx.gullyInnings.findUnique({
      where: {
        gullyMatchId_inningsNumber: {
          gullyMatchId: matchId,
          inningsNumber: match.currentInningsNumber,
        },
      },
      include: {
        battingScorecards: true,
        bowlingScorecards: true,
      },
    });

    if (!currentInnings) throw { statusCode: 404, message: 'Current innings not found' };
    if (currentInnings.status !== InningsStatus.IN_PROGRESS) {
      throw { statusCode: 400, message: 'Current innings is not in progress' };
    }

    const isSingles = match.matchType === GullyMatchType.SINGLES_MATCH;
    const { currentStrikerId, currentNonStrikerId, currentBowlerId } = currentInnings;

    if (!currentStrikerId || !currentBowlerId) {
      throw { statusCode: 400, message: 'Striker and bowler must be set before scoring' };
    }
    if (!isSingles && !currentNonStrikerId) {
      throw { statusCode: 400, message: 'Non-striker must be set for team match before scoring' };
    }

    // Save previous snapshot for atomic rollback
    const prevStrikerId = currentStrikerId;
    const prevNonStrikerId = currentNonStrikerId;
    const prevBowlerId = currentBowlerId;

    // Delivery attributes
    const extraType = dto.extraType || ExtraType.NONE;
    const isLegalDelivery =
      extraType !== ExtraType.WIDE &&
      extraType !== ExtraType.NO_BALL &&
      extraType !== ExtraType.PENALTY;
    const batterRuns = dto.batterRuns || 0;
    const extraRuns = dto.extraRuns || 0;

    let deliveryRuns = 0;
    let bowlerRunsConceded = 0;
    let widePenalty = 0;
    let noBallPenalty = 0;
    let byeRuns = 0;
    let legByeRuns = 0;
    let penaltyRuns = 0;

    if (extraType === ExtraType.NONE) {
      deliveryRuns = batterRuns;
      bowlerRunsConceded = batterRuns;
    } else if (extraType === ExtraType.WIDE) {
      widePenalty = 1 + extraRuns;
      deliveryRuns = widePenalty;
      bowlerRunsConceded = widePenalty;
    } else if (extraType === ExtraType.NO_BALL) {
      noBallPenalty = 1;
      deliveryRuns = 1 + batterRuns + extraRuns;
      bowlerRunsConceded = 1 + batterRuns;
    } else if (extraType === ExtraType.BYE) {
      byeRuns = dto.extraRuns !== undefined && dto.extraRuns !== null ? dto.extraRuns : dto.batterRuns;
      deliveryRuns = byeRuns;
      bowlerRunsConceded = 0;
    } else if (extraType === ExtraType.LEG_BYE) {
      legByeRuns = dto.extraRuns !== undefined && dto.extraRuns !== null ? dto.extraRuns : dto.batterRuns;
      deliveryRuns = legByeRuns;
      bowlerRunsConceded = 0;
    } else if (extraType === ExtraType.PENALTY) {
      penaltyRuns = dto.extraRuns !== undefined && dto.extraRuns !== null ? dto.extraRuns : 5;
      deliveryRuns = penaltyRuns;
      bowlerRunsConceded = 0;
    }

    const currentOverNumber = Math.floor(currentInnings.legalBalls / 6);
    const ballNumberInOver = (currentInnings.legalBalls % 6) + 1;

    // Bowler credit for wickets
    const isWicket = !!dto.isWicket;
    let bowlerCredited = false;
    if (isWicket && dto.dismissalType) {
      const creditedTypes: DismissalType[] = [
        DismissalType.BOWLED,
        DismissalType.CAUGHT,
        DismissalType.LBW,
        DismissalType.STUMPED,
        DismissalType.HIT_WICKET,
      ];
      bowlerCredited = creditedTypes.includes(dto.dismissalType);
    }

    // Strike rotation calculation
    let strikeRotated = false;
    let nextStrikerId: string | null = currentStrikerId;
    let nextNonStrikerId: string | null = currentNonStrikerId;

    if (!isSingles) {
      // Normal team strike rotation
      let runningRuns = 0;
      if (extraType === ExtraType.NONE || extraType === ExtraType.NO_BALL) {
        runningRuns = batterRuns;
      } else if (extraType === ExtraType.WIDE) {
        runningRuns = extraRuns > 0 ? extraRuns : 0;
      } else if (extraType === ExtraType.BYE) {
        runningRuns = byeRuns;
      } else if (extraType === ExtraType.LEG_BYE) {
        runningRuns = legByeRuns;
      }

      if (dto.runsCompletedBeforeDismissal) {
        runningRuns = dto.runsCompletedBeforeDismissal;
      }

      strikeRotated = runningRuns % 2 === 1;
      if (strikeRotated) {
        nextStrikerId = currentNonStrikerId!;
        nextNonStrikerId = currentStrikerId;
      }
    } else {
      // In SINGLES MATCH: Never rotate strike!
      // All runs belong to the single batter. Strike stays with batter.
      strikeRotated = false;
      nextStrikerId = currentStrikerId;
      nextNonStrikerId = null;
    }

    // Wicket handling
    let dismissedPlayerId = dto.dismissedPlayerId || null;
    let incomingBatterId = dto.incomingBatterId || null;
    let singlesInningsEndedByWicket = false;

    if (isWicket) {
      if (isSingles) {
        dismissedPlayerId = currentStrikerId;
        if (match.singlesDismissalRule === SinglesDismissalRule.LAST_WICKET_ENDS_INNINGS) {
          singlesInningsEndedByWicket = true;
        } else {
          // BATTER_CONTINUES: Record wicket, but batter remains striker!
          nextStrikerId = currentStrikerId;
          nextNonStrikerId = null;
        }
      } else {
        // Team match wicket handling
        if (!dismissedPlayerId || (dismissedPlayerId !== currentStrikerId && dismissedPlayerId !== currentNonStrikerId)) {
          dismissedPlayerId = currentStrikerId;
        }

        if (dismissedPlayerId === currentStrikerId) {
          if (strikeRotated) {
            nextNonStrikerId = incomingBatterId || null;
          } else {
            nextStrikerId = incomingBatterId || null;
          }
        } else if (dismissedPlayerId === currentNonStrikerId) {
          if (strikeRotated) {
            nextStrikerId = incomingBatterId || null;
          } else {
            nextNonStrikerId = incomingBatterId || null;
          }
        }
      }
    }

    // Over completion check
    const newLegalBalls = currentInnings.legalBalls + (isLegalDelivery ? 1 : 0);
    const isOverComplete = isLegalDelivery && newLegalBalls % 6 === 0;

    // Maiden over check
    let isMaidenOver = false;
    if (isOverComplete) {
      const overDeliveries = await tx.gullyDelivery.findMany({
        where: {
          inningsId: currentInnings.id,
          overNumber: currentOverNumber,
        },
      });

      const totalRunsConcededInOver =
        overDeliveries.reduce((sum, d) => {
          let runs = 0;
          if (d.extraType === ExtraType.NONE) runs += d.batterRuns;
          else if (d.extraType === ExtraType.WIDE) runs += 1 + d.extraRuns;
          else if (d.extraType === ExtraType.NO_BALL) runs += 1 + d.batterRuns;
          return sum + runs;
        }, 0) + bowlerRunsConceded;

      if (totalRunsConcededInOver === 0) {
        isMaidenOver = true;
      }

      // End of over: batters change ends in TEAM MATCH ONLY
      if (!isSingles) {
        const tempStriker = nextStrikerId;
        nextStrikerId = nextNonStrikerId;
        nextNonStrikerId = tempStriker;
      }
      // In SINGLES MATCH: Batter does NOT change ends!
    }

    // Record Delivery
    const delivery = await tx.gullyDelivery.create({
      data: {
        inningsId: currentInnings.id,
        overNumber: currentOverNumber,
        ballNumber: ballNumberInOver,
        strikerId: currentStrikerId,
        nonStrikerId: currentNonStrikerId,
        bowlerId: currentBowlerId,
        batterRuns,
        extraRuns,
        extraType,
        totalRuns: deliveryRuns,
        isLegalDelivery,
        isWicket,
        dismissalType: dto.dismissalType || null,
        dismissedPlayerId,
        fielderId: dto.fielderId || null,
        bowlerCredited,
        runsCompletedBeforeDismissal: dto.runsCompletedBeforeDismissal || 0,
        strikeRotated,
        incomingBatterId,
        prevStrikerId,
        prevNonStrikerId,
        prevBowlerId,
      },
    });

    // Record Wicket if occurred
    if (isWicket && dismissedPlayerId && dto.dismissalType) {
      await tx.gullyWicket.create({
        data: {
          inningsId: currentInnings.id,
          deliveryId: delivery.id,
          playerId: dismissedPlayerId,
          dismissalType: dto.dismissalType,
          bowlerCredited,
          bowlerId: bowlerCredited ? currentBowlerId : null,
          fielderId: dto.fielderId || null,
          overBallText: `${currentOverNumber}.${ballNumberInOver}`,
          teamRunsAtFall: currentInnings.totalRuns + deliveryRuns,
          wicketNumber: currentInnings.wickets + 1,
        },
      });
    }

    // Update Batting Scorecard for striker
    const strikerCard = await tx.gullyBattingScorecard.findUnique({
      where: {
        inningsId_playerId: {
          inningsId: currentInnings.id,
          playerId: currentStrikerId,
        },
      },
    });

    if (strikerCard) {
      const isStrikerDismissed = isWicket && dismissedPlayerId === currentStrikerId;
      const isReallyOut = isSingles
        ? singlesInningsEndedByWicket
        : isStrikerDismissed;

      const newStrikerRuns =
        strikerCard.runs +
        (extraType === ExtraType.NONE || extraType === ExtraType.NO_BALL ? batterRuns : 0);
      const newStrikerBalls =
        strikerCard.balls + (isLegalDelivery || extraType === ExtraType.NO_BALL ? 1 : 0);
      const newFours = strikerCard.fours + (batterRuns === 4 ? 1 : 0);
      const newSixes = strikerCard.sixes + (batterRuns === 6 ? 1 : 0);

      const bowlerPlayer = match.matchPlayers.find(p => p.playerId === currentBowlerId)?.player;
      const fielderPlayer = dto.fielderId
        ? match.matchPlayers.find(p => p.playerId === dto.fielderId)?.player
        : null;

      let dismissalText: string | null = null;
      if (isStrikerDismissed && dto.dismissalType) {
        dismissalText = formatDismissalText(
          dto.dismissalType,
          bowlerCredited,
          bowlerPlayer?.playerName,
          fielderPlayer?.playerName
        );
      }

      await tx.gullyBattingScorecard.update({
        where: { id: strikerCard.id },
        data: {
          runs: newStrikerRuns,
          balls: newStrikerBalls,
          fours: newFours,
          sixes: newSixes,
          strikeRate: calculateStrikeRate(newStrikerRuns, newStrikerBalls),
          notOut: !isReallyOut,
          dismissalType: isStrikerDismissed ? dto.dismissalType : null,
          dismissalText: isStrikerDismissed ? dismissalText : null,
          bowlerId: isStrikerDismissed && bowlerCredited ? currentBowlerId : null,
          fielderId: isStrikerDismissed ? dto.fielderId || null : null,
        },
      });
    }

    // If non-striker was dismissed in team match
    if (!isSingles && isWicket && dismissedPlayerId === currentNonStrikerId && currentNonStrikerId) {
      const nonStrikerCard = await tx.gullyBattingScorecard.findUnique({
        where: {
          inningsId_playerId: {
            inningsId: currentInnings.id,
            playerId: currentNonStrikerId,
          },
        },
      });
      if (nonStrikerCard) {
        const bowlerPlayer = match.matchPlayers.find(p => p.playerId === currentBowlerId)?.player;
        const fielderPlayer = dto.fielderId
          ? match.matchPlayers.find(p => p.playerId === dto.fielderId)?.player
          : null;
        await tx.gullyBattingScorecard.update({
          where: { id: nonStrikerCard.id },
          data: {
            notOut: false,
            dismissalType: dto.dismissalType,
            dismissalText: formatDismissalText(
              dto.dismissalType!,
              bowlerCredited,
              bowlerPlayer?.playerName,
              fielderPlayer?.playerName
            ),
            fielderId: dto.fielderId || null,
          },
        });
      }
    }

    // If incoming batter in team match
    if (!isSingles && incomingBatterId) {
      const existingIncomingCard = await tx.gullyBattingScorecard.findUnique({
        where: {
          inningsId_playerId: {
            inningsId: currentInnings.id,
            playerId: incomingBatterId,
          },
        },
      });
      if (!existingIncomingCard) {
        const nextOrder =
          (await tx.gullyBattingScorecard.count({ where: { inningsId: currentInnings.id } })) + 1;
        await tx.gullyBattingScorecard.create({
          data: {
            inningsId: currentInnings.id,
            playerId: incomingBatterId,
            battingOrder: nextOrder,
            notOut: true,
          },
        });
      }
    }

    // Update Bowling Scorecard
    const bowlerCard = await tx.gullyBowlingScorecard.findUnique({
      where: {
        inningsId_playerId: {
          inningsId: currentInnings.id,
          playerId: currentBowlerId,
        },
      },
    });

    if (bowlerCard) {
      const newBowlerBalls = bowlerCard.legalBalls + (isLegalDelivery ? 1 : 0);
      const newRunsConceded = bowlerCard.runsConceded + bowlerRunsConceded;
      const newWickets = bowlerCard.wickets + (isWicket && bowlerCredited ? 1 : 0);
      const newMaidens = bowlerCard.maidens + (isMaidenOver ? 1 : 0);
      const newWides = bowlerCard.wides + (extraType === ExtraType.WIDE ? 1 : 0);
      const newNoBalls = bowlerCard.noBalls + (extraType === ExtraType.NO_BALL ? 1 : 0);

      await tx.gullyBowlingScorecard.update({
        where: { id: bowlerCard.id },
        data: {
          legalBalls: newBowlerBalls,
          oversText: ballsToOversText(newBowlerBalls),
          runsConceded: newRunsConceded,
          wickets: newWickets,
          maidens: newMaidens,
          wides: newWides,
          noBalls: newNoBalls,
          economy: calculateEconomyRate(newRunsConceded, newBowlerBalls),
        },
      });
    }

    // Calculate updated Innings metrics
    const newTotalRuns = currentInnings.totalRuns + deliveryRuns;
    const newWicketsTotal = currentInnings.wickets + (isWicket ? 1 : 0);
    const newOversText = ballsToOversText(newLegalBalls);

    // Innings & Match Completion Conditions
    const maxBalls = match.totalOvers * 6;
    const isOversCompleted = newLegalBalls >= maxBalls;

    let isAllOut = false;
    if (!isSingles) {
      const currentBattingTempTeamId = currentInnings.battingTempTeamId;
      const teamPlayersCount = match.matchPlayers.filter(
        mp => mp.temporaryTeamId === currentBattingTempTeamId
      ).length;
      const maxWickets = Math.max(1, teamPlayersCount - 1);
      isAllOut = newWicketsTotal >= maxWickets;
    }

    let isTargetReached = false;
    if (currentInnings.targetRuns && newTotalRuns >= currentInnings.targetRuns) {
      isTargetReached = true;
    }

    let shouldEndInnings = false;
    if (isSingles) {
      if (singlesInningsEndedByWicket || isOversCompleted) {
        shouldEndInnings = true;
      }
    } else {
      if (isAllOut || isOversCompleted || isTargetReached) {
        shouldEndInnings = true;
      }
    }

    let nextBowlerId: string | null = currentBowlerId;
    let lastBowlerId: string | null = currentInnings.lastBowlerId;

    if (isOverComplete) {
      lastBowlerId = currentBowlerId;
      nextBowlerId = null; // Requires scorer to select/confirm next bowler
    }

    // Update Innings
    const updatedInnings = await tx.gullyInnings.update({
      where: { id: currentInnings.id },
      data: {
        totalRuns: newTotalRuns,
        wickets: newWicketsTotal,
        legalBalls: newLegalBalls,
        oversCompletedText: newOversText,
        wides: currentInnings.wides + widePenalty,
        noBalls: currentInnings.noBalls + (extraType === ExtraType.NO_BALL ? 1 : 0),
        byes: currentInnings.byes + byeRuns,
        legByes: currentInnings.legByes + legByeRuns,
        penaltyRuns: currentInnings.penaltyRuns + penaltyRuns,
        currentStrikerId: shouldEndInnings ? null : nextStrikerId,
        currentNonStrikerId: shouldEndInnings ? null : nextNonStrikerId,
        currentBowlerId: shouldEndInnings ? null : nextBowlerId,
        lastBowlerId,
        status: shouldEndInnings ? InningsStatus.COMPLETED : InningsStatus.IN_PROGRESS,
      },
    });

    // Handle Match Completion or Next Innings
    if (isSingles) {
      // In Singles Match, this batter's innings is marked COMPLETED when a wicket falls or overs finish.
      // The match remains LIVE so the next batter in the queue can bat, next round can start,
      // or scorer can click 'End Match' at any time.
    } else {
      // Team Match Logic
      if (currentInnings.inningsNumber === 1 && shouldEndInnings) {
        // Create 2nd Innings
        const secondInningsTarget = newTotalRuns + 1;
        const tempTeamA = match.temporaryTeams.find(t => t.isTeamA)!;
        const tempTeamB = match.temporaryTeams.find(t => !t.isTeamA)!;

        const nextBattingTeam =
          currentInnings.battingTempTeamId === tempTeamA.id ? tempTeamB : tempTeamA;
        const nextBowlingTeam =
          currentInnings.battingTempTeamId === tempTeamA.id ? tempTeamA : tempTeamB;

        const existingInnings2 = await tx.gullyInnings.findUnique({
          where: { gullyMatchId_inningsNumber: { gullyMatchId: matchId, inningsNumber: 2 } },
        });

        if (!existingInnings2) {
          await tx.gullyInnings.create({
            data: {
              gullyMatchId: matchId,
              inningsNumber: 2,
              battingTeamName: nextBattingTeam.teamName,
              bowlingTeamName: nextBowlingTeam.teamName,
              battingTempTeamId: nextBattingTeam.id,
              bowlingTempTeamId: nextBowlingTeam.id,
              targetRuns: secondInningsTarget,
            },
          });
        }

        await tx.gullyMatch.update({
          where: { id: matchId },
          data: { currentInningsNumber: 2 },
        });
      } else if (currentInnings.inningsNumber === 2 && shouldEndInnings) {
        // Evaluate Winner
        const chasingTeamName = currentInnings.battingTeamName;
        const defendingTeamName = currentInnings.bowlingTeamName;
        const teamPlayersCount = match.matchPlayers.filter(
          mp => mp.temporaryTeamId === currentInnings.battingTempTeamId
        ).length;
        const maxWickets = Math.max(1, teamPlayersCount - 1);

        let resultType: MatchResultType = MatchResultType.NO_RESULT;
        let resultDescription = '';
        let winnerName: string | null = null;

        if (isTargetReached) {
          const wicketsRemaining = maxWickets - newWicketsTotal;
          resultType = MatchResultType.WIN_WICKETS;
          winnerName = chasingTeamName;
          resultDescription = `${chasingTeamName} won by ${wicketsRemaining} wicket${
            wicketsRemaining === 1 ? '' : 's'
          }`;
        } else if (newTotalRuns === currentInnings.targetRuns! - 1) {
          resultType = MatchResultType.TIE;
          resultDescription = 'Match tied';
        } else {
          const runsDiff = currentInnings.targetRuns! - 1 - newTotalRuns;
          resultType = MatchResultType.WIN_RUNS;
          winnerName = defendingTeamName;
          resultDescription = `${defendingTeamName} won by ${runsDiff} run${
            runsDiff === 1 ? '' : 's'
          }`;
        }

        await tx.gullyMatch.update({
          where: { id: matchId },
          data: {
            status: MatchStatus.COMPLETED,
            resultType,
            resultDescription,
            winnerName,
          },
        });
      }
    }

    return {
      delivery,
      innings: updatedInnings,
      isOverComplete,
      shouldPromptBowler: isOverComplete && !shouldEndInnings,
      isAllOut,
      isOversCompleted,
      isTargetReached,
    };
  });
}

export async function changeGullyBowler(
  matchId: string,
  registeredTeamId: string,
  bowlerId: string
) {
  return prisma.$transaction(async tx => {
    const match = await tx.gullyMatch.findUnique({
      where: { id: matchId },
      include: {
        matchPlayers: true,
      },
    });

    if (!match) throw { statusCode: 404, message: 'Gully match not found' };
    if (match.registeredTeamId !== registeredTeamId) {
      throw { statusCode: 403, message: 'Access denied: You do not own this Gully match' };
    }

    const innings = await tx.gullyInnings.findUnique({
      where: {
        gullyMatchId_inningsNumber: {
          gullyMatchId: matchId,
          inningsNumber: match.currentInningsNumber,
        },
      },
    });

    if (!innings) throw { statusCode: 404, message: 'Innings not found' };

    // Find bowler in match players
    const matchBowler = match.matchPlayers.find(p => p.playerId === bowlerId);
    if (!matchBowler) {
      throw { statusCode: 400, message: 'Selected bowler is not a participant in this match' };
    }

    // In team match, verify bowler belongs to fielding temporary team
    if (match.matchType === GullyMatchType.TEAM_MATCH && innings.bowlingTempTeamId) {
      if (matchBowler.temporaryTeamId !== innings.bowlingTempTeamId) {
        throw { statusCode: 400, message: 'Bowler must belong to the bowling team' };
      }
    }

    // Bowler cannot bowl two consecutive overs (if more than 1 bowler available)
    const availableBowlersCount = match.matchPlayers.filter(p =>
      match.matchType === GullyMatchType.SINGLES_MATCH
        ? p.isBowler
        : p.temporaryTeamId === innings.bowlingTempTeamId
    ).length;

    if (availableBowlersCount > 1 && innings.lastBowlerId === bowlerId) {
      throw { statusCode: 400, message: 'A bowler cannot bowl two consecutive overs' };
    }

    // Check allocation limit
    const existingCard = await tx.gullyBowlingScorecard.findUnique({
      where: { inningsId_playerId: { inningsId: innings.id, playerId: bowlerId } },
    });

    const allocatedLimit = existingCard?.allocatedOvers || matchBowler.allocatedOvers || 1;
    if (existingCard) {
      const completedOvers = Math.floor(existingCard.legalBalls / 6);
      if (completedOvers >= allocatedLimit) {
        throw {
          statusCode: 400,
          message: `Bowler has already completed their maximum allotted ${allocatedLimit} over(s)`,
        };
      }
    } else {
      const order =
        (await tx.gullyBowlingScorecard.count({ where: { inningsId: innings.id } })) + 1;
      await tx.gullyBowlingScorecard.create({
        data: {
          inningsId: innings.id,
          playerId: bowlerId,
          bowlingOrder: order,
          allocatedOvers: allocatedLimit,
        },
      });
    }

    return tx.gullyInnings.update({
      where: { id: innings.id },
      data: { currentBowlerId: bowlerId },
    });
  });
}

export async function undoLastGullyDelivery(matchId: string, registeredTeamId: string) {
  return prisma.$transaction(async tx => {
    const match = await tx.gullyMatch.findUnique({
      where: { id: matchId },
    });

    if (!match) throw { statusCode: 404, message: 'Gully match not found' };
    if (match.registeredTeamId !== registeredTeamId) {
      throw { statusCode: 403, message: 'Access denied: You do not own this Gully match' };
    }

    const currentInnings = await tx.gullyInnings.findUnique({
      where: {
        gullyMatchId_inningsNumber: {
          gullyMatchId: matchId,
          inningsNumber: match.currentInningsNumber,
        },
      },
    });

    if (!currentInnings) throw { statusCode: 404, message: 'Innings not found' };

    const lastDelivery = await tx.gullyDelivery.findFirst({
      where: { inningsId: currentInnings.id },
      orderBy: { createdAt: 'desc' },
      include: { wickets: true },
    });

    if (!lastDelivery) {
      throw { statusCode: 400, message: 'No delivery to undo in this innings' };
    }

    // Revert batting scorecard
    const strikerCard = await tx.gullyBattingScorecard.findUnique({
      where: {
        inningsId_playerId: {
          inningsId: currentInnings.id,
          playerId: lastDelivery.strikerId,
        },
      },
    });

    if (strikerCard) {
      const revertedRuns = Math.max(0, strikerCard.runs - lastDelivery.batterRuns);
      const revertedBalls = Math.max(
        0,
        strikerCard.balls -
          (lastDelivery.isLegalDelivery || lastDelivery.extraType === ExtraType.NO_BALL ? 1 : 0)
      );
      const revertedFours = Math.max(
        0,
        strikerCard.fours - (lastDelivery.batterRuns === 4 ? 1 : 0)
      );
      const revertedSixes = Math.max(
        0,
        strikerCard.sixes - (lastDelivery.batterRuns === 6 ? 1 : 0)
      );
      const isDismissed =
        lastDelivery.isWicket && lastDelivery.dismissedPlayerId === lastDelivery.strikerId;

      await tx.gullyBattingScorecard.update({
        where: { id: strikerCard.id },
        data: {
          runs: revertedRuns,
          balls: revertedBalls,
          fours: revertedFours,
          sixes: revertedSixes,
          strikeRate: calculateStrikeRate(revertedRuns, revertedBalls),
          notOut: isDismissed ? true : strikerCard.notOut,
          dismissalType: isDismissed ? null : strikerCard.dismissalType,
          dismissalText: isDismissed ? null : strikerCard.dismissalText,
          bowlerId: isDismissed ? null : strikerCard.bowlerId,
          fielderId: isDismissed ? null : strikerCard.fielderId,
        },
      });
    }

    // Revert non-striker dismissal in team match
    if (
      lastDelivery.nonStrikerId &&
      lastDelivery.isWicket &&
      lastDelivery.dismissedPlayerId === lastDelivery.nonStrikerId
    ) {
      await tx.gullyBattingScorecard.updateMany({
        where: {
          inningsId: currentInnings.id,
          playerId: lastDelivery.nonStrikerId,
        },
        data: {
          notOut: true,
          dismissalType: null,
          dismissalText: null,
          fielderId: null,
        },
      });
    }

    // Revert incoming batter scorecard if newly created on this ball
    if (lastDelivery.incomingBatterId) {
      const incomingCard = await tx.gullyBattingScorecard.findUnique({
        where: {
          inningsId_playerId: {
            inningsId: currentInnings.id,
            playerId: lastDelivery.incomingBatterId,
          },
        },
      });
      if (incomingCard && incomingCard.balls === 0 && incomingCard.runs === 0) {
        await tx.gullyBattingScorecard.delete({ where: { id: incomingCard.id } });
      }
    }

    // Revert bowling scorecard
    const bowlerCard = await tx.gullyBowlingScorecard.findUnique({
      where: {
        inningsId_playerId: {
          inningsId: currentInnings.id,
          playerId: lastDelivery.bowlerId,
        },
      },
    });

    if (bowlerCard) {
      let bowlerRuns = 0;
      if (lastDelivery.extraType === ExtraType.NONE) bowlerRuns = lastDelivery.batterRuns;
      else if (lastDelivery.extraType === ExtraType.WIDE) bowlerRuns = 1 + lastDelivery.extraRuns;
      else if (lastDelivery.extraType === ExtraType.NO_BALL)
        bowlerRuns = 1 + lastDelivery.batterRuns;

      const revertedBalls = Math.max(
        0,
        bowlerCard.legalBalls - (lastDelivery.isLegalDelivery ? 1 : 0)
      );
      const revertedRunsConceded = Math.max(0, bowlerCard.runsConceded - bowlerRuns);
      const revertedWickets = Math.max(
        0,
        bowlerCard.wickets - (lastDelivery.isWicket && lastDelivery.bowlerCredited ? 1 : 0)
      );
      const revertedWides = Math.max(
        0,
        bowlerCard.wides - (lastDelivery.extraType === ExtraType.WIDE ? 1 : 0)
      );
      const revertedNoBalls = Math.max(
        0,
        bowlerCard.noBalls - (lastDelivery.extraType === ExtraType.NO_BALL ? 1 : 0)
      );

      let revertedMaidens = bowlerCard.maidens;
      if (lastDelivery.isLegalDelivery && (revertedBalls + 1) % 6 === 0) {
        const overDeliveries = await tx.gullyDelivery.findMany({
          where: {
            inningsId: currentInnings.id,
            overNumber: lastDelivery.overNumber,
          },
        });
        const totalRunsInOver = overDeliveries.reduce((sum, d) => {
          let r = 0;
          if (d.extraType === ExtraType.NONE) r += d.batterRuns;
          else if (d.extraType === ExtraType.WIDE) r += 1 + d.extraRuns;
          else if (d.extraType === ExtraType.NO_BALL) r += 1 + d.batterRuns;
          return sum + r;
        }, 0);
        if (totalRunsInOver === 0) {
          revertedMaidens = Math.max(0, bowlerCard.maidens - 1);
        }
      }

      await tx.gullyBowlingScorecard.update({
        where: { id: bowlerCard.id },
        data: {
          legalBalls: revertedBalls,
          oversText: ballsToOversText(revertedBalls),
          runsConceded: revertedRunsConceded,
          wickets: revertedWickets,
          maidens: revertedMaidens,
          wides: revertedWides,
          noBalls: revertedNoBalls,
          economy: calculateEconomyRate(revertedRunsConceded, revertedBalls),
        },
      });
    }

    // Delete associated wickets
    await tx.gullyWicket.deleteMany({ where: { deliveryId: lastDelivery.id } });

    // Delete the delivery
    await tx.gullyDelivery.delete({ where: { id: lastDelivery.id } });

    // Revert innings metrics
    let widePenalty = 0;
    let noBallPenalty = 0;
    let byeRuns = 0;
    let legByeRuns = 0;
    let penaltyRuns = 0;

    if (lastDelivery.extraType === ExtraType.WIDE) {
      widePenalty = 1 + lastDelivery.extraRuns;
    } else if (lastDelivery.extraType === ExtraType.NO_BALL) {
      noBallPenalty = 1;
    } else if (lastDelivery.extraType === ExtraType.BYE) {
      byeRuns = lastDelivery.totalRuns;
    } else if (lastDelivery.extraType === ExtraType.LEG_BYE) {
      legByeRuns = lastDelivery.totalRuns;
    } else if (lastDelivery.extraType === ExtraType.PENALTY) {
      penaltyRuns = lastDelivery.totalRuns;
    }

    const revertedTotalRuns = Math.max(0, currentInnings.totalRuns - lastDelivery.totalRuns);
    const revertedWicketsCount = Math.max(
      0,
      currentInnings.wickets - (lastDelivery.isWicket ? 1 : 0)
    );
    const revertedLegalBalls = Math.max(
      0,
      currentInnings.legalBalls - (lastDelivery.isLegalDelivery ? 1 : 0)
    );

    await tx.gullyInnings.update({
      where: { id: currentInnings.id },
      data: {
        totalRuns: revertedTotalRuns,
        wickets: revertedWicketsCount,
        legalBalls: revertedLegalBalls,
        oversCompletedText: ballsToOversText(revertedLegalBalls),
        wides: Math.max(0, currentInnings.wides - widePenalty),
        noBalls: Math.max(0, currentInnings.noBalls - noBallPenalty),
        byes: Math.max(0, currentInnings.byes - byeRuns),
        legByes: Math.max(0, currentInnings.legByes - legByeRuns),
        penaltyRuns: Math.max(0, currentInnings.penaltyRuns - penaltyRuns),
        currentStrikerId: lastDelivery.prevStrikerId,
        currentNonStrikerId: lastDelivery.prevNonStrikerId,
        currentBowlerId: lastDelivery.prevBowlerId,
        status: InningsStatus.IN_PROGRESS,
      },
    });

    // If match was completed by this delivery, reopen to LIVE
    if (match.status === MatchStatus.COMPLETED) {
      await tx.gullyMatch.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.LIVE,
          resultType: null,
          resultDescription: null,
          winnerName: null,
        },
      });
    }

    return { message: 'Delivery reverted successfully' };
  });
}
