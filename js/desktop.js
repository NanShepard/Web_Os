/* ============================================
   NexOS — Desktop
   ============================================ */

'use strict';

WebOS.Desktop = (() => {
  const ICONS = [
    { id: 'files',        label: 'Files',        emoji: '📁', appId: 'files' },
    { id: 'terminal',     label: 'Terminal',     emoji: '💻', appId: 'terminal' },
    { id: 'cloud-drive',  label: 'Cloud Drive',  emoji: '☁️', appId: 'cloud-drive' },
    { id: 'browser',      label: 'Browser',      emoji: '🌐', appId: 'browser' },
    { id: 'text-editor',  label: 'Text Editor',  emoji: '📝', appId: 'text-editor' },
    { id: 'calculator',   label: 'Calculator',   emoji: '🔢', appId: 'calculator' },
    { id: 'task-manager', label: 'Task Manager', emoji: '📊', appId: 'task-manager' },
    { id: 'settings',     label: 'Settings',     emoji: '⚙️', appId: 'settings' },
  ];

  let selectedIcon = null;
  let wallpaper = localStorage.getItem('nexos_wallpaper') || '1';

  function init() {
    _renderIcons();
    _applyWallpaper(wallpaper);
    _setupContextMenu();
    _setupDesktopInteraction();

    // Listen for wallpaper changes
    WebOS.Kernel.Events.on('settings:wallpaper', ({ id }) => {
      wallpaper = id;
      _applyWallpaper(id);
      localStorage.setItem('nexos_wallpaper', id);
    });

    // Listen for theme changes
    WebOS.Kernel.Events.on('settings:theme', ({ theme }) => {
      document.body.dataset.theme = theme;
    });
  }

  function _renderIcons() {
    const container = document.getElementById('desktop-icons');
    container.innerHTML = '';

    ICONS.forEach(icon => {
      const el = document.createElement('div');
      el.className = 'desktop-icon';
      el.id = `deskicon-${icon.id}`;
      el.innerHTML = `
        <span class="desktop-icon-emoji">${icon.emoji}</span>
        <span class="desktop-icon-label">${icon.label}</span>
      `;

      // Single click → select
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        _selectIcon(icon.id);
      });

      // Double click → launch app
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        el.style.animation = 'iconBounce 0.4s ease';
        setTimeout(() => { el.style.animation = ''; }, 400);
        AppRegistry.launch(icon.appId);
        _deselectAll();
      });

      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        _selectIcon(icon.id);
        _showIconContextMenu(e.clientX, e.clientY, icon);
      });

      container.appendChild(el);
    });
  }

  function _selectIcon(id) {
    _deselectAll();
    selectedIcon = id;
    const el = document.getElementById(`deskicon-${id}`);
    if (el) el.classList.add('selected');
  }

  function _deselectAll() {
    selectedIcon = null;
    document.querySelectorAll('.desktop-icon').forEach(e => e.classList.remove('selected'));
  }

  function _setupDesktopInteraction() {
    const desktop = document.getElementById('desktop');
    desktop.addEventListener('mousedown', (e) => {
      if (e.target === desktop || e.target.id === 'desktop-icons') {
        _deselectAll();
      }
    });

    desktop.addEventListener('contextmenu', (e) => {
      if (e.target === desktop || e.target.id === 'desktop-icons' || e.target.id === 'windows-container') {
        e.preventDefault();
        _showDesktopContextMenu(e.clientX, e.clientY);
      }
    });
  }

  function _setupContextMenu() {
    const ctx = document.getElementById('context-menu');
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') ctx.classList.add('hidden');
    });
  }

  function _showDesktopContextMenu(x, y) {
    const ctx = document.getElementById('context-menu');
    ctx.innerHTML = `
      <div class="ctx-item" id="ctx-new-folder">
        <span class="ctx-item-icon">📁</span> New Folder
      </div>
      <div class="ctx-item" id="ctx-new-file">
        <span class="ctx-item-icon">📄</span> New Text File
      </div>
      <div class="ctx-sep"></div>
      <div class="ctx-item" id="ctx-open-terminal">
        <span class="ctx-item-icon">💻</span> Open Terminal
      </div>
      <div class="ctx-item" id="ctx-open-files">
        <span class="ctx-item-icon">📁</span> Open Files
      </div>
      <div class="ctx-sep"></div>
      <div class="ctx-item" id="ctx-wallpaper">
        <span class="ctx-item-icon">🖼️</span> Change Wallpaper
      </div>
      <div class="ctx-item" id="ctx-settings">
        <span class="ctx-item-icon">⚙️</span> Settings
      </div>
    `;

    _positionContextMenu(ctx, x, y);
    ctx.classList.remove('hidden');

    ctx.querySelector('#ctx-new-folder').onclick  = () => { ctx.classList.add('hidden'); _createNewFolder(); };
    ctx.querySelector('#ctx-new-file').onclick    = () => { ctx.classList.add('hidden'); _createNewFile(); };
    ctx.querySelector('#ctx-open-terminal').onclick= () => { ctx.classList.add('hidden'); AppRegistry.launch('terminal'); };
    ctx.querySelector('#ctx-open-files').onclick  = () => { ctx.classList.add('hidden'); AppRegistry.launch('files'); };
    ctx.querySelector('#ctx-wallpaper').onclick   = () => { ctx.classList.add('hidden'); AppRegistry.launch('settings', { page: 'personalization' }); };
    ctx.querySelector('#ctx-settings').onclick    = () => { ctx.classList.add('hidden'); AppRegistry.launch('settings'); };
  }

  function _showIconContextMenu(x, y, icon) {
    const ctx = document.getElementById('context-menu');
    ctx.innerHTML = `
      <div class="ctx-item" id="ctx-icon-open">
        <span class="ctx-item-icon">${icon.emoji}</span> Open ${icon.label}
      </div>
      <div class="ctx-sep"></div>
      <div class="ctx-item" id="ctx-icon-pin">
        <span class="ctx-item-icon">📌</span> Pin to Taskbar
      </div>
    `;
    _positionContextMenu(ctx, x, y);
    ctx.classList.remove('hidden');
    ctx.querySelector('#ctx-icon-open').onclick = () => { ctx.classList.add('hidden'); AppRegistry.launch(icon.appId); };
    ctx.querySelector('#ctx-icon-pin').onclick  = () => { ctx.classList.add('hidden'); Notify({ title: 'Pinned', message: `${icon.label} pinned to taskbar`, type: 'success', duration: 2000 }); };
  }

  function _positionContextMenu(ctx, x, y) {
    ctx.style.left = x + 'px'; ctx.style.top = y + 'px';
    requestAnimationFrame(() => {
      const rect = ctx.getBoundingClientRect();
      if (rect.right  > window.innerWidth)  ctx.style.left = (x - rect.width)  + 'px';
      if (rect.bottom > window.innerHeight) ctx.style.top  = (y - rect.height) + 'px';
    });
  }

  const WALLPAPERS = {
    '1': { style: 'background: radial-gradient(ellipse 90% 70% at 15% 5%, rgba(0,212,255,0.05) 0%, transparent 55%), radial-gradient(ellipse 70% 60% at 85% 90%, rgba(168,85,247,0.05) 0%, transparent 55%), #060b18;' },
    '2': { style: 'background: radial-gradient(ellipse at 30% 20%, #0f1a4f 0%, #060b18 60%), radial-gradient(ellipse at 80% 80%, #1a0f2e 0%, transparent 50%);' },
    '3': { style: 'background: linear-gradient(135deg, #070d1a 0%, #061a12 40%, #070d09 100%);' },
    '4': { style: 'background: radial-gradient(ellipse at center, #180a24 0%, #060b18 70%);' },
    '5': { style: 'background: linear-gradient(135deg, #0a060b 0%, #0c0b1a 40%, #06080a 100%); background-image: radial-gradient(at 40% 40%, rgba(255,107,107,0.05) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(0,212,255,0.06) 0px, transparent 50%);' },
  };

  function _applyWallpaper(id) {
    const w = WALLPAPERS[id] || WALLPAPERS['1'];
    const desktop = document.getElementById('desktop');
    if (desktop) desktop.setAttribute('style', w.style + 'position:fixed;inset:0;bottom:var(--taskbar-height);overflow:hidden;user-select:none;');
  }

  async function _createNewFolder() {
    WebOS.Kernel.Dialog.prompt({
      title: 'New Folder', placeholder: 'Folder name', defaultValue: 'New Folder',
      onConfirm: async (name) => {
        if (!name.trim()) return;
        try {
          await WebOS.FS.createDir('/home/' + name.trim());
          Notify({ title: 'Folder Created', message: `"${name}" created in /home`, type: 'success', icon: '📁', duration: 3000 });
        } catch(e) {
          Notify({ title: 'Error', message: e.message, type: 'error' });
        }
      }
    });
  }

  async function _createNewFile() {
    WebOS.Kernel.Dialog.prompt({
      title: 'New File', placeholder: 'File name', defaultValue: 'new-file.txt',
      onConfirm: async (name) => {
        if (!name.trim()) return;
        try {
          await WebOS.FS.writeFile('/home/' + name.trim(), '');
          Notify({ title: 'File Created', message: `"${name}" created`, type: 'success', icon: '📄', duration: 3000 });
          AppRegistry.launch('text-editor', { path: '/home/' + name.trim() });
        } catch(e) {
          Notify({ title: 'Error', message: e.message, type: 'error' });
        }
      }
    });
  }

  return { init };
})();
