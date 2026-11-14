import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import * as authService from '../src/services/auth.service.js';
import * as squadService from '../src/services/squad.service.js';
import * as matchService from '../src/services/match.service.js';
import * as testMatchService from '../src/services/testMatch.service.js';
import * as pdfService from '../src/services/pdf.service.js';
import { MatchFormat, PlayerRole } from '@prisma/client';

describe('Test Match Management & Cumulative Rules', () => {
  let teamA: any;
  let teamB: any;
  let playersA: any[] = [];
  let playersB: any[] = [];
  let match: any;

  beforeAll(async () => {
    const ts = Date.now();
    const regA = await authService.registerTeam({
      teamName: `Australia XI ${ts}`,
      username: `aus_${ts}`,
      email: `aus_${ts}@cricket.test`,
      password: 'password123',
    });
    teamA = regA.team;

    const regB = await authService.registerTeam({
      teamName: `England XI ${ts}`,
      username: `eng_${ts}`,
      email: `eng_${ts}@cricket.test`,
      password: 'password123',
    });
    teamB = regB.team;

    for (let i = 1; i <= 11; i++) {
      playersA.push(await squadService.addPlayer(teamA.id, { playerName: `Aus Player ${i}`, jerseyNumber: i, role: PlayerRole.BATTER }));
      playersB.push(await squadService.addPlayer(teamB.id, { playerName: `Eng Player ${i}`, jerseyNumber: i, role: PlayerRole.BOWLER }));
    }

    match = await matchService.createMatch(teamA.id, {
      format: MatchFormat.TEST,
      opponentTeamId: teamB.id,
      matchDate: new Date().toISOString(),
      venue: 'Lord\'s Cricket Ground',
    });

    await matchService.setupPlayingXI(match.id, playersA.map(p => p.id), playersB.map(p => p.id));
    await matchService.conductToss(match.id, { tossWinnerId: teamA.id, tossDecision: 'BAT' });
  });

  afterAll(async () => {
    if (match) await prisma.match.deleteMany({ where: { id: match.id } });
    await prisma.player.deleteMany({ where: { teamId: { in: [teamA.id, teamB.id] } } });
    await prisma.team.deleteMany({ where: { id: { in: [teamA.id, teamB.id] } } });
  });

  it('manages sessions and days accurately up to 5 days', async () => {
    // Starts at Day 1, Session 1
    let status = await testMatchService.calculateTestMatchStatus(match.id);
    expect(status.currentDay).toBe(1);
    expect(status.currentSession).toBe(1);

    // Advance session 1 -> session 2
    const res1 = await testMatchService.advanceSession(match.id);
    expect(res1.session).toBe(2);

    // Advance session 2 -> session 3
    const res2 = await testMatchService.advanceSession(match.id);
    expect(res2.session).toBe(3);

    // Advance session 3 -> advances to Day 2, Session 1
    const res3 = await testMatchService.advanceSession(match.id);
    expect(res3.day).toBe(2);
    expect(res3.session).toBe(1);
  });

  it('calculates cumulative lead and trail accurately across innings', async () => {
    // Simulate Innings 1: Australia scores 400
    await prisma.innings.update({
      where: { matchId_inningsNumber: { matchId: match.id, inningsNumber: 1 } },
      data: { totalRuns: 400, wickets: 10, status: 'COMPLETED' },
    });

    // Create Innings 2: England scores 180
    await prisma.innings.create({
      data: {
        matchId: match.id,
        inningsNumber: 2,
        battingTeamId: teamB.id,
        bowlingTeamId: teamA.id,
        totalRuns: 180,
        wickets: 10,
        status: 'COMPLETED',
      },
    });

    const leadTrail = await testMatchService.calculateTestMatchStatus(match.id);
    expect(leadTrail.leaderTeam?.id).toBe(teamA.id);
    expect(leadTrail.leadRuns).toBe(220); // 400 - 180
    expect(leadTrail.canEnforceFollowOn).toBe(true); // 220 >= 200
  });

  it('enforces follow-on rule when opponent trails by 200 or more runs', async () => {
    const foResult = await testMatchService.handleFollowOn(match.id, true);
    expect(foResult.followOnEnforced).toBe(true);

    // Innings 3 must have England (teamB) batting again!
    const inn3 = await prisma.innings.findUnique({
      where: { matchId_inningsNumber: { matchId: match.id, inningsNumber: 3 } },
    });
    expect(inn3).toBeDefined();
    expect(inn3?.battingTeamId).toBe(teamB.id);
  });

  it('supports declarations and transitions to 4th innings target', async () => {
    // England scores 300 in 3rd innings and declares
    await prisma.innings.update({
      where: { matchId_inningsNumber: { matchId: match.id, inningsNumber: 3 } },
      data: { totalRuns: 300, wickets: 6 },
    });

    await prisma.match.update({
      where: { id: match.id },
      data: { currentInningsNumber: 3 },
    });

    const dec = await testMatchService.declareInnings(match.id);
    expect(dec.message).toContain('Innings 4 initialized');

    // England cumulative: 180 + 300 = 480
    // Australia cumulative: 400
    // Australia 4th innings target = 480 - 400 + 1 = 81 runs!
    const inn4 = await prisma.innings.findUnique({
      where: { matchId_inningsNumber: { matchId: match.id, inningsNumber: 4 } },
    });
    expect(inn4?.targetRuns).toBe(81);
    expect(inn4?.battingTeamId).toBe(teamA.id);
  });

  it('generates PDF scorecard without errors', async () => {
    const pdfBuffer = await pdfService.generateMatchPdf(match.id);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // Verify PDF header magic bytes "%PDF-"
    expect(pdfBuffer.toString('utf-8', 0, 5)).toBe('%PDF-');
  });
});
