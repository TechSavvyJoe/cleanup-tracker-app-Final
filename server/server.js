require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const Vehicle = require('./models/Vehicle');
const { getInventoryCsvUrl } = require('./utils/inventorySource');

// Import utilities and middleware
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { requestLogger, performanceMonitor } = require('./middleware/requestLogger');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '', 10) || (isProduction ? 100 : 1000);
const AUTH_RATE_LIMIT_MAX = parseInt(process.env.AUTH_RATE_LIMIT_MAX || '', 10) || (isProduction ? 5 : 50);
const UPLOAD_LIMIT = process.env.UPLOAD_LIMIT || '10mb';

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"]
    }
  }
}));

app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: RATE_LIMIT_MAX,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to API routes (disabled in development for testing)
if (isProduction) {
  app.use('/api/', limiter);
}

// Auth endpoints need stricter rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: AUTH_RATE_LIMIT_MAX,
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 15 * 60 * 1000
  }
});

// Apply auth rate limiting only in production
if (isProduction) {
  app.use('/api/users/login', authLimiter);
  app.use('/api/users/register', authLimiter);
  app.use('/api/v2/auth/login', authLimiter);
}

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : false)
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: UPLOAD_LIMIT }));
app.use(bodyParser.urlencoded({ extended: true, limit: UPLOAD_LIMIT }));

// Request logging and performance monitoring
app.use(requestLogger);
app.use(performanceMonitor(2000)); // Log requests slower than 2 seconds

// DB Config
const configDb = require('./config/keys').mongoURI;

// Connect to MongoDB with fallback to in-memory server
async function connectDb() {
  try {
    await mongoose.connect(configDb, { serverSelectionTimeoutMS: 3000 });
    logger.startup('MongoDB Connected', { uri: configDb.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') });
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('MongoDB connection failed in production', { error: err.message });
      process.exit(1);
    }
    logger.warn('Local MongoDB not available, starting in-memory MongoDB', { error: err.message });
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      logger.info('Spinning up in-memory MongoDB instance...');
      const mongod = await MongoMemoryServer.create({
        instance: {
          dbName: 'cleanup-tracker',
          storageEngine: 'wiredTiger'
        },
        binary: {
          downloadDir: path.join(__dirname, 'mongodb-binaries')
        }
      });
      const uri = mongod.getUri();
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      logger.startup('Connected to in-memory MongoDB', { dbName: 'cleanup-tracker' });
    } catch (memErr) {
      logger.error('Failed to start in-memory MongoDB', { error: memErr.message, stack: memErr.stack });
      process.exit(1);
    }
  }
}

// Health check endpoint for deployment platforms
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Use Routes
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/users', require('./routes/users'));
app.use('/api/cleanups', require('./routes/cleanups'));
app.use('/api/v2', require('./routes/v2'));

const fs = require('fs');

// Serve static assets (both dev and prod)
// In Docker production, server.js is in /app/, so client/build is at ./client/build
// In development, server.js is in /app/server/, so client/build is at ../client/build
const clientBuildPath = fs.existsSync(path.join(__dirname, 'client', 'build'))
  ? path.join(__dirname, 'client', 'build')
  : path.resolve(__dirname, '..', 'client', 'build');

logger.info('Serving static files', { path: clientBuildPath });

app.use(express.static(clientBuildPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Try to listen on process.env.PORT or default 5051, increment on conflict
let startPort = parseInt(process.env.PORT, 10) || 5051;

// Seed default users if none exist
async function seedUsersIfNeeded() {
  const V2User = require("./models/V2User");
  const count = await V2User.countDocuments();
  if (count > 0) {
    logger.info('Users already seeded', { count });
    return;
  }
  logger.info('No users found. Seeding default users...');
  const defaultUsers = [
    { name: "Joe Gallant", role: "manager", pin: "1701", employeeNumber: "MGR001", phoneNumber: "555-0001" },
    { name: "Alfred", role: "detailer", pin: "1716", uid: "detailer-001", employeeNumber: "DET001", phoneNumber: "555-0002" },
    { name: "Brian", role: "detailer", pin: "1709", uid: "detailer-002", employeeNumber: "DET002", phoneNumber: "555-0003" },
    { name: "Sarah Johnson", role: "salesperson", pin: "2001", employeeNumber: "SALES001", phoneNumber: "555-0101" },
    { name: "Mike Chen", role: "salesperson", pin: "2002", employeeNumber: "SALES002", phoneNumber: "555-0102" },
    { name: "Lisa Rodriguez", role: "salesperson", pin: "2003", employeeNumber: "SALES003", phoneNumber: "555-0103" }
  ];

  // Use save() instead of insertMany() to trigger pre-save hooks for PIN hashing
  for (const userData of defaultUsers) {
    const user = new V2User(userData);
    await user.save();
  }

  logger.startup('Seeded default users', { count: defaultUsers.length });
}

// Ensure DB is connected before starting the HTTP server
async function main() {
  await connectDb();
  try {
    await seedUsersIfNeeded();
  } catch (e) {
    logger.warn('User seeding failed', { error: e.message });
  }
  try {
    await fetchAndImportInventory();
  } catch (e) {
    logger.warn('Inventory import skipped/failed', { error: e.message });
  }
  startServer(startPort);
}

main().catch(err => {
  logger.error('Fatal startup error', { error: err.message, stack: err.stack });
  process.exit(1);
});
const maxPort = startPort + 100;

function startServer(portToTry) {
  const serverInstance = app.listen(portToTry, () => {
    logger.startup(`Server started on port ${portToTry}`, {
      port: portToTry,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version
    });
    // Removed .port file writing as it causes permission errors in Docker
    // and is not necessary for the application to function
  });

  serverInstance.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Port ${portToTry} in use, trying ${portToTry + 1}`);
      serverInstance.close?.();
      if (portToTry + 1 <= maxPort) {
        startServer(portToTry + 1);
      } else {
        logger.error('No available ports found', { maxPort });
        process.exit(1);
      }
    } else {
      logger.error('Server error', { error: err.message, code: err.code, stack: err.stack });
      process.exit(1);
    }
  });
}

// startServer is invoked from main() after DB connection

// Import Google Sheets inventory CSV at startup
const csv = require('csv-parser');
async function fetchAndImportInventory() {
  const SHEET_URL = getInventoryCsvUrl();
  logger.info('Fetching inventory CSV', { url: SHEET_URL });
  const response = await axios.get(SHEET_URL, { responseType: 'stream' });
  const headerMap = {
    0: 'newUsed', 1: 'stockNumber', 2: 'vehicle', 3: 'year', 4: 'make', 5: 'model',
    6: 'body', 7: 'drivetrain', 8: 'color', 9: 'odometer', 10: 'price', 11: 'age', 12: 'vin', 13: 'tags', 14: 'status'
  };
  const rows = [];
  await new Promise((resolve, reject) => {
    response.data
      .pipe(csv({ mapHeaders: ({ header, index }) => headerMap[index] || null }))
      .on('data', (row) => rows.push(row))
      .on('error', reject)
      .on('end', resolve);
  });
  if (!rows.length) {
    logger.warn('Inventory CSV empty');
    return;
  }
  const cleanInt = (v) => { const n = parseInt(String(v || '').replace(/[^0-9-]/g, ''), 10); return Number.isNaN(n) ? null : n; };
  const cleanStr = (v) => (v == null ? '' : String(v).trim());
  const cleanPrice = (v) => (v == null ? '' : String(v).replace(/[^0-9.]/g, '').trim());
  const ops = rows.filter(r => cleanStr(r.vin) && cleanStr(r.stockNumber)).map(r => {
    const doc = {
      newUsed: cleanStr(r.newUsed), stockNumber: cleanStr(r.stockNumber), vehicle: cleanStr(r.vehicle),
      year: cleanInt(r.year), make: cleanStr(r.make), model: cleanStr(r.model), body: cleanStr(r.body),
      drivetrain: cleanStr(r.drivetrain), color: cleanStr(r.color), odometer: cleanStr(r.odometer), price: cleanPrice(r.price),
      age: cleanInt(r.age), vin: cleanStr(r.vin), tags: cleanStr(r.tags), status: cleanStr(r.status)
    };
    return { updateOne: { filter: { vin: doc.vin }, update: { $set: doc }, upsert: true } };
  });
  if (!ops.length) {
    logger.warn('No VIN rows found in inventory CSV');
    return;
  }
  const result = await Vehicle.bulkWrite(ops, { ordered: false });
  const total = await Vehicle.countDocuments();
  logger.startup('Inventory import completed', {
    upserted: result.upsertedCount || 0,
    modified: result.modifiedCount || 0,
    total
  });
}
