import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return socket;
}

export function useMatchSocket(matchId?: string, onMatchUpdate?: (data: any) => void) {
  useEffect(() => {
    if (!matchId) return;

    const s = getSocket();

    s.emit('join:match', matchId);

    const handleUpdate = (updatedMatch: any) => {
      if (onMatchUpdate) {
        onMatchUpdate(updatedMatch);
      }
    };

    s.on('match:updated', handleUpdate);

    return () => {
      s.emit('leave:match', matchId);
      s.off('match:updated', handleUpdate);
    };
  }, [matchId, onMatchUpdate]);
}
