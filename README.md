# Cricket Scorer - International & Gully Cricket Engine

A full-stack cricket tournament management and live scoring platform built with React, Node.js, Express, TypeScript, Prisma, and MySQL.

## Features

### 1. International Cricket
- **Formats**: T10, T20, ODI, and Multi-Day Test matches.
- **Admin Control**: Centralized scheduling, team accounts management, toss, match supervision, and cancellation.
- **Full Scoring Engine**:
  - Live ball-by-ball updates with Socket.io real-time broadcast.
  - Striker/non-striker management, overs completion, bowler change enforcement.
  - Extras: Wides, No-balls, Byes, Leg Byes, Penalty runs.
  - Wickets: Bowled, Caught, LBW, Run Out, Stumped, Hit Wicket.
  - Undo ball mechanism with full rollback of stats.
  - Test Match controls: Follow-on enforcement, declarations, session and day advances.
  - Exportable PDF scorecards.

### 2. Gully Cricket
- **Team Match**:
  - Registered teams create ad-hoc temporary teams for neighborhood games without permanent registration.
  - Fully customizable overs per innings and bowler allocations.
- **Singles Match**:
  - **Gully Draft**: Interactive card shuffle to select solo batter or custom order.
  - Batter plays alone without strike rotation.
  - Multi-round batting queue with highest-score seeding.
  - Live leaderboard and round scorecards.
- **Match Management**:
  - Dedicated Gully match history, leaderboard, and statistics completely segregated from International records.
  - Full delete match capabilities with database cascading clean-up.

---

## Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite, TanStack Query, Socket.io Client.
- **Backend**: Node.js, Express, TypeScript, Prisma ORM, MySQL, JWT authentication, Vitest, Socket.io.

---

## Setup & Running Locally

### Prerequisites
- Node.js (v18+)
- MySQL Server (v8.0+)

### Backend Setup
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
