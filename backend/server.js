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
connectDB();

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
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  // Dev mode: no frontend build present
  app.use(notFound);
  app.use(errorHandler);
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`📡 Socket.io initialized`);

  // Start email poller only if real Gmail credentials are configured
  const hasRealGmailToken = process.env.GMAIL_REFRESH_TOKEN &&
    !process.env.GMAIL_REFRESH_TOKEN.includes('your_gmail');
  if (hasRealGmailToken) {
    startEmailPoller();
    console.log(`📧 Gmail email poller started`);
  } else {
    console.log(`📧 Gmail not configured, email polling disabled`);
  }
});

module.exports = { app, server };
