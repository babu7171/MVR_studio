// server.js — MVR Studio Express Backend Server
'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security Middleware ────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,  // Disabled so inline scripts in HTML work
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ─── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',  // In production, set this to your domain
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ─── Body Parsers ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Static Files ───────────────────────────────────────────────────────────
// Serve uploaded media files
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Block access to server code, SQLite DB, environment files, package definitions, and git directories
app.use((req, res, next) => {
  const normalizedPath = req.path.toLowerCase().replace(/\\/g, '/');
  if (
    normalizedPath.startsWith('/server') || 
    normalizedPath.includes('/server/') ||
    normalizedPath.startsWith('/.git') ||
    normalizedPath.includes('/.git/') ||
    normalizedPath.includes('package.json') ||
    normalizedPath.includes('package-lock.json') ||
    normalizedPath.includes('.env') ||
    normalizedPath.includes('.gitignore')
  ) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
});

// Serve the frontend (index.html, admin.html, CSS, JS, images)
const FRONTEND_DIR = path.join(__dirname, '..');
app.use(express.static(FRONTEND_DIR, {
  index: 'index.html'
}));

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/gallery',   require('./routes/gallery'));
app.use('/api/services',  require('./routes/services'));
app.use('/api/enquiries', require('./routes/enquiries'));

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'MVR Studio API',
    version: '1.0.0',
    time: new Date().toISOString()
  });
});

// ─── SPA Fallback ───────────────────────────────────────────────────────────
// Serve index.html for any non-API, non-asset routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// ─── Global Error Handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 100MB.' });
  }

  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start Server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      MVR Studio Backend Server           ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  🚀 Running at http://localhost:${PORT}       ║`);
  console.log(`║  📁 Uploads: ${UPLOADS_DIR.split('\\').pop()}/ folder          ║`);
  console.log(`║  🗄  Database: mvr_studio.db               ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
