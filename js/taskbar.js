/* ============================================
   NexOS — Taskbar
   ============================================ */

'use strict';

WebOS.Taskbar = (() => {
  const taskbarApps = new Map();
  let activeId = null;
  let clockInterval = null;
  let startMenuOpen = false;

  function init() {
    _initClock();
    _initStartMenu();
    _initTray();

    // Start menu toggle
    document.getElementById('start-btn').addEventListener('click', toggleStartMenu);

    // Close start menu on outside click
    document.addEventListener('mousedown', (e) => {
      if (startMenuOpen) {
        const sm = document.getElementById('start-menu');
        const sb = document.getElementById('start-btn');
        if (!sm.contains(e.target) && !sb.contains(e.target)) closeStartMenu();
      }
    });
  }

  // ── Clock ──
  function _initClock() {
    function updateClock() {
      const now = new Date();
      const timeEl = document.getElementById('clock-time');
      const dateEl = document.getElementById('clock-date');
      if (!timeEl) return;

      timeEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    updateClock();
    clockInterval = setInterval(updateClock, 1000);
  }

  // ── Tray ──
  function _initTray() {
    const trayWifi   = document.getElementById('tray-wifi');
    const trayVolume = document.getElementById('tray-volume');
    const clock      = document.getElementById('clock-display');

    if (trayWifi)   trayWifi.addEventListener('click',   () => AppRegistry.launch('settings', { page: 'network' }));
    if (trayVolume) trayVolume.addEventListener('click', () => AppRegistry.launch('settings', { page: 'sound' }));
    if (clock)      clock.addEventListener('click',      () => _showClockPanel());
  }

  function _showClockPanel() {
    Notify({ title: 'System Time', message: new Date().toLocaleString(), type: 'info', icon: '🕐', duration: 3000 });
  }

  // ── Taskbar Apps ──
  function addApp(id, title, icon) {
    const container = document.getElementById('taskbar-apps');
    if (!container) return;
    if (taskbarApps.has(id)) return;

    const btn = document.createElement('div');
    btn.className = 'taskbar-app-btn';
    btn.id = `taskbar-${id}`;
    btn.innerHTML = `
      <span class="taskbar-app-icon">${icon}</span>
      <span class="taskbar-app-title">${title}</span>
    `;
    btn.addEventListener('click', () => WebOS.WindowManager.toggleWindow(id));
    container.appendChild(btn);
    taskbarApps.set(id, btn);
    setActive(id);
  }

  function removeApp(id) {
    const btn = taskbarApps.get(id);
    if (btn) { btn.remove(); taskbarApps.delete(id); }
    if (activeId === id) activeId = null;
  }

  function setActive(id) {
    activeId = id;
    taskbarApps.forEach((btn, wid) => btn.classList.toggle('active', wid === id));
    document.getElementById('start-btn').classList.toggle('active', id === '__start__');
  }

  function setMinimized(id, minimized) {
    const btn = taskbarApps.get(id);
    if (btn) btn.style.opacity = minimized ? '0.5' : '1';
  }

  // ── Start Menu ──
  function _initStartMenu() {
    const sm = document.getElementById('start-menu');
    sm.innerHTML = '';
    sm.innerHTML = _buildStartMenu();
    _attachStartMenuListeners();
  }

  function _buildStartMenu() {
    const apps = [
      { id: 'files',        name: 'Files',        emoji: '📁', category: 'System' },
      { id: 'terminal',     name: 'Terminal',     emoji: '💻', category: 'System' },
      { id: 'cloud-drive',  name: 'Cloud Drive',  emoji: '☁️', category: 'Cloud' },
      { id: 'task-manager', name: 'Task Manager', emoji: '📊', category: 'System' },
      { id: 'settings',     name: 'Settings',     emoji: '⚙️', category: 'System' },
      { id: 'text-editor',  name: 'Text Editor',  emoji: '📝', category: 'Apps' },
      { id: 'browser',      name: 'Browser',      emoji: '🌐', category: 'Apps' },
      { id: 'calculator',   name: 'Calculator',   emoji: '🔢', category: 'Apps' },
    ];

    const grouped = {};
    apps.forEach(a => { if (!grouped[a.category]) grouped[a.category] = []; grouped[a.category].push(a); });

    const appGrids = Object.entries(grouped).map(([cat, items]) => `
      <div class="start-menu-section">
        <div class="start-menu-section-title">${cat}</div>
        <div class="start-menu-apps-grid">
          ${items.map(a => `
            <div class="start-app-item" data-app="${a.id}">
              <span class="start-app-emoji">${a.emoji}</span>
              <span class="start-app-name">${a.name}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    const user = WebOS.Kernel.getUser();

    return `
      <div class="start-menu-header">
        <div class="start-menu-search">
          <span style="font-size:14px;color:var(--text-muted)">🔍</span>
          <input type="text" placeholder="Search apps..." id="start-search" autocomplete="off">
        </div>
      </div>
      <div class="start-menu-content">
        ${appGrids}
      </div>
      <div class="start-menu-footer">
        <div class="start-user-info">
          <div class="start-user-avatar">🧑‍💻</div>
          <div>
            <div class="start-user-name">${user}</div>
            <div class="start-user-role">Cloud Administrator</div>
          </div>
        </div>
        <div class="start-footer-btns">
          <div class="start-footer-btn" id="smb-settings" title="Settings">⚙️</div>
          <div class="start-footer-btn" id="smb-restart"  title="Restart">🔄</div>
          <div class="start-footer-btn danger" id="smb-shutdown" title="Shut Down">⏻</div>
        </div>
      </div>
    `;
  }

  function _attachStartMenuListeners() {
    const sm = document.getElementById('start-menu');

    sm.querySelectorAll('.start-app-item').forEach(item => {
      item.addEventListener('click', () => {
        const appId = item.dataset.app;
        closeStartMenu();
        AppRegistry.launch(appId);
      });
    });

    const searchInput = sm.querySelector('#start-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        sm.querySelectorAll('.start-app-item').forEach(item => {
          const name = item.querySelector('.start-app-name').textContent.toLowerCase();
          item.style.display = name.includes(q) ? '' : 'none';
        });
      });
    }

    const smSettings = sm.querySelector('#smb-settings');
    const smRestart  = sm.querySelector('#smb-restart');
    const smShutdown = sm.querySelector('#smb-shutdown');

    if (smSettings) smSettings.addEventListener('click', () => { closeStartMenu(); AppRegistry.launch('settings'); });
    if (smRestart)  smRestart.addEventListener('click',  () => { closeStartMenu(); WebOS.Kernel.restart(); });
    if (smShutdown) smShutdown.addEventListener('click', () => { closeStartMenu(); WebOS.Kernel.shutdown(); });
  }

  function toggleStartMenu() {
    startMenuOpen ? closeStartMenu() : openStartMenu();
  }

  function openStartMenu() {
    const sm = document.getElementById('start-menu');
    const sb = document.getElementById('start-btn');
    sm.classList.remove('hidden');
    sm.style.animation = 'startMenuIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both';
    sb.classList.add('active');
    startMenuOpen = true;
    setTimeout(() => { const inp = sm.querySelector('#start-search'); if (inp) inp.focus(); }, 100);
  }

  function closeStartMenu() {
    const sm = document.getElementById('start-menu');
    const sb = document.getElementById('start-btn');
    sm.classList.add('hidden');
    sb.classList.remove('active');
    startMenuOpen = false;
  }

  return { init, addApp, removeApp, setActive, setMinimized, toggleStartMenu, openStartMenu, closeStartMenu };
})();
