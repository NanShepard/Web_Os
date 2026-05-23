/* ============================================
   NexOS — Kernel (Core OS)
   ============================================ */

'use strict';

window.WebOS = window.WebOS || {};

WebOS.Kernel = (() => {
  // ── State ──
  const state = {
    user: null,
    startTime: Date.now(),
    version: '2.4.1',
    booted: false,
    activeWindows: new Map(),
    processes: [],
  };

  // ── Real Metrics State ──
  const _metrics = {
    clientCpu: 0, clientMem: 0, clientMemMB: 0, clientMemTotalMB: 0,
    serverCpu: 0, serverMem: 0, serverMemUsedMB: 0, serverMemTotalMB: 0,
    serverProcessMB: 0, serverUptime: 0, serverCores: 0,
    serverHostname: '', serverCpuModel: '', serverPlatform: '',
  };
  let _loopLast = performance.now();
  const _loopDelays = [];

  // ── Event Bus ──
  const _listeners = {};
  const Events = {
    on(event, cb) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(cb);
      return () => Events.off(event, cb);
    },
    off(event, cb) {
      if (_listeners[event]) _listeners[event] = _listeners[event].filter(f => f !== cb);
    },
    emit(event, data) {
      (_listeners[event] || []).forEach(cb => { try { cb(data); } catch(e) { console.error(e); } });
    }
  };

  // ── App Registry ──
  const apps = {};
  const AppRegistry = {
    register(manifest) {
      apps[manifest.id] = manifest;
    },
    getAll() { return Object.values(apps); },
    get(id)  { return apps[id]; },
    launch(id, params) {
      const app = apps[id];
      if (!app) { console.warn(`App not found: ${id}`); return; }
      app.launch(params);
      state.processes.push({ id, name: app.name, pid: Date.now(), startTime: Date.now() });
      Events.emit('process:start', { id, name: app.name });
    }
  };

  // ── Process Manager ──
  const ProcessManager = {
    getAll()     { return [...state.processes]; },
    kill(pid)    {
      const idx = state.processes.findIndex(p => p.pid === pid);
      if (idx !== -1) {
        const p = state.processes.splice(idx, 1)[0];
        Events.emit('process:kill', p);
      }
    },
    getUptime()  { return Math.floor((Date.now() - state.startTime) / 1000); },
    getMemUsage(){ return _metrics.clientMem || 0; },
    getCpuUsage(){ return _metrics.clientCpu || 0; },
    getServerCpu(){ return _metrics.serverCpu || 0; },
    getServerMem(){ return _metrics.serverMem || 0; },
  };

  // ── Notifications ──
  const Notifications = {
    show({ title, message, type = 'info', icon, duration = 5000 }) {
      const center = document.getElementById('notification-center');
      if (!center) return;

      const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌', cloud: '☁️' };
      const el = document.createElement('div');
      el.className = `notification ${type}`;
      el.innerHTML = `
        <div class="notif-icon">${icon || icons[type] || 'ℹ️'}</div>
        <div class="notif-content">
          <div class="notif-title">${title}</div>
          <div class="notif-message">${message}</div>
          <div class="notif-time">Just now</div>
        </div>
      `;

      center.appendChild(el);
      el.addEventListener('click', () => removeNotif(el));

      if (duration > 0) setTimeout(() => removeNotif(el), duration);
    }
  };

  function removeNotif(el) {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  }

  // ── System Dialog ──
  const Dialog = {
    prompt({ title, message, placeholder = '', defaultValue = '', onConfirm, onCancel }) {
      const overlay = document.createElement('div');
      overlay.className = 'os-dialog-overlay';
      overlay.innerHTML = `
        <div class="os-dialog">
          <div class="os-dialog-title">${title}</div>
          ${message ? `<div class="os-dialog-body">${message}</div>` : ''}
          <input class="os-dialog-input" placeholder="${placeholder}" value="${defaultValue}" type="text">
          <div class="os-dialog-actions">
            <button class="os-dialog-btn" id="dlg-cancel">Cancel</button>
            <button class="os-dialog-btn primary" id="dlg-ok">OK</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      const input = overlay.querySelector('.os-dialog-input');
      input.focus(); input.select();

      function close(result) {
        overlay.remove();
        if (result !== null && onConfirm) onConfirm(result);
        else if (result === null && onCancel) onCancel();
      }

      overlay.querySelector('#dlg-ok').onclick = () => close(input.value);
      overlay.querySelector('#dlg-cancel').onclick = () => close(null);
      overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') close(input.value);
        if (e.key === 'Escape') close(null);
      });
    },

    confirm({ title, message, onConfirm, onCancel, dangerous = false }) {
      const overlay = document.createElement('div');
      overlay.className = 'os-dialog-overlay';
      overlay.innerHTML = `
        <div class="os-dialog">
          <div class="os-dialog-title">${title}</div>
          <div class="os-dialog-body">${message}</div>
          <div class="os-dialog-actions">
            <button class="os-dialog-btn" id="dlg-cancel">Cancel</button>
            <button class="os-dialog-btn ${dangerous ? 'danger' : 'primary'}" id="dlg-ok">${dangerous ? 'Delete' : 'Confirm'}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector('#dlg-ok').onclick = () => { overlay.remove(); if (onConfirm) onConfirm(); };
      overlay.querySelector('#dlg-cancel').onclick = () => { overlay.remove(); if (onCancel) onCancel(); };
    },

    alert({ title, message }) {
      const overlay = document.createElement('div');
      overlay.className = 'os-dialog-overlay';
      overlay.innerHTML = `
        <div class="os-dialog">
          <div class="os-dialog-title">${title}</div>
          <div class="os-dialog-body">${message}</div>
          <div class="os-dialog-actions">
            <button class="os-dialog-btn primary" id="dlg-ok">OK</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector('#dlg-ok').onclick = () => overlay.remove();
    }
  };

  // ── Boot sequence ──
  async function boot() {
    state.user = sessionStorage.getItem('nexos_user') || 'admin';
    state.booted = false;

    // Initialize subsystems in order
    await WebOS.FS.init();
    WebOS.Cloud.init();
    WebOS.WindowManager.init();
    WebOS.Taskbar.init();
    WebOS.Desktop.init();

    state.booted = true;
    Events.emit('os:ready', { user: state.user });

    // Start real metrics collection
    _startMetricsCollection();

    // Start JWT token expiry watcher
    _startTokenWatcher();

    // Welcome notification
    setTimeout(() => {
      Notifications.show({
        title: 'Welcome to NexOS',
        message: `Logged in as ${state.user}. Cloud sync is active.`,
        type: 'success',
        icon: '🖥️',
        duration: 4000
      });
    }, 800);

    // Cloud connected notification
    setTimeout(() => {
      Notifications.show({
        title: 'Cloud Connected',
        message: 'NexOS Cloud infrastructure is online. All files will be synced automatically.',
        type: 'info',
        icon: '☁️',
        duration: 5000
      });
    }, 2200);
  }

  // ── Power ──
  function shutdown() {
    WebOS.Kernel.Dialog.confirm({
      title: 'Shut Down',
      message: 'Are you sure you want to shut down NexOS? All unsaved data will be lost.',
      onConfirm: () => {
        _fadeAndRedirect();
      }
    });
  }

  function logout() {
    WebOS.Kernel.Dialog.confirm({
      title: 'Log Out',
      message: `Log out of <strong>${state.user}</strong>? You will need to sign in again.`,
      onConfirm: () => {
        sessionStorage.clear();
        _fadeAndRedirect();
      }
    });
  }

  function _fadeAndRedirect() {
    const overlay = document.getElementById('boot-overlay') || (() => {
      const el = document.createElement('div');
      el.id = 'boot-overlay';
      el.style.cssText = 'position:fixed;inset:0;background:#000;z-index:99999;opacity:0;transition:opacity 0.8s ease;';
      document.body.appendChild(el);
      return el;
    })();
    overlay.style.opacity = '1';
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
  }

  function restart() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:99999;opacity:0;transition:opacity 0.5s;';
    document.body.appendChild(overlay);
    overlay.style.opacity = '1';
    setTimeout(() => window.location.reload(), 600);
  }

  // ── JWT Token Expiry Watcher ──
  function _startTokenWatcher() {
    setInterval(async () => {
      const token = sessionStorage.getItem('nexos_token');
      if (!token) return;
      try {
        const res = await fetch('/api/cloud/files?prefix=/', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.status === 401) {
          Notifications.show({
            title: 'Session Expired',
            message: 'Your session has expired. Redirecting to login...',
            type: 'warning',
            icon: '🔒',
            duration: 3000
          });
          setTimeout(() => {
            sessionStorage.clear();
            window.location.href = 'index.html';
          }, 2000);
        }
      } catch(e) { /* network error — skip check */ }
    }, 60000); // Check every 60 seconds
  }

  // ── Getters ──
  function getUser()    { return state.user; }
  function getVersion() { return state.version; }
  function getUptime()  { return ProcessManager.getUptime(); }

  return { boot, Events, AppRegistry, ProcessManager, Notifications, Dialog, getUser, getVersion, getUptime, shutdown, restart, logout, getMetrics() { return { ..._metrics }; }, _metricsRef: _metrics };
})();

/* ── Expose shortcuts ── */
const WebOSEvents  = WebOS.Kernel.Events;
const AppRegistry  = WebOS.Kernel.AppRegistry;
const Notify       = (opts) => WebOS.Kernel.Notifications.show(opts);

/* ── Real Metrics Collection ── */
function _startMetricsCollection() {
  const _metrics = WebOS.Kernel._metricsRef;

  // Client CPU via event loop delay (200ms interval)
  let _loopLast = performance.now();
  const _loopDelays = [];
  setInterval(() => {
    const now = performance.now();
    const delay = Math.max(0, (now - _loopLast) - 200);
    _loopDelays.push(delay);
    if (_loopDelays.length > 15) _loopDelays.shift();
    const avg = _loopDelays.reduce((a, b) => a + b, 0) / _loopDelays.length;
    _metrics.clientCpu = Math.min(100, Math.round((avg / 200) * 100));
    _loopLast = now;
  }, 200);

  // Client Memory via Performance API
  setInterval(() => {
    if (performance.memory) {
      _metrics.clientMemMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
      _metrics.clientMemTotalMB = Math.round(performance.memory.jsHeapSizeLimit / 1048576);
      _metrics.clientMem = Math.round((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100);
    } else {
      // Fallback: estimate from DOM node count
      const nodes = document.querySelectorAll('*').length;
      _metrics.clientMemMB = Math.round(nodes * 0.004 + 12);
      _metrics.clientMemTotalMB = 256;
      _metrics.clientMem = Math.min(100, Math.round((_metrics.clientMemMB / _metrics.clientMemTotalMB) * 100));
    }
  }, 2000);

  // Server Metrics via API
  async function fetchServerMetrics() {
    try {
      const token = sessionStorage.getItem('nexos_token');
      if (!token) return;
      const res = await fetch('/api/system/metrics', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        _metrics.serverCpu = data.cpu.usage;
        _metrics.serverMem = data.memory.percentage;
        _metrics.serverMemUsedMB = Math.round(data.memory.used / 1048576);
        _metrics.serverMemTotalMB = Math.round(data.memory.total / 1048576);
        _metrics.serverProcessMB = Math.round(data.process.rss / 1048576);
        _metrics.serverUptime = data.uptime.system;
        _metrics.serverCores = data.cpu.cores;
        _metrics.serverHostname = data.hostname;
        _metrics.serverCpuModel = data.cpu.model;
        _metrics.serverPlatform = data.platform;
      }
    } catch(e) { /* skip on network error */ }
  }
  fetchServerMetrics();
  setInterval(fetchServerMetrics, 3000);
}
