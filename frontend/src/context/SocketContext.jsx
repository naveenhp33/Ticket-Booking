import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const pendingJoinsRef = useRef(new Set());

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('token');
    const socket = io('http://localhost:5001', {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Replay any pending room joins after reconnection
      pendingJoinsRef.current.forEach(ticketId => {
        socket.emit('join_ticket', ticketId);
      });
    });
    socket.on('disconnect', () => { setConnected(false); });
    socket.on('connect_error', (err) => { console.warn('Socket error:', err.message); });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user]);

  // joinTicket: emit immediately if connected, and track for reconnection replay
  const joinTicket = useCallback((ticketId) => {
    pendingJoinsRef.current.add(ticketId);
    socketRef.current?.emit('join_ticket', ticketId);
  }, []);

  const leaveTicket = useCallback((ticketId) => {
    pendingJoinsRef.current.delete(ticketId);
    socketRef.current?.emit('leave_ticket', ticketId);
  }, []);

  // on: register listener. Re-created when `connected` changes so consumers
  // with `[on]` in their dependency array re-register handlers on the live socket.
  const on = useCallback((event, handler) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on(event, handler);
    return () => socket.off(event, handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, joinTicket, leaveTicket, on }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
