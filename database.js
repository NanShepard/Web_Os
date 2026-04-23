const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const CLOUD_DIR = path.join(__dirname, 'cloud_data');
const DB_FILE = path.join(CLOUD_DIR, 'database.sqlite');
const USERS_FILE = path.join(CLOUD_DIR, 'users.json');
const METADATA_FILE = path.join(CLOUD_DIR, 'metadata.json');

const SALT_ROUNDS = 10;

if (!fs.existsSync(CLOUD_DIR)) {
  fs.mkdirSync(CLOUD_DIR, { recursive: true });
}

async function initDb() {
  const db = await open({
    filename: DB_FILE,
    driver: sqlite3.Database
  });

  // Create tables for the Cloud OS
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metadata (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      path TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      size INTEGER DEFAULT 0,
      modified INTEGER,
      synced INTEGER DEFAULT 1,
      syncedAt INTEGER,
      fileId TEXT NOT NULL
    );
  `);

  // Migration step: Port old JSON users to SQLite if empty
  const userCount = await db.get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    if (fs.existsSync(USERS_FILE)) {
      const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      for (const [username, data] of Object.entries(users)) {
        const hashed = bcrypt.hashSync(data.password, SALT_ROUNDS);
        await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashed, data.role]);
      }
      console.log('Migrated old users.json to SQLite (passwords hashed with bcrypt)');
    } else {
      // Default users — store hashed passwords
      await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', bcrypt.hashSync('nexos', SALT_ROUNDS), 'Administrator']);
      await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['user', bcrypt.hashSync('password', SALT_ROUNDS), 'Standard User']);
      await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['cloud', bcrypt.hashSync('cloud123', SALT_ROUNDS), 'Cloud Operator']);
    }
  } else {
    // Auto-migrate existing plain-text passwords to bcrypt hashes
    const allUsers = await db.all('SELECT username, password FROM users');
    for (const user of allUsers) {
      // bcrypt hashes always start with "$2a$" or "$2b$" — plain text won't
      if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
        const hashed = bcrypt.hashSync(user.password, SALT_ROUNDS);
        await db.run('UPDATE users SET password = ? WHERE username = ?', [hashed, user.username]);
        console.log(`Migrated password for user "${user.username}" to bcrypt hash`);
      }
    }
  }

  // Migration step: Port old JSON metadata to SQLite if empty
  const metaCount = await db.get('SELECT COUNT(*) as count FROM metadata');
  if (metaCount.count === 0 && fs.existsSync(METADATA_FILE)) {
    const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    let count = 0;
    for (const [key, data] of Object.entries(metadata)) {
      await db.run(`
        INSERT INTO metadata (id, owner, path, name, type, size, modified, syncedAt, fileId) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [key, data.owner, data.path, data.name, data.type, data.size, data.modified, data.syncedAt, data.fileId]);
      count++;
    }
    if(count > 0) console.log(`Migrated ${count} files from metadata.json to SQLite`);
  }

  return db;
}

module.exports = { initDb };
