import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

// API base route
app.use('/api', routes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use(errorHandler);
