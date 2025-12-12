require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');

// Config
const { initializeDatabase } = require('./config/db');
const swaggerSpec = require('./config/swagger');

// Middleware
const docAuth = require('./middleware/docAuth');

// Routes
const apiRoutes = require('./routes/apiRoutes');

// Socket Manager
const { initSockets, isUserOnline } = require('./sockets/socketManager');

// Tracking Controller - set online status getter
const trackingController = require('./controllers/trackingController');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3010;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with custom path
const io = new Server(server, {
  path: '/api/v1/io',
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Swagger UI - Protected with Basic Auth
app.use('/api-docs', docAuth, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'MyDosen API Documentation'
}));

// Socket.IO Documentation - Protected with Basic Auth
app.get('/socket-docs', docAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'socket-docs.html'));
});

// Simulator - Protected with Basic Auth
app.get('/simulator', docAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'simulator.html'));
});

// Seed users endpoint for simulator (protected)
app.get('/api/v1/seed-users', docAuth, (req, res) => {
  res.json({
    users: [
      { label: 'Admin', email: process.env.SEED_ADMIN_EMAIL || 'admin@unsri.ac.id', password: process.env.SEED_ADMIN_PASSWORD || 'admin123' },
      { label: 'Dosen', email: process.env.SEED_DOSEN_EMAIL || 'dosen1@unsri.ac.id', password: process.env.SEED_DOSEN_PASSWORD || 'dosen123' },
      { label: 'Mahasiswa', email: process.env.SEED_MAHASISWA_EMAIL || 'mahasiswa1@unsri.ac.id', password: process.env.SEED_MAHASISWA_PASSWORD || 'mahasiswa123' }
    ]
  });
});

// API Routes - Version 1
app.use('/api/v1', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'MyDosen Backend'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to MyDosen API',
    version: '1.0.0',
    documentation: {
      rest_api: '/api-docs',
      socket_io: '/socket-docs'
    },
    endpoints: {
      api: '/api/v1',
      socket: '/api/v1/io'
    },
    health: '/health'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const startServer = async () => {
  try {
    // Initialize database
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('Database initialized successfully.');
    
    // Set online status getter for tracking controller (generic user checker)
    trackingController.setOnlineStatusGetter(isUserOnline);
    
    // Initialize Socket.IO
    initSockets(io);
    
    // Start listening
    server.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  MyDosen Backend Server Started`);
      console.log(`========================================`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Server:      http://localhost:${PORT}`);
      console.log(`  API Base:    http://localhost:${PORT}/api/v1`);
      console.log(`  Socket.IO:   http://localhost:${PORT}/api/v1/io`);
      console.log(`  API Docs:    http://localhost:${PORT}/api-docs`);
      console.log(`  Socket Docs: http://localhost:${PORT}/socket-docs`);
      console.log(`  Simulator:   http://localhost:${PORT}/simulator`);
      console.log(`  Health:      http://localhost:${PORT}/health`);
      console.log(`========================================`);
      console.log(`  Protected Routes Credentials:`);
      console.log(`  Username: ${process.env.DOC_USERNAME || 'admin'}`);
      console.log(`  Password: ${process.env.DOC_PASSWORD || 'ADM1NC0Y'}`);
      console.log(`========================================\n`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer();

module.exports = { app, server, io };
