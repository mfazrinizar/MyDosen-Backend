const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Database path from environment or default
const DB_PATH = process.env.DB_PATH 
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '../db', 'database.sqlite');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Helper to run queries with promises
const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const getOne = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Generate UUID
const generateUUID = () => {
  return uuidv4();
};

// Initialize database schema
const initializeDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        // Create users table with UUID
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create mahasiswa profile table
        db.run(`
          CREATE TABLE IF NOT EXISTS mahasiswa (
            user_id TEXT PRIMARY KEY,
            nim TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);

        // Create dosen profile table
        db.run(`
          CREATE TABLE IF NOT EXISTS dosen (
            user_id TEXT PRIMARY KEY,
            nidn TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);

        // Create admin profile table
        db.run(`
          CREATE TABLE IF NOT EXISTS admin (
            user_id TEXT PRIMARY KEY,
            nip TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);

        // Create tracking_permissions table with UUID
        db.run(`
          CREATE TABLE IF NOT EXISTS tracking_permissions (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            lecturer_id TEXT NOT NULL,
            status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES mahasiswa(user_id) ON DELETE CASCADE,
            FOREIGN KEY (lecturer_id) REFERENCES dosen(user_id) ON DELETE CASCADE,
            UNIQUE(student_id, lecturer_id)
          )
        `);

        // Create locations table
        db.run(`
          CREATE TABLE IF NOT EXISTS locations (
            user_id TEXT PRIMARY KEY,
            latitude REAL,
            longitude REAL,
            position_name TEXT,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);

        // Create geofences table with UUID
        db.run(`
          CREATE TABLE IF NOT EXISTS geofences (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            radius_km REAL DEFAULT 1.0
          )
        `, async (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Seed data after tables are created
          await seedDatabase();
          resolve();
        });

      } catch (error) {
        reject(error);
      }
    });
  });
};

// Seed initial data
const seedDatabase = async () => {
  try {
    // Get seed credentials from environment or use defaults
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@unsri.ac.id';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
    const dosenEmail = process.env.SEED_DOSEN_EMAIL || 'dosen1@unsri.ac.id';
    const dosenPassword = process.env.SEED_DOSEN_PASSWORD || 'dosen123';
    const mahasiswaEmail = process.env.SEED_MAHASISWA_EMAIL || 'mahasiswa1@unsri.ac.id';
    const mahasiswaPassword = process.env.SEED_MAHASISWA_PASSWORD || 'mahasiswa123';

    // Check if admin already exists
    const existingAdmin = await getOne('SELECT * FROM users WHERE email = ?', [adminEmail]);
    
    if (!existingAdmin) {
      // Hash password for admin
      const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
      const adminId = generateUUID();
      
      // Insert admin user
      await runQuery(
        'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
        [adminId, 'Administrator', adminEmail, adminPasswordHash]
      );
      
      // Insert admin profile
      await runQuery(
        'INSERT INTO admin (user_id, nip) VALUES (?, ?)',
        [adminId, '199001012020011001']
      );
      
      console.log('Admin user seeded successfully.');
    }

    // Seed example Dosen
    const existingDosen = await getOne('SELECT * FROM users WHERE email = ?', [dosenEmail]);
    if (!existingDosen) {
      const dosenPasswordHash = await bcrypt.hash(dosenPassword, 10);
      const dosenId = generateUUID();
      
      await runQuery(
        'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
        [dosenId, 'Dr. Budi Santoso', dosenEmail, dosenPasswordHash]
      );
      await runQuery(
        'INSERT INTO dosen (user_id, nidn) VALUES (?, ?)',
        [dosenId, '0001018501']
      );
      console.log('Example Dosen seeded successfully.');
    }

    // Seed example Mahasiswa
    const existingMahasiswa = await getOne('SELECT * FROM users WHERE email = ?', [mahasiswaEmail]);
    if (!existingMahasiswa) {
      const mahasiswaPasswordHash = await bcrypt.hash(mahasiswaPassword, 10);
      const mahasiswaId = generateUUID();
      
      await runQuery(
        'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
        [mahasiswaId, 'Andi Wijaya', mahasiswaEmail, mahasiswaPasswordHash]
      );
      await runQuery(
        'INSERT INTO mahasiswa (user_id, nim) VALUES (?, ?)',
        [mahasiswaId, '09021182126001']
      );
      console.log('Example Mahasiswa seeded successfully.');
    }

    // Seed geofences
    const existingGeofences = await getAll('SELECT * FROM geofences');
    if (existingGeofences.length === 0) {
      await runQuery(
        'INSERT INTO geofences (id, name, latitude, longitude, radius_km) VALUES (?, ?, ?, ?, ?)',
        [generateUUID(), 'UNSRI Indralaya', -3.219741, 104.651220, 2.5]
      );
      await runQuery(
        'INSERT INTO geofences (id, name, latitude, longitude, radius_km) VALUES (?, ?, ?, ?, ?)',
        [generateUUID(), 'UNSRI Palembang', -2.985028, 104.732230, 1.5]
      );
      console.log('Geofences seeded successfully.');
    }

  } catch (error) {
    console.error('Error seeding database:', error.message);
  }
};

module.exports = {
  db,
  runQuery,
  getOne,
  getAll,
  initializeDatabase,
  generateUUID
};
