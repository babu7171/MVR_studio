// database.js — SQLite setup using Node.js built-in node:sqlite (Node v22.5+)
'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_PATH = path.join(DATA_DIR, 'mvr_studio.db');

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    // WAL mode for better performance
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  // Create gallery table
  db.exec(`
    CREATE TABLE IF NOT EXISTS gallery (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      src         TEXT    NOT NULL,
      type        TEXT    NOT NULL DEFAULT 'photo',
      cap         TEXT    NOT NULL DEFAULT 'MVR Work',
      category    TEXT    NOT NULL DEFAULT 'wedding',
      uploaded_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Create services table
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id          TEXT    PRIMARY KEY,
      icon        TEXT    NOT NULL DEFAULT '📷',
      name        TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      group_name  TEXT    NOT NULL DEFAULT 'Wedding & Ceremonies',
      budget      TEXT    NOT NULL DEFAULT '',
      bg          TEXT    NOT NULL DEFAULT 'gallery-wedding.png',
      sort_order  INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Create enquiries table
  db.exec(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      phone       TEXT    NOT NULL,
      email       TEXT,
      service     TEXT    NOT NULL,
      event_date  TEXT,
      guests      TEXT,
      budget      TEXT,
      message     TEXT,
      status      TEXT    NOT NULL DEFAULT 'New',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Seed default services if table is empty
  const row = db.prepare('SELECT COUNT(*) as c FROM services').get();
  if (row.c === 0) {
    seedDefaultServices();
  }
}

function seedDefaultServices() {
  const DEFAULT_SERVICES = [
    { id: 'wedding',       icon: '💍', name: 'Wedding Photographers',       description: 'Full coverage — Mandap, Pheras, Vidaai & Portraits',               group_name: 'Wedding & Ceremonies',             budget: '₹50,000 – ₹1,00,000', bg: 'gallery-wedding.png',   sort_order: 1  },
    { id: 'prewedding',    icon: '💑', name: 'Pre Wedding Photoshoot',       description: 'Romantic couple sessions at heritage & scenic locations',           group_name: 'Wedding & Ceremonies',             budget: '₹20,000 – ₹50,000',  bg: 'svc-prewedding.png',    sort_order: 2  },
    { id: 'baraat',        icon: '🐴', name: 'Baraat & Reception',           description: 'Grand procession with dhol & band baja to the elegant Reception',   group_name: 'Wedding & Ceremonies',             budget: '₹25,000 – ₹50,000',  bg: 'gallery-baraat.png',    sort_order: 3  },
    { id: 'mehndi',        icon: '🌸', name: 'Mehndi & Haldi',               description: 'Colourful traditions captured beautifully',                         group_name: 'Wedding & Ceremonies',             budget: '₹25,000 – ₹50,000',  bg: 'gallery-mehndi.png',    sort_order: 4  },
    { id: 'candid',        icon: '📷', name: 'Candid Wedding Photography',   description: 'Natural, unposed moments full of genuine emotion',                  group_name: 'Wedding & Ceremonies',             budget: '₹50,000 – ₹1,00,000', bg: 'gallery-wedding2.png',  sort_order: 5  },
    { id: 'videographers', icon: '🎬', name: 'Wedding Videographers',        description: 'Bollywood-style cinematic 4K wedding films',                        group_name: 'Wedding & Ceremonies',             budget: '₹50,000 – ₹1,00,000', bg: 'gallery-drone2.png',    sort_order: 6  },
    { id: 'sangeet',       icon: '💃', name: 'Sangeet Ceremony',             description: 'Vibrant dance & celebration photography',                           group_name: 'Wedding & Ceremonies',             budget: '₹25,000 – ₹50,000',  bg: 'gallery-event.png',     sort_order: 7  },
    { id: 'engagement',    icon: '💎', name: 'Engagement Photoshoot',        description: 'Capture the joy of your commitment day',                            group_name: 'Wedding & Ceremonies',             budget: '₹25,000 – ₹50,000',  bg: 'svc-prewedding.png',    sort_order: 8  },
    { id: 'drone',         icon: '🚁', name: 'Drone Aerial Photography',     description: 'DGCA-licensed stunning aerial shots from the sky',                  group_name: 'Wedding & Ceremonies',             budget: '₹10,000 – ₹25,000',  bg: 'gallery-drone.png',     sort_order: 9  },
    { id: 'events',        icon: '🎉', name: 'Event Photographers',          description: 'Corporate events, grand parties & cultural programs',               group_name: 'Events & Special Occasions',       budget: '₹25,000 – ₹50,000',  bg: 'svc-event.png',         sort_order: 10 },
    { id: 'birthday',      icon: '🎂', name: 'Birthday Photoshoot',          description: 'Fun & vibrant birthday celebration photography',                    group_name: 'Events & Special Occasions',       budget: '₹10,000 – ₹25,000',  bg: 'gallery-event.png',     sort_order: 11 },
    { id: 'housewarming',  icon: '🏠', name: 'House Warming Photoshoot',     description: 'Griha Pravesh pooja & family moments',                              group_name: 'Events & Special Occasions',       budget: '₹25,000 – ₹50,000',  bg: 'gallery-event.png',     sort_order: 12 },
    { id: 'naming',        icon: '👶', name: 'Naming Ceremony',              description: 'Namkaran blessings & first name-giving ritual',                     group_name: 'Events & Special Occasions',       budget: '₹10,000 – ₹25,000',  bg: 'gallery-event.png',     sort_order: 13 },
    { id: 'upanayanam',    icon: '🙏', name: 'Upanayanam Photography',       description: 'Sacred thread ceremony — every ritual covered',                     group_name: 'Events & Special Occasions',       budget: '₹25,000 – ₹50,000',  bg: 'gallery-event.png',     sort_order: 14 },
    { id: 'family',        icon: '👨‍👩‍👧‍👦', name: 'Family Photoshoot', description: 'Warm portraits capturing the bond of your family',                    group_name: 'Events & Special Occasions',       budget: '₹10,000 – ₹25,000',  bg: 'gallery-event.png',     sort_order: 15 },
    { id: 'maternity',     icon: '🤰', name: 'Maternity Photoshoot',         description: 'Celebrating the glow of motherhood',                               group_name: 'Portrait & Specialty Photography', budget: '₹10,000 – ₹25,000',  bg: 'svc-portrait.png',      sort_order: 16 },
    { id: 'newborn',       icon: '🍼', name: 'Newborn Photoshoot',           description: 'Tiny toes, peaceful sleeps, precious first days',                   group_name: 'Portrait & Specialty Photography', budget: '₹10,000 – ₹25,000',  bg: 'svc-portrait.png',      sort_order: 17 },
    { id: 'portfolio',     icon: '👤', name: 'Portfolio Shoot',              description: 'Professional portfolios for models, actors & professionals',        group_name: 'Portrait & Specialty Photography', budget: '₹10,000 – ₹25,000',  bg: 'svc-portrait.png',      sort_order: 18 },
    { id: 'album',         icon: '📚', name: 'Album Design & Print',         description: 'Premium custom wedding albums & photo books',                        group_name: 'Portrait & Specialty Photography', budget: '₹25,000 – ₹50,000',  bg: 'gallery-wedding2.png',  sort_order: 19 }
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO services (id, icon, name, description, group_name, budget, bg, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const svc of DEFAULT_SERVICES) {
    insert.run(svc.id, svc.icon, svc.name, svc.description, svc.group_name, svc.budget, svc.bg, svc.sort_order);
  }

  console.log('✅ Default services seeded into database');
}

module.exports = { getDb };
