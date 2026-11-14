import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { app } from './app.js';
import { initSocketServer } from './sockets/matchSocket.js';

dotenv.config();

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

initSocketServer(io);

server.listen(PORT, () => {
  console.log(`Cricket Scorer Backend running on http://localhost:${PORT}`);
});
