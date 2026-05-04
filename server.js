const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { initDb } = require('./database');
const vm = require('vm');
const { spawn } = require('child_process');

const JWT_SECRET = process.env.JWT_SECRET || 'nexos-cloud-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';
const MAX_STORAGE_PER_USER = 5 * 1024 * 1024 * 1024; // 5 GB

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'DELETE', 'PUT'] }
});

// REPL Sessions state
const replSessions = new Map();

io.on('connection', (socket) => {
  console.log('Client connected to Socket.io');

  // Handle Stateful Python Notebook (Colab style via Docker)
  socket.on('start_repl', () => {
    // Spawn Python kernel inside an isolated Docker container
    const containerName = `nexos-kernel-${socket.id}`;
    const dockerArgs = [
      'run', '-i', '--rm',
      '--name', containerName,
      '--memory', '256m',
      '--cpus', '0.5',
      'nexos-python-kernel'
    ];
    
    const pythonProcess = spawn('docker', dockerArgs);
    replSessions.set(socket.id, pythonProcess);

    pythonProcess.stdout.on('data', (data) => {
      socket.emit('repl_output', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      socket.emit('repl_output', data.toString());
    });

    pythonProcess.on('close', (code) => {
      socket.emit('repl_output', `\n[Kernel disconnected]\n`);
      replSessions.delete(socket.id);
    });
  });

  socket.on('execute_cell', ({ cellId, code }) => {
    const pythonProcess = replSessions.get(socket.id);
    if (pythonProcess) {
      const b64 = Buffer.from(code).toString('base64');
      pythonProcess.stdin.write(`RUN|${cellId}|${b64}\n`);
    } else {
      socket.emit('repl_output', `\n[No active Python kernel. Please close and reopen.]\n__NEXOS_CELL_COMPLETE__${cellId}__\n`);
    }
  });

  socket.on('disconnect', () => {
    const pythonProcess = replSessions.get(socket.id);
    if (pythonProcess) {
      // Forcefully remove the Docker container
      spawn('docker', ['rm', '-f', `nexos-kernel-${socket.id}`]);
      replSessions.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Login rate limiter state
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Set up abstracted Storage Provider
class StorageProvider {
  constructor(baseDir) {
    this.baseDir = baseDir;
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
  }

  saveFile(fileId, content) {
    const physicalPath = path.join(this.baseDir, fileId);
    fs.writeFileSync(physicalPath, content || '');
    return physicalPath;
  }

  readFile(fileId) {
    const physicalPath = path.join(this.baseDir, fileId);
    if (!fs.existsSync(physicalPath)) return null;
    return fs.readFileSync(physicalPath, 'utf8');
  }

  deleteFile(fileId) {
    const physicalPath = path.join(this.baseDir, fileId);
    if (fs.existsSync(physicalPath)) {
      fs.unlinkSync(physicalPath);
    }
  }
}

// Global scope vars
let db;
const storage = new StorageProvider(path.join(__dirname, 'cloud_data'));

// Serve static files of NexOS
app.use(express.static(__dirname, { index: 'index.html' }));

// Middleware to authenticate via JWT token
async function getUserRole(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.username;
    req.role = decoded.role;
    next();
  } catch(e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Middleware to restrict routes to Administrators only
function requireAdmin(req, res, next) {
  if (req.role !== 'Administrator') {
    return res.status(403).json({ error: 'Administrator access required' });
  }
  next();
}

// --- API ROUTES ---

// 1. Upload File
app.post('/api/cloud/upload', getUserRole, async (req, res) => {
  const { path: clientPath, content, size, modified, type } = req.body;
  if (!clientPath) return res.status(400).json({ error: 'Path is required' });

  try {
    // Server-side storage quota enforcement (5 GB per user)
    const fileSize = size || content?.length || 0;
    const usageRow = await db.get('SELECT COALESCE(SUM(size), 0) as totalUsed FROM metadata WHERE owner = ?', [req.user]);
    const currentUsage = usageRow.totalUsed || 0;
    if (currentUsage + fileSize > MAX_STORAGE_PER_USER) {
      return res.status(413).json({ error: 'Storage quota exceeded (5 GB limit)' });
    }

    const metaKey = `${req.user}:${clientPath}`;
    const fileId = Buffer.from(metaKey).toString('base64').replace(/=/g, '');
    
    storage.saveFile(fileId, content);

    const fileMeta = {
      id: metaKey,
      owner: req.user,
      path: clientPath,
      name: clientPath.split('/').pop(),
      type: type || 'file',
      size: fileSize,
      modified: modified || Date.now(),
      syncedAt: Date.now(),
      fileId: fileId
    };

    await db.run(`
      INSERT INTO metadata (id, owner, path, name, type, size, modified, syncedAt, fileId) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET 
        type=excluded.type, size=excluded.size, modified=excluded.modified, syncedAt=excluded.syncedAt, fileId=excluded.fileId
    `, [fileMeta.id, fileMeta.owner, fileMeta.path, fileMeta.name, fileMeta.type, fileMeta.size, fileMeta.modified, fileMeta.syncedAt, fileMeta.fileId]);

    io.emit('file_updated'); // Broadcast update to all clients
    res.json({ success: true, file: { ...fileMeta, synced: true } });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Download File
app.get('/api/cloud/download', getUserRole, async (req, res) => {
  let clientPath = req.query.path;
  if (!clientPath) return res.status(400).json({ error: 'Path is required' });

  let targetOwner = req.user;

  // Resolving shared path retrieval
  if (clientPath.startsWith('/shared/')) {
    const parts = clientPath.split('/'); 
    if (parts.length > 2) {
      const requestedOwner = parts[2];
      const actualPath = '/' + parts.slice(3).join('/'); 
      
      // Only Admins/Cloud Operators can see other users' files
      if (req.role === 'Administrator' || req.role === 'Cloud Operator') {
        targetOwner = requestedOwner;
        clientPath = actualPath;
      }
    }
  }

  const metaKey = `${targetOwner}:${clientPath}`;

  try {
    const fileMeta = await db.get('SELECT * FROM metadata WHERE id = ?', [metaKey]);

    if (!fileMeta) return res.status(404).json({ error: 'File not found' });

    const content = storage.readFile(fileMeta.fileId);
    if (content === null) {
      return res.status(404).json({ error: 'Physical file missing in storage' });
    }

    res.json({ success: true, content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Delete File
app.delete('/api/cloud/delete', getUserRole, async (req, res) => {
  let clientPath = req.query.path;
  if (!clientPath) return res.status(400).json({ error: 'Path is required' });

  let targetOwner = req.user;

  // Resolving admin shared path deletion
  if (clientPath.startsWith('/shared/') && (req.role === 'Administrator' || req.role === 'Cloud Operator')) {
    const parts = clientPath.split('/'); 
    if (parts.length > 2) {
      targetOwner = parts[2];
      clientPath = '/' + parts.slice(3).join('/'); 
    }
  }

  const metaKey = `${targetOwner}:${clientPath}`;

  try {
    const fileMeta = await db.get('SELECT * FROM metadata WHERE id = ?', [metaKey]);

    if (fileMeta) {
      storage.deleteFile(fileMeta.fileId);
      await db.run('DELETE FROM metadata WHERE id = ?', [metaKey]);
      io.emit('file_deleted'); // Broadcast update to all clients
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. List Files
app.get('/api/cloud/files', getUserRole, async (req, res) => {
  const prefix = req.query.prefix || '/';
  
  try {
    let files = [];
    
    // User's own files
    const userFiles = await db.all('SELECT * FROM metadata WHERE owner = ?', [req.user]);
    for (const f of userFiles) {
      if (f.path.startsWith(prefix)) {
        files.push({ ...f, synced: true });
      }
    }

    // Retrieving everyone's files prefixed via /shared/
    // Real Cloud Computing: standard users cannot see other users' files at all.
    if (req.role === 'Administrator' || req.role === 'Cloud Operator') {
      const allFiles = await db.all('SELECT * FROM metadata WHERE owner != ?', [req.user]);
      for (const f of allFiles) {
        const sharedPath = `/shared/${f.owner}${f.path}`;
        if (sharedPath.startsWith(prefix) || prefix.startsWith('/shared')) {
          files.push({ ...f, path: sharedPath, synced: true });
        }
      }
    }
    
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Execute Cloud Function (Serverless Engine)
app.post('/api/cloud/execute', getUserRole, async (req, res) => {
  const content = req.body.code;
  if (!content) return res.status(400).json({ error: 'Source code is required' });

  try {
    let logs = [];
    const sandboxConsole = {
      log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      error: (...args) => logs.push('[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      warn: (...args) => logs.push('[WARN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      info: (...args) => logs.push('[INFO] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '))
    };

    const sandbox = {
      console: sandboxConsole,
      setTimeout, Buffer,
      Math, JSON, Date, parseInt, parseFloat, isNaN
    };

    const context = vm.createContext(sandbox);
    
    try {
      vm.runInContext(content, context, { timeout: 2000 });
      res.json({ success: true, logs: logs.join('\\n') });
    } catch (execError) {
      res.json({ success: false, error: execError.toString(), logs: logs.join('\\n') });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- USER ROUTES ---

// 1. Login — returns JWT token on success (rate-limited only on failures)
app.post('/api/users/login', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const { username, password } = req.body;
  
  try {
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    const isValid = user && await bcrypt.compare(password, user.password);

    if (isValid) {
      // Success: Clear any existing rate-limits for this IP
      loginAttempts.delete(clientIp);
      
      const token = jwt.sign(
        { username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      return res.json({ success: true, role: user.role, token });
    } else {
      // Failure: Track the failed attempt
      const now = Date.now();
      let record = loginAttempts.get(clientIp);
      
      if (!record || now - record.firstAttempt > LOGIN_WINDOW_MS) {
        record = { count: 1, firstAttempt: now };
        loginAttempts.set(clientIp, record);
      } else {
        record.count++;
      }
      
      // Reject if they've exceeded the failure threshold
      if (record.count > MAX_LOGIN_ATTEMPTS) {
        return res.status(429).json({ success: false, error: 'Too many login attempts. Try again in 15 minutes.' });
      }

      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 2. List Users (protected — requires login)
app.get('/api/users/list', getUserRole, async (req, res) => {
  try {
    const users = await db.all('SELECT username, role FROM users');
    res.json({ success: true, users });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 3. Create User (protected — admin only)
app.post('/api/users/create', getUserRole, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, error: 'Username and password required' });
  try {
    const exist = await db.get('SELECT username FROM users WHERE username = ?', [username]);
    if (exist) return res.status(400).json({ success: false, error: 'User already exists' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, role || 'Standard User']);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 4. Delete User (protected — admin only)
app.delete('/api/users/delete', getUserRole, requireAdmin, async (req, res) => {
  const { username } = req.query;
  if (username === 'admin') return res.status(400).json({ success: false, error: 'Cannot delete admin' });
  try {
    const exist = await db.get('SELECT username FROM users WHERE username = ?', [username]);
    if (!exist) return res.status(404).json({ success: false, error: 'User not found' });
    
    await db.run('DELETE FROM users WHERE username = ?', [username]);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 5. Change Password (protected — admin only)
app.put('/api/users/password', getUserRole, requireAdmin, async (req, res) => {
  const { username, newPassword } = req.body;
  try {
    const exist = await db.get('SELECT username FROM users WHERE username = ?', [username]);
    if (!exist) return res.status(404).json({ success: false, error: 'User not found' });
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.run('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username]);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Start Server & Init DB
initDb().then(database => {
  db = database;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`NexOS Cloud Backend running at http://0.0.0.0:${PORT} with SQLite DB & WebSockets`);
  });
}).catch(err => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});
