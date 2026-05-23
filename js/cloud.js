/* ============================================
   NexOS — Cloud Computing Engine
   ============================================ */

'use strict';

WebOS.Cloud = (() => {
  const CLOUD_KEY    = 'nexos_cloud_v1';
  const SYNC_LOG_KEY = 'nexos_sync_log';
  const MAX_STORAGE  = 5 * 1024 * 1024 * 1024; // 5 GB simulated

  const REGIONS = [
    { id: 'us-east-1',    name: 'US East (N. Virginia)',    flag: '🇺🇸', latency: 12  },
    { id: 'eu-west-1',    name: 'EU West (Ireland)',         flag: '🇮🇪', latency: 35  },
    { id: 'ap-se-1',      name: 'Asia Pacific (Singapore)',  flag: '🇸🇬', latency: 58  },
    { id: 'ap-ne-1',      name: 'Asia Pacific (Tokyo)',      flag: '🇯🇵', latency: 72  },
    { id: 'sa-east-1',    name: 'South America (São Paulo)', flag: '🇧🇷', latency: 95  },
  ];

  const SERVERS = [
    { id: 'nexos-vm-01', name: 'nexos-vm-01', region: 'us-east-1', type: 'General Purpose', cores: 4, ram: '8 GB', status: 'online' },
    { id: 'nexos-vm-02', name: 'nexos-vm-02', region: 'eu-west-1', type: 'Compute Optimized', cores: 8, ram: '16 GB', status: 'online' },
    { id: 'nexos-db-01', name: 'nexos-db-01', region: 'us-east-1', type: 'Database',           cores: 2, ram: '4 GB',  status: 'online' },
    { id: 'nexos-s3-01', name: 'nexos-store', region: 'ap-se-1',  type: 'Object Storage',     cores: 1, ram: '2 GB',  status: 'online' },
  ];

  let state = {
    initialized: false,
    activeRegion: 'us-east-1',
    syncQueue: [],
    syncing: false,
    syncLog: [],
    cloudStorage: {},      // { path → { content, size, modified, synced } }
    usedStorage: 0,
    connectedServer: null,
    networkStats: { up: 0, down: 0, totalUp: 0, totalDown: 0 },
  };

  // Transfer log for real rate calculation
  const _transferLog = [];

  // ── Init ──
  function init() {
    _loadFromStorage();
    _fetchCloudStorage();
    _startSyncLoop();
    _startNetworkRateCalculation();
    
    // Connect to WebSockets for real-time cloud updates
    if (typeof io !== 'undefined') {
      const socket = io();
      socket.on('file_updated', () => _fetchCloudStorage());
      socket.on('file_deleted', () => _fetchCloudStorage());
      console.log('Cloud: Connected to Real-time Socket Server');
    }
    
    state.initialized = true;
  }

  // Helper to build auth headers with JWT token
  function _authHeaders() {
    const token = sessionStorage.getItem('nexos_token');
    return { 'Authorization': 'Bearer ' + token };
  }

  async function _fetchCloudStorage() {
    const user = sessionStorage.getItem('nexos_user');
    if (!user) return;
    try {
      const res = await fetch('/api/cloud/files?prefix=/', {
        headers: _authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        state.cloudStorage = {};
        for (const file of data.files) {
          state.cloudStorage[file.path] = file;

          // Perform automatic downward background sync
          if (!file.path.startsWith('/shared/')) {
            if (file.type === 'file') {
              const stat = await WebOS.FS.getStat(file.path);
              if (!stat || stat.modified < file.modified) {
                await downloadFile(file.path).catch(e => console.warn('Sync down error fetching', file.path, e));
              }
            } else if (file.type === 'dir') {
              const exist = await WebOS.FS.exists(file.path);
              if (!exist) {
                await WebOS.FS.createDir(file.path, true).catch(()=>{});
              }
            }
          }
        }
        state.usedStorage = _calcUsed();
        WebOS.Kernel.Events.emit('fs:change', { path: '/', type: 'sync' });
        WebOS.Kernel.Events.emit('cloud:metadataUpdated');
      }
    } catch(e) { console.error('Cloud: Failed to fetch cloud metadata', e); }
  }

  function _loadFromStorage() {
    try {
      const raw = localStorage.getItem(CLOUD_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        state.activeRegion = saved.region  || 'us-east-1';
        state.syncLog      = saved.syncLog || [];
      }
    } catch (e) { console.warn('Cloud: failed to load from storage', e); }
  }

  function _saveToStorage() {
    try {
      localStorage.setItem(CLOUD_KEY, JSON.stringify({
        region:  state.activeRegion,
        syncLog: state.syncLog.slice(-100), // Keep last 100 entries
      }));
    } catch(e) { console.warn('Cloud: failed to save', e); }
  }

  function _calcUsed() {
    return Object.values(state.cloudStorage).reduce((s, f) => s + (f.size || 0), 0);
  }

  // ── Sync Engine ──
  function queueSync(path) {
    if (!state.syncQueue.includes(path)) {
      state.syncQueue.push(path);
    }
    WebOS.Kernel.Events.emit('cloud:syncQueue', { count: state.syncQueue.length });
    _updateTrayStatus('pending');
  }

  function _startSyncLoop() {
    setInterval(async () => {
      if (state.syncing || state.syncQueue.length === 0) return;
      await _processSyncQueue();
    }, 3000);
  }

  async function _processSyncQueue() {
    if (state.syncing || state.syncQueue.length === 0) return;
    state.syncing = true;
    _updateTrayStatus('syncing');

    const items = [...state.syncQueue];
    state.syncQueue = [];

    for (const path of items) {
      await _syncFile(path);
    }

    state.syncing = false;
    _updateTrayStatus('synced');
    _saveToStorage();
    WebOS.Kernel.Events.emit('cloud:synced', { count: items.length });
  }

  async function _syncFile(path) {
    // Simulate network latency
    const region  = REGIONS.find(r => r.id === state.activeRegion);
    const latency = (region?.latency || 30) + Math.random() * 20;
    await _sleep(latency);

    try {
      const node = await WebOS.FS.getStat(path);
      if (!node) return;

      const size = node.size || 0;

      const res = await fetch('/api/cloud/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ..._authHeaders() },
        body: JSON.stringify({ path, content: node.content || '', size, modified: node.modified, type: node.type })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to upload from sync');

      state.cloudStorage[path] = data.file;
      state.usedStorage = _calcUsed();

      state.networkStats.up        += size;
      state.networkStats.totalUp   += size;
      _recordTransfer(size, 'up');

      // Mark as synced in FS
      if (node.type === 'file') {
        await WebOS.FS.markSynced(path).catch(() => {});
      }
      
      _addSyncLog({ path, action: 'upload', status: 'success' });
      WebOS.Kernel.Events.emit('cloud:fileSynced', { path, status: 'synced' });

    } catch(e) {
      _addSyncLog({ path, action: 'upload', status: 'error', error: e.message });
      WebOS.Kernel.Events.emit('cloud:fileSynced', { path, status: 'error' });
    }
  }

  function _addSyncLog(entry) {
    state.syncLog.unshift({ ...entry, timestamp: Date.now() });
    if (state.syncLog.length > 200) state.syncLog.pop();
  }

  // ── Cloud File Operations ──
  async function uploadFile(path, content) {
    const size = new Blob([content]).size;
    if (state.usedStorage + size > MAX_STORAGE) {
      throw new Error('Cloud storage limit reached');
    }
    
    const res = await fetch('/api/cloud/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ..._authHeaders() },
      body: JSON.stringify({ path, content, size, modified: Date.now(), type: 'file' })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to upload');

    state.cloudStorage[path] = data.file;
    state.usedStorage = _calcUsed();
    state.networkStats.up += size;
    state.networkStats.totalUp += size;
    _recordTransfer(size, 'up');
    _addSyncLog({ path, action: 'manual upload', size, status: 'success' });
    WebOS.Kernel.Events.emit('cloud:fileSynced', { path, status: 'synced' });
  }

  async function downloadFile(path) {
    const file = state.cloudStorage[path];
    if (!file) throw new Error(`File not in cloud: ${path}`);
    const size = file.size || 0;
    state.networkStats.down += size;
    state.networkStats.totalDown += size;
    _recordTransfer(size, 'down');
    
    const res = await fetch(`/api/cloud/download?path=${encodeURIComponent(path)}`, {
      headers: _authHeaders()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to download');

    const parts = path.split('/');
    let cur = '';
    for (let i = 1; i < parts.length - 1; i++) {
      cur += '/' + parts[i];
      if (!(await WebOS.FS.exists(cur))) await WebOS.FS.createDir(cur, true).catch(()=>{});
    }
    await WebOS.FS.writeFile(path, data.content, true);

    _addSyncLog({ path, action: 'download', size, status: 'success' });
    return data.content;
  }

  async function executeScript(code) {
    const res = await fetch('/api/cloud/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ..._authHeaders() },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Execution failed\\n\\nLogs:\\n' + (data.logs||''));
    return data;
  }

  async function deleteCloudFile(path) {
    try {
      await fetch(`/api/cloud/delete?path=${encodeURIComponent(path)}`, { 
        method: 'DELETE',
        headers: _authHeaders()
      });
      delete state.cloudStorage[path];
      state.usedStorage = _calcUsed();
      _addSyncLog({ path, action: 'delete', status: 'success' });
      WebOS.Kernel.Events.emit('cloud:fileDeleted', { path });
    } catch(e) {
      console.error(e);
      _addSyncLog({ path, action: 'delete', status: 'error' });
    }
  }

  function listCloudFiles(prefix = '/') {
    return Object.values(state.cloudStorage)
      .filter(f => f.path.startsWith(prefix))
      .sort((a, b) => b.modified - a.modified);
  }

  // ── Real Network Rate Tracking ──
  function _recordTransfer(bytes, direction) {
    _transferLog.push({ timestamp: Date.now(), bytes, direction });
    // Keep only last 30 seconds
    const cutoff = Date.now() - 30000;
    while (_transferLog.length > 0 && _transferLog[0].timestamp < cutoff) {
      _transferLog.shift();
    }
  }

  function _startNetworkRateCalculation() {
    setInterval(() => {
      const now = Date.now();
      const windowMs = 5000; // 5-second sliding window
      const cutoff = now - windowMs;

      let upBytes = 0, downBytes = 0;
      for (const entry of _transferLog) {
        if (entry.timestamp >= cutoff) {
          if (entry.direction === 'up') upBytes += entry.bytes;
          else downBytes += entry.bytes;
        }
      }

      // Bytes per second
      state.networkStats.up = Math.round(upBytes / (windowMs / 1000));
      state.networkStats.down = Math.round(downBytes / (windowMs / 1000));

      WebOS.Kernel.Events.emit('cloud:networkStats', { ...state.networkStats });
    }, 2000);
  }

  // ── Cloud Shell (simulated SSH) ──
  const shellCommands = {
    'help': () => `Available cloud commands:\n  cloud ls [path]     — list cloud files\n  cloud df            — disk usage\n  cloud sync          — force sync\n  cloud region        — show active region\n  cloud servers       — list VM instances\n  cloud logs          — sync logs\n  cloud ping          — test connectivity`,

    'ls': async (args) => {
      const prefix = args[0] || '/';
      const files = listCloudFiles(prefix);
      if (files.length === 0) return 'No files found.';
      return files.map(f => `${f.type === 'dir' ? 'DIR ' : 'FILE'} ${f.path.padEnd(40)} ${WebOS.FS.formatSize(f.size)}`).join('\n');
    },

    'df': () => {
      const used = WebOS.FS.formatSize(state.usedStorage);
      const max  = '5 GB';
      const pct  = ((state.usedStorage / MAX_STORAGE) * 100).toFixed(2);
      return `Cloud Storage:\n  Used:      ${used}\n  Total:     ${max}\n  Available: ${WebOS.FS.formatSize(MAX_STORAGE - state.usedStorage)}\n  Usage:     ${pct}%`;
    },

    'sync': async () => {
      const files = await WebOS.FS.getAllFiles();
      files.filter(f => f.type === 'file').forEach(f => queueSync(f.path));
      return `Queued ${files.filter(f => f.type === 'file').length} files for sync.`;
    },

    'region': () => {
      const r = REGIONS.find(x => x.id === state.activeRegion);
      return `Active region: ${r?.flag} ${r?.name} (${r?.id})\nLatency: ~${r?.latency}ms`;
    },

    'servers': () => {
      return SERVERS.map(s =>
        `${s.status === 'online' ? '● ' : '○ '} ${s.id.padEnd(16)} ${s.type.padEnd(20)} ${s.region}  ${s.cores} vCPU / ${s.ram}`
      ).join('\n');
    },

    'logs': () => {
      if (state.syncLog.length === 0) return 'No sync logs yet.';
      return state.syncLog.slice(0, 20).map(l => {
        const time = new Date(l.timestamp).toLocaleTimeString();
        return `[${time}] ${l.status.toUpperCase().padEnd(7)} ${l.action.padEnd(14)} ${l.path}`;
      }).join('\n');
    },

    'ping': async () => {
      const r = REGIONS.find(x => x.id === state.activeRegion);
      await _sleep((r?.latency || 30) + Math.random() * 10);
      return `PING nexos-cloud-${state.activeRegion} — ${r?.latency}ms ttl=64`;
    },
  };

  async function runShellCommand(input) {
    const parts  = input.trim().split(/\s+/);
    const prefix = parts[0];
    const sub    = parts[1] || 'help';
    const args   = parts.slice(2);

    if (prefix !== 'cloud') return null; // Not a cloud command

    const fn = shellCommands[sub];
    if (!fn) return `cloud: unknown command '${sub}'. Try 'cloud help'.`;

    try {
      const result = await fn(args);
      return result;
    } catch(e) {
      return `Error: ${e.message}`;
    }
  }

  // ── Tray Status ──
  function _updateTrayStatus(status) {
    const el = document.getElementById('tray-cloud');
    const tx = document.getElementById('tray-cloud-text');
    if (!el || !tx) return;
    el.className = `tray-item cloud-sync-indicator ${status}`;
    tx.textContent = status === 'syncing' ? 'Syncing...' : status === 'pending' ? 'Pending' : status === 'error' ? 'Error' : 'Synced';
    WebOS.Kernel.Events.emit('cloud:status', { status });
  }

  // ── Region ──
  function setRegion(id) {
    const r = REGIONS.find(x => x.id === id);
    if (!r) throw new Error(`Unknown region: ${id}`);
    state.activeRegion = id;
    _saveToStorage();
    WebOS.Kernel.Events.emit('cloud:regionChanged', { region: r });
    Notify({ title: 'Cloud Region Changed', message: `Now connected to ${r.flag} ${r.name}`, type: 'info', icon: '🌐' });
  }

  // ── Versioning & Sharing API ──
  async function getVersions(path) {
    const res = await fetch(`/api/cloud/versions?path=${encodeURIComponent(path)}`, { headers: _authHeaders() });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.versions;
  }

  async function restoreVersion(path, version) {
    const res = await fetch('/api/cloud/restore', {
      method: 'POST',
      headers: { ..._authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, version })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    // Force a re-fetch of metadata
    await _fetchCloudStorage();
    return data;
  }

  async function shareFile(path, shareWith) {
    const res = await fetch('/api/cloud/share', {
      method: 'POST',
      headers: { ..._authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, shareWith })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data;
  }

  function getRegion()    { return REGIONS.find(r => r.id === state.activeRegion) || REGIONS[0]; }
  function getRegions()   { return REGIONS; }
  function getServers()   { return SERVERS; }
  function getUsedStorage(){ return state.usedStorage; }
  function getMaxStorage(){ return MAX_STORAGE; }
  function getSyncLog()   { return [...state.syncLog]; }
  function getNetworkStats() { return { ...state.networkStats }; }

  async function forceSync() {
    await _fetchCloudStorage();
    return _processSyncQueue();
  }

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  return {
    init, queueSync, forceSync,
    uploadFile, downloadFile, deleteCloudFile, listCloudFiles, executeScript,
    getVersions, restoreVersion, shareFile,
    runShellCommand,
    setRegion, getRegion, getRegions, getServers,
    getUsedStorage, getMaxStorage, getSyncLog, getNetworkStats,
    get syncQueue() { return state.syncQueue; },
    get isSyncing() { return state.syncing; },
  };
})();
