const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Cloud data directory
const CLOUD_DATA_DIR = path.join(__dirname, 'cloud_data');
if (!fs.existsSync(CLOUD_DATA_DIR)) {
  fs.mkdirSync(CLOUD_DATA_DIR, { recursive: true });
}

// Ensure metadata file exists
const METADATA_FILE = path.join(CLOUD_DATA_DIR, 'metadata.json');
if (!fs.existsSync(METADATA_FILE)) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify({}));
}

// Ensure users file exists
const USERS_FILE = path.join(CLOUD_DATA_DIR, 'users.json');
const DEFAULT_USERS = {
  admin: { password: 'nexos', role: 'Administrator' },
  user: { password: 'password', role: 'Standard User' },
  cloud: { password: 'cloud123', role: 'Cloud Operator' }
};
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(DEFAULT_USERS, null, 2));
}

// Serve static files of NexOS
app.use(express.static(__dirname, { index: 'index.html' }));

// Middleware to get user context
function getUserRole(req, res, next) {
  const username = req.headers['x-user'];
  if (!username) return res.status(401).json({ error: 'x-user header required' });
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (!users[username]) return res.status(401).json({ error: 'invalid user' });
    req.user = username;
    req.role = users[username].role;
    next();
  } catch(e) {
    res.status(500).json({ error: 'auth verification error' });
  }
}

// --- API ROUTES ---

// 1. Upload File
app.post('/api/cloud/upload', getUserRole, (req, res) => {
  const { path: clientPath, content, size, modified, type } = req.body;
  if (!clientPath) return res.status(400).json({ error: 'Path is required' });

  try {
    const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    
    // Support admins creating files in shared spaces? Actually just prevent it or handle standard.
    // Simplifying: files always go to the uploader's namespace
    const metaKey = `${req.user}:${clientPath}`;
    const fileId = Buffer.from(metaKey).toString('base64').replace(/=/g, '');
    const physicalPath = path.join(CLOUD_DATA_DIR, fileId);
    
    fs.writeFileSync(physicalPath, content || '');

    metadata[metaKey] = {
      owner: req.user,
      path: clientPath,
      name: clientPath.split('/').pop(),
      type: type || 'file',
      size: size || content?.length || 0,
      modified: modified || Date.now(),
      synced: true,
      syncedAt: Date.now(),
      fileId
    };

    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));

    res.json({ success: true, file: metadata[metaKey] });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Download File
app.get('/api/cloud/download', getUserRole, (req, res) => {
  let clientPath = req.query.path;
  if (!clientPath) return res.status(400).json({ error: 'Path is required' });

  let targetOwner = req.user;

  // Resolving admin shared path retrieval
  if (clientPath.startsWith('/shared/') && (req.role === 'Administrator' || req.role === 'Cloud Operator')) {
    const parts = clientPath.split('/'); 
    if (parts.length > 2) {
      targetOwner = parts[2];
      clientPath = '/' + parts.slice(3).join('/'); 
    }
  }

  const metaKey = `${targetOwner}:${clientPath}`;

  try {
    const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    const fileMeta = metadata[metaKey];

    if (!fileMeta) return res.status(404).json({ error: 'File not found' });

    const physicalPath = path.join(CLOUD_DATA_DIR, fileMeta.fileId);
    if (!fs.existsSync(physicalPath)) {
      return res.status(404).json({ error: 'Physical file missing' });
    }

    const content = fs.readFileSync(physicalPath, 'utf8');
    res.json({ success: true, content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Delete File
app.delete('/api/cloud/delete', getUserRole, (req, res) => {
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
    const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    const fileMeta = metadata[metaKey];

    if (fileMeta) {
      const physicalPath = path.join(CLOUD_DATA_DIR, fileMeta.fileId);
      if (fs.existsSync(physicalPath)) {
        fs.unlinkSync(physicalPath);
      }
      delete metadata[metaKey];
      fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. List Files
app.get('/api/cloud/files', getUserRole, (req, res) => {
  const prefix = req.query.prefix || '/';
  
  try {
    const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    const files = [];

    for (const key in metadata) {
      const file = metadata[key];
      // User's own files
      if (file.owner === req.user) {
        if (file.path.startsWith(prefix)) {
          files.push(file);
        }
      } 
      // Admins retrieving everyone's files prefixed via /shared/
      else if (req.role === 'Administrator' || req.role === 'Cloud Operator') {
        const sharedPath = `/shared/${file.owner}${file.path}`;
        if (sharedPath.startsWith(prefix) || prefix.startsWith('/shared')) {
          files.push({ ...file, path: sharedPath });
        }
      }
    }
    
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- USER ROUTES ---

// 1. Login
app.post('/api/users/login', (req, res) => {
  const { username, password } = req.body;
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (users[username] && users[username].password === password) {
      res.json({ success: true, role: users[username].role });
    } else {
      res.status(401).json({ success: false, error: 'Invalid username or password' });
    }
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 2. List Users
app.get('/api/users/list', (req, res) => {
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const list = Object.keys(users).map(u => ({ username: u, role: users[u].role }));
    res.json({ success: true, users: list });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 3. Create User
app.post('/api/users/create', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, error: 'Username and password required' });
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (users[username]) return res.status(400).json({ success: false, error: 'User already exists' });
    users[username] = { password, role: role || 'Standard User' };
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 4. Delete User
app.delete('/api/users/delete', (req, res) => {
  const { username } = req.query;
  if (username === 'admin') return res.status(400).json({ success: false, error: 'Cannot delete admin' });
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (!users[username]) return res.status(404).json({ success: false, error: 'User not found' });
    delete users[username];
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 5. Change Password
app.put('/api/users/password', (req, res) => {
  const { username, newPassword } = req.body;
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (!users[username]) return res.status(404).json({ success: false, error: 'User not found' });
    users[username].password = newPassword;
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`NexOS Cloud Backend running at http://0.0.0.0:${PORT}`);
});
