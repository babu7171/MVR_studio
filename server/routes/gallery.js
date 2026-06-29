// routes/gallery.js — Gallery CRUD with Google Drive / Local disk fallback support
'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');
const { uploadFileToDrive, deleteFileFromDrive, extractFileId, fetchDriveGalleryTree } = require('../driveService');

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

// Ensure temporary uploads directory exists
const TEMP_DIR = path.join(__dirname, '..', 'temp_uploads');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Multer config: save files temporarily to disk (prevents Out of Memory crashes on low RAM servers)
const upload = multer({
  dest: TEMP_DIR,
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
    
    // Check which authentication mode is active
    const useOAuth2 = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
    const useServiceAccount = !useOAuth2 && !!process.env.GOOGLE_DRIVE_CREDENTIALS;

    if (!useOAuth2 && !useServiceAccount) {
      return res.json({
        success: false,
        error: 'No Google Drive credentials found. Please configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN or GOOGLE_DRIVE_CREDENTIALS.'
      });
    }

    if (!folderId) {
      return res.json({
        success: false,
        error: 'GOOGLE_DRIVE_FOLDER_ID environment variable is missing.'
      });
    }

    const { google } = require('googleapis');
    let auth;
    let clientType = '';
    let details = {};

    if (useOAuth2) {
      clientType = 'OAuth2 User';
      auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      auth.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });
      details = {
        clientId: process.env.GOOGLE_CLIENT_ID.substring(0, 15) + '...'
      };
    } else {
      clientType = 'Service Account';
      let credentials;
      try {
        credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS);
      } catch (err) {
        return res.json({
          success: false,
          error: `Failed to parse GOOGLE_DRIVE_CREDENTIALS JSON: ${err.message}`
        });
      }
      
      const privateKey = credentials.private_key
        ? credentials.private_key.replace(/\\n/g, '\n')
        : null;

      auth = new google.auth.JWT({
        email: credentials.client_email,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/drive']
      });
      
      details = {
        clientEmail: credentials.client_email
      };
    }

    try {
      const drive = google.drive({ version: 'v3', auth });

      const folderMetadata = await drive.files.get({
        fileId: folderId,
        fields: 'id, name, capabilities'
      });

      return res.json({
        success: true,
        clientType,
        ...details,
        folderId,
        folderName: folderMetadata.data.name,
        capabilities: folderMetadata.data.capabilities
      });
    } catch (driveErr) {
      return res.json({
        success: false,
        clientType,
        ...details,
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
    const hasDrive = !!(process.env.GOOGLE_DRIVE_CREDENTIALS || (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN));

    const insertStmt = db.prepare(
      'INSERT INTO gallery (src, type, cap, category, uploaded_at) VALUES (?, ?, ?, ?, ?)'
    );

    for (const file of req.files) {
      const isVideo = file.mimetype.startsWith('video/');
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${timestamp}-${safeName}`;
      const cat = category || 'wedding';
      
      let src;
      try {
        if (hasDrive) {
          // Look up human-readable service name for subfolder name mapping
          let subfolderName = null;
          try {
            const categoryRow = db.prepare('SELECT name FROM services WHERE id = ?').get(cat);
            if (categoryRow) {
              subfolderName = categoryRow.name;
            }
          } catch (dbErr) {
            console.warn('Could not query service name for category:', cat, dbErr.message);
          }

          // Upload directly to Google Drive (with subfolder mapping)
          const uploadResult = await uploadFileToDrive(file.path, fileName, file.mimetype, subfolderName);
          src = uploadResult.url;
        } else {
          // Fallback: move from temp to permanent uploads folder
          const destPath = path.join(UPLOADS_DIR, fileName);
          fs.renameSync(file.path, destPath);
          src = `uploads/${fileName}`;
        }
      } finally {
        // Always clean up the temporary file from disk
        if (fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
          } catch (unlinkErr) {
            console.warn('Failed to delete temporary file:', file.path, unlinkErr.message);
          }
        }
      }

      const type = isVideo ? 'video' : 'photo';
      const cap = caption || file.originalname.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
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
    const hasDrive = !!(process.env.GOOGLE_DRIVE_CREDENTIALS || (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN));

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
    const hasDrive = !!(process.env.GOOGLE_DRIVE_CREDENTIALS || (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN));

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

/**
 * POST /api/gallery/sync
 * Sync Google Drive folders/files directly with SQLite gallery database table (admin protected)
 */
router.post('/sync', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const hasDrive = !!(process.env.GOOGLE_DRIVE_CREDENTIALS || (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN));
    
    if (!hasDrive) {
      return res.status(400).json({ error: 'Google Drive integration is not configured on the server.' });
    }

    console.log('🔄 Scanning Google Drive folders for gallery synchronization...');
    const driveTree = await fetchDriveGalleryTree();
    const dbServices = db.prepare('SELECT id, name FROM services').all();

    // Helper to find category ID by folder name
    function matchCategory(folderName) {
      if (folderName === 'Uncategorized') return 'wedding';
      
      const cleanFolder = folderName.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Try exact or partial match with database services
      for (const svc of dbServices) {
        const cleanSvcName = svc.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanFolder.includes(cleanSvcName) || cleanSvcName.includes(cleanFolder)) {
          return svc.id;
        }
      }
      return 'wedding'; // default fallback
    }

    const driveFileUrls = [];
    let addedCount = 0;
    let skippedCount = 0;

    // Get all existing gallery URLs from SQLite to avoid duplicates
    const existingRows = db.prepare('SELECT src FROM gallery').all();
    const existingSrcs = new Set(existingRows.map(r => r.src));

    const insertStmt = db.prepare(
      'INSERT INTO gallery (src, type, cap, category) VALUES (?, ?, ?, ?)'
    );

    // Loop through subfolders and files found in Drive
    for (const node of driveTree) {
      const folderName = node.folderName;
      const category = matchCategory(folderName);

      for (const file of node.files) {
        const cdnUrl = `https://lh3.googleusercontent.com/d/${file.id}`;
        driveFileUrls.push(cdnUrl);

        if (existingSrcs.has(cdnUrl)) {
          skippedCount++;
        } else {
          const isVideo = file.mimeType.startsWith('video/');
          const type = isVideo ? 'video' : 'photo';
          // Clean filename to make a clean caption: e.g. "my-photo-name.jpg" -> "my photo name"
          const cleanCap = file.name
            .substring(0, file.name.lastIndexOf('.'))
            .replace(/[-_]/g, ' ')
            .trim();
          const cap = cleanCap || 'MVR Work';

          insertStmt.run(cdnUrl, type, cap, category);
          addedCount++;
        }
      }
    }

    // Pruning phase: Delete items in DB that are no longer present in Google Drive
    let prunedCount = 0;
    if (driveFileUrls.length > 0) {
      const placeholders = driveFileUrls.map(() => '?').join(',');
      const deleteStmt = db.prepare(`
        DELETE FROM gallery 
        WHERE src LIKE 'https://lh3.googleusercontent.com/d/%' 
          AND src NOT IN (${placeholders})
      `);
      const info = deleteStmt.run(...driveFileUrls);
      prunedCount = info.changes;
    } else {
      const info = db.prepare("DELETE FROM gallery WHERE src LIKE 'https://lh3.googleusercontent.com/d/%'").run();
      prunedCount = info.changes;
    }

    console.log(`✅ Gallery Sync Complete: Added ${addedCount}, Skipped ${skippedCount}, Pruned ${prunedCount}`);
    res.json({
      success: true,
      added: addedCount,
      skipped: skippedCount,
      pruned: prunedCount,
      message: `Google Drive sync complete! Added ${addedCount} new items, pruned ${prunedCount} deleted items.`
    });
  } catch (err) {
    console.error('Google Drive gallery sync error:', err);
    res.status(500).json({ error: 'Failed to sync Google Drive gallery: ' + err.message });
  }
});

module.exports = router;
