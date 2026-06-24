// routes/auth.js — Admin authentication endpoints
'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Hash the admin password on first use (lazy hashing)
let hashedPassword = null;
async function getHashedPassword() {
  if (!hashedPassword) {
    hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'mvr@123', 10);
  }
  return hashedPassword;
}

/**
 * POST /api/auth/login
 * Body: { password: string }
 * Returns: { token: string, expiresIn: string }
 */
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Direct compare with env password (simple for studio use)
    const adminPassword = process.env.ADMIN_PASSWORD || 'mvr@123';
    const isValid = password === adminPassword;

    if (!isValid) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const token = jwt.sign(
      { role: 'admin', loginAt: Date.now() },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      expiresIn: '7 days'
    });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Server error during authentication' });
  }
});

/**
 * POST /api/auth/verify
 * Checks if a token is still valid
 */
router.post('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.json({ valid: false });

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, decoded });
  } catch {
    res.json({ valid: false });
  }
});

module.exports = router;
