// routes/gallery.js — Gallery CRUD with file uploads (using node:sqlite)
'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo'
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

/**
 * GET /api/gallery
 * Returns all gallery items (public)
 * Optional query: ?category=wedding
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { category } = req.query;

    let items;
    if (category && category !== 'all') {
      items = db.prepare('SELECT * FROM gallery WHERE category = ? ORDER BY id DESC').all(category);
    } else {
      items = db.prepare('SELECT * FROM gallery ORDER BY id DESC').all();
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const result = items.map(item => ({
      id: item.id,
      src: item.src.startsWith('http') ? item.src : `${baseUrl}/${item.src}`,
      type: item.type,
      cap: item.cap,
      category: item.category,
      uploaded_at: item.uploaded_at
    }));

    res.json({ success: true, gallery: result, total: result.length });
  } catch (err) {
    console.error('Gallery GET error:', err);
    res.status(500).json({ error: 'Failed to fetch gallery' });
  }
});

/**
 * POST /api/gallery
 * Upload one or multiple files (admin protected)
 */
router.post('/', requireAuth, upload.array('files', 20), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const db = getDb();
    const { caption, category } = req.body;
    const insertedItems = [];

    const insertStmt = db.prepare(
      'INSERT INTO gallery (src, type, cap, category, uploaded_at) VALUES (?, ?, ?, ?, ?)'
    );

    for (const file of req.files) {
      const isVideo = file.mimetype.startsWith('video/');
      const src = `uploads/${file.filename}`;
      const type = isVideo ? 'video' : 'photo';
      const cap = caption || file.originalname.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      const cat = category || 'wedding';
      const uploadedAt = new Date().toISOString();

      const result = insertStmt.run(src, type, cap, cat, uploadedAt);
      insertedItems.push({ id: result.lastInsertRowid, src, type, cap, category: cat, uploaded_at: uploadedAt });
    }

    console.log(`✅ Uploaded ${req.files.length} file(s) to gallery`);
    res.json({ success: true, uploaded: insertedItems.length, items: insertedItems });
  } catch (err) {
    console.error('Gallery POST error:', err);
    res.status(500).json({ error: 'Failed to save gallery items: ' + err.message });
  }
});

/**
 * DELETE /api/gallery/batch
 * Batch delete by IDs array (admin protected)
 * Body: { ids: [1, 2, 3] }
 */
router.delete('/batch', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const placeholders = ids.map(() => '?').join(',');

    // Get file paths before deletion
    const items = db.prepare(`SELECT * FROM gallery WHERE id IN (${placeholders})`).all(...ids);

    // Delete from database
    db.prepare(`DELETE FROM gallery WHERE id IN (${placeholders})`).run(...ids);

    // Delete files from disk
    let deletedFiles = 0;
    for (const item of items) {
      const filename = path.basename(item.src);
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deletedFiles++;
      }
    }

    console.log(`✅ Batch deleted ${ids.length} gallery items, ${deletedFiles} files from disk`);
    res.json({ success: true, deleted: ids.length, filesRemoved: deletedFiles });
  } catch (err) {
    console.error('Gallery batch DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete gallery items: ' + err.message });
  }
});

/**
 * DELETE /api/gallery/:id
 * Delete a single gallery item (admin protected)
 */
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid gallery item ID' });
    }

    const item = db.prepare('SELECT * FROM gallery WHERE id = ?').get(id);
    if (!item) {
      return res.status(404).json({ error: 'Gallery item not found' });
    }

    db.prepare('DELETE FROM gallery WHERE id = ?').run(id);

    const filename = path.basename(item.src);
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    console.log(`✅ Deleted gallery item ${id}`);
    res.json({ success: true, deleted: id });
  } catch (err) {
    console.error('Gallery DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete gallery item: ' + err.message });
  }
});

module.exports = router;
