import { Server, Socket } from 'socket.io';

let ioInstance: Server | null = null;

export function initSocketServer(io: Server) {
  ioInstance = io;

  io.on('connection', (socket: Socket) => {
    socket.on('join:match', (matchId: string) => {
      socket.join(`match:${matchId}`);
    });

    socket.on('leave:match', (matchId: string) => {
      socket.leave(`match:${matchId}`);
    });
  });
}

export function broadcastMatchUpdate(matchId: string, data: any) {
  if (ioInstance) {
    ioInstance.to(`match:${matchId}`).emit('match:updated', data);
  }
}
