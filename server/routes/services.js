// routes/services.js — Services & budgets (using node:sqlite)
'use strict';

const express = require('express');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/services
 * Returns all services (public)
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const services = db.prepare('SELECT * FROM services ORDER BY sort_order ASC').all();

    const budgets = {};
    services.forEach(svc => { budgets[svc.name] = svc.budget; });

    const mapped = services.map(svc => ({
      id: svc.id,
      icon: svc.icon,
      name: svc.name,
      desc: svc.description,
      group: svc.group_name,
      budget: svc.budget,
      bg: svc.bg,
      photos: []
    }));

    res.json({ success: true, services: mapped, budgets });
  } catch (err) {
    console.error('Services GET error:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

/**
 * PUT /api/services
 * Update all services & budgets (admin protected)
 * Body: { services: [...] }
 */
router.put('/', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { services } = req.body;

    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ error: 'services array is required' });
    }

    const updateStmt = db.prepare(
      'UPDATE services SET icon = ?, name = ?, description = ?, group_name = ?, budget = ?, bg = ? WHERE id = ?'
    );

    for (const svc of services) {
      updateStmt.run(
        svc.icon || '📷',
        svc.name,
        svc.desc || svc.description || '',
        svc.group || svc.group_name || 'Wedding & Ceremonies',
        svc.budget || '',
        svc.bg || 'gallery-wedding.png',
        svc.id
      );
    }

    console.log(`✅ Updated ${services.length} services`);
    res.json({ success: true, updated: services.length });
  } catch (err) {
    console.error('Services PUT error:', err);
    res.status(500).json({ error: 'Failed to update services: ' + err.message });
  }
});

module.exports = router;
