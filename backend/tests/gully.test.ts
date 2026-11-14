import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import * as authService from '../src/services/auth.service.js';
import * as squadService from '../src/services/squad.service.js';
import * as gullyService from '../src/services/gullyMatch.service.js';
import * as gullyScoringService from '../src/services/gullyScoring.service.js';
import * as gullyStatsService from '../src/services/gullyStats.service.js';
import * as adminService from '../src/services/admin.service.js';
import * as statsService from '../src/services/stats.service.js';
import { PlayerRole, ExtraType, DismissalType, MatchStatus, GullyMatchType } from '@prisma/client';

describe('Gully Cricket Module Tests', () => {
  let team1: any;
  let team2: any;
  let team1Players: any[] = [];

  beforeAll(async () => {
    const ts = Date.now();

    // 1. Register Team 1
    const t1 = await authService.registerTeam({
      teamName: `Friends CC ${ts}`,
      username: `fcc_${ts}`,
      email: `fcc_${ts}@test.com`,
      password: 'password123',
    });
    team1 = t1.team;

    // 2. Register Team 2
    const t2 = await authService.registerTeam({
      teamName: `Royal Strikers ${ts}`,
      username: `rs_${ts}`,
      email: `rs_${ts}@test.com`,
      password: 'password123',
    });
    team2 = t2.team;

    // 3. Register squad for Team 1 (Aditya, Rahul, Kiran, Arjun, Varun, Rohit)
    const playerNames = ['Aditya', 'Rahul', 'Kiran', 'Arjun', 'Varun', 'Rohit'];
    for (let i = 0; i < playerNames.length; i++) {
      const p = await squadService.addPlayer(team1.id, {
        playerName: playerNames[i],
        jerseyNumber: i + 1,
        role: i === 0 ? PlayerRole.BATTER : i < 3 ? PlayerRole.ALL_ROUNDER : PlayerRole.BOWLER,
      });
      team1Players.push(p);
    }
  });

  afterAll(async () => {
    // Clean up
    if (team1 && team2) {
      await prisma.gullyMatch.deleteMany({ where: { registeredTeamId: { in: [team1.id, team2.id] } } });
      await prisma.player.deleteMany({ where: { teamId: { in: [team1.id, team2.id] } } });
      await prisma.team.deleteMany({ where: { id: { in: [team1.id, team2.id] } } });
    }
  });

  it('performs Gully Draft with fair random backend selection', async () => {
    const playerIds = team1Players.map(p => p.id);
    const draft = await gullyService.performGullyDraft(team1.id, playerIds);

    expect(draft.selectedBatter).toBeDefined();
    expect(draft.bowlers).toHaveLength(playerIds.length - 1);
    expect(draft.bowlers.some((b: any) => b.id === draft.selectedBatter.id)).toBe(false);
  });

  it('creates a Gully Team Match with temporary teams and custom overs', async () => {
    // Team A: Aditya, Rahul, Kiran (3 players)
    // Team B: Arjun, Varun, Rohit (3 players)
    const teamAPlayerIds = [team1Players[0].id, team1Players[1].id, team1Players[2].id];
    const teamBPlayerIds = [team1Players[3].id, team1Players[4].id, team1Players[5].id];

    const match = await gullyService.createTeamMatch(team1.id, {
      totalOvers: 3,
      venue: 'Cross Road Street',
      bowlingAllocationRule: 'MAX_LIMIT',
      teamA: {
        teamName: 'Street Kings',
        playerIds: teamAPlayerIds,
        captainPlayerId: teamAPlayerIds[0],
        bowlingAllocations: [
          { playerId: teamAPlayerIds[0], allocatedOvers: 1 },
          { playerId: teamAPlayerIds[1], allocatedOvers: 1 },
          { playerId: teamAPlayerIds[2], allocatedOvers: 1 },
        ],
      },
      teamB: {
        teamName: 'Night Riders',
        playerIds: teamBPlayerIds,
        captainPlayerId: teamBPlayerIds[0],
        bowlingAllocations: [
          { playerId: teamBPlayerIds[0], allocatedOvers: 1 },
          { playerId: teamBPlayerIds[1], allocatedOvers: 1 },
          { playerId: teamBPlayerIds[2], allocatedOvers: 1 },
        ],
      },
      toss: {
        tossWinnerTeam: 'teamA',
        tossDecision: 'BAT',
      },
      openingPlayers: {
        strikerId: teamAPlayerIds[0],
        nonStrikerId: teamAPlayerIds[1],
        bowlerId: teamBPlayerIds[0],
      },
    });

    expect(match.matchType).toBe('TEAM_MATCH');
    expect(match.status).toBe('LIVE');
    expect(match.totalOvers).toBe(3);
    expect(match.temporaryTeams).toHaveLength(2);
    expect(match.temporaryTeams.find((t: any) => t.isTeamA)?.teamName).toBe('Street Kings');
    expect(match.temporaryTeams.find((t: any) => !t.isTeamA)?.teamName).toBe('Night Riders');
    expect(match.innings).toHaveLength(1);
    expect(match.innings[0].battingTeamName).toBe('Street Kings');
  });

  it('prevents selecting the same player in both temporary teams', async () => {
    await expect(
      gullyService.createTeamMatch(team1.id, {
        totalOvers: 2,
        bowlingAllocationRule: 'MAX_LIMIT',
        teamA: {
          teamName: 'Team One',
          playerIds: [team1Players[0].id, team1Players[1].id],
        },
        teamB: {
          teamName: 'Team Two',
          playerIds: [team1Players[0].id, team1Players[2].id], // duplicate player 0
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/cannot be selected in both teams/i),
    });
  });

  it('creates and scores a Gully Singles Match where batter plays alone and strike never rotates', async () => {
    const batter = team1Players[0]; // Aditya
    const bowlers = [team1Players[1], team1Players[2], team1Players[3]]; // Rahul, Kiran, Arjun

    // Create Singles match: 2 overs total, Rahul 1 over, Kiran 1 over
    const match = await gullyService.createSinglesMatch(team1.id, {
      totalOvers: 2,
      selectedBatterId: batter.id,
      bowlerPlayerIds: bowlers.map(b => b.id),
      bowlingAllocations: [
        { playerId: bowlers[0].id, allocatedOvers: 1 },
        { playerId: bowlers[1].id, allocatedOvers: 1 },
        { playerId: bowlers[2].id, allocatedOvers: 1 },
      ],
      bowlingAllocationRule: 'MAX_LIMIT',
      singlesDismissalRule: 'BATTER_CONTINUES',
      bowlerOrderRule: 'FREE_SELECTION',
      openingBowlerId: bowlers[0].id,
    });

    const matchId = match.id;
    expect(match.matchType).toBe('SINGLES_MATCH');
    expect(match.status).toBe('LIVE');
    expect(match.innings[0].currentStrikerId).toBe(batter.id);
    expect(match.innings[0].currentNonStrikerId).toBeNull();
    expect(match.innings[0].currentBowlerId).toBe(bowlers[0].id);

    // Ball 1: Batter hits 1 single run -> Strike MUST stay with batter!
    const ball1 = await gullyScoringService.scoreGullyDelivery(matchId, team1.id, {
      batterRuns: 1,
      extraType: ExtraType.NONE,
    });

    expect(ball1.innings.totalRuns).toBe(1);
    expect(ball1.innings.currentStrikerId).toBe(batter.id); // STRIKE UNCHANGED!
    expect(ball1.innings.currentNonStrikerId).toBeNull();

    // Ball 2: Batter hits a 4 boundary -> Score becomes 5, strike stays with batter!
    const ball2 = await gullyScoringService.scoreGullyDelivery(matchId, team1.id, {
      batterRuns: 4,
      extraType: ExtraType.NONE,
    });

    expect(ball2.innings.totalRuns).toBe(5);
    expect(ball2.innings.currentStrikerId).toBe(batter.id);

    // Ball 3: Bye with 2 runs
    const ball3 = await gullyScoringService.scoreGullyDelivery(matchId, team1.id, {
      batterRuns: 0,
      extraType: ExtraType.BYE,
      extraRuns: 2,
    });

    expect(ball3.innings.totalRuns).toBe(7);
    expect(ball3.innings.byes).toBe(2);
    expect(ball3.innings.currentStrikerId).toBe(batter.id);

    // Ball 4: Wicket falls! But under BATTER_CONTINUES, batter continues!
    const ball4 = await gullyScoringService.scoreGullyDelivery(matchId, team1.id, {
      batterRuns: 0,
      extraType: ExtraType.NONE,
      isWicket: true,
      dismissalType: DismissalType.BOWLED,
      dismissedPlayerId: batter.id,
    });

    expect(ball4.innings.wickets).toBe(1);
    expect(ball4.innings.currentStrikerId).toBe(batter.id); // STILL BATTING!
    expect(ball4.innings.status).toBe('IN_PROGRESS');

    // Ball 5: Dot ball
    await gullyScoringService.scoreGullyDelivery(matchId, team1.id, {
      batterRuns: 0,
      extraType: ExtraType.NONE,
    });

    // Ball 6: 1 run (over 1 complete!)
    const ball6 = await gullyScoringService.scoreGullyDelivery(matchId, team1.id, {
      batterRuns: 1,
      extraType: ExtraType.NONE,
    });

    expect(ball6.isOverComplete).toBe(true);
    // At end of over, in Singles Match: striker remains batter!
    expect(ball6.innings.currentStrikerId).toBe(batter.id);
    expect(ball6.innings.currentBowlerId).toBeNull(); // Needs next bowler selection

    // Try to select Rahul again for consecutive over -> must be rejected
    await expect(
      gullyScoringService.changeGullyBowler(matchId, team1.id, bowlers[0].id)
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/cannot bowl two consecutive overs/i),
    });

    // Select Kiran (bowler 1)
    const changed = await gullyScoringService.changeGullyBowler(matchId, team1.id, bowlers[1].id);
    expect(changed.currentBowlerId).toBe(bowlers[1].id);

    // Test Undo Last Delivery
    const undoRes = await gullyScoringService.undoLastGullyDelivery(matchId, team1.id);
    expect(undoRes.message).toMatch(/reverted successfully/i);

    const fresh = await gullyService.getGullyMatchDetails(matchId);
    expect(fresh.innings[0].legalBalls).toBe(5); // Ball 6 undone!
  });

  it('enforces LAST_WICKET_ENDS_INNINGS dismissal rule in Singles Match', async () => {
    const batter = team1Players[1];
    const bowler = team1Players[2];

    const match = await gullyService.createSinglesMatch(team1.id, {
      totalOvers: 5,
      selectedBatterId: batter.id,
      bowlerPlayerIds: [bowler.id],
      bowlingAllocations: [{ playerId: bowler.id, allocatedOvers: 5 }],
      bowlingAllocationRule: 'MAX_LIMIT',
      singlesDismissalRule: 'LAST_WICKET_ENDS_INNINGS',
      bowlerOrderRule: 'FREE_SELECTION',
    });

    const matchId = match.id;

    // Delivery: Wicket!
    const wicketBall = await gullyScoringService.scoreGullyDelivery(matchId, team1.id, {
      batterRuns: 0,
      extraType: ExtraType.NONE,
      isWicket: true,
      dismissalType: DismissalType.CAUGHT,
      dismissedPlayerId: batter.id,
    });

    expect(wicketBall.innings.status).toBe('COMPLETED');
    const freshMatch = await gullyService.getGullyMatchDetails(matchId);
    expect(freshMatch.status).toBe(MatchStatus.LIVE);

    // Call End Match to conclude
    const endedMatch = await gullyService.endGullyMatch(matchId, team1.id);
    expect(endedMatch.status).toBe(MatchStatus.COMPLETED);
    expect(endedMatch.winnerName).toBeDefined();
  });

  it('enforces authorization: Team 2 cannot access or score Team 1 Gully Match', async () => {
    const batter = team1Players[0];
    const bowler = team1Players[1];

    const match = await gullyService.createSinglesMatch(team1.id, {
      totalOvers: 2,
      selectedBatterId: batter.id,
      bowlerPlayerIds: [bowler.id],
      bowlingAllocations: [{ playerId: bowler.id, allocatedOvers: 2 }],
      bowlingAllocationRule: 'MAX_LIMIT',
      singlesDismissalRule: 'BATTER_CONTINUES',
      bowlerOrderRule: 'FREE_SELECTION',
    });

    const matchId = match.id;

    // Team 2 tries to score Team 1's match
    await expect(
      gullyScoringService.scoreGullyDelivery(matchId, team2.id, {
        batterRuns: 4,
        extraType: ExtraType.NONE,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringMatching(/access denied/i),
    });
  });

  it('verifies Gully Matches do NOT appear in Admin International matches or dashboard', async () => {
    const adminDashboard = await adminService.getAdminDashboard();
    const adminMatches = await adminService.getAllMatches();

    // Verify all matches returned in adminMatches are MatchFormat enum (International)
    adminMatches.forEach((m: any) => {
      expect(['T10', 'T20', 'ODI', 'TEST']).toContain(m.format);
    });

    // None of the adminMatches should have registeredTeamId or matchType belonging to Gully
    adminMatches.forEach((m: any) => {
      expect(m.matchType).toBeUndefined();
    });
  });

  it('tracks Gully player statistics completely separately from International statistics', async () => {
    const player = team1Players[0];

    // Fetch Gully Profile
    const gullyStats = await gullyStatsService.getPlayerGullyProfile(player.id, team1.id);
    expect(gullyStats.gullyBattingStats).toBeDefined();
    expect(gullyStats.teamMatchBreakdown).toBeDefined();
    expect(gullyStats.singlesMatchBreakdown).toBeDefined();

    // Fetch International Profile
    const intlStats = await statsService.getPlayerProfile(player.id);
    expect(intlStats.battingStats).toBeDefined();
    // International stats must remain 0 since this player only played Gully matches
    expect(intlStats.battingStats.matchesPlayed).toBe(0);
    expect(intlStats.battingStats.totalRuns).toBe(0);
  });

  it('supports multi-batter Singles rounds, seeds round 2 batting order by highest score, and provides cumulative summary', async () => {
    const p1 = team1Players[0];
    const p2 = team1Players[1];
    const p3 = team1Players[2];

    // Create Singles match with batting order: p1, p2, p3
    const match = await gullyService.createSinglesMatch(team1.id, {
      totalOvers: 2,
      battingOrderPlayerIds: [p1.id, p2.id, p3.id],
      singlesDismissalRule: 'LAST_WICKET_ENDS_INNINGS',
      bowlerOrderRule: 'FREE_SELECTION',
    });

    const matchId = match.id;
    expect(match.singlesQueue).toHaveLength(3);
    expect(match.singlesQueue[0].playerId).toBe(p1.id);

    // Batter 1 (p1) scores 4 runs, then gets caught out
    await gullyScoringService.scoreGullyDelivery(matchId, team1.id, {
      batterRuns: 4,
      extraType: ExtraType.NONE,
    });
    await gullyScoringService.scoreGullyDelivery(matchId, team1.id, {
      batterRuns: 0,
      extraType: ExtraType.NONE,
      isWicket: true,
      dismissalType: DismissalType.CAUGHT,
      dismissedPlayerId: p1.id,
    });

    // Start Next Batter: p2
    const mAfterP2 = await gullyService.startNextSinglesBatter(matchId, team1.id);
    expect(mAfterP2.currentInningsNumber).toBe(2);
    expect(mAfterP2.selectedBatterId).toBe(p2.id);

    // Batter 2 (p2) hits 6 and 6 = 12 runs, then gets bowled
    await gullyScoringService.scoreGullyDelivery(matchId, team1.id, {
      batterRuns: 6,
      extraType: ExtraType.NONE,
    });
    await gullyScoringService.scoreGullyDelivery(matchId, team1.id, {
      batterRuns: 6,
      extraType: ExtraType.NONE,
    });
    await gullyScoringService.scoreGullyDelivery(matchId, team1.id, {
      batterRuns: 0,
      extraType: ExtraType.NONE,
      isWicket: true,
      dismissalType: DismissalType.BOWLED,
      dismissedPlayerId: p2.id,
    });

    // Start Next Batter: p3
    const mAfterP3 = await gullyService.startNextSinglesBatter(matchId, team1.id);
    expect(mAfterP3.currentInningsNumber).toBe(3);
    expect(mAfterP3.selectedBatterId).toBe(p3.id);

    // Batter 3 (p3) scores 1 run, then out
    await gullyScoringService.scoreGullyDelivery(matchId, team1.id, {
      batterRuns: 1,
      extraType: ExtraType.NONE,
    });
    await gullyScoringService.scoreGullyDelivery(matchId, team1.id, {
      batterRuns: 0,
      extraType: ExtraType.NONE,
      isWicket: true,
      dismissalType: DismissalType.BOWLED,
      dismissedPlayerId: p3.id,
    });

    // Check Round 1 completion: all 3 have batted!
    const round1Details = await gullyService.getGullyMatchDetails(matchId);
    expect(round1Details.isRoundComplete).toBe(true);
    expect(round1Details.rounds).toHaveLength(1);
    expect(round1Details.rounds[0].roundLeaderboard[0].batterId).toBe(p2.id); // p2 scored 12 runs (Rank 1)
    expect(round1Details.rounds[0].roundLeaderboard[1].batterId).toBe(p1.id); // p1 scored 4 runs (Rank 2)
    expect(round1Details.rounds[0].roundLeaderboard[2].batterId).toBe(p3.id); // p3 scored 1 run (Rank 3)

    // Start Round 2: Seeded by highest scores!
    // Highest scorer (p2) must bat 1st in Round 2!
    const round2Match = await gullyService.startNextSinglesRound(matchId, team1.id);
    expect(round2Match.currentRoundNumber).toBe(2);
    expect(round2Match.selectedBatterId).toBe(p2.id); // p2 bats FIRST in Round 2!
    const r2Order: string[] = JSON.parse(round2Match.singlesBattingOrder || '[]');
    expect(r2Order[0]).toBe(p2.id);
    expect(r2Order[1]).toBe(p1.id);
    expect(r2Order[2]).toBe(p3.id);

    // End match with End Match button
    const finalMatch = await gullyService.endGullyMatch(matchId, team1.id);
    expect(finalMatch.status).toBe(MatchStatus.COMPLETED);
    expect(finalMatch.winnerName).toBe(p2.playerName);
    expect(finalMatch.cumulativeLeaderboard[0].playerId).toBe(p2.id);
    expect(finalMatch.cumulativeLeaderboard[0].totalRuns).toBe(12);
  });
});
