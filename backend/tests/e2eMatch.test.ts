import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import * as authService from '../src/services/auth.service.js';
import * as squadService from '../src/services/squad.service.js';
import * as matchService from '../src/services/match.service.js';
import * as scoringService from '../src/services/scoring.service.js';
import * as statsService from '../src/services/stats.service.js';
import * as pdfService from '../src/services/pdf.service.js';
import { MatchFormat, PlayerRole, ExtraType, DismissalType } from '@prisma/client';

describe('End-to-End Match Simulation & Career Stats Verification', () => {
  let team1: any;
  let team2: any;
  let squad1: any[] = [];
  let squad2: any[] = [];
  let match: any;

  beforeAll(async () => {
    const ts = Date.now();
    const t1 = await authService.registerTeam({
      teamName: `Warriors ${ts}`,
      username: `warriors_${ts}`,
      email: `warriors_${ts}@test.cricket`,
      password: 'password123',
    });
    team1 = t1.team;

    const t2 = await authService.registerTeam({
      teamName: `Knights ${ts}`,
      username: `knights_${ts}`,
      email: `knights_${ts}@test.cricket`,
      password: 'password123',
    });
    team2 = t2.team;

    // Squad 1 (11 players)
    for (let i = 1; i <= 11; i++) {
      const p = await squadService.addPlayer(team1.id, {
        playerName: `Warrior ${i}`,
        jerseyNumber: i,
        role: i <= 5 ? PlayerRole.BATTER : i === 6 ? PlayerRole.WICKETKEEPER : PlayerRole.BOWLER,
      });
      squad1.push(p);
    }

    // Squad 2 (11 players)
    for (let i = 1; i <= 11; i++) {
      const p = await squadService.addPlayer(team2.id, {
        playerName: `Knight ${i}`,
        jerseyNumber: i,
        role: i <= 5 ? PlayerRole.BATTER : i === 6 ? PlayerRole.WICKETKEEPER : PlayerRole.BOWLER,
      });
      squad2.push(p);
    }
  });

  afterAll(async () => {
    if (match) await prisma.match.deleteMany({ where: { id: match.id } });
    await prisma.player.deleteMany({ where: { teamId: { in: [team1.id, team2.id] } } });
    await prisma.team.deleteMany({ where: { id: { in: [team1.id, team2.id] } } });
  });

  it('runs complete T10 match from toss to victory and verifies player statistical profiles', async () => {
    // 1. Create match
    match = await matchService.createMatch(team1.id, {
      format: MatchFormat.T10,
      opponentTeamId: team2.id,
      matchDate: new Date().toISOString(),
      venue: 'Eden Gardens',
    });
    expect(match.id).toBeDefined();

    // 2. Setup Playing XI
    await matchService.setupPlayingXI(
      match.id,
      squad1.map(p => p.id),
      squad2.map(p => p.id)
    );

    // 3. Toss: Team 1 wins and bats
    await matchService.conductToss(match.id, {
      tossWinnerId: team1.id,
      tossDecision: 'BAT',
    });

    // 4. Openers: Striker = squad1[0], Non-striker = squad1[1], Bowler = squad2[10]
    await matchService.selectOpeningPlayers(match.id, {
      strikerId: squad1[0].id,
      nonStrikerId: squad1[1].id,
      bowlerId: squad2[10].id,
      inningsNumber: 1,
    });

    // 5. Score 1st Innings:
    // Over 1 (bowled by squad2[10]):
    // Ball 1: 4
    await scoringService.scoreDelivery(match.id, { batterRuns: 4, extraType: ExtraType.NONE });
    // Ball 2: 1 (rotates strike to squad1[1])
    await scoringService.scoreDelivery(match.id, { batterRuns: 1, extraType: ExtraType.NONE });
    // Ball 3: 6
    await scoringService.scoreDelivery(match.id, { batterRuns: 6, extraType: ExtraType.NONE });
    // Ball 4: 0
    await scoringService.scoreDelivery(match.id, { batterRuns: 0, extraType: ExtraType.NONE });
    // Ball 5: 2
    await scoringService.scoreDelivery(match.id, { batterRuns: 2, extraType: ExtraType.NONE });
    // Ball 6: 1 (strike rotates, over completes!)
    const o1End = await scoringService.scoreDelivery(match.id, { batterRuns: 1, extraType: ExtraType.NONE });
    expect(o1End.isOverComplete).toBe(true);
    expect(o1End.innings.totalRuns).toBe(14); // 4 + 1 + 6 + 0 + 2 + 1 = 14

    // Scorer selects next bowler: squad2[9]
    await scoringService.changeBowler(match.id, squad2[9].id);

    // Over 2 (bowled by squad2[9]):
    // Ball 7: Wicket! (Bowled, bowler credited)
    await scoringService.scoreDelivery(match.id, {
      batterRuns: 0,
      extraType: ExtraType.NONE,
      isWicket: true,
      dismissalType: DismissalType.BOWLED,
      incomingBatterId: squad1[2].id,
    });

    // Innings declaration or completion: Declare 1st innings closed at 14/1
    await prisma.innings.update({
      where: { matchId_inningsNumber: { matchId: match.id, inningsNumber: 1 } },
      data: { status: 'COMPLETED' },
    });

    // Setup 2nd Innings: Knights chase target of 15 (14 + 1)
    await prisma.innings.create({
      data: {
        matchId: match.id,
        inningsNumber: 2,
        battingTeamId: team2.id,
        bowlingTeamId: team1.id,
        targetRuns: 15,
      },
    });

    await prisma.match.update({
      where: { id: match.id },
      data: { currentInningsNumber: 2 },
    });

    // 2nd Innings Openers: squad2[0], squad2[1], bowler = squad1[10]
    await matchService.selectOpeningPlayers(match.id, {
      strikerId: squad2[0].id,
      nonStrikerId: squad2[1].id,
      bowlerId: squad1[10].id,
      inningsNumber: 2,
    });

    // Ball 1: 6 runs
    await scoringService.scoreDelivery(match.id, { batterRuns: 6, extraType: ExtraType.NONE });
    // Ball 2: 6 runs (total: 12)
    await scoringService.scoreDelivery(match.id, { batterRuns: 6, extraType: ExtraType.NONE });
    // Ball 3: 4 runs (total: 16 -> target 15 reached!)
    const winningBall = await scoringService.scoreDelivery(match.id, { batterRuns: 4, extraType: ExtraType.NONE });

    expect(winningBall.isTargetReached).toBe(true);

    // Verify Match status is COMPLETED with correct result
    const completedMatch = await matchService.getMatchDetails(match.id);
    expect(completedMatch.status).toBe('COMPLETED');
    expect(completedMatch.winnerId).toBe(team2.id);
    expect(completedMatch.resultDescription).toContain('won by 10 wickets');

    // Verify Player Statistical Profiles are updated automatically
    const batterProfile = await statsService.getPlayerProfile(squad2[0].id);
    expect(batterProfile.battingStats.matchesPlayed).toBe(1);
    expect(batterProfile.battingStats.totalRuns).toBe(16); // 6 + 6 + 4 = 16
    expect(batterProfile.battingStats.ballsFaced).toBe(3);
    expect(batterProfile.battingStats.strikeRate).toBe(533.33); // (16/3)*100
    expect(batterProfile.battingStats.fours).toBe(1);
    expect(batterProfile.battingStats.sixes).toBe(2);
    expect(batterProfile.battingStats.notOuts).toBe(1);

    // Verify bowler who took a wicket in 1st innings (squad2[9])
    const bowlerProfile = await statsService.getPlayerProfile(squad2[9].id);
    expect(bowlerProfile.bowlingStats.totalWickets).toBe(1);

    // Verify PDF generation for completed match
    const pdfBuf = await pdfService.generateMatchPdf(match.id);
    expect(pdfBuf.length).toBeGreaterThan(1500);
  });
});
