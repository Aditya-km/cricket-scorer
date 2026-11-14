import { MatchFormat } from '@prisma/client';

export function ballsToOversText(balls: number): string {
  const completedOvers = Math.floor(balls / 6);
  const remainingBalls = balls % 6;
  return `${completedOvers}.${remainingBalls}`;
}

export function ballsToOversDecimal(balls: number): number {
  if (balls <= 0) return 0;
  return balls / 6;
}

export function calculateStrikeRate(runs: number, balls: number): number {
  if (balls <= 0) return 0;
  return Number(((runs / balls) * 100).toFixed(2));
}

export function calculateBattingAverage(runs: number, dismissals: number): number | null {
  if (dismissals <= 0) return null; // Not out
  return Number((runs / dismissals).toFixed(2));
}

export function calculateBowlingAverage(runsConceded: number, wickets: number): number | null {
  if (wickets <= 0) return null;
  return Number((runsConceded / wickets).toFixed(2));
}

export function calculateEconomyRate(runsConceded: number, legalBalls: number): number {
  if (legalBalls <= 0) return 0;
  const overs = legalBalls / 6;
  return Number((runsConceded / overs).toFixed(2));
}

export function getMaxOversPerBowler(format: MatchFormat): number {
  switch (format) {
    case 'T10':
      return 2;
    case 'T20':
      return 4;
    case 'ODI':
      return 10;
    case 'TEST':
      return Infinity;
  }
}

export function getMaxOversPerInnings(format: MatchFormat): number | null {
  switch (format) {
    case 'T10':
      return 10;
    case 'T20':
      return 20;
    case 'ODI':
      return 50;
    case 'TEST':
      return null;
  }
}
