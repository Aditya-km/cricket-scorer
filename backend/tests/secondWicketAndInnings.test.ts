import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import * as authService from '../src/services/auth.service.js';
import * as squadService from '../src/services/squad.service.js';
import * as matchService from '../src/services/match.service.js';
import * as scoringService from '../src/services/scoring.service.js';
import { MatchFormat, PlayerRole, ExtraType, DismissalType, InningsStatus } from '@prisma/client';

describe('Second Wicket Replacement & Second Innings Openers Selection', () => {
  let team1: any;
  let team2: any;
  let squad1: any[] = [];
  let squad2: any[] = [];
  let match: any;

  beforeAll(async () => {
    const ts = Date.now();
    const t1 = await authService.registerTeam({
      teamName: `Lions ${ts}`,
      username: `lions_${ts}`,
      email: `lions_${ts}@cricket.test`,
      password: 'password123',
    });
    team1 = t1.team;

    const t2 = await authService.registerTeam({
      teamName: `Tigers ${ts}`,
      username: `tigers_${ts}`,
      email: `tigers_${ts}@cricket.test`,
      password: 'password123',
    });
    team2 = t2.team;

    for (let i = 1; i <= 11; i++) {
      const p1 = await squadService.addPlayer(team1.id, {
        playerName: `Lion Player ${i}`,
        jerseyNumber: i,
        role: i <= 5 ? PlayerRole.BATTER : i === 6 ? PlayerRole.ALL_ROUNDER : PlayerRole.BOWLER,
      });
      squad1.push(p1);

      const p2 = await squadService.addPlayer(team2.id, {
        playerName: `Tiger Player ${i}`,
        jerseyNumber: i,
        role: i <= 5 ? PlayerRole.BATTER : i === 6 ? PlayerRole.ALL_ROUNDER : PlayerRole.BOWLER,
      });
      squad2.push(p2);
    }
  });

  afterAll(async () => {
    if (match) await prisma.match.deleteMany({ where: { id: match.id } });
    await prisma.player.deleteMany({ where: { teamId: { in: [team1.id, team2.id] } } });
    await prisma.team.deleteMany({ where: { id: { in: [team1.id, team2.id] } } });
  });

  it('correctly replaces striker on 1st, 2nd, and subsequent wickets without inflating old batter score', async () => {
    match = await matchService.createMatch(team1.id, {
      format: MatchFormat.T10,
      opponentTeamId: team2.id,
      matchDate: new Date().toISOString(),
      venue: 'Wankhede Stadium',
    });

    await matchService.setupPlayingXI(
      match.id,
      squad1.map(p => p.id),
      squad2.map(p => p.id)
    );

    await matchService.conductToss(match.id, {
      tossWinnerId: team1.id,
      tossDecision: 'BAT',
    });

    // Innings 1: P1 on strike, P2 non-striker, P11 bowler
    await matchService.selectOpeningPlayers(match.id, {
      strikerId: squad1[0].id,
      nonStrikerId: squad1[1].id,
      bowlerId: squad2[10].id,
      inningsNumber: 1,
    });

    // Ball 1: P1 scores 4
    await scoringService.scoreDelivery(match.id, {
      batterRuns: 4,
      extraType: ExtraType.NONE,
    });

    let details = await matchService.getMatchDetails(match.id);
    let inn1 = details.innings.find(i => i.inningsNumber === 1)!;
    expect(inn1.currentStrikerId).toBe(squad1[0].id);

    // Ball 2: WICKET 1 - P1 is caught! Incoming batter: P3 (squad1[2])
    await scoringService.scoreDelivery(match.id, {
      batterRuns: 0,
      extraType: ExtraType.NONE,
      isWicket: true,
      dismissalType: DismissalType.CAUGHT,
      dismissedPlayerId: squad1[0].id,
      fielderId: squad2[0].id,
      incomingBatterId: squad1[2].id,
    });

    details = await matchService.getMatchDetails(match.id);
    inn1 = details.innings.find(i => i.inningsNumber === 1)!;
    expect(inn1.wickets).toBe(1);
    expect(inn1.currentStrikerId).toBe(squad1[2].id); // P3 is now on strike!
    expect(inn1.currentNonStrikerId).toBe(squad1[1].id);

    // Verify P1 scorecard is marked out and frozen at 4 runs
    const p1Card = inn1.battingScorecards.find(b => b.playerId === squad1[0].id)!;
    expect(p1Card.notOut).toBe(false);
    expect(p1Card.runs).toBe(4);
    expect(p1Card.dismissalType).toBe(DismissalType.CAUGHT);

    // Ball 3: P3 scores 2 runs
    await scoringService.scoreDelivery(match.id, {
      batterRuns: 2,
      extraType: ExtraType.NONE,
    });

    // Ball 4: P3 scores 1 run (rotates strike to P2)
    await scoringService.scoreDelivery(match.id, {
      batterRuns: 1,
      extraType: ExtraType.NONE,
    });

    details = await matchService.getMatchDetails(match.id);
    inn1 = details.innings.find(i => i.inningsNumber === 1)!;
    expect(inn1.currentStrikerId).toBe(squad1[1].id); // P2 is now striker
    expect(inn1.currentNonStrikerId).toBe(squad1[2].id); // P3 is non-striker

    // Ball 5: P2 scores 1 run (rotates strike back to P3)
    await scoringService.scoreDelivery(match.id, {
      batterRuns: 1,
      extraType: ExtraType.NONE,
    });

    details = await matchService.getMatchDetails(match.id);
    inn1 = details.innings.find(i => i.inningsNumber === 1)!;
    expect(inn1.currentStrikerId).toBe(squad1[2].id); // P3 is striker again

    // Ball 6: WICKET 2 - P3 is bowled! Incoming batter: P4 (squad1[3])
    // Note: this is ball 6 so end of over will rotate batters!
    // But before end-of-over rotation, P3 was replaced by P4.
    // At end of over (6.0), strike rotates: P2 becomes striker, P4 becomes non-striker.
    await scoringService.scoreDelivery(match.id, {
      batterRuns: 0,
      extraType: ExtraType.NONE,
      isWicket: true,
      dismissalType: DismissalType.BOWLED,
      dismissedPlayerId: squad1[2].id,
      incomingBatterId: squad1[3].id,
    });

    details = await matchService.getMatchDetails(match.id);
    inn1 = details.innings.find(i => i.inningsNumber === 1)!;
    expect(inn1.wickets).toBe(2);

    // Verify P3 scorecard is frozen at 3 runs and marked out
    const p3Card = inn1.battingScorecards.find(b => b.playerId === squad1[2].id)!;
    expect(p3Card.notOut).toBe(false);
    expect(p3Card.runs).toBe(3);
    expect(p3Card.dismissalType).toBe(DismissalType.BOWLED);

    // Over 1 completed: change bowler to squad2[9]
    await scoringService.changeBowler(match.id, squad2[9].id);

    // Over 2 Ball 1 (Ball 7): P2 scores 1 run (rotates strike to P4)
    await scoringService.scoreDelivery(match.id, {
      batterRuns: 1,
      extraType: ExtraType.NONE,
    });

    details = await matchService.getMatchDetails(match.id);
    inn1 = details.innings.find(i => i.inningsNumber === 1)!;
    expect(inn1.currentStrikerId).toBe(squad1[3].id); // P4 is striker!

    // Over 2 Ball 2: P4 hits a 6!
    await scoringService.scoreDelivery(match.id, {
      batterRuns: 6,
      extraType: ExtraType.NONE,
    });

    details = await matchService.getMatchDetails(match.id);
    inn1 = details.innings.find(i => i.inningsNumber === 1)!;

    // Verify P4 has 6 runs, while dismissed P3 still has exactly 3 runs and dismissed P1 still has 4 runs
    const p4Card = inn1.battingScorecards.find(b => b.playerId === squad1[3].id)!;
    expect(p4Card.runs).toBe(6);
    expect(p4Card.sixes).toBe(1);
    expect(p4Card.notOut).toBe(true);

    const freshP3Card = inn1.battingScorecards.find(b => b.playerId === squad1[2].id)!;
    expect(freshP3Card.runs).toBe(3); // P3's score did NOT increase!
    expect(freshP3Card.notOut).toBe(false);

    const freshP1Card = inn1.battingScorecards.find(b => b.playerId === squad1[0].id)!;
    expect(freshP1Card.runs).toBe(4); // P1's score did NOT increase!
  });

  it('allows selecting opening players for Innings 2 and scores deliveries in 2nd innings', async () => {
    // Fast-forward Innings 1 to completion by taking all 10 wickets
    let details = await matchService.getMatchDetails(match.id);
    let inn1 = details.innings.find(i => i.inningsNumber === 1)!;

    // Score remaining wickets until all out (10 wickets)
    while (inn1.wickets < 10 && inn1.status === InningsStatus.IN_PROGRESS) {
      if (!inn1.currentBowlerId) {
        const altBowler = inn1.lastBowlerId === squad2[9].id ? squad2[10].id : squad2[9].id;
        await scoringService.changeBowler(match.id, altBowler);
        details = await matchService.getMatchDetails(match.id);
        inn1 = details.innings.find(i => i.inningsNumber === 1)!;
      }
      // For wickets 1..9, incoming is squad1[wicket+1]. For 10th wicket (all out), undefined.
      const incomingId = inn1.wickets < 9 ? squad1[inn1.wickets + 1]?.id : undefined;
      await scoringService.scoreDelivery(match.id, {
        batterRuns: 0,
        extraType: ExtraType.NONE,
        isWicket: true,
        dismissalType: DismissalType.BOWLED,
        dismissedPlayerId: inn1.currentStrikerId!,
        incomingBatterId: incomingId,
      });
      details = await matchService.getMatchDetails(match.id);
      inn1 = details.innings.find(i => i.inningsNumber === 1)!;
    }

    // Verify Innings 1 is completed and Match is on Innings 2
    expect(inn1.status).toBe(InningsStatus.COMPLETED);
    expect(details.currentInningsNumber).toBe(2);

    const inn2 = details.innings.find(i => i.inningsNumber === 2);
    expect(inn2).toBeDefined();
    expect(inn2!.targetRuns).toBe(inn1.totalRuns + 1);
    expect(inn2!.currentStrikerId).toBeNull();
    expect(inn2!.currentNonStrikerId).toBeNull();
    expect(inn2!.currentBowlerId).toBeNull();

    // Select Opening Players for Innings 2
    const result = await matchService.selectOpeningPlayers(match.id, {
      strikerId: squad2[0].id,
      nonStrikerId: squad2[1].id,
      bowlerId: squad1[10].id,
      inningsNumber: 2,
    });

    expect(result.message).toBe('Opening players configured');

    details = await matchService.getMatchDetails(match.id);
    const freshInn2 = details.innings.find(i => i.inningsNumber === 2)!;
    expect(freshInn2.currentStrikerId).toBe(squad2[0].id);
    expect(freshInn2.currentNonStrikerId).toBe(squad2[1].id);
    expect(freshInn2.currentBowlerId).toBe(squad1[10].id);

    // Score Ball 1 in Innings 2: squad2[0] hits a four
    await scoringService.scoreDelivery(match.id, {
      batterRuns: 4,
      extraType: ExtraType.NONE,
    });

    details = await matchService.getMatchDetails(match.id);
    const updatedInn2 = details.innings.find(i => i.inningsNumber === 2)!;
    expect(updatedInn2.totalRuns).toBe(4);
    expect(updatedInn2.legalBalls).toBe(1);

    const inn2StrikerCard = updatedInn2.battingScorecards.find(b => b.playerId === squad2[0].id)!;
    expect(inn2StrikerCard.runs).toBe(4);
    expect(inn2StrikerCard.fours).toBe(1);
  });
});
