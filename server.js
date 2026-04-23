require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security Middleware ───────────────────────────────
app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting — disabled in development, active in production
const isDev = process.env.NODE_ENV !== 'production';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { success: false, message: 'Too many requests, please slow down.' }
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 20,
  skip: () => isDev,
  message: { success: false, message: 'Too many login attempts, try again in 15 minutes.' }
});
app.use('/api/auth/login', authLimiter);

// ─── Body Parsers ─────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ─── Health Check ─────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Hotel SaaS API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// ─── Action-Based API Routes (Professional Naming) ────
// e.g., /api/createHotel, /api/fetchBookings, /api/fetchRooms
app.use('/api', require('./src/routes/actionRoutes'));

// ─── Legacy REST Routes (Backward Compatible) ────────
app.use('/api/auth',          require('./src/routes/auth'));
app.use('/api/organizations', require('./src/routes/organizations'));
app.use('/api/hotels',        require('./src/routes/hotels'));
app.use('/api/rooms',         require('./src/routes/rooms'));
app.use('/api/bookings',      require('./src/routes/bookings'));
app.use('/api/payments',      require('./src/routes/payments'));
app.use('/api/users',         require('./src/routes/users'));
app.use('/api/customers',     require('./src/routes/customers'));
app.use('/api/images',        require('./src/routes/images'));

// ─── 404 Handler ──────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Hotel SaaS Backend running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
