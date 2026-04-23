/* ============================================
   NexOS — Settings App
   ============================================ */

'use strict';

/* ── User Manager (Server-backed) ── */
const UserManager = (() => {

  function _authHeaders() {
    const token = sessionStorage.getItem('nexos_token');
    return { 'Authorization': 'Bearer ' + token };
  }

  async function getAll() {
    const res = await fetch('/api/users/list', {
      headers: _authHeaders()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.users; // [{ username, role }]
  }

  async function addUser(username, password, role = 'Standard User') {
    if (!username || !password) throw new Error('Username and password are required.');
    if (username.length < 3)    throw new Error('Username must be at least 3 characters.');
    if (password.length < 4)    throw new Error('Password must be at least 4 characters.');
    if (!/^[a-z0-9_-]+$/i.test(username)) throw new Error('Username can only contain letters, numbers, _ and -.');
    const res = await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ..._authHeaders() },
      body: JSON.stringify({ username, password, role })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  }

  async function deleteUser(username) {
    if (username === 'admin') throw new Error('Cannot delete the admin account.');
    const res = await fetch(`/api/users/delete?username=${encodeURIComponent(username)}`, {
      method: 'DELETE',
      headers: _authHeaders()
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  }

  async function changePassword(username, newPassword) {
    if (newPassword.length < 4) throw new Error('Password must be at least 4 characters.');
    const res = await fetch('/api/users/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ..._authHeaders() },
      body: JSON.stringify({ username, newPassword })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
  }

  return { getAll, addUser, deleteUser, changePassword };
})();

window.UserManager = UserManager;

AppRegistry.register({
  id: 'settings',
  name: 'Settings',
  icon: '⚙️',

  launch(params) {
    const id = 'settings-win';
    if (WebOS.WindowManager.isOpen(id)) { WebOS.WindowManager.focusWindow(id); return; }

    WebOS.WindowManager.createWindow({
      id, title: 'Settings', icon: '⚙️',
      width: 780, height: 540,
      content: `
        <div class="app-container">
          <div class="settings-layout">
            <div class="settings-sidebar">
              <div class="settings-nav-item active" data-page="system">
                <span class="settings-nav-icon">💻</span> System
              </div>
              <div class="settings-nav-item" data-page="personalization">
                <span class="settings-nav-icon">🎨</span> Personalization
              </div>
              <div class="settings-nav-item" data-page="network">
                <span class="settings-nav-icon">📶</span> Network
              </div>
              <div class="settings-nav-item" data-page="cloud">
                <span class="settings-nav-icon">☁️</span> Cloud
              </div>
              <div class="settings-nav-item" data-page="sound">
                <span class="settings-nav-icon">🔊</span> Sound
              </div>
              <div class="settings-nav-item" data-page="account">
                <span class="settings-nav-icon">🧑‍💻</span> Account
              </div>
              <div class="settings-nav-item" data-page="about">
                <span class="settings-nav-icon">ℹ️</span> About
              </div>
            </div>
            <div class="settings-content" id="settings-content"></div>
          </div>
        </div>
      `,
      onReady: (body) => _initSettings(body, params?.page || 'system'),
    });
  }
});

const PAGES = {
  system: () => `
    <div class="settings-section">
      <div class="settings-section-title">System</div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Dark Mode</div>
            <div class="settings-row-desc">Use dark theme across all windows and apps</div>
          </div>
          <div class="toggle on" id="toggle-dark"></div>
        </div>
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Animations</div>
            <div class="settings-row-desc">Enable window animations and transitions</div>
          </div>
          <div class="toggle on" id="toggle-anim"></div>
        </div>
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Notifications</div>
            <div class="settings-row-desc">Show system and app notifications</div>
          </div>
          <div class="toggle on" id="toggle-notifs"></div>
        </div>
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Auto-Save</div>
            <div class="settings-row-desc">Automatically save files every 30 seconds</div>
          </div>
          <div class="toggle" id="toggle-autosave"></div>
        </div>
      </div>
    </div>
  `,

  personalization: () => `
    <div class="settings-section">
      <div class="settings-section-title">Personalization</div>
      <div class="settings-card" style="padding:16px">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Wallpaper</div>
        <div class="wallpaper-grid">
          ${[
            { id:'1', label:'Deep Space', bg:'linear-gradient(135deg,#060b18,#0b1221)' },
            { id:'2', label:'Aurora',     bg:'radial-gradient(at 30% 20%,#0f1a4f,#060b18)' },
            { id:'3', label:'Forest',     bg:'linear-gradient(135deg,#070d0a,#061219)' },
            { id:'4', label:'Nebula',     bg:'radial-gradient(at center,#180a24,#060b18)' },
            { id:'5', label:'Cosmic',     bg:'linear-gradient(135deg,#0a060b,#0c0b1a)' },
          ].map(w => `
            <div class="wallpaper-item ${localStorage.getItem('nexos_wallpaper')||'1'===w.id?'active':''}" data-w="${w.id}" style="background:${w.bg}">
              <div style="position:absolute;bottom:4px;left:0;right:0;text-align:center;font-size:10px;color:rgba(255,255,255,0.5)">${w.label}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Accent Color</div>
            <div class="settings-row-desc">Choose the highlight color for the interface</div>
          </div>
          <div style="display:flex;gap:8px">
            ${[
              { color:'#00d4ff', name:'Cyan' },
              { color:'#a855f7', name:'Purple' },
              { color:'#22c55e', name:'Green' },
              { color:'#f59e0b', name:'Amber' },
              { color:'#f97316', name:'Orange' },
            ].map(c => `
              <div style="width:24px;height:24px;border-radius:50%;background:${c.color};cursor:pointer;border:2px solid transparent;transition:all 0.1s" title="${c.name}" onclick="this.parentElement.querySelectorAll('div').forEach(d=>d.style.border='2px solid transparent');this.style.border='2px solid white'"></div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `,

  network: () => `
    <div class="settings-section">
      <div class="settings-section-title">Network & Internet</div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">📶 NexOS Cloud Network</div>
            <div class="settings-row-desc">Connected — 850 Mbps  ↑ ${Math.floor(Math.random()*50+10)} KB/s  ↓ ${Math.floor(Math.random()*200+50)} KB/s</div>
          </div>
          <div style="color:var(--green);font-size:12px;font-weight:600">● Online</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">DNS</div>
            <div class="settings-row-desc">NexOS Cloud DNS (auto)</div>
          </div>
          <div style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono)">8.8.8.8</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">VPN</div>
            <div class="settings-row-desc">Route traffic through cloud VPN</div>
          </div>
          <div class="toggle" id="toggle-vpn"></div>
        </div>
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Firewall</div>
            <div class="settings-row-desc">Block incoming connections</div>
          </div>
          <div class="toggle on" id="toggle-fw"></div>
        </div>
      </div>
    </div>
  `,

  cloud: () => {
    const reg    = WebOS.Cloud.getRegion();
    const used   = WebOS.Cloud.getUsedStorage();
    const max    = WebOS.Cloud.getMaxStorage();
    const pct    = ((used/max)*100).toFixed(1);
    const regions= WebOS.Cloud.getRegions();
    return `
    <div class="settings-section">
      <div class="settings-section-title">Cloud Settings</div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Cloud Sync</div>
            <div class="settings-row-desc">Automatically sync files to cloud storage</div>
          </div>
          <div class="toggle on" id="toggle-sync"></div>
        </div>
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Active Region</div>
            <div class="settings-row-desc">Data center location for cloud services</div>
          </div>
          <select id="cloud-region-select" style="background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:var(--radius-sm);padding:5px 10px;color:var(--text-primary);font-size:12px;cursor:pointer">
            ${regions.map(r => `<option value="${r.id}" ${r.id===reg.id?'selected':''}>${r.flag} ${r.name} (~${r.latency}ms)</option>`).join('')}
          </select>
        </div>
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Storage</div>
            <div class="settings-row-desc">${WebOS.FS.formatSize ? WebOS.FS.formatSize(used) : '0 B'} used of 5 GB (${pct}%)</div>
          </div>
          <div style="width:120px">
            <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--cyan),var(--purple));border-radius:3px"></div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Auto Backup</div>
            <div class="settings-row-desc">Backup to cloud every 30 minutes</div>
          </div>
          <div class="toggle on" id="toggle-backup"></div>
        </div>
      </div>
      <div class="settings-card" style="padding:14px 16px">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;font-weight:600">CLOUD SERVERS</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
          ${WebOS.Cloud.getServers().map(s => `
            <div style="background:rgba(255,255,255,0.025);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px 12px;font-size:12px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <div style="width:8px;height:8px;border-radius:50%;background:var(--${s.status==='online'?'green':'red'})"></div>
                <span style="font-weight:600">${s.id}</span>
              </div>
              <div style="color:var(--text-muted)">${s.type}</div>
              <div style="color:var(--text-muted)">${s.cores} vCPU / ${s.ram}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `; },

  sound: () => `
    <div class="settings-section">
      <div class="settings-section-title">Sound</div>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Master Volume</div></div>
          <input type="range" min="0" max="100" value="70" style="width:140px;accent-color:var(--cyan)">
        </div>
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">System Sounds</div>
            <div class="settings-row-desc">Play sounds for notifications and events</div>
          </div>
          <div class="toggle on" id="toggle-sounds"></div>
        </div>
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Notification Alerts</div></div>
          <div class="toggle on" id="toggle-notif-sounds"></div>
        </div>
      </div>
    </div>
  `,

  account: async () => {
    const currentUser = WebOS.Kernel.getUser();
    let allUsers = [];
    try {
      allUsers = await UserManager.getAll();
    } catch(e) { console.error('Failed to load users', e); }
    
    const roleColors  = { 'Administrator': 'var(--cyan)', 'Cloud Operator': 'var(--purple)', 'Standard User': 'var(--green)' };
    const roleIcons   = { 'Administrator': '👑', 'Cloud Operator': '☁️', 'Standard User': '🧑‍💻' };
    const currentRole = allUsers.find(u => u.username === currentUser)?.role || 'Administrator';

    return `
    <div class="settings-section">
      <div class="settings-section-title">Account</div>

      <!-- Current user card -->
      <div class="settings-card" style="padding:20px 24px;display:flex;align-items:center;gap:20px">
        <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,rgba(0,212,255,0.2),rgba(168,85,247,0.2));border:2px solid var(--border-active);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">${roleIcons[currentRole] || '🧑‍💻'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:18px;font-weight:600">${currentUser}</div>
          <div style="font-size:12px;color:${roleColors[currentRole] || 'var(--cyan)'};margin-top:4px;font-weight:500">${currentRole}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">NexOS Pro · Cloud Enabled · Logged in this session</div>
        </div>
        <button class="app-btn" id="acc-change-pw">🔑 Change Password</button>
      </div>

      <!-- 2FA row -->
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Two-Factor Authentication</div>
            <div class="settings-row-desc">Add an extra layer of security to your account</div>
          </div>
          <div class="toggle" id="toggle-2fa"></div>
        </div>
      </div>

      <!-- User Management section -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
        <div style="font-size:15px;font-weight:600;color:var(--text-primary)">User Management</div>
        <button class="app-btn primary" id="acc-add-user">➕ Add User</button>
      </div>

      <div class="settings-card" id="acc-user-list">
        ${allUsers.map(u => `
          <div class="settings-row" data-username="${u.username}">
            <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
              <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,rgba(0,212,255,0.15),rgba(168,85,247,0.15));border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${roleIcons[u.role] || '🧑‍💻'}</div>
              <div style="min-width:0">
                <div style="font-size:13px;font-weight:600;color:${u.username === currentUser ? 'var(--cyan)' : 'var(--text-primary)'}">
                  ${u.username}
                  ${u.username === currentUser ? '<span style="font-size:10px;background:rgba(0,212,255,0.12);border:1px solid var(--border-active);border-radius:4px;padding:1px 6px;margin-left:6px;font-weight:400">current</span>' : ''}
                </div>
                <div style="font-size:11px;color:${roleColors[u.role] || 'var(--text-muted)'};margin-top:2px">${u.role}</div>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="app-btn acc-reset-pw-btn" data-user="${u.username}" title="Reset password">🔑</button>
              <button class="app-btn danger acc-delete-btn" data-user="${u.username}" ${(u.username === currentUser || u.username === 'admin') ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''} title="${u.username === 'admin' ? 'Cannot delete admin' : u.username === currentUser ? 'Cannot delete yourself' : 'Delete user'}">🗑️</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  },


  about: () => `
    <div class="settings-section">
      <div class="settings-section-title">About NexOS</div>
      <div class="settings-card" style="padding:28px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px">
        <div style="font-size:56px">🖥️</div>
        <div style="font-size:24px;font-weight:700;background:linear-gradient(135deg,var(--cyan),var(--purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent">NexOS</div>
        <div style="font-size:13px;color:var(--text-muted)">Version 2.4.1 Cloud Edition</div>
        <div style="font-size:12px;color:var(--text-disabled)">Built with HTML, CSS & JavaScript</div>
      </div>
      <div class="settings-card">
        ${[
          ['OS Version', 'NexOS 2.4.1'],
          ['Build',      'cloud-2024.04.14'],
          ['Kernel',     'nexos-2.4.1-cloud'],
          ['Shell',      'nexsh 1.0'],
          ['Renderer',   navigator.userAgent.split(' ').slice(-2).join(' ')],
          ['Memory',     `${(performance?.memory?.usedJSHeapSize / 1e6 | 0) || '~'}  MB JS Heap`],
          ['Uptime',     `${WebOS.Kernel.getUptime()}s`],
        ].map(([k,v]) => `
          <div class="settings-row">
            <div class="settings-row-label">${k}</div>
            <div style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono)">${v}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `,
};

function _initSettings(body, initialPage) {
  const content = body.querySelector('#settings-content');
  let currentPage = initialPage;

  body.querySelectorAll('.settings-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      body.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      currentPage = item.dataset.page;
      renderPage(currentPage);
    });
  });

  // Navigate to initial page
  const initItem = body.querySelector(`[data-page="${initialPage}"]`);
  if (initItem) {
    body.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
    initItem.classList.add('active');
  }

  renderPage(initialPage);

  async function renderPage(page) {
    const fn = PAGES[page];
    if (!fn) {
      content.innerHTML = '<div style="padding:24px;color:var(--text-muted)">Page not found</div>';
    } else if (typeof fn === 'function') {
      content.innerHTML = await fn();
    } else {
      content.innerHTML = fn;
    }
    _attachPageHandlers(page, content);
  }

  function _attachPageHandlers(page, el) {
    // Toggles
    el.querySelectorAll('.toggle').forEach(t => {
      t.addEventListener('click', () => t.classList.toggle('on'));
    });

    // Wallpaper picker
    el.querySelectorAll('.wallpaper-item').forEach(item => {
      item.addEventListener('click', () => {
        el.querySelectorAll('.wallpaper-item').forEach(w => w.classList.remove('active'));
        item.classList.add('active');
        WebOS.Kernel.Events.emit('settings:wallpaper', { id: item.dataset.w });
        Notify({ title: 'Wallpaper Changed', message: 'Desktop wallpaper updated', type: 'success', icon: '🖼️', duration: 2000 });
      });
    });

    // Cloud region selector
    const regionSel = el.querySelector('#cloud-region-select');
    if (regionSel) {
      regionSel.addEventListener('change', () => WebOS.Cloud.setRegion(regionSel.value));
    }

    // ── Account page handlers ──
    if (page === 'account') _attachAccountHandlers(el);
  }

  function _attachAccountHandlers(el) {
    const currentUser = WebOS.Kernel.getUser();

    // Change own password
    el.querySelector('#acc-change-pw')?.addEventListener('click', () => {
      _showAddUserDialog({ changePasswordFor: currentUser });
    });

    // Add new user button
    el.querySelector('#acc-add-user')?.addEventListener('click', () => {
      _showAddUserDialog({});
    });

    // Reset another user's password
    el.querySelectorAll('.acc-reset-pw-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetUser = btn.dataset.user;
        _showAddUserDialog({ changePasswordFor: targetUser });
      });
    });

    // Delete user
    el.querySelectorAll('.acc-delete-btn').forEach(btn => {
      if (btn.disabled) return;
      btn.addEventListener('click', () => {
        const targetUser = btn.dataset.user;
        WebOS.Kernel.Dialog.confirm({
          title: 'Delete User',
          message: `Are you sure you want to delete user "<strong>${targetUser}</strong>"? This cannot be undone.`,
          dangerous: true,
          onConfirm: async () => {
            try {
              await UserManager.deleteUser(targetUser);
              Notify({ title: 'User Deleted', message: `"${targetUser}" has been removed.`, type: 'success', icon: '🗑️', duration: 3000 });
              // Re-render account page
              renderPage('account');
            } catch(e) {
              Notify({ title: 'Error', message: e.message, type: 'error' });
            }
          }
        });
      });
    });
  }

  // ── Add User / Change Password dialog ──
  function _showAddUserDialog({ changePasswordFor = null }) {
    const isChangePw = !!changePasswordFor;
    const ROLES = ['Administrator', 'Cloud Operator', 'Standard User'];

    const overlay = document.createElement('div');
    overlay.className = 'os-dialog-overlay';
    overlay.innerHTML = `
      <div class="os-dialog" style="min-width:400px">
        <div class="os-dialog-title">${isChangePw ? `🔑 Change Password — ${changePasswordFor}` : '➕ Add New User'}</div>
        ${!isChangePw ? `
          <div style="display:flex;flex-direction:column;gap:10px">
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px">Username</label>
              <input class="os-dialog-input" id="dlg-new-username" placeholder="e.g. john_doe" type="text" autocomplete="off">
            </div>
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px">Role</label>
              <select id="dlg-new-role" style="width:100%;padding:10px 14px;background:rgba(255,255,255,0.05);border:1.5px solid var(--border);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;cursor:pointer">
                ${ROLES.map(r => `<option value="${r}">${r}</option>`).join('')}
              </select>
            </div>
          </div>
        ` : ''}
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px">New Password</label>
          <input class="os-dialog-input" id="dlg-new-password" placeholder="Min. 4 characters" type="password" autocomplete="new-password">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:5px">Confirm Password</label>
          <input class="os-dialog-input" id="dlg-confirm-password" placeholder="Re-enter password" type="password" autocomplete="new-password">
        </div>
        <div id="dlg-err" style="font-size:12px;color:var(--red);display:none;padding:8px 12px;background:var(--red-dim);border-radius:var(--radius-sm)"></div>
        <div class="os-dialog-actions">
          <button class="os-dialog-btn" id="dlg-cancel">Cancel</button>
          <button class="os-dialog-btn primary" id="dlg-ok">${isChangePw ? 'Change Password' : 'Create User'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const errEl    = overlay.querySelector('#dlg-err');
    const pwInput  = overlay.querySelector('#dlg-new-password');
    const cpInput  = overlay.querySelector('#dlg-confirm-password');
    const unInput  = overlay.querySelector('#dlg-new-username');
    const roleEl   = overlay.querySelector('#dlg-new-role');

    if (unInput) unInput.focus(); else pwInput.focus();

    function showErr(msg) {
      errEl.textContent = msg;
      errEl.style.display = 'block';
    }

    async function submit() {
      const pw  = pwInput.value.trim();
      const cpw = cpInput.value.trim();
      errEl.style.display = 'none';

      if (!pw)          return showErr('Password is required.');
      if (pw !== cpw)   return showErr('Passwords do not match.');

      const submitBtn = overlay.querySelector('#dlg-ok');
      submitBtn.disabled = true;

      try {
        if (isChangePw) {
          await UserManager.changePassword(changePasswordFor, pw);
          overlay.remove();
          Notify({ title: 'Password Changed', message: `Password for "${changePasswordFor}" updated successfully.`, type: 'success', icon: '🔑', duration: 3000 });
        } else {
          const username = unInput.value.trim();
          const role     = roleEl.value;
          await UserManager.addUser(username, pw, role);
          overlay.remove();
          Notify({ title: 'User Created', message: `"${username}" (${role}) added successfully. They can now log in.`, type: 'success', icon: '👤', duration: 4000 });
          renderPage('account'); // refresh user list
        }
      } catch(e) {
        showErr(e.message);
        submitBtn.disabled = false;
      }
    }

    overlay.querySelector('#dlg-ok').onclick     = submit;
    overlay.querySelector('#dlg-cancel').onclick = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    cpInput.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  }
}
