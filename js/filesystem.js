/* ============================================
   NexOS — Virtual Filesystem (IndexedDB)
   ============================================ */

'use strict';

WebOS.FS = (() => {
  const DB_VERSION = 1;
  const STORE_NAME = 'filesystem';

  let db = null;

  function getDbName() {
    const user = sessionStorage.getItem('nexos_user') || 'default';
    return 'NexOS_FS_' + user;
  }

  // ── Init / Open DB ──
  async function init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(getDbName(), DB_VERSION);

      req.onerror   = () => reject(req.error);
      req.onsuccess = () => { db = req.result; resolve(); };

      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_NAME)) {
          const store = d.createObjectStore(STORE_NAME, { keyPath: 'path' });
          store.createIndex('parent', 'parent', { unique: false });
          store.createIndex('type',   'type',   { unique: false });
        }
      };
    }).then(async () => {
      await _ensureDefaultStructure();
    });
  }

  // ── Default folder structure ──
  async function _ensureDefaultStructure() {
    const defaults = [
      { path: '/',           type: 'dir', name: 'root',        parent: null,     created: Date.now(), modified: Date.now() },
      { path: '/home',       type: 'dir', name: 'home',        parent: '/',      created: Date.now(), modified: Date.now() },
      { path: '/documents',  type: 'dir', name: 'documents',   parent: '/',      created: Date.now(), modified: Date.now() },
      { path: '/pictures',   type: 'dir', name: 'pictures',    parent: '/',      created: Date.now(), modified: Date.now() },
      { path: '/downloads',  type: 'dir', name: 'downloads',   parent: '/',      created: Date.now(), modified: Date.now() },
      { path: '/cloud',      type: 'dir', name: 'cloud',       parent: '/',      created: Date.now(), modified: Date.now() },
      { path: '/cloud/backup', type: 'dir', name: 'backup',    parent: '/cloud', created: Date.now(), modified: Date.now() },
      { path: '/trash',      type: 'dir', name: 'trash',       parent: '/',      created: Date.now(), modified: Date.now() },
      {
        path: '/documents/readme.txt', type: 'file', name: 'readme.txt', parent: '/documents',
        content: '# Welcome to NexOS\n\nThis is your cloud-powered Web Operating System.\n\nFeatures:\n- Virtual filesystem\n- Cloud sync\n- Terminal\n- Text Editor\n- And much more!\n\nEnjoy! 🚀',
        size: 150, created: Date.now(), modified: Date.now(), synced: true, mimeType: 'text/plain'
      },
      {
        path: '/documents/notes.md', type: 'file', name: 'notes.md', parent: '/documents',
        content: '# My Notes\n\n## Ideas\n- Build something amazing\n- Learn cloud computing\n- Explore NexOS\n\n## Todo\n- [ ] Set up cloud sync\n- [ ] Create project files\n- [ ] Explore the terminal',
        size: 140, created: Date.now(), modified: Date.now(), synced: true, mimeType: 'text/markdown'
      },
      {
        path: '/documents/config.json', type: 'file', name: 'config.json', parent: '/documents',
        content: '{\n  "os": "NexOS",\n  "version": "2.4.1",\n  "cloud": {\n    "region": "us-east-1",\n    "autoSync": true,\n    "syncInterval": 30\n  },\n  "user": {\n    "name": "admin",\n    "theme": "dark"\n  }\n}',
        size: 200, created: Date.now(), modified: Date.now(), synced: true, mimeType: 'application/json'
      },
      {
        path: '/home/welcome.txt', type: 'file', name: 'welcome.txt', parent: '/home',
        content: 'Welcome to your NexOS home directory!\n\nThis folder is your personal space. All files here are automatically synced to the cloud.\n\nCreated: ' + new Date().toLocaleDateString(),
        size: 180, created: Date.now(), modified: Date.now(), synced: true, mimeType: 'text/plain'
      },
    ];

    for (const node of defaults) {
      const existing = await _get(node.path).catch(() => null);
      if (!existing) {
        await _put(node);
      }
    }
  }

  // ── Low-level DB ops ──
  function _transaction(mode) {
    return db.transaction([STORE_NAME], mode).objectStore(STORE_NAME);
  }

  function _put(obj) {
    return new Promise((res, rej) => {
      const req = _transaction('readwrite').put(obj);
      req.onsuccess = () => res(obj);
      req.onerror   = () => rej(req.error);
    });
  }

  function _get(path) {
    return new Promise((res, rej) => {
      const req = _transaction('readonly').get(path);
      req.onsuccess = () => res(req.result || null);
      req.onerror   = () => rej(req.error);
    });
  }

  function _delete(path) {
    return new Promise((res, rej) => {
      const req = _transaction('readwrite').delete(path);
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
    });
  }

  function _getByIndex(indexName, value) {
    return new Promise((res, rej) => {
      const store = _transaction('readonly');
      const idx   = store.index(indexName);
      const req   = idx.getAll(value);
      req.onsuccess = () => res(req.result || []);
      req.onerror   = () => rej(req.error);
    });
  }

  // ── Public API ──

  async function listDir(path) {
    const normalized = normalizePath(path);
    const items = await _getByIndex('parent', normalized);
    return items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async function readFile(path) {
    const node = await _get(normalizePath(path));
    if (!node || node.type !== 'file') throw new Error(`Not a file: ${path}`);
    return node.content || '';
  }

  async function writeFile(path, content, skipSync = false) {
    const name = path.substring(path.lastIndexOf('/') + 1);
    const parent = path.substring(0, path.lastIndexOf('/')) || '/';
    const normalized = normalizePath(path);

    if (parent !== '/') {
      const pNode = await _get(parent);
      if (!pNode || pNode.type !== 'dir') throw new Error(`Parent directory ${parent} does not exist.`);
    }

    const existing = await _get(normalized);
    if (existing && existing.type === 'dir') throw new Error(`Cannot write file: ${path} is a directory.`);

    const size = new Blob([content]).size;
    const node = {
      path: normalized, type: 'file', name, parent,
      content, size, modified: Date.now(), synced: skipSync,
      created: existing ? existing.created : Date.now(),
      mimeType: getMimeType(name),
    };
    await _put(node);
    if (!skipSync && window.WebOS?.Cloud) WebOS.Cloud.queueSync(normalized);
    WebOS.Kernel.Events.emit('fs:change', { path: normalized, type: 'write' });
    return node;
  }

  async function createDir(path, skipSync = false) {
    const name = path.substring(path.lastIndexOf('/') + 1);
    const parent = path.substring(0, path.lastIndexOf('/')) || '/';
    const normalized = normalizePath(path);

    if (await _get(normalized)) throw new Error(`Directory ${path} already exists`);

    if (parent !== '/') {
      const pNode = await _get(parent);
      if (!pNode || pNode.type !== 'dir') throw new Error(`Parent directory ${parent} does not exist.`);
    }

    const node = {
      path: normalized, type: 'dir', name, parent,
      modified: Date.now(), created: Date.now(), synced: skipSync
    };
    await _put(node);
    if (!skipSync && window.WebOS?.Cloud) WebOS.Cloud.queueSync(normalized);
    WebOS.Kernel.Events.emit('fs:change', { path: normalized, type: 'createDir' });
    return node;
  }

  async function deleteEntry(path) {
    const normalized = normalizePath(path);
    const node = await _get(normalized);
    if (!node) throw new Error(`Not found: ${path}`);

    if (node.type === 'dir') {
      const children = await listDir(normalized);
      for (const child of children) {
        await deleteEntry(child.path);
      }
    }
    await _delete(normalized);
    WebOS.Kernel.Events.emit('fs:change', { path: normalized, type: 'delete' });
  }

  async function renameEntry(oldPath, newName) {
    const oldNorm = normalizePath(oldPath);
    const node    = await _get(oldNorm);
    if (!node) throw new Error(`Not found: ${oldPath}`);

    const parent  = node.parent;
    const newPath = (parent === '/' ? '' : parent) + '/' + newName;

    const newNode = { ...node, path: newPath, name: newName, modified: Date.now(), synced: false };
    await _put(newNode);
    await _delete(oldNorm);

    if (node.type === 'dir') {
      const children = await listDir(oldNorm);
      for (const child of children) {
        const childNewPath = newPath + child.path.substring(oldNorm.length);
        await _put({ ...child, path: childNewPath, parent: newPath, modified: Date.now() });
        await _delete(child.path);
      }
    }

    WebOS.Kernel.Events.emit('fs:change', { oldPath: oldNorm, path: newPath, type: 'rename' });
    return newNode;
  }

  async function copyEntry(srcPath, destDir) {
    const srcNorm  = normalizePath(srcPath);
    const destNorm = normalizePath(destDir);
    const node     = await _get(srcNorm);
    if (!node) throw new Error(`Not found: ${srcPath}`);

    const destParent = await _get(destNorm);
    if (!destParent || destParent.type !== 'dir') throw new Error(`Destination is not a directory: ${destDir}`);

    // Resolve final name (handle duplicates)
    let finalName = node.name;
    let finalPath = (destNorm === '/' ? '' : destNorm) + '/' + finalName;
    while (await _get(finalPath)) {
      if (node.type === 'file') {
        const dotIdx = finalName.lastIndexOf('.');
        if (dotIdx > 0) {
          finalName = finalName.substring(0, dotIdx) + ' (copy)' + finalName.substring(dotIdx);
        } else {
          finalName += ' (copy)';
        }
      } else {
        finalName += ' (copy)';
      }
      finalPath = (destNorm === '/' ? '' : destNorm) + '/' + finalName;
    }

    if (node.type === 'file') {
      const newNode = {
        ...node,
        path: finalPath,
        name: finalName,
        parent: destNorm,
        created: Date.now(),
        modified: Date.now(),
        synced: false,
      };
      await _put(newNode);
    } else {
      // Create directory
      await _put({
        path: finalPath,
        type: 'dir',
        name: finalName,
        parent: destNorm,
        created: Date.now(),
        modified: Date.now(),
        synced: false,
      });
      // Recursively copy children
      const children = await listDir(srcNorm);
      for (const child of children) {
        await copyEntry(child.path, finalPath);
      }
    }

    WebOS.Kernel.Events.emit('fs:change', { path: finalPath, type: 'copy' });
    return finalPath;
  }

  async function moveEntry(srcPath, destDir) {
    const finalPath = await copyEntry(srcPath, destDir);
    await deleteEntry(srcPath);
    WebOS.Kernel.Events.emit('fs:change', { path: finalPath, type: 'move' });
    return finalPath;
  }

  async function exists(path) {
    const node = await _get(normalizePath(path));
    return !!node;
  }

  async function getStat(path) {
    return _get(normalizePath(path));
  }

  async function getAllFiles() {
    return new Promise((res, rej) => {
      const req = _transaction('readonly').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror   = () => rej(req.error);
    });
  }

  async function getTotalSize() {
    const all = await getAllFiles();
    return all.reduce((sum, f) => sum + (f.size || 0), 0);
  }

  async function markSynced(path) {
    const normalized = normalizePath(path);
    const node = await _get(normalized);
    if (!node) return;
    node.synced = true;
    node.syncedAt = Date.now();
    await _put(node);
  }

  // ── Helpers ──
  function normalizePath(p) {
    if (!p || p === '/') return '/';
    p = p.replace(/\/+/g, '/');
    if (p.endsWith('/') && p.length > 1) p = p.slice(0, -1);
    if (!p.startsWith('/')) p = '/' + p;
    return p;
  }

  function getMimeType(name) {
    const ext = name.split('.').pop().toLowerCase();
    const types = {
      txt: 'text/plain', md: 'text/markdown', html: 'text/html',
      css: 'text/css', js: 'application/javascript', json: 'application/json',
      png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml',
      pdf: 'application/pdf', zip: 'application/zip',
    };
    return types[ext] || 'application/octet-stream';
  }

  function getFileIcon(name, type) {
    if (type === 'dir') return '📁';
    const ext = name.split('.').pop().toLowerCase();
    const icons = {
      txt: '📄', md: '📝', html: '🌐', css: '🎨', js: '⚙️',
      json: '📋', png: '🖼️', jpg: '🖼️', gif: '🖼️', svg: '🖼️',
      pdf: '📕', zip: '🗜️', mp3: '🎵', mp4: '🎬', py: '🐍',
    };
    return icons[ext] || '📄';
  }

  function formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return { init, listDir, readFile, writeFile, createDir, deleteEntry, renameEntry, copyEntry, moveEntry, exists, getStat, getAllFiles, getTotalSize, markSynced, normalizePath, getMimeType, getFileIcon, formatSize, formatDate };
})();
