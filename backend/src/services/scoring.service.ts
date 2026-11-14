import {
  DismissalType,
  ExtraType,
  InningsStatus,
  MatchFormat,
  MatchResultType,
  MatchStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../config/db.js';
import {
  ballsToOversText,
  calculateEconomyRate,
  calculateStrikeRate,
  getMaxOversPerBowler,
  getMaxOversPerInnings,
} from '../utils/cricket.js';
import { ScoreDeliveryDto } from '../types/index.js';

export async function scoreDelivery(matchId: string, dto: ScoreDeliveryDto) {
  return prisma.$transaction(async tx => {
    const match = await tx.match.findUnique({
      where: { id: matchId },
      include: {
        teamA: { select: { id: true, teamName: true } },
        teamB: { select: { id: true, teamName: true } },
        matchPlayers: { where: { isPlayingXI: true } },
      },
    });

    if (!match) {
      throw { statusCode: 404, message: 'Match not found' };
    }

    if (match.status === MatchStatus.COMPLETED) {
      throw { statusCode: 400, message: 'Match is already completed' };
    }

    const currentInnings = await tx.innings.findUnique({
      where: {
        matchId_inningsNumber: {
          matchId,
          inningsNumber: match.currentInningsNumber,
        },
      },
      include: {
        battingScorecards: true,
        bowlingScorecards: true,
      },
    });

    if (!currentInnings) {
      throw { statusCode: 404, message: 'Current innings not found' };
    }

    if (currentInnings.status !== InningsStatus.IN_PROGRESS) {
      throw { statusCode: 400, message: 'Current innings is not in progress' };
    }

    const { currentStrikerId, currentNonStrikerId, currentBowlerId } = currentInnings;
    if (!currentStrikerId || !currentNonStrikerId || !currentBowlerId) {
      throw { statusCode: 400, message: 'Striker, non-striker, and bowler must be set before scoring' };
    }

    // Save previous snapshot for atomic rollback
    const prevStrikerId = currentStrikerId;
    const prevNonStrikerId = currentNonStrikerId;
    const prevBowlerId = currentBowlerId;

    // Delivery attributes
    const extraType = dto.extraType || ExtraType.NONE;
    const isLegalDelivery = extraType !== ExtraType.WIDE && extraType !== ExtraType.NO_BALL && extraType !== ExtraType.PENALTY;
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

    // Determine current over and ball in over
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

    // Determine strike rotation
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

    let strikeRotated = runningRuns % 2 === 1;

    let nextStrikerId: string | null = currentStrikerId;
    let nextNonStrikerId: string | null = currentNonStrikerId;

    if (strikeRotated) {
      nextStrikerId = currentNonStrikerId;
      nextNonStrikerId = currentStrikerId;
    }

    // Handle wicket dismissals and incoming batter
    let dismissedPlayerId = dto.dismissedPlayerId || null;
    let incomingBatterId = dto.incomingBatterId || null;

    if (isWicket) {
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

    // Check if over finishes on this ball
    const newLegalBalls = currentInnings.legalBalls + (isLegalDelivery ? 1 : 0);
    const isOverComplete = isLegalDelivery && newLegalBalls % 6 === 0;

    // Check maiden over
    let isMaidenOver = false;
    if (isOverComplete) {
      // Find all deliveries in this completed over
      const overDeliveries = await tx.delivery.findMany({
        where: {
          inningsId: currentInnings.id,
          overNumber: currentOverNumber,
        },
      });

      const totalRunsConcededInOver =
        overDeliveries.reduce((sum, d) => {
          let runs = 0;
          if (d.extraType === ExtraType.NONE) runs += d.batterRuns;
          else if (d.extraType === ExtraType.WIDE) runs += (1 + d.extraRuns);
          else if (d.extraType === ExtraType.NO_BALL) runs += (1 + d.batterRuns);
          return sum + runs;
        }, 0) + bowlerRunsConceded;

      if (totalRunsConcededInOver === 0) {
        isMaidenOver = true;
      }

      // End of over: batters change ends!
      const tempStriker = nextStrikerId;
      nextStrikerId = nextNonStrikerId;
      nextNonStrikerId = tempStriker;
    }

    // Record the Delivery
    const delivery = await tx.delivery.create({
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

    // If wicket, record Wicket entry
    if (isWicket && dismissedPlayerId && dto.dismissalType) {
      await tx.wicket.create({
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
    const strikerCard = await tx.battingScorecard.findUnique({
      where: {
        inningsId_playerId: {
          inningsId: currentInnings.id,
          playerId: currentStrikerId,
        },
      },
    });

    if (strikerCard) {
      const isStrikerDismissed = isWicket && dismissedPlayerId === currentStrikerId;
      const newStrikerRuns = strikerCard.runs + (extraType === ExtraType.NONE || extraType === ExtraType.NO_BALL ? batterRuns : 0);
      const newStrikerBalls = strikerCard.balls + (isLegalDelivery || extraType === ExtraType.NO_BALL ? 1 : 0);
      const newFours = strikerCard.fours + (batterRuns === 4 ? 1 : 0);
      const newSixes = strikerCard.sixes + (batterRuns === 6 ? 1 : 0);

      let dismissalText: string | null = null;
      if (isStrikerDismissed && dto.dismissalType) {
        dismissalText = formatDismissalText(dto.dismissalType, bowlerCredited, currentBowlerId, dto.fielderId);
      }

      await tx.battingScorecard.update({
        where: { id: strikerCard.id },
        data: {
          runs: newStrikerRuns,
          balls: newStrikerBalls,
          fours: newFours,
          sixes: newSixes,
          strikeRate: calculateStrikeRate(newStrikerRuns, newStrikerBalls),
          notOut: !isStrikerDismissed,
          dismissalType: isStrikerDismissed ? dto.dismissalType : null,
          dismissalText: isStrikerDismissed ? dismissalText : null,
          bowlerId: isStrikerDismissed && bowlerCredited ? currentBowlerId : null,
          fielderId: isStrikerDismissed ? dto.fielderId || null : null,
        },
      });
    }

    // If non-striker was dismissed (e.g. run out)
    if (isWicket && dismissedPlayerId === currentNonStrikerId) {
      const nonStrikerCard = await tx.battingScorecard.findUnique({
        where: {
          inningsId_playerId: {
            inningsId: currentInnings.id,
            playerId: currentNonStrikerId,
          },
        },
      });
      if (nonStrikerCard) {
        await tx.battingScorecard.update({
          where: { id: nonStrikerCard.id },
          data: {
            notOut: false,
            dismissalType: dto.dismissalType,
            dismissalText: formatDismissalText(dto.dismissalType!, bowlerCredited, currentBowlerId, dto.fielderId),
            fielderId: dto.fielderId || null,
          },
        });
      }
    }

    // If incoming batter, create their batting scorecard entry
    if (incomingBatterId) {
      const existingIncomingCard = await tx.battingScorecard.findUnique({
        where: {
          inningsId_playerId: {
            inningsId: currentInnings.id,
            playerId: incomingBatterId,
          },
        },
      });
      if (!existingIncomingCard) {
        const nextBattingOrder = (await tx.battingScorecard.count({ where: { inningsId: currentInnings.id } })) + 1;
        await tx.battingScorecard.create({
          data: {
            inningsId: currentInnings.id,
            playerId: incomingBatterId,
            battingOrder: nextBattingOrder,
            notOut: true,
          },
        });
      }
    }

    // Update Bowling Scorecard
    const bowlerCard = await tx.bowlingScorecard.findUnique({
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

      await tx.bowlingScorecard.update({
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

    // Check all-out condition
    // For 11 playing XI members, 10 wickets is all-out
    const battingPlayingXI = match.matchPlayers.filter(
      mp => mp.teamId === currentInnings.battingTeamId
    );
    const maxWickets = Math.max(1, battingPlayingXI.length - 1);
    const isAllOut = newWicketsTotal >= maxWickets;

    // Check format-specific innings over limits (for T10, T20, ODI)
    const maxOvers = getMaxOversPerInnings(match.format);
    const maxBalls = maxOvers ? maxOvers * 6 : null;
    const isOversCompleted = maxBalls !== null && newLegalBalls >= maxBalls;

    let nextBowlerId: string | null = currentBowlerId;
    let lastBowlerId: string | null = currentInnings.lastBowlerId;

    if (isOverComplete) {
      lastBowlerId = currentBowlerId;
      nextBowlerId = null; // Requires scorer to select next bowler
    }

    let inningsStatus: InningsStatus = currentInnings.status;
    let shouldEndInnings = false;

    // Check 2nd innings target reached
    let isTargetReached = false;
    if (currentInnings.targetRuns && newTotalRuns >= currentInnings.targetRuns) {
      isTargetReached = true;
      shouldEndInnings = true;
    }

    if (isAllOut || isOversCompleted) {
      shouldEndInnings = true;
    }

    if (shouldEndInnings) {
      inningsStatus = InningsStatus.COMPLETED;
    }

    // Update the Innings record
    const updatedInnings = await tx.innings.update({
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
        status: inningsStatus,
      },
    });

    // Check Match Completion logic for limited overs
    if (match.format !== MatchFormat.TEST) {
      if (currentInnings.inningsNumber === 1 && shouldEndInnings) {
        // Prepare 2nd innings
        const secondInningsTarget = newTotalRuns + 1;
        const existingInnings2 = await tx.innings.findUnique({
          where: { matchId_inningsNumber: { matchId, inningsNumber: 2 } },
        });

        if (!existingInnings2) {
          await tx.innings.create({
            data: {
              matchId,
              inningsNumber: 2,
              battingTeamId: currentInnings.bowlingTeamId,
              bowlingTeamId: currentInnings.battingTeamId,
              targetRuns: secondInningsTarget,
            },
          });
        }

        await tx.match.update({
          where: { id: matchId },
          data: { currentInningsNumber: 2 },
        });
      } else if (currentInnings.inningsNumber === 2 && shouldEndInnings) {
        // Second innings completed -> evaluate match result
        const chasingTeamId = currentInnings.battingTeamId;
        const defendingTeamId = currentInnings.bowlingTeamId;
        const chasingTeamName = match.teamAId === chasingTeamId ? match.teamA.teamName : match.teamB.teamName;
        const defendingTeamName = match.teamAId === defendingTeamId ? match.teamA.teamName : match.teamB.teamName;

        let resultType: MatchResultType = MatchResultType.NO_RESULT;
        let resultDescription = '';
        let winnerId: string | null = null;

        if (isTargetReached) {
          const wicketsRemaining = maxWickets - newWicketsTotal;
          resultType = MatchResultType.WIN_WICKETS;
          winnerId = chasingTeamId;
          resultDescription = `${chasingTeamName} won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? '' : 's'}`;
        } else if (newTotalRuns === (currentInnings.targetRuns! - 1)) {
          resultType = MatchResultType.TIE;
          resultDescription = 'Match tied';
        } else {
          const runsDifference = (currentInnings.targetRuns! - 1) - newTotalRuns;
          resultType = MatchResultType.WIN_RUNS;
          winnerId = defendingTeamId;
          resultDescription = `${defendingTeamName} won by ${runsDifference} run${runsDifference === 1 ? '' : 's'}`;
        }

        await tx.match.update({
          where: { id: matchId },
          data: {
            status: MatchStatus.COMPLETED,
            resultType,
            resultDescription,
            winnerId,
          },
        });
      }
    } else {
      // Test match live delivery progress
      await tx.match.update({
        where: { id: matchId },
        data: {
          dayOvers: isOverComplete ? match.dayOvers + 1 : match.dayOvers,
          sessionOvers: isOverComplete ? match.sessionOvers + 1 : match.sessionOvers,
        },
      });
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

export async function changeBowler(matchId: string, bowlerId: string) {
  return prisma.$transaction(async tx => {
    const match = await tx.match.findUnique({
      where: { id: matchId },
    });
    if (!match) throw { statusCode: 404, message: 'Match not found' };

    const innings = await tx.innings.findUnique({
      where: { matchId_inningsNumber: { matchId, inningsNumber: match.currentInningsNumber } },
    });
    if (!innings) throw { statusCode: 404, message: 'Innings not found' };

    // Prevent consecutive overs
    if (innings.lastBowlerId === bowlerId) {
      throw { statusCode: 400, message: 'A bowler cannot bowl two consecutive overs' };
    }

    // Check format-specific over limit
    const maxOvers = getMaxOversPerBowler(match.format);
    if (maxOvers !== Infinity) {
      const scorecard = await tx.bowlingScorecard.findUnique({
        where: { inningsId_playerId: { inningsId: innings.id, playerId: bowlerId } },
      });
      if (scorecard) {
        const completedOvers = Math.floor(scorecard.legalBalls / 6);
        if (completedOvers >= maxOvers) {
          throw { statusCode: 400, message: `Bowler has already completed their maximum allotted ${maxOvers} overs` };
        }
      }
    }

    // Ensure scorecard exists for bowler
    const existingCard = await tx.bowlingScorecard.findUnique({
      where: { inningsId_playerId: { inningsId: innings.id, playerId: bowlerId } },
    });
    if (!existingCard) {
      const order = (await tx.bowlingScorecard.count({ where: { inningsId: innings.id } })) + 1;
      await tx.bowlingScorecard.create({
        data: {
          inningsId: innings.id,
          playerId: bowlerId,
          bowlingOrder: order,
        },
      });
    }

    return tx.innings.update({
      where: { id: innings.id },
      data: { currentBowlerId: bowlerId },
    });
  });
}

export async function undoLastDelivery(matchId: string) {
  return prisma.$transaction(async tx => {
    const match = await tx.match.findUnique({
      where: { id: matchId },
    });
    if (!match) throw { statusCode: 404, message: 'Match not found' };

    const currentInnings = await tx.innings.findUnique({
      where: { matchId_inningsNumber: { matchId, inningsNumber: match.currentInningsNumber } },
    });
    if (!currentInnings) throw { statusCode: 404, message: 'Innings not found' };

    // Get the last delivery
    const lastDelivery = await tx.delivery.findFirst({
      where: { inningsId: currentInnings.id },
      orderBy: { createdAt: 'desc' },
      include: { wickets: true },
    });

    if (!lastDelivery) {
      throw { statusCode: 400, message: 'No delivery to undo in this innings' };
    }

    // Revert batting scorecard
    const strikerCard = await tx.battingScorecard.findUnique({
      where: { inningsId_playerId: { inningsId: currentInnings.id, playerId: lastDelivery.strikerId } },
    });

    if (strikerCard) {
      const revertedRuns = Math.max(0, strikerCard.runs - lastDelivery.batterRuns);
      const revertedBalls = Math.max(0, strikerCard.balls - (lastDelivery.isLegalDelivery || lastDelivery.extraType === ExtraType.NO_BALL ? 1 : 0));
      const revertedFours = Math.max(0, strikerCard.fours - (lastDelivery.batterRuns === 4 ? 1 : 0));
      const revertedSixes = Math.max(0, strikerCard.sixes - (lastDelivery.batterRuns === 6 ? 1 : 0));

      const isDismissed = lastDelivery.isWicket && lastDelivery.dismissedPlayerId === lastDelivery.strikerId;

      await tx.battingScorecard.update({
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

    // Revert non-striker dismissal if applicable
    if (lastDelivery.isWicket && lastDelivery.dismissedPlayerId === lastDelivery.nonStrikerId) {
      await tx.battingScorecard.updateMany({
        where: { inningsId: currentInnings.id, playerId: lastDelivery.nonStrikerId },
        data: {
          notOut: true,
          dismissalType: null,
          dismissalText: null,
          fielderId: null,
        },
      });
    }

    // Revert incoming batter if created on this ball
    if (lastDelivery.incomingBatterId) {
      const incomingCard = await tx.battingScorecard.findUnique({
        where: { inningsId_playerId: { inningsId: currentInnings.id, playerId: lastDelivery.incomingBatterId } },
      });
      if (incomingCard && incomingCard.balls === 0 && incomingCard.runs === 0) {
        await tx.battingScorecard.delete({ where: { id: incomingCard.id } });
      }
    }

    // Revert bowling scorecard
    const bowlerCard = await tx.bowlingScorecard.findUnique({
      where: { inningsId_playerId: { inningsId: currentInnings.id, playerId: lastDelivery.bowlerId } },
    });

    if (bowlerCard) {
      let bowlerRuns = 0;
      if (lastDelivery.extraType === ExtraType.NONE) bowlerRuns = lastDelivery.batterRuns;
      else if (lastDelivery.extraType === ExtraType.WIDE) bowlerRuns = 1 + lastDelivery.extraRuns;
      else if (lastDelivery.extraType === ExtraType.NO_BALL) bowlerRuns = 1 + lastDelivery.batterRuns;

      const revertedBalls = Math.max(0, bowlerCard.legalBalls - (lastDelivery.isLegalDelivery ? 1 : 0));
      const revertedRunsConceded = Math.max(0, bowlerCard.runsConceded - bowlerRuns);
      const revertedWickets = Math.max(0, bowlerCard.wickets - (lastDelivery.isWicket && lastDelivery.bowlerCredited ? 1 : 0));
      const revertedWides = Math.max(0, bowlerCard.wides - (lastDelivery.extraType === ExtraType.WIDE ? 1 : 0));
      const revertedNoBalls = Math.max(0, bowlerCard.noBalls - (lastDelivery.extraType === ExtraType.NO_BALL ? 1 : 0));

      let revertedMaidens = bowlerCard.maidens;
      if (lastDelivery.isLegalDelivery && (revertedBalls + 1) % 6 === 0) {
        const overDeliveries = await tx.delivery.findMany({
          where: {
            inningsId: currentInnings.id,
            overNumber: lastDelivery.overNumber,
          },
        });
        const totalRunsInOver = overDeliveries.reduce((sum, d) => {
          let r = 0;
          if (d.extraType === ExtraType.NONE) r += d.batterRuns;
          else if (d.extraType === ExtraType.WIDE) r += (1 + d.extraRuns);
          else if (d.extraType === ExtraType.NO_BALL) r += (1 + d.batterRuns);
          return sum + r;
        }, 0);
        if (totalRunsInOver === 0) {
          revertedMaidens = Math.max(0, bowlerCard.maidens - 1);
        }
      }

      await tx.bowlingScorecard.update({
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

    // Revert innings totals
    const revertedTotalRuns = Math.max(0, currentInnings.totalRuns - lastDelivery.totalRuns);
    const revertedWicketsTotal = Math.max(0, currentInnings.wickets - (lastDelivery.isWicket ? 1 : 0));
    const revertedLegalBalls = Math.max(0, currentInnings.legalBalls - (lastDelivery.isLegalDelivery ? 1 : 0));

    // Delete Wicket record if delivery was a wicket
    if (lastDelivery.wickets.length > 0) {
      await tx.wicket.deleteMany({
        where: { deliveryId: lastDelivery.id },
      });
    }

    // Revert extras totals
    let revertedByes = currentInnings.byes;
    let revertedLegByes = currentInnings.legByes;
    let revertedWides = currentInnings.wides;
    let revertedNoBalls = currentInnings.noBalls;
    let revertedPenalty = currentInnings.penaltyRuns;

    if (lastDelivery.extraType === ExtraType.BYE) {
      revertedByes = Math.max(0, currentInnings.byes - lastDelivery.totalRuns);
    } else if (lastDelivery.extraType === ExtraType.LEG_BYE) {
      revertedLegByes = Math.max(0, currentInnings.legByes - lastDelivery.totalRuns);
    } else if (lastDelivery.extraType === ExtraType.WIDE) {
      revertedWides = Math.max(0, currentInnings.wides - (1 + lastDelivery.extraRuns));
    } else if (lastDelivery.extraType === ExtraType.NO_BALL) {
      revertedNoBalls = Math.max(0, currentInnings.noBalls - 1);
    } else if (lastDelivery.extraType === ExtraType.PENALTY) {
      revertedPenalty = Math.max(0, currentInnings.penaltyRuns - lastDelivery.totalRuns);
    }

    // Restore positions and totals from delivery snapshot
    const revertedInnings = await tx.innings.update({
      where: { id: currentInnings.id },
      data: {
        totalRuns: revertedTotalRuns,
        wickets: revertedWicketsTotal,
        legalBalls: revertedLegalBalls,
        oversCompletedText: ballsToOversText(revertedLegalBalls),
        byes: revertedByes,
        legByes: revertedLegByes,
        wides: revertedWides,
        noBalls: revertedNoBalls,
        penaltyRuns: revertedPenalty,
        currentStrikerId: lastDelivery.prevStrikerId,
        currentNonStrikerId: lastDelivery.prevNonStrikerId,
        currentBowlerId: lastDelivery.prevBowlerId,
        status: InningsStatus.IN_PROGRESS,
      },
    });

    // Reopen match if it had been completed
    if (match.status === MatchStatus.COMPLETED) {
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.LIVE,
          resultType: null,
          resultDescription: null,
          winnerId: null,
        },
      });
    }

    // Delete the delivery record
    await tx.delivery.delete({
      where: { id: lastDelivery.id },
    });

    return { message: 'Last delivery undone successfully', currentInnings: revertedInnings };
  });
}

function formatDismissalText(
  type: DismissalType,
  bowlerCredited: boolean,
  bowlerId?: string | null,
  fielderId?: string | null
): string {
  switch (type) {
    case DismissalType.BOWLED:
      return 'b bowler';
    case DismissalType.CAUGHT:
      return fielderId ? 'c fielder b bowler' : 'c & b bowler';
    case DismissalType.LBW:
      return 'lbw b bowler';
    case DismissalType.RUN_OUT:
      return 'run out';
    case DismissalType.STUMPED:
      return 'st fielder b bowler';
    case DismissalType.HIT_WICKET:
      return 'hit wicket b bowler';
    case DismissalType.RETIRED_OUT:
      return 'retired out';
    case DismissalType.OBSTRUCTING_FIELD:
      return 'obstructing the field';
    default:
      return 'out';
  }
}
