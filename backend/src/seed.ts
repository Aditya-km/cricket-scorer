import bcrypt from 'bcryptjs';
import { prisma } from './config/db.js';
import { PlayerRole, UserRole } from '@prisma/client';

async function seed() {
  console.log('Seeding initial cricket teams, squads, and admin account...');

  const passwordHash = await bcrypt.hash('password123', 10);
  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  // 0. Super Administrator Account
  await prisma.team.upsert({
    where: { username: 'admin' },
    update: { role: UserRole.ADMIN, isActive: true },
    create: {
      teamName: 'Cricket Administrator',
      username: 'admin',
      email: 'admin@cricket.com',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  // 1. Mumbai Titans
  const teamA = await prisma.team.upsert({
    where: { username: 'mumbai_titans' },
    update: { role: UserRole.TEAM },
    create: {
      teamName: 'Mumbai Titans',
      username: 'mumbai_titans',
      email: 'mumbai@cricket.com',
      passwordHash,
      role: UserRole.TEAM,
      isActive: true,
    },
  });

  const squadA = [
    { playerName: 'Rohit Sharma', jerseyNumber: 45, role: PlayerRole.BATTER },
    { playerName: 'Ishan Kishan', jerseyNumber: 32, role: PlayerRole.WICKETKEEPER },
    { playerName: 'Suryakumar Yadav', jerseyNumber: 63, role: PlayerRole.BATTER },
    { playerName: 'Tilak Varma', jerseyNumber: 9, role: PlayerRole.BATTER },
    { playerName: 'Hardik Pandya', jerseyNumber: 33, role: PlayerRole.ALL_ROUNDER },
    { playerName: 'Tim David', jerseyNumber: 8, role: PlayerRole.ALL_ROUNDER },
    { playerName: 'Jasprit Bumrah', jerseyNumber: 93, role: PlayerRole.BOWLER },
    { playerName: 'Piyush Chawla', jerseyNumber: 11, role: PlayerRole.BOWLER },
    { playerName: 'Gerald Coetzee', jerseyNumber: 62, role: PlayerRole.BOWLER },
    { playerName: 'Nuwan Thushara', jerseyNumber: 99, role: PlayerRole.BOWLER },
    { playerName: 'Nehal Wadhera', jerseyNumber: 22, role: PlayerRole.BATTER },
    { playerName: 'Mohammad Nabi', jerseyNumber: 7, role: PlayerRole.ALL_ROUNDER },
    { playerName: 'Luke Wood', jerseyNumber: 14, role: PlayerRole.BOWLER },
    { playerName: 'Akash Madhwal', jerseyNumber: 88, role: PlayerRole.BOWLER },
    { playerName: 'Vishnu Vinod', jerseyNumber: 12, role: PlayerRole.WICKETKEEPER },
  ];

  for (const p of squadA) {
    await prisma.player.upsert({
      where: { teamId_jerseyNumber: { teamId: teamA.id, jerseyNumber: p.jerseyNumber } },
      update: { playerName: p.playerName, role: p.role },
      create: { teamId: teamA.id, ...p },
    });
  }

  // 2. Chennai Super Kings
  const teamB = await prisma.team.upsert({
    where: { username: 'chennai_kings' },
    update: { role: UserRole.TEAM },
    create: {
      teamName: 'Chennai Super Kings',
      username: 'chennai_kings',
      email: 'chennai@cricket.com',
      passwordHash,
      role: UserRole.TEAM,
      isActive: true,
    },
  });

  const squadB = [
    { playerName: 'Ruturaj Gaikwad', jerseyNumber: 31, role: PlayerRole.BATTER },
    { playerName: 'Devon Conway', jerseyNumber: 88, role: PlayerRole.BATTER },
    { playerName: 'Ajinkya Rahane', jerseyNumber: 21, role: PlayerRole.BATTER },
    { playerName: 'Daryl Mitchell', jerseyNumber: 75, role: PlayerRole.ALL_ROUNDER },
    { playerName: 'Shivam Dube', jerseyNumber: 25, role: PlayerRole.ALL_ROUNDER },
    { playerName: 'Ravindra Jadeja', jerseyNumber: 8, role: PlayerRole.ALL_ROUNDER },
    { playerName: 'MS Dhoni', jerseyNumber: 7, role: PlayerRole.WICKETKEEPER },
    { playerName: 'Deepak Chahar', jerseyNumber: 90, role: PlayerRole.BOWLER },
    { playerName: 'Shardul Thakur', jerseyNumber: 54, role: PlayerRole.ALL_ROUNDER },
    { playerName: 'Tushar Deshpande', jerseyNumber: 24, role: PlayerRole.BOWLER },
    { playerName: 'Matheesha Pathirana', jerseyNumber: 81, role: PlayerRole.BOWLER },
    { playerName: 'Moeen Ali', jerseyNumber: 18, role: PlayerRole.ALL_ROUNDER },
    { playerName: 'Mustafizur Rahman', jerseyNumber: 91, role: PlayerRole.BOWLER },
    { playerName: 'Sameer Rizvi', jerseyNumber: 1, role: PlayerRole.BATTER },
    { playerName: 'Mukesh Choudhary', jerseyNumber: 19, role: PlayerRole.BOWLER },
  ];

  for (const p of squadB) {
    await prisma.player.upsert({
      where: { teamId_jerseyNumber: { teamId: teamB.id, jerseyNumber: p.jerseyNumber } },
      update: { playerName: p.playerName, role: p.role },
      create: { teamId: teamB.id, ...p },
    });
  }

  console.log('Seeding completed successfully!');
  await prisma.$disconnect();
}

seed().catch(e => {
  console.error('Seed error:', e);
  process.exit(1);
});
