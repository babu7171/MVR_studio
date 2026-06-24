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

/**
 * GET /api/auth/google
 * Initiates the Google OAuth2 flow to obtain a refresh token for personal accounts
 */
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.send(`
      <div style="font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; border: 1px solid #ff5252; border-radius: 8px; background: #fff5f5;">
        <h3 style="color: #ff5252; margin-top:0;">Configuration Error</h3>
        <p>Please configure the <strong>GOOGLE_CLIENT_ID</strong> and <strong>GOOGLE_CLIENT_SECRET</strong> environment variables on Render first.</p>
        <p>Once those variables are set, refresh this page to begin authentication.</p>
      </div>
    `);
  }

  const { google } = require('googleapis');
  // Determine redirect URI dynamically
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const redirectUri = `${protocol}://${req.get('host')}/api/auth/google/callback`;

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Request refresh token
    prompt: 'consent',     // Force consent to always return refresh token
    scope: ['https://www.googleapis.com/auth/drive']
  });

  res.redirect(authUrl);
});

/**
 * GET /api/auth/google/callback
 * Google OAuth2 callback page that shows the refresh token to the user
 */
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!code) {
    return res.status(400).send('Authorization code is missing.');
  }

  try {
    const { google } = require('googleapis');
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const redirectUri = `${protocol}://${req.get('host')}/api/auth/google/callback`;

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return res.send(`
        <div style="font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; border: 1px solid #ff9800; border-radius: 8px; background: #fffde7;">
          <h3 style="color: #ff9800; margin-top:0;">Warning: No Refresh Token Returned!</h3>
          <p>Google did not return a refresh token. This usually happens if you have already authorized this application previously.</p>
          <p><strong>To resolve this:</strong></p>
          <ol>
            <li>Go to <a href="https://myaccount.google.com/connections" target="_blank" style="color:#2196f3;">Google Third-party apps access</a>.</li>
            <li>Find your app / Google project, click it, and select <strong>Remove Access</strong>.</li>
            <li>Come back and visit <a href="/api/auth/google" style="color:#2196f3;">mvr-studio.onrender.com/api/auth/google</a> again to re-authenticate.</li>
          </ol>
        </div>
      `);
    }

    res.send(`
      <div style="font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 30px; border: 1px solid #4caf50; border-radius: 8px; background: #f1f8e9; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <h2 style="color: #4caf50; margin-top: 0; display:flex; align-items:center; gap:8px;">🎉 Authorization Successful!</h2>
        <p>You have successfully authorized your personal Google Drive account.</p>
        <p>Copy the value below and add it as an environment variable in your Render settings:</p>
        
        <div style="margin: 20px 0;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px; color:#555;">Key Name:</label>
          <input type="text" value="GOOGLE_REFRESH_TOKEN" readonly style="width: 100%; padding: 10px; font-family: monospace; font-size: 1rem; border: 1px solid #ccc; border-radius: 4px; background:#fff; cursor:pointer;" onclick="this.select()"/>
        </div>

        <div style="margin: 20px 0;">
          <label style="font-weight: bold; display: block; margin-bottom: 5px; color:#555;">Value (Refresh Token):</label>
          <textarea readonly style="width: 100%; height: 80px; padding: 10px; font-family: monospace; font-size: 0.9rem; border: 1px solid #ccc; border-radius: 4px; background:#fff; cursor:pointer; resize:none;" onclick="this.select()">${tokens.refresh_token}</textarea>
        </div>

        <p style="color: #666; font-size: 0.85rem; line-height:1.4;">
          💡 <strong>Tip:</strong> Click inside the boxes above to automatically highlight the text, making it easy to copy.<br/>
          After adding <code>GOOGLE_REFRESH_TOKEN</code> to Render, you can safely delete the old <code>GOOGLE_DRIVE_CREDENTIALS</code> variable since it is no longer needed.
        </p>
      </div>
    `);
  } catch (err) {
    console.error('OAuth Callback Error:', err);
    res.status(500).send(`Error obtaining tokens: ${err.message}`);
  }
});

module.exports = router;
