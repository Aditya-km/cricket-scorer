import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ballsToOversText,
  ballsToOversDecimal,
  calculateStrikeRate,
  calculateBattingAverage,
  calculateBowlingAverage,
  calculateEconomyRate,
  getMaxOversPerBowler,
  getMaxOversPerInnings,
} from '../src/utils/cricket.js';
import { prisma } from '../src/config/db.js';
import * as authService from '../src/services/auth.service.js';
import * as squadService from '../src/services/squad.service.js';
import * as matchService from '../src/services/match.service.js';
import * as scoringService from '../src/services/scoring.service.js';
import * as testMatchService from '../src/services/testMatch.service.js';
import * as statsService from '../src/services/stats.service.js';
import { DismissalType, ExtraType, MatchFormat, PlayerRole } from '@prisma/client';

describe('Cricket Math & Calculations', () => {
  it('correctly converts legal deliveries to over strings', () => {
    expect(ballsToOversText(0)).toBe('0.0');
    expect(ballsToOversText(1)).toBe('0.1');
    expect(ballsToOversText(5)).toBe('0.5');
    expect(ballsToOversText(6)).toBe('1.0');
    expect(ballsToOversText(14)).toBe('2.2');
    expect(ballsToOversText(300)).toBe('50.0');
  });

  it('calculates decimal overs correctly without string decimal traps', () => {
    expect(ballsToOversDecimal(0)).toBe(0);
    expect(ballsToOversDecimal(6)).toBe(1);
    expect(ballsToOversDecimal(12)).toBe(2);
    expect(ballsToOversDecimal(3)).toBe(0.5);
  });

  it('calculates batting strike rate correctly', () => {
    expect(calculateStrikeRate(50, 25)).toBe(200.0);
    expect(calculateStrikeRate(45, 30)).toBe(150.0);
    expect(calculateStrikeRate(0, 5)).toBe(0.0);
    expect(calculateStrikeRate(0, 0)).toBe(0.0);
  });

  it('calculates batting average correctly', () => {
    expect(calculateBattingAverage(100, 2)).toBe(50.0);
    expect(calculateBattingAverage(75, 1)).toBe(75.0);
    expect(calculateBattingAverage(40, 0)).toBe(null); // Not out -> null
  });

  it('calculates bowling figures and economy rate', () => {
    expect(calculateBowlingAverage(60, 3)).toBe(20.0);
    expect(calculateBowlingAverage(30, 0)).toBe(null);
    expect(calculateEconomyRate(24, 24)).toBe(6.0); // 24 runs in 4 overs = 6.0
    expect(calculateEconomyRate(35, 30)).toBe(7.0); // 35 runs in 5 overs = 7.0
  });

  it('enforces format-specific bowling over limits', () => {
    expect(getMaxOversPerBowler('T10')).toBe(2);
    expect(getMaxOversPerBowler('T20')).toBe(4);
    expect(getMaxOversPerBowler('ODI')).toBe(10);
    expect(getMaxOversPerBowler('TEST')).toBe(Infinity);
  });

  it('enforces format-specific innings over limits', () => {
    expect(getMaxOversPerInnings('T10')).toBe(10);
    expect(getMaxOversPerInnings('T20')).toBe(20);
    expect(getMaxOversPerInnings('ODI')).toBe(50);
    expect(getMaxOversPerInnings('TEST')).toBe(null);
  });
});

describe('Full Cricket Match Lifecycle & Rules Engine', () => {
  let teamA: any;
  let teamB: any;
  let playersA: any[] = [];
  let playersB: any[] = [];
  let match: any;

  beforeAll(async () => {
    // Generate unique timestamp for isolated test run
    const ts = Date.now();
    const regA = await authService.registerTeam({
      teamName: `Lions XI ${ts}`,
      username: `lions_${ts}`,
      email: `lions_${ts}@cricket.test`,
      password: 'password123',
    });
    teamA = regA.team;

    const regB = await authService.registerTeam({
      teamName: `Tigers XI ${ts}`,
      username: `tigers_${ts}`,
      email: `tigers_${ts}@cricket.test`,
      password: 'password123',
    });
    teamB = regB.team;

    // Create 11 players for Team A
    for (let i = 1; i <= 11; i++) {
      const p = await squadService.addPlayer(teamA.id, {
        playerName: `BatterA ${i}`,
        jerseyNumber: i,
        role: i <= 5 ? PlayerRole.BATTER : i === 6 ? PlayerRole.WICKETKEEPER : i <= 8 ? PlayerRole.ALL_ROUNDER : PlayerRole.BOWLER,
      });
      playersA.push(p);
    }

    // Create 11 players for Team B
    for (let i = 1; i <= 11; i++) {
      const p = await squadService.addPlayer(teamB.id, {
        playerName: `PlayerB ${i}`,
        jerseyNumber: i,
        role: i <= 5 ? PlayerRole.BATTER : i <= 8 ? PlayerRole.ALL_ROUNDER : PlayerRole.BOWLER,
      });
      playersB.push(p);
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (match) {
      await prisma.match.deleteMany({ where: { id: match.id } });
    }
    await prisma.player.deleteMany({ where: { teamId: { in: [teamA.id, teamB.id] } } });
    await prisma.team.deleteMany({ where: { id: { in: [teamA.id, teamB.id] } } });
  });

  it('creates match, sets Playing XI, conducts toss, and sets openers', async () => {
    match = await matchService.createMatch(teamA.id, {
      format: MatchFormat.T20,
      opponentTeamId: teamB.id,
      matchDate: new Date().toISOString(),
      venue: 'National Cricket Ground',
    });

    expect(match.id).toBeDefined();
    expect(match.format).toBe('T20');

    // Setup Playing XI
    await matchService.setupPlayingXI(
      match.id,
      playersA.map(p => p.id),
      playersB.map(p => p.id)
    );

    // Conduct Toss: Team A wins and bats
    const toss = await matchService.conductToss(match.id, {
      tossWinnerId: teamA.id,
      tossDecision: 'BAT',
    });

    expect(toss.firstBattingTeamId).toBe(teamA.id);
    expect(toss.firstBowlingTeamId).toBe(teamB.id);

    // Opening players
    await matchService.selectOpeningPlayers(match.id, {
      strikerId: playersA[0].id,
      nonStrikerId: playersA[1].id,
      bowlerId: playersB[10].id,
    });

    const details = await matchService.getMatchDetails(match.id);
    const inn1 = details.innings[0];
    expect(inn1.currentStrikerId).toBe(playersA[0].id);
    expect(inn1.currentNonStrikerId).toBe(playersA[1].id);
    expect(inn1.currentBowlerId).toBe(playersB[10].id);
  });

  it('scores boundaries and dot balls with proper strike retention', async () => {
    // Ball 1: 4 runs (boundary) -> strike retained by striker
    const b1 = await scoringService.scoreDelivery(match.id, {
      batterRuns: 4,
      extraType: ExtraType.NONE,
    });
    expect(b1.innings.totalRuns).toBe(4);
    expect(b1.innings.legalBalls).toBe(1);
    expect(b1.innings.currentStrikerId).toBe(playersA[0].id); // Retained

    // Ball 2: 0 runs (dot) -> strike retained
    const b2 = await scoringService.scoreDelivery(match.id, {
      batterRuns: 0,
      extraType: ExtraType.NONE,
    });
    expect(b2.innings.totalRuns).toBe(4);
    expect(b2.innings.legalBalls).toBe(2);
    expect(b2.innings.currentStrikerId).toBe(playersA[0].id);
  });

  it('scores single run and rotates strike correctly', async () => {
    // Ball 3: 1 run -> strike rotates to non-striker
    const b3 = await scoringService.scoreDelivery(match.id, {
      batterRuns: 1,
      extraType: ExtraType.NONE,
    });
    expect(b3.innings.totalRuns).toBe(5);
    expect(b3.innings.legalBalls).toBe(3);
    expect(b3.innings.currentStrikerId).toBe(playersA[1].id); // Swapped!
  });

  it('handles extras: Wide does not count as legal ball and adds penalty', async () => {
    // Ball 4 (attempted): Wide
    const bWide = await scoringService.scoreDelivery(match.id, {
      batterRuns: 0,
      extraType: ExtraType.WIDE,
      extraRuns: 0,
    });
    expect(bWide.innings.totalRuns).toBe(6); // 5 + 1
    expect(bWide.innings.legalBalls).toBe(3); // Still 3! Not legal ball.
  });

  it('handles extras: No-ball gives penalty + bat runs without legal ball count', async () => {
    // Ball 4 (attempted again): No-ball + 4 runs off bat
    const bNb = await scoringService.scoreDelivery(match.id, {
      batterRuns: 4,
      extraType: ExtraType.NO_BALL,
    });
    expect(bNb.innings.totalRuns).toBe(11); // 6 + 1(penalty) + 4(bat)
    expect(bNb.innings.legalBalls).toBe(3); // Still 3!
  });

  it('handles extras: Bye counts as legal ball without crediting bowler', async () => {
    // Ball 4: 1 Bye -> legal ball, strike rotates
    const bBye = await scoringService.scoreDelivery(match.id, {
      batterRuns: 0,
      extraType: ExtraType.BYE,
      extraRuns: 1,
    });
    expect(bBye.innings.totalRuns).toBe(12);
    expect(bBye.innings.legalBalls).toBe(4);
  });

  it('handles wicket dismissal, credits bowler, and brings in incoming batter', async () => {
    // Ball 5: Caught out!
    const bWicket = await scoringService.scoreDelivery(match.id, {
      batterRuns: 0,
      extraType: ExtraType.NONE,
      isWicket: true,
      dismissalType: DismissalType.CAUGHT,
      dismissedPlayerId: playersA[0].id,
      fielderId: playersB[5].id,
      incomingBatterId: playersA[2].id,
    });

    expect(bWicket.innings.wickets).toBe(1);
    expect(bWicket.innings.legalBalls).toBe(5);
    expect(bWicket.delivery.bowlerCredited).toBe(true);
  });

  it('completes the over at 6 legal balls, rotates strike, and prompts next bowler', async () => {
    // Ball 6: 2 runs -> legal over complete!
    const b6 = await scoringService.scoreDelivery(match.id, {
      batterRuns: 2,
      extraType: ExtraType.NONE,
    });

    expect(b6.isOverComplete).toBe(true);
    expect(b6.shouldPromptBowler).toBe(true);
    expect(b6.innings.legalBalls).toBe(6);
    expect(b6.innings.oversCompletedText).toBe('1.0');
    expect(b6.innings.currentBowlerId).toBe(null); // Waiting for bowler selection
  });

  it('enforces consecutive over rule when selecting next bowler', async () => {
    // Bowler who bowled over 1 was playersB[10].id
    // Trying to select same bowler must fail
    await expect(
      scoringService.changeBowler(match.id, playersB[10].id)
    ).rejects.toThrow('A bowler cannot bowl two consecutive overs');

    // Selecting another bowler succeeds
    const changed = await scoringService.changeBowler(match.id, playersB[9].id);
    expect(changed.currentBowlerId).toBe(playersB[9].id);
  });

  it('reverts state accurately when Undo Last Delivery is performed', async () => {
    // Score 1 ball in over 2
    const beforeUndo = await scoringService.scoreDelivery(match.id, {
      batterRuns: 6,
      extraType: ExtraType.NONE,
    });
    expect(beforeUndo.innings.legalBalls).toBe(7);

    // Undo delivery
    await scoringService.undoLastDelivery(match.id);

    const details = await matchService.getMatchDetails(match.id);
    const inn = details.innings[0];
    expect(inn.legalBalls).toBe(6);
  });
});
