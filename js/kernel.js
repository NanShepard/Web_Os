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
    getMemUsage(){ return Math.floor(20 + Math.random() * 15); }, // Simulated %
    getCpuUsage(){ return Math.floor(3 + Math.random() * 12);  }  // Simulated %
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
    });
  }

  function restart() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:99999;opacity:0;transition:opacity 0.5s;';
    document.body.appendChild(overlay);
    overlay.style.opacity = '1';
    setTimeout(() => window.location.reload(), 600);
  }

  // ── Getters ──
  function getUser()    { return state.user; }
  function getVersion() { return state.version; }
  function getUptime()  { return ProcessManager.getUptime(); }

  return { boot, Events, AppRegistry, ProcessManager, Notifications, Dialog, getUser, getVersion, getUptime, shutdown, restart };
})();

/* ── Expose shortcuts ── */
const WebOSEvents  = WebOS.Kernel.Events;
const AppRegistry  = WebOS.Kernel.AppRegistry;
const Notify       = (opts) => WebOS.Kernel.Notifications.show(opts);
