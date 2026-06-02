const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mvr@123';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// SQLite Database Setup
const dbFile = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbFile);

// Helper function wrappers for SQLite queries using Promises
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Initialize database tables
async function initDatabase() {
  try {
    // Bookings table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY,
        timestamp TEXT,
        name TEXT,
        phone TEXT,
        email TEXT,
        service TEXT,
        date TEXT,
        guests INTEGER,
        budget TEXT,
        message TEXT,
        status TEXT DEFAULT 'New'
      )
    `);

    // Website counter stats table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS counters (
        id INTEGER PRIMARY KEY DEFAULT 1,
        projects INTEGER DEFAULT 500,
        years INTEGER DEFAULT 8,
        satisfaction INTEGER DEFAULT 100,
        reviews INTEGER DEFAULT 50
      )
    `);

    // Seed default stats row if missing
    await dbRun(`
      INSERT OR IGNORE INTO counters (id, projects, years, satisfaction, reviews)
      VALUES (1, 500, 8, 100, 50)
    `);

    // Custom uploaded gallery media table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS gallery (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE,
        type TEXT,
        cap TEXT
      )
    `);

    // Ensure uploads folder exists
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }
}

initDatabase();

// Multer storage setup for gallery file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Admin Authorization check middleware
function checkAdminAuth(req, res, next) {
  const token = req.headers['authorization'] || req.headers['x-admin-auth'];
  if (token === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized: Incorrect admin password token' });
  }
}

/* ══════════════════════════════════════════════════
   BACKEND REST API ENDPOINTS
   ══════════════════════════════════════════════════ */

// 1. Admin Login API
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_PASSWORD });
  } else {
    res.status(400).json({ error: 'Incorrect password' });
  }
});

// 2. Bookings APIs
// Save a booking request (Public endpoint)
app.post('/api/bookings', async (req, res) => {
  try {
    const { name, phone, email, service, date, guests, budget, message } = req.body;
    if (!name || !phone || !service) {
      return res.status(400).json({ error: 'Missing required booking fields (name, phone, service)' });
    }

    const id = Date.now();
    const timestamp = new Date().toLocaleString('en-IN');

    await dbRun(`
      INSERT INTO bookings (id, timestamp, name, phone, email, service, date, guests, budget, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, timestamp, name, phone, email || '', service, date || '', guests || null, budget || '', message || '']);

    // Trigger Nodemailer client confirmation response and admin alert
    sendBookingEmails({ id, timestamp, name, phone, email, service, date, guests, budget, message });

    res.json({ success: true, booking: { id, timestamp, name, phone, email, service, date, guests, budget, message } });
  } catch (err) {
    console.error('Error inserting booking:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get bookings (Admin only)
app.get('/api/bookings', checkAdminAuth, async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM bookings ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error loading bookings:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Delete a booking by ID (Admin only)
app.delete('/api/bookings/:id', checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM bookings WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting booking:', err);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// Clear all bookings (Admin only)
app.delete('/api/bookings', checkAdminAuth, async (req, res) => {
  try {
    await dbRun('DELETE FROM bookings');
    res.json({ success: true });
  } catch (err) {
    console.error('Error clearing bookings:', err);
    res.status(500).json({ error: 'Failed to clear bookings' });
  }
});

// 3. Counter Stats APIs
// Get stats counters (Public)
app.get('/api/stats', async (req, res) => {
  try {
    const row = await dbGet('SELECT * FROM counters WHERE id = 1');
    res.json(row || { projects: 500, years: 8, satisfaction: 100, reviews: 50 });
  } catch (err) {
    res.json({ projects: 500, years: 8, satisfaction: 100, reviews: 50 });
  }
});

// Update stats counters (Admin only)
app.post('/api/stats', checkAdminAuth, async (req, res) => {
  try {
    const { projects, years, satisfaction, reviews } = req.body;
    await dbRun(`
      UPDATE counters 
      SET projects = ?, years = ?, satisfaction = ?, reviews = ? 
      WHERE id = 1
    `, [projects, years, satisfaction, reviews]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving counter stats:', err);
    res.status(500).json({ error: 'Failed to save stats' });
  }
});

// 4. Custom Gallery APIs
// Get custom gallery files (Public)
app.get('/api/gallery', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM gallery ORDER BY id DESC');
    const items = rows.map(r => ({
      id: r.id,
      src: 'uploads/' + r.filename,
      type: r.type,
      cap: r.cap,
      isNew: true
    }));
    res.json(items);
  } catch (err) {
    res.json([]);
  }
});

// Upload media to gallery (Admin only)
app.post('/api/gallery', checkAdminAuth, upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const inserted = [];
    for (const file of req.files) {
      const isVid = file.mimetype.startsWith('video/');
      const cap = file.originalname.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      const filename = file.filename;
      const type = isVid ? 'video' : 'photo';

      await dbRun(`
        INSERT INTO gallery (filename, type, cap) 
        VALUES (?, ?, ?)
      `, [filename, type, cap]);

      inserted.push({
        src: 'uploads/' + filename,
        type,
        cap,
        isNew: true
      });
    }

    res.json({ success: true, files: inserted });
  } catch (err) {
    console.error('Error saving gallery files:', err);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Delete custom gallery item (Admin only)
app.delete('/api/gallery/:id', checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const row = await dbGet('SELECT * FROM gallery WHERE id = ?', [id]);
    if (!row) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Delete file from disk
    const filePath = path.join(__dirname, 'public', 'uploads', row.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove database record
    await dbRun('DELETE FROM gallery WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting gallery item:', err);
    res.status(500).json({ error: 'Failed to delete gallery item' });
  }
});

// Helper Function: Send confirmation emails via Nodemailer SMTP
function sendBookingEmails(booking) {
  const mailHost = process.env.SMTP_HOST;
  const mailPort = process.env.SMTP_PORT;
  const mailUser = process.env.SMTP_USER;
  const mailPass = process.env.SMTP_PASS;

  // Stop if SMTP settings are not set
  if (!mailHost || !mailUser || !mailPass) {
    console.log('Nodemailer SMTP not configured. Logged booking details:\n', booking);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: mailHost,
    port: mailPort,
    secure: mailPort === '465', // true for port 465, false for other ports
    auth: {
      user: mailUser,
      pass: mailPass,
    },
  });

  // 1. Email to Admin
  const adminMailOptions = {
    from: `"MVR Studio Alerts" <${mailUser}>`,
    to: 'info@mvrstudio.in', // Or same user
    subject: `🔔 NEW BOOKING REQUEST: ${booking.name} (${booking.service})`,
    text: `🔔 NEW BOOKING REQUEST — MVR STUDIO\n\n` +
          `👤 Name: ${booking.name}\n` +
          `📞 Phone: ${booking.phone}\n` +
          `📧 Email: ${booking.email || 'Not provided'}\n` +
          `🎬 Service: ${booking.service}\n` +
          `📅 Event Date: ${booking.date || 'Not specified'}\n` +
          `👥 Guests: ${booking.guests || 'Not specified'}\n` +
          `💰 Budget: ${booking.budget || 'Not specified'}\n` +
          `💬 Message: ${booking.message || 'No message'}\n\n` +
          `⏰ Time: ${booking.timestamp}`,
  };

  // 2. Email confirmation to Client
  const clientMailOptions = booking.email ? {
    from: `"MVR Studio" <${mailUser}>`,
    to: booking.email,
    subject: `📅 Booking Received - MVR Studio`,
    html: `
      <div style="font-family: 'Inter', sans-serif; background: #080c18; color: #ffffff; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #c9a55a;">
        <h2 style="color: #c9a55a; font-family: 'Cormorant Garamond', serif; border-bottom: 1px solid rgba(201,165,90,0.25); padding-bottom: 10px;">Booking Request Confirmed!</h2>
        <p>Hello <strong>${booking.name}</strong>,</p>
        <p>Thank you for choosing MVR Studio! We have received your booking request for <strong>${booking.service}</strong>.</p>
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #c9a55a;">Booking Details:</h4>
          <ul style="list-style: none; padding: 0; margin: 0; line-height: 1.6;">
            <li><strong>Service:</strong> ${booking.service}</li>
            <li><strong>Preferred Date:</strong> ${booking.date || 'Not specified'}</li>
            <li><strong>Approx. Budget:</strong> ${booking.budget || 'Not specified'}</li>
          </ul>
        </div>
        <p>We will contact you at <strong>${booking.phone}</strong> within 2 hours to confirm your booking date and coordinate details.</p>
        <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 20px 0;"/>
        <p style="font-size: 0.85rem; color: #a0a0a0; font-style: italic;">MVR Studio Hyderabad · Professional Cinematic Photography & Videography</p>
      </div>
    `
  } : null;

  transporter.sendMail(adminMailOptions, (err, info) => {
    if (err) console.error('Admin nodemailer error:', err);
    else console.log('Admin email alert sent:', info.response);
  });

  if (clientMailOptions) {
    transporter.sendMail(clientMailOptions, (err, info) => {
      if (err) console.error('Client nodemailer error:', err);
      else console.log('Client confirmation email sent:', info.response);
    });
  }
}

// Fallback: Route for index.html (SPA Fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
