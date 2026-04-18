const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000
  });

  // Auth middleware for socket
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication error: No token'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.userDept = decoded.department;
      next();
    } catch {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.userId} (${socket.userRole} in ${socket.userDept})`);

    // Join personal room
    socket.join(`user_${socket.userId}`);

    // Join role room for broadcasts
    socket.join(`role_${socket.userRole}`);

    // Join department room
    if (socket.userDept) {
      socket.join(`dept_${socket.userDept}`);
    }

    // Join ticket room for real-time updates
    socket.on('join_ticket', (ticketId) => {
      socket.join(`ticket_${ticketId}`);
    });

    socket.on('leave_ticket', (ticketId) => {
      socket.leave(`ticket_${ticketId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.userId}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

// Emit helpers
const emitToUser = (userId, event, data) => {
  if (io) io.to(`user_${userId}`).emit(event, data);
};

const emitToRole = (role, event, data) => {
  if (io) io.to(`role_${role}`).emit(event, data);
};

const emitToDepartment = (department, event, data) => {
  if (io) io.to(`dept_${department}`).emit(event, data);
};

const emitToTicket = (ticketId, event, data) => {
  if (io) io.to(`ticket_${ticketId}`).emit(event, data);
};

const emitToAll = (event, data) => {
  if (io) io.emit(event, data);
};

module.exports = { 
  initSocket, 
  getIO, 
  emitToUser, 
  emitToRole, 
  emitToDepartment,
  emitToTicket, 
  emitToAll 
};
