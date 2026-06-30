const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');

// Load environment variables (prefer server/.env, fallback to project-root/.env)
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const app = express();
const server = http.createServer(app);

const defaultClientOrigins = ['http://localhost:3000', 'http://localhost:3001'];
const envClientOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultClientOrigins, ...envClientOrigins]));

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Regular JSON parser for all routes (Razorpay webhooks use JSON)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting (increased for development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// MongoDB connection with increased timeout
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/warehouse_management', {
  serverSelectionTimeoutMS: 30000, // 30 seconds timeout for Atlas
  socketTimeoutMS: 45000, // 45 seconds socket timeout
  connectTimeoutMS: 30000, // 30 seconds connection timeout
}).catch(err => {
  console.warn('⚠️  MongoDB connection failed:', err.message);
  console.warn('⚠️  Server will continue running but database features will be unavailable');
  console.warn('⚠️  To fix: Install MongoDB or update MONGODB_URI in .env file');
});

const db = mongoose.connection;
db.on('error', (error) => {
  console.warn('⚠️  MongoDB error:', error.message);
});
db.once('open', async () => {
  console.log('✅ Connected to MongoDB');

  // Initialize local file storage
  try {
    const localFileService = require('./utils/localFileService');
    console.log('✅ Local file storage initialized');
  } catch (error) {
    console.log('⚠️  File service initialization error:', error.message);
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`Client joined room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/warehouse', require('./routes/warehouse'));
app.use('/api/dynamic-warehouse', require('./routes/dynamicWarehouse'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/files', require('./routes/files'));
app.use('/api/exports', require('./routes/exports'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/loans', require('./routes/loans'));
app.use('/api/market', require('./routes/market'));
app.use('/api/predictions', require('./routes/predictions'));
app.use('/api/ai', require('./routes/ai-predictions'));
app.use('/api/workflows', require('./routes/workflows'));
app.use('/api/translate', require('./routes/translate'));
app.use('/api/email', require('./routes/email'));
app.use('/api/evaluation', require('./routes/evaluation'));
app.use('/api/notifications', require('./routes/notifications'));

// Serve static uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static assets in production (or when React dev server isn't running)
if (process.env.NODE_ENV === 'production' || process.env.SERVE_REACT === 'true') {
  app.use(express.static(path.join(__dirname, 'client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(`
      <h1>Warehouse Management System - Backend API</h1>
      <p>Backend server is running on port 5000</p>
      <h2>To run the full application:</h2>
      <h3>Option 1: Development Mode (Recommended)</h3>
      <ul>
        <li>Backend API: Already running on port 5000</li>
        <li>Frontend: Run <code>cd client && npm start</code> to start on port 3001</li>
        <li>Then access: <a href="http://localhost:3001">http://localhost:3001</a></li>
      </ul>
      <h3>Option 2: Production Mode</h3>
      <ul>
        <li>Set environment variable: <code>SERVE_REACT=true</code></li>
        <li>Or restart with: <code>npm run start:prod</code></li>
        <li>Access: <a href="http://localhost:5000">http://localhost:5000</a></li>
      </ul>
      <h2>API Endpoints:</h2>
      <ul>
        <li>POST /api/auth/login - Login</li>
        <li>POST /api/auth/register - Register</li>
        <li>GET /api/warehouse/* - Warehouse routes (requires auth)</li>
        <li>GET /api/vehicles/* - Vehicle routes (requires auth)</li>
        <li>GET /api/customers/* - Customer routes (requires auth)</li>
        <li>GET /api/analytics/* - Analytics routes (requires auth)</li>
        <li>GET /api/loans/* - Loan routes (requires auth)</li>
        <li>GET /api/market/* - Market routes (requires auth)</li>
        <li>GET /api/workflows/* - AI Workflow automation (requires auth)</li>
      </ul>
    `);
  });
}

const PORT = process.env.PORT || 5000;

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('Received SIGINT. Graceful shutdown...');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API accessible at http://localhost:${PORT}`);
  console.log(`Server listening on all interfaces`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use. Please close other applications using this port.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});
