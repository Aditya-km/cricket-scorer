import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import * as authService from '../src/services/auth.service.js';
import * as adminService from '../src/services/admin.service.js';
import * as matchService from '../src/services/match.service.js';
import * as squadService from '../src/services/squad.service.js';
import { verifyToken } from '../src/utils/jwt.js';
import { MatchFormat, UserRole, PlayerRole } from '@prisma/client';

describe('Role-Based Access Control (Admin vs Team) Tests', () => {
  let adminTeam: any;
  let testTeam1: any;
  let testTeam2: any;
  let adminToken: string;
  let teamToken: string;
  let match: any;

  beforeAll(async () => {
    const ts = Date.now();

    // Find or seed Admin
    let admin = await prisma.team.findFirst({
      where: { role: UserRole.ADMIN },
    });
    if (!admin) {
      const createdAdmin = await authService.registerTeam({
        teamName: 'Platform Administrator',
        username: `admin_${ts}`,
        email: `admin_${ts}@cricket.com`,
        password: 'adminpassword',
        role: UserRole.ADMIN,
      });
      admin = await prisma.team.findUnique({ where: { id: createdAdmin.team.id } });
    }
    adminTeam = admin;

    // Login Admin
    const adminLogin = await authService.loginTeam({
      usernameOrEmail: adminTeam.username,
      password: adminTeam.username === 'admin' ? 'admin123' : 'adminpassword',
    });
    adminToken = adminLogin.token;

    // Register Team 1
    const t1 = await authService.registerTeam({
      teamName: `RBAC Team 1 ${ts}`,
      username: `rbac_team1_${ts}`,
      email: `rbac_team1_${ts}@cricket.test`,
      password: 'password123',
    });
    testTeam1 = t1.team;
    teamToken = t1.token;

    // Register Team 2
    const t2 = await authService.registerTeam({
      teamName: `RBAC Team 2 ${ts}`,
      username: `rbac_team2_${ts}`,
      email: `rbac_team2_${ts}@cricket.test`,
      password: 'password123',
    });
    testTeam2 = t2.team;

    // Add players to testTeam1
    for (let i = 1; i <= 3; i++) {
      await squadService.addPlayer(testTeam1.id, {
        playerName: `RBAC Player ${i}`,
        jerseyNumber: i,
        role: PlayerRole.BATTER,
      });
    }

    // Add players to testTeam2
    for (let i = 1; i <= 3; i++) {
      await squadService.addPlayer(testTeam2.id, {
        playerName: `Opp Player ${i}`,
        jerseyNumber: 10 + i,
        role: PlayerRole.BOWLER,
      });
    }
  });

  afterAll(async () => {
    if (match) await prisma.match.deleteMany({ where: { id: match.id } });
    await prisma.player.deleteMany({ where: { teamId: { in: [testTeam1.id, testTeam2.id] } } });
    await prisma.team.deleteMany({ where: { id: { in: [testTeam1.id, testTeam2.id] } } });
  });

  it('verifies Admin JWT contains role ADMIN', () => {
    const payload = verifyToken(adminToken);
    expect(payload.role).toBe(UserRole.ADMIN);
  });

  it('verifies Team JWT contains role TEAM and isActive true', () => {
    const payload = verifyToken(teamToken);
    expect(payload.role).toBe(UserRole.TEAM);
    expect(payload.isActive).toBe(true);
  });

  it('allows Admin to view platform overview statistics', async () => {
    const dashboard = await adminService.getAdminDashboard();
    expect(dashboard.totalTeams).toBeGreaterThanOrEqual(2);
    expect(dashboard.totalPlayers).toBeGreaterThanOrEqual(6);
    expect(typeof dashboard.totalMatches).toBe('number');
    expect(typeof dashboard.upcomingMatches).toBe('number');
    expect(typeof dashboard.liveMatches).toBe('number');
    expect(typeof dashboard.completedMatches).toBe('number');
  });

  it('allows Admin to view all teams with registered player counts', async () => {
    const teams = await adminService.getAllTeams();
    const found1 = teams.find(t => t.id === testTeam1.id);
    const found2 = teams.find(t => t.id === testTeam2.id);

    expect(found1).toBeDefined();
    expect(found1!.totalPlayers).toBe(3);
    expect(found1!.isActive).toBe(true);

    expect(found2).toBeDefined();
    expect(found2!.totalPlayers).toBe(3);
  });

  it('allows Admin to deactivate a team account and prevents deactivated team from logging in', async () => {
    // Admin deactivates testTeam1
    const updated = await adminService.updateTeamStatus(testTeam1.id, false);
    expect(updated.isActive).toBe(false);

    // Login must fail with 403 Forbidden
    await expect(
      authService.loginTeam({
        usernameOrEmail: testTeam1.username,
        password: 'password123',
      })
    ).rejects.toThrow(/deactivated by the administrator/);
  });

  it('allows Admin to reactivate a team account, restoring login access', async () => {
    // Admin reactivates testTeam1
    const updated = await adminService.updateTeamStatus(testTeam1.id, true);
    expect(updated.isActive).toBe(true);

    // Login now succeeds
    const loginRes = await authService.loginTeam({
      usernameOrEmail: testTeam1.username,
      password: 'password123',
    });
    expect(loginRes.token).toBeDefined();
    expect(loginRes.team.isActive).toBe(true);
  });

  it('allows Admin to create and schedule a match between two active teams', async () => {
    match = await matchService.createMatch({
      format: MatchFormat.T10,
      teamAId: testTeam1.id,
      teamBId: testTeam2.id,
      matchDate: new Date().toISOString(),
      venue: 'Eden Gardens',
    });

    expect(match.id).toBeDefined();
    expect(match.teamAId).toBe(testTeam1.id);
    expect(match.teamBId).toBe(testTeam2.id);
    expect(match.format).toBe(MatchFormat.T10);
  });

  it('prevents match creation when one of the teams is deactivated', async () => {
    // Deactivate testTeam2
    await adminService.updateTeamStatus(testTeam2.id, false);

    await expect(
      matchService.createMatch({
        format: MatchFormat.T20,
        teamAId: testTeam1.id,
        teamBId: testTeam2.id,
        matchDate: new Date().toISOString(),
      })
    ).rejects.toThrow(/inactive/);

    // Re-activate testTeam2
    await adminService.updateTeamStatus(testTeam2.id, true);
  });
});
