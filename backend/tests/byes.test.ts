import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import * as authService from '../src/services/auth.service.js';
import * as squadService from '../src/services/squad.service.js';
import * as matchService from '../src/services/match.service.js';
import * as scoringService from '../src/services/scoring.service.js';
import { MatchFormat, PlayerRole, ExtraType, TossDecision } from '@prisma/client';

describe('Bye and Leg Bye Scoring Engine Tests', () => {
  let team1: any;
  let team2: any;
  let squad1: any[] = [];
  let squad2: any[] = [];
  let match: any;

  beforeAll(async () => {
    const ts = Date.now();
    const t1 = await authService.registerTeam({
      teamName: `Bye Team A ${ts}`,
      username: `bye_teama_${ts}`,
      email: `bye_teama_${ts}@cricket.test`,
      password: 'password123',
    });
    team1 = t1.team;

    const t2 = await authService.registerTeam({
      teamName: `Bye Team B ${ts}`,
      username: `bye_teamb_${ts}`,
      email: `bye_teamb_${ts}@cricket.test`,
      password: 'password123',
    });
    team2 = t2.team;

    // Create 3 players for Team 1
    for (let i = 1; i <= 3; i++) {
      const p = await squadService.addPlayer(team1.id, {
        playerName: `Batter ${i}`,
        jerseyNumber: i,
        role: PlayerRole.BATTER,
      });
      squad1.push(p);
    }

    // Create 3 players for Team 2
    for (let i = 1; i <= 3; i++) {
      const p = await squadService.addPlayer(team2.id, {
        playerName: `Bowler ${i}`,
        jerseyNumber: 10 + i,
        role: PlayerRole.BOWLER,
      });
      squad2.push(p);
    }
  });

  afterAll(async () => {
    if (match) await prisma.match.deleteMany({ where: { id: match.id } });
    await prisma.player.deleteMany({ where: { teamId: { in: [team1.id, team2.id] } } });
    await prisma.team.deleteMany({ where: { id: { in: [team1.id, team2.id] } } });
  });

  it('sets up a match ready for live scoring', async () => {
    match = await matchService.createMatch({
      format: MatchFormat.T20,
      teamAId: team1.id,
      teamBId: team2.id,
      matchDate: new Date().toISOString(),
      venue: 'Lord\'s Cricket Ground',
    });

    await matchService.setupPlayingXI(match.id, [squad1[0].id, squad1[1].id, squad1[2].id], [squad2[0].id, squad2[1].id, squad2[2].id]);

    await matchService.conductToss(match.id, {
      tossWinnerId: team1.id,
      tossDecision: TossDecision.BAT,
    });

    await matchService.selectOpeningPlayers(match.id, {
      strikerId: squad1[0].id,
      nonStrikerId: squad1[1].id,
      bowlerId: squad2[0].id,
    });

    const details = await matchService.getMatchDetails(match.id);
    expect(details.innings.length).toBe(1);
    expect(details.innings[0].currentStrikerId).toBe(squad1[0].id);
    expect(details.innings[0].currentNonStrikerId).toBe(squad1[1].id);
    expect(details.innings[0].currentBowlerId).toBe(squad2[0].id);
  });

  it('records a 1-run Bye: credits team & byes, 0 to batter, 0 to bowler, legal ball, odd rotates strike', async () => {
    await scoringService.scoreDelivery(match.id, {
      batterRuns: 0,
      extraType: ExtraType.BYE,
      extraRuns: 1,
    });

    const details = await matchService.getMatchDetails(match.id);
    const inn = details.innings[0];

    expect(inn.totalRuns).toBe(1);
    expect(inn.byes).toBe(1);
    expect(inn.legByes).toBe(0);
    expect(inn.legalBalls).toBe(1);

    // Strike rotation: odd run (1) switches striker and non-striker
    expect(inn.currentStrikerId).toBe(squad1[1].id);
    expect(inn.currentNonStrikerId).toBe(squad1[0].id);

    // Striker 1 (who faced the ball): runs = 0, balls = 1
    const strikerCard = inn.battingScorecards.find((b: any) => b.playerId === squad1[0].id);
    expect(strikerCard.runs).toBe(0);
    expect(strikerCard.balls).toBe(1);

    // Bowler: 1 ball bowled, 0 runs conceded
    const bowlerCard = inn.bowlingScorecards.find((b: any) => b.playerId === squad2[0].id);
    expect(bowlerCard.legalBalls).toBe(1);
    expect(bowlerCard.runsConceded).toBe(0);
  });

  it('records a 2-run Bye: even runs keeps striker on strike, 0 to batter, 0 to bowler', async () => {
    await scoringService.scoreDelivery(match.id, {
      batterRuns: 0,
      extraType: ExtraType.BYE,
      extraRuns: 2,
    });

    const details = await matchService.getMatchDetails(match.id);
    const inn = details.innings[0];

    expect(inn.totalRuns).toBe(3); // 1 + 2 = 3
    expect(inn.byes).toBe(3); // 1 + 2 = 3
    expect(inn.legalBalls).toBe(2);

    // Even runs (2) -> current striker stays on strike
    expect(inn.currentStrikerId).toBe(squad1[1].id);
    expect(inn.currentNonStrikerId).toBe(squad1[0].id);

    // Striker 2 (squad1[1]): runs = 0, balls = 1
    const strikerCard = inn.battingScorecards.find((b: any) => b.playerId === squad1[1].id);
    expect(strikerCard.runs).toBe(0);
    expect(strikerCard.balls).toBe(1);

    // Bowler: 2 balls, 0 runs conceded
    const bowlerCard = inn.bowlingScorecards.find((b: any) => b.playerId === squad2[0].id);
    expect(bowlerCard.legalBalls).toBe(2);
    expect(bowlerCard.runsConceded).toBe(0);
  });

  it('records a 4-run Bye boundary', async () => {
    await scoringService.scoreDelivery(match.id, {
      batterRuns: 0,
      extraType: ExtraType.BYE,
      extraRuns: 4,
    });

    const details = await matchService.getMatchDetails(match.id);
    const inn = details.innings[0];

    expect(inn.totalRuns).toBe(7); // 3 + 4 = 7
    expect(inn.byes).toBe(7); // 3 + 4 = 7
    expect(inn.legalBalls).toBe(3);

    // Even runs (4) -> striker remains on strike
    expect(inn.currentStrikerId).toBe(squad1[1].id);

    const bowlerCard = inn.bowlingScorecards.find((b: any) => b.playerId === squad2[0].id);
    expect(bowlerCard.runsConceded).toBe(0);
  });

  it('records a 1-run Leg Bye: credits legByes, odd rotates strike', async () => {
    await scoringService.scoreDelivery(match.id, {
      batterRuns: 0,
      extraType: ExtraType.LEG_BYE,
      extraRuns: 1,
    });

    const details = await matchService.getMatchDetails(match.id);
    const inn = details.innings[0];

    expect(inn.totalRuns).toBe(8); // 7 + 1 = 8
    expect(inn.byes).toBe(7);
    expect(inn.legByes).toBe(1);
    expect(inn.legalBalls).toBe(4);

    // Odd runs (1) -> strike rotates back to squad1[0]
    expect(inn.currentStrikerId).toBe(squad1[0].id);
    expect(inn.currentNonStrikerId).toBe(squad1[1].id);

    const bowlerCard = inn.bowlingScorecards.find((b: any) => b.playerId === squad2[0].id);
    expect(bowlerCard.runsConceded).toBe(0);
  });

  it('records a 0-run (dot) Leg Bye: legal ball increments, strike unchanged', async () => {
    await scoringService.scoreDelivery(match.id, {
      batterRuns: 0,
      extraType: ExtraType.LEG_BYE,
      extraRuns: 0,
    });

    const details = await matchService.getMatchDetails(match.id);
    const inn = details.innings[0];

    expect(inn.totalRuns).toBe(8);
    expect(inn.legByes).toBe(1);
    expect(inn.legalBalls).toBe(5);

    // 0 runs -> strike does not rotate
    expect(inn.currentStrikerId).toBe(squad1[0].id);

    const bowlerCard = inn.bowlingScorecards.find((b: any) => b.playerId === squad2[0].id);
    expect(bowlerCard.legalBalls).toBe(5);
    expect(bowlerCard.runsConceded).toBe(0);
  });

  it('records a 3-run Leg Bye completing the 6th delivery of the over: over ends & ends rotate', async () => {
    await scoringService.scoreDelivery(match.id, {
      batterRuns: 0,
      extraType: ExtraType.LEG_BYE,
      extraRuns: 3,
    });

    const details = await matchService.getMatchDetails(match.id);
    const inn = details.innings[0];

    expect(inn.totalRuns).toBe(11); // 8 + 3 = 11
    expect(inn.legByes).toBe(4); // 1 + 3 = 4
    expect(inn.legalBalls).toBe(6);
    expect(inn.oversCompletedText).toBe('1.0');

    // 6th ball over complete:
    // Running 3 rotated strike (squad1[0] -> squad1[1]), and over end rotated ends again (squad1[1] -> squad1[0])
    expect(inn.currentStrikerId).toBe(squad1[0].id);
    expect(inn.currentNonStrikerId).toBe(squad1[1].id);

    // Over is complete -> nextBowlerId is null until selected
    expect(inn.currentBowlerId).toBe(null);
    expect(inn.lastBowlerId).toBe(squad2[0].id);

    // Bowler completed 1 maiden over (0 runs conceded)
    const bowlerCard = inn.bowlingScorecards.find((b: any) => b.playerId === squad2[0].id);
    expect(bowlerCard.oversText).toBe('1.0');
    expect(bowlerCard.runsConceded).toBe(0);
    expect(bowlerCard.maidens).toBe(1);
  });

  it('undoes the 6th delivery accurately, rolling back runs, legByes, maiden, and restoring bowler', async () => {
    await scoringService.undoLastDelivery(match.id);

    const details = await matchService.getMatchDetails(match.id);
    const inn = details.innings[0];

    expect(inn.totalRuns).toBe(8);
    expect(inn.legByes).toBe(1);
    expect(inn.legalBalls).toBe(5);
    expect(inn.oversCompletedText).toBe('0.5');

    // Bowler is restored
    expect(inn.currentBowlerId).toBe(squad2[0].id);

    const bowlerCard = inn.bowlingScorecards.find((b: any) => b.playerId === squad2[0].id);
    expect(bowlerCard.legalBalls).toBe(5);
    expect(bowlerCard.oversText).toBe('0.5');
    expect(bowlerCard.maidens).toBe(0);
    expect(bowlerCard.runsConceded).toBe(0);
  });
});
