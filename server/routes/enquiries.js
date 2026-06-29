// routes/enquiries.js — Booking enquiries (using node:sqlite)
'use strict';

const express = require('express');
const { getDb, getDbPath } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/enquiries
 * Submit new booking enquiry (public)
 */
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, phone, email, service, event_date, guests, budget, message } = req.body;

    if (!name || !phone || !service) {
      return res.status(400).json({ error: 'name, phone, and service are required' });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    const result = db.prepare(`
      INSERT INTO enquiries (name, phone, email, service, event_date, guests, budget, message, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'New', datetime('now'))
    `).run(name, phone, email || null, service, event_date || null, guests || null, budget || null, message || null);

    console.log(`✅ New enquiry from ${name} (${phone}) for ${service}`);
    res.json({ success: true, id: result.lastInsertRowid, message: 'Booking enquiry submitted successfully' });
  } catch (err) {
    console.error('Enquiries POST error:', err);
    res.status(500).json({ error: 'Failed to submit enquiry: ' + err.message });
  }
});

/**
 * GET /api/enquiries/status/:id
 * Retrieve specific enquiry status (public)
 */
router.get('/status/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const row = db.prepare('SELECT status FROM enquiries WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'Booking enquiry not found' });
    }

    res.json({ success: true, status: row.status });
  } catch (err) {
    console.error('Enquiry status query error:', err);
    res.status(500).json({ error: 'Failed to query status: ' + err.message });
  }
});

/**
 * GET /api/enquiries/status-by-phone/:phone
 * Retrieve status of the latest enquiry for a specific phone number (public)
 */
router.get('/status-by-phone/:phone', (req, res) => {
  try {
    const db = getDb();
    const phone = req.params.phone.trim();
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Clean phone number to extract digits
    const cleanPhone = phone.replace(/\D/g, '');
    let searchPhone = cleanPhone;
    if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
      searchPhone = cleanPhone.substring(2);
    } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
      searchPhone = cleanPhone.substring(1);
    }

    // Find the latest enquiry matching this phone suffix
    const row = db.prepare(`
      SELECT id, status FROM enquiries 
      WHERE replace(phone, ' ', '') LIKE ? 
      ORDER BY id DESC LIMIT 1
    `).get(`%${searchPhone}%`);

    if (!row) {
      return res.status(404).json({ error: 'No bookings found for this phone number' });
    }

    res.json({ success: true, id: row.id, status: row.status });
  } catch (err) {
    console.error('Enquiry status by phone query error:', err);
    res.status(500).json({ error: 'Failed to query status: ' + err.message });
  }
});

/**
 * GET /api/enquiries/booked-dates
 * Retrieve all confirmed and completed booking dates (public)
 */
router.get('/booked-dates', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT DISTINCT event_date FROM enquiries 
      WHERE status IN ('Confirmed', 'Completed') AND event_date IS NOT NULL AND event_date != ''
    `).all();

    const dates = rows.map(r => r.event_date);
    res.json({ success: true, bookedDates: dates });
  } catch (err) {
    console.error('Booked dates query error:', err);
    res.status(500).json({ error: 'Failed to query booked dates: ' + err.message });
  }
});

/**
 * GET /api/enquiries
 * List all enquiries (admin protected)
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const enquiries = db.prepare('SELECT * FROM enquiries ORDER BY id DESC').all();
    res.json({ success: true, enquiries, total: enquiries.length });
  } catch (err) {
    console.error('Enquiries GET error:', err);
    res.status(500).json({ error: 'Failed to fetch enquiries' });
  }
});

/**
 * GET /api/enquiries/backup
 * Download SQLite database backup file (admin protected)
 */
router.get('/backup', requireAuth, (req, res) => {
  try {
    const dbPath = getDbPath();
    res.download(dbPath, 'mvr_studio_backup.db', (err) => {
      if (err) {
        console.error('Database backup download failed:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download database backup file' });
        }
      }
    });
  } catch (err) {
    console.error('Backup endpoint error:', err);
    res.status(500).json({ error: 'Internal server error during backup generation' });
  }
});

/**
 * PATCH /api/enquiries/:id/status
 * Update enquiry status (admin protected)
 */
router.patch('/:id/status', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    const allowed = ['New', 'Contacted', 'Confirmed', 'Completed', 'Cancelled'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }

    const result = db.prepare('UPDATE enquiries SET status = ? WHERE id = ?').run(status, id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    res.json({ success: true, id, status });
  } catch (err) {
    console.error('Enquiry PATCH error:', err);
    res.status(500).json({ error: 'Failed to update enquiry status' });
  }
});

/**
 * DELETE /api/enquiries/:id
 * Delete single enquiry (admin protected)
 */
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    const result = db.prepare('DELETE FROM enquiries WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    console.log(`✅ Deleted enquiry ${id}`);
    res.json({ success: true, deleted: id });
  } catch (err) {
    console.error('Enquiry DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete enquiry' });
  }
});

/**
 * DELETE /api/enquiries
 * Clear all enquiries (admin protected)
 */
router.delete('/', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM enquiries').run();
    console.log(`✅ Cleared all ${result.changes} enquiries`);
    res.json({ success: true, deleted: result.changes });
  } catch (err) {
    console.error('Enquiries clear error:', err);
    res.status(500).json({ error: 'Failed to clear enquiries' });
  }
});

module.exports = router;
