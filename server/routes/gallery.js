// routes/gallery.js — Gallery CRUD with Google Drive / Local disk fallback support
'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');
const { uploadFileToDrive, deleteFileFromDrive, extractFileId } = require('../driveService');

const router = express.Router();

// Ensure local uploads directory exists (used as fallback)
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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

// Use memoryStorage so we always have access to file buffers
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

/**
 * GET /api/gallery/debug
 * Secure diagnostic endpoint for Google Drive credentials & access check
 */
router.get('/debug', requireAuth, async (req, res) => {
  try {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const credentialsJson = process.env.GOOGLE_DRIVE_CREDENTIALS;

    if (!credentialsJson) {
      return res.json({
        success: false,
        error: 'GOOGLE_DRIVE_CREDENTIALS environment variable is missing.'
      });
    }

    let credentials;
    try {
      credentials = JSON.parse(credentialsJson);
    } catch (parseErr) {
      return res.json({
        success: false,
        error: `Failed to parse GOOGLE_DRIVE_CREDENTIALS JSON: ${parseErr.message}`
      });
    }

    const clientEmail = credentials.client_email;
    if (!clientEmail) {
      return res.json({
        success: false,
        error: 'client_email is missing from GOOGLE_DRIVE_CREDENTIALS JSON.'
      });
    }

    if (!folderId) {
      return res.json({
        success: false,
        clientEmail,
        error: 'GOOGLE_DRIVE_FOLDER_ID environment variable is missing.'
      });
    }

    try {
      const { google } = require('googleapis');
      const privateKey = credentials.private_key
        ? credentials.private_key.replace(/\\n/g, '\n')
        : null;

      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/drive']
      });

      const drive = google.drive({ version: 'v3', auth });

      const folderMetadata = await drive.files.get({
        fileId: folderId,
        fields: 'id, name, capabilities'
      });

      return res.json({
        success: true,
        clientEmail,
        folderId,
        folderName: folderMetadata.data.name,
        capabilities: folderMetadata.data.capabilities
      });
    } catch (driveErr) {
      return res.json({
        success: false,
        clientEmail,
        folderId,
        error: `Google Drive API error: ${driveErr.message}`
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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
router.post('/', requireAuth, upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const db = getDb();
    const { caption, category } = req.body;
    const insertedItems = [];
    const hasDrive = !!process.env.GOOGLE_DRIVE_CREDENTIALS;

    const insertStmt = db.prepare(
      'INSERT INTO gallery (src, type, cap, category, uploaded_at) VALUES (?, ?, ?, ?, ?)'
    );

    for (const file of req.files) {
      const isVideo = file.mimetype.startsWith('video/');
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${timestamp}-${safeName}`;
      
      let src;
      if (hasDrive) {
        // Upload directly to Google Drive
        const uploadResult = await uploadFileToDrive(file.buffer, fileName, file.mimetype);
        src = uploadResult.url;
      } else {
        // Fallback: save to local server disk
        const filePath = path.join(UPLOADS_DIR, fileName);
        fs.writeFileSync(filePath, file.buffer);
        src = `uploads/${fileName}`;
      }

      const type = isVideo ? 'video' : 'photo';
      const cap = caption || file.originalname.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      const cat = category || 'wedding';
      const uploadedAt = new Date().toISOString();

      const result = insertStmt.run(src, type, cap, cat, uploadedAt);
      insertedItems.push({ id: result.lastInsertRowid, src, type, cap, category: cat, uploaded_at: uploadedAt });
    }

    console.log(`✅ Uploaded ${req.files.length} file(s) to gallery (Google Drive: ${hasDrive})`);
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
router.delete('/batch', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { ids } = req.body;
    const hasDrive = !!process.env.GOOGLE_DRIVE_CREDENTIALS;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const placeholders = ids.map(() => '?').join(',');

    // Get file paths/urls before deletion
    const items = db.prepare(`SELECT * FROM gallery WHERE id IN (${placeholders})`).all(...ids);

    // Delete from database
    db.prepare(`DELETE FROM gallery WHERE id IN (${placeholders})`).run(...ids);

    let deletedFiles = 0;
    for (const item of items) {
      const fileId = extractFileId(item.src);
      if (fileId && hasDrive) {
        // Delete from Google Drive
        try {
          await deleteFileFromDrive(fileId);
          deletedFiles++;
        } catch (driveErr) {
          console.warn(`Failed to delete file ${fileId} from Google Drive:`, driveErr.message);
        }
      } else {
        // Delete from local disk
        const filename = path.basename(item.src);
        const filePath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deletedFiles++;
        }
      }
    }

    console.log(`✅ Batch deleted ${ids.length} gallery items, removed ${deletedFiles} files`);
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
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    const hasDrive = !!process.env.GOOGLE_DRIVE_CREDENTIALS;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid gallery item ID' });
    }

    const item = db.prepare('SELECT * FROM gallery WHERE id = ?').get(id);
    if (!item) {
      return res.status(404).json({ error: 'Gallery item not found' });
    }

    // Delete from database
    db.prepare('DELETE FROM gallery WHERE id = ?').run(id);

    const fileId = extractFileId(item.src);
    if (fileId && hasDrive) {
      // Delete from Google Drive
      try {
        await deleteFileFromDrive(fileId);
      } catch (driveErr) {
        console.warn(`Failed to delete file ${fileId} from Google Drive:`, driveErr.message);
      }
    } else {
      // Delete from local disk
      const filename = path.basename(item.src);
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    console.log(`✅ Deleted gallery item ${id}`);
    res.json({ success: true, deleted: id });
  } catch (err) {
    console.error('Gallery DELETE error:', err);
    res.status(500).json({ error: 'Failed to delete gallery item: ' + err.message });
  }
});

module.exports = router;
