const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const connectDB = require('./config/database');
const { initSocket } = require('./config/socket');
const { startEmailPoller } = require('./services/emailPoller.service');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

// Prevent server crash on unhandled network/IMAP errors
process.on('uncaughtException', (err) => {
  console.error('🔥 CRITICAL: Uncaught Exception:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${process.env.PORT || 5000} is already in use. Killing process...`);
    process.exit(1);
  }
  if (err.code === 'ETIMEOUT') console.log('🛡️  Suppressed ETIMEOUT crash.');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

// Route imports
const authRoutes = require('./routes/auth.routes');
const ticketRoutes = require('./routes/ticket.routes');
const commentRoutes = require('./routes/comment.routes');
const userRoutes = require('./routes/user.routes');
const notificationRoutes = require('./routes/notification.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const emailRoutes = require('./routes/email.routes');
const knowledgeRoutes = require('./routes/knowledge.routes');

const app = express();
const server = http.createServer(app);

// Init socket
initSocket(server);

// Connect DB
// connectDB() was here, moved to line 137 to ensure services start after connection

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root API info
app.get('/api', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Ticket System API v1.1 is live', 
    endpoints: {
      auth: '/api/auth',
      tickets: '/api/tickets',
      dashboard: '/api/dashboard',
      health: '/api/health'
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/knowledge', knowledgeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Ticket System API is running', timestamp: new Date().toISOString() });
});

// Serve frontend static files if built (works in production on Render)
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // Catch-all: serve index.html for any non-API route (SPA support)
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Global Error Handlers (Applicable to both Dev and Prod)
app.use(notFound);
app.use(errorHandler);

// Connect DB and Start Services
connectDB().then(() => {
  // Start email poller if configured
  const method = process.env.EMAIL_POLLING_METHOD || 'IMAP';
  const hasGmailConfig = process.env.GMAIL_REFRESH_TOKEN && !process.env.GMAIL_REFRESH_TOKEN.includes('your_gmail');
  const hasImapConfig = process.env.IMAP_USER && !process.env.IMAP_USER.includes('itadmin@vdartinc.com');
  
  const { startResolutionCron } = require('./services/resolutionCron.service');
  
  if ((method === 'GMAIL' && hasGmailConfig) || (method === 'IMAP' && hasImapConfig) || (method === 'SMTP' && hasImapConfig)) {
    startEmailPoller();
    console.log(`📧 Email poller started (Method: ${method === 'SMTP' ? 'IMAP (via SMTP settings)' : method})`);
  }

  // Start the 24h auto-close checker
  startResolutionCron();
  
  // RUN SYSTEM SANITY CHECKS (Refactored logic from legacy utility scripts)
  const User = require('./models/User.model');
  const Ticket = require('./models/Ticket.model');
  
  (async () => {
    try {
      // 1. Fix negative workloads
      const fixResults = await User.updateMany({ currentWorkload: { $lt: 0 } }, { $set: { currentWorkload: 0 } });
      if (fixResults.modifiedCount > 0) console.log(`🔧 HealthCheck: Fixed ${fixResults.modifiedCount} negative workloads.`);
      
      // 2. Normalize IT admin expertise
      const adminResults = await User.updateMany(
        { role: 'admin', department: 'IT', expertise: { $size: 0 } },
        { $set: { expertise: ['IT'] } }
      );
      if (adminResults.modifiedCount > 0) console.log(`🔧 HealthCheck: Initialized expertise for ${adminResults.modifiedCount} IT admins.`);
      
      // 3. Log agent summary
      const activeAgents = await User.find({ role: { $in: ['support_agent', 'admin'] }, isActive: true }).countDocuments();
      console.log(`📡 HealthCheck: ${activeAgents} agents currently active and monitored.`);
      
      // 4. One-time patch for TKT-00005
      await Ticket.updateOne({ ticketId: 'TKT-00005', category: { $ne: 'IT' } }, { $set: { category: 'IT' } });
      
    } catch (e) { console.error('❌ HealthCheck Error:', e.message); }
  })();
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`📡 Socket.io initialized`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is in use. Please close other instances or kill the process.`);
    process.exit(1);
  }
});

module.exports = { app, server };
