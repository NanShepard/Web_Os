/* ============================================
   NexOS — File Explorer App
   ============================================ */

'use strict';

AppRegistry.register({
  id: 'files',
  name: 'File Explorer',
  icon: '📁',

  launch(params) {
    if (WebOS.WindowManager.isOpen('files-win')) {
      WebOS.WindowManager.focusWindow('files-win');
      return;
    }

    WebOS.WindowManager.createWindow({
      id: 'files-win',
      title: 'File Explorer',
      icon: '📁',
      width: 880, height: 560,
      content: _getHTML(),
      onReady: (body) => _init(body, params?.path || '/home'),
    });
  }
});

function _getHTML() {
  return `
    <div class="app-container">
      <div class="app-toolbar">
        <button class="app-btn icon-only" id="fe-back" title="Back">◀</button>
        <button class="app-btn icon-only" id="fe-fwd"  title="Forward">▶</button>
        <button class="app-btn icon-only" id="fe-up"   title="Up">↑</button>
        <div class="app-input" style="max-width:300px">
          <span style="font-size:12px;color:var(--text-muted)">📍</span>
          <input type="text" id="fe-path-input" placeholder="/home">
        </div>
        <button class="app-btn icon-only" id="fe-refresh" title="Refresh">🔄</button>
        <button class="app-btn" id="fe-new-folder">📁 New Folder</button>
        <button class="app-btn" id="fe-new-file">📄 New File</button>
        <div style="margin-left:auto;display:flex;gap:6px">
          <button class="app-btn icon-only" id="fe-view-grid" title="Grid view">⊞</button>
          <button class="app-btn icon-only" id="fe-view-list" title="List view">☰</button>
        </div>
      </div>

      <div class="fe-layout">
        <div class="fe-sidebar">
          <div class="fe-sidebar-section">
            <div class="fe-sidebar-label">Favorites</div>
            <div class="fe-nav-item active" data-path="/home">🏠 <span>Home</span></div>
            <div class="fe-nav-item" data-path="/documents">📄 <span>Documents</span></div>
            <div class="fe-nav-item" data-path="/pictures">🖼️ <span>Pictures</span></div>
            <div class="fe-nav-item" data-path="/downloads">⬇️ <span>Downloads</span></div>
          </div>
          <div class="fe-sidebar-section">
            <div class="fe-sidebar-label">Cloud</div>
            <div class="fe-nav-item" data-path="/cloud">☁️ <span>Cloud Drive</span></div>
            <div class="fe-nav-item" data-path="/">💾 <span>Root</span></div>
          </div>
          <div class="fe-sidebar-section">
            <div class="fe-sidebar-label">System</div>
            <div class="fe-nav-item" data-path="/trash">🗑️ <span>Trash</span></div>
          </div>
        </div>

        <div class="fe-main">
          <div class="fe-breadcrumb" id="fe-breadcrumb"></div>
          <div class="fe-content" id="fe-content"></div>
        </div>
      </div>

      <div class="app-status-bar">
        <span id="fe-status-items">0 items</span>
        <span id="fe-status-selected"></span>
        <span style="margin-left:auto" id="fe-status-size"></span>
      </div>
    </div>
  `;
}

function _init(body, startPath) {
  const state = {
    currentPath: startPath,
    history: [startPath],
    historyIdx: 0,
    viewMode: 'grid',
    selected: null,
    items: [],
  };

  // Nav sidebar
  body.querySelectorAll('.fe-nav-item').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.path));
  });

  // Toolbar
  body.querySelector('#fe-back').addEventListener('click',    () => goBack());
  body.querySelector('#fe-fwd').addEventListener('click',     () => goForward());
  body.querySelector('#fe-up').addEventListener('click',      () => goUp());
  body.querySelector('#fe-refresh').addEventListener('click', () => loadDir(state.currentPath));
  body.querySelector('#fe-new-folder').addEventListener('click', () => createFolder());
  body.querySelector('#fe-new-file').addEventListener('click',   () => createFile());
  body.querySelector('#fe-view-grid').addEventListener('click',  () => { state.viewMode = 'grid'; renderItems(); });
  body.querySelector('#fe-view-list').addEventListener('click',  () => { state.viewMode = 'list'; renderItems(); });

  const pathInput = body.querySelector('#fe-path-input');
  pathInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(pathInput.value.trim()); });

  // FS change listener
  WebOS.Kernel.Events.on('fs:change', () => { if (body.isConnected) loadDir(state.currentPath); });

  loadDir(startPath);

  async function loadDir(path) {
    try {
      const items = await WebOS.FS.listDir(path);
      state.items = items;
      state.currentPath = WebOS.FS.normalizePath(path);
      pathInput.value = state.currentPath;
      _updateBreadcrumb();
      _updateSidebar();
      renderItems();
    } catch(e) {
      body.querySelector('#fe-content').innerHTML = `<div class="fe-empty"><div class="fe-empty-icon">❌</div><span>Error: ${e.message}</span></div>`;
    }
  }

  function navigate(path) {
    if (!path) return;
    state.history = state.history.slice(0, state.historyIdx + 1);
    state.history.push(path);
    state.historyIdx = state.history.length - 1;
    loadDir(path);
  }

  function goBack()    { if (state.historyIdx > 0)                      { state.historyIdx--; loadDir(state.history[state.historyIdx]); } }
  function goForward() { if (state.historyIdx < state.history.length-1)  { state.historyIdx++; loadDir(state.history[state.historyIdx]); } }
  function goUp() {
    const p = state.currentPath;
    if (p === '/') return;
    const parent = p.substring(0, p.lastIndexOf('/')) || '/';
    navigate(parent);
  }

  function _updateBreadcrumb() {
    const bc = body.querySelector('#fe-breadcrumb');
    const parts = state.currentPath === '/' ? [''] : state.currentPath.split('/');
    let accum = '';
    bc.innerHTML = parts.map((part, i) => {
      accum = i === 0 && part === '' ? '/' : accum === '/' ? '/' + part : accum + '/' + part;
      const isLast = i === parts.length - 1;
      const label  = part === '' ? '/' : part;
      return `
        ${i > 0 && part !== '' ? '<span class="fe-breadcrumb-sep">›</span>' : ''}
        <span class="fe-breadcrumb-item ${isLast ? 'active' : ''}" data-path="${accum}">${label}</span>
      `;
    }).join('');

    bc.querySelectorAll('.fe-breadcrumb-item:not(.active)').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.path));
    });
  }

  function _updateSidebar() {
    body.querySelectorAll('.fe-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.path === state.currentPath);
    });
  }

  function renderItems() {
    const content = body.querySelector('#fe-content');
    const statusItems = body.querySelector('#fe-status-items');

    if (state.items.length === 0) {
      content.innerHTML = `<div class="fe-empty"><div class="fe-empty-icon">📂</div><span>This folder is empty</span></div>`;
      statusItems.textContent = '0 items';
      return;
    }

    statusItems.textContent = `${state.items.length} item${state.items.length !== 1 ? 's' : ''}`;

    if (state.viewMode === 'grid') {
      content.innerHTML = `<div class="fe-grid">${state.items.map(item => `
        <div class="fe-item" data-path="${item.path}" data-type="${item.type}" data-name="${item.name}">
          <span class="fe-item-icon">${WebOS.FS.getFileIcon(item.name, item.type)}</span>
          <span class="fe-item-name">${item.name}</span>
        </div>
      `).join('')}</div>`;
    } else {
      content.innerHTML = `
        <div class="fe-list">
          <div class="fe-list-item" style="opacity:0.5;cursor:default;border-bottom:1px solid var(--border-subtle)">
            <div style="width:22px"></div>
            <div class="fe-list-name" style="font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Name</div>
            <div class="fe-list-date" style="font-weight:600;font-size:11px;text-transform:uppercase">Modified</div>
            <div class="fe-list-size" style="font-weight:600;font-size:11px;text-transform:uppercase">Size</div>
          </div>
          ${state.items.map(item => `
            <div class="fe-list-item" data-path="${item.path}" data-type="${item.type}" data-name="${item.name}">
              <span class="fe-list-icon">${WebOS.FS.getFileIcon(item.name, item.type)}</span>
              <span class="fe-list-name">${item.name}</span>
              <span class="fe-list-date">${WebOS.FS.formatDate(item.modified)}</span>
              <span class="fe-list-size">${item.type === 'dir' ? '—' : WebOS.FS.formatSize(item.size)}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Attach item interactions
    content.querySelectorAll('.fe-item, .fe-list-item[data-path]').forEach(el => {
      let clickTimer = null;

      el.addEventListener('click', (e) => {
        content.querySelectorAll('.fe-item.selected, .fe-list-item.selected').forEach(s => s.classList.remove('selected'));
        el.classList.add('selected');
        state.selected = state.items.find(i => i.path === el.dataset.path);
        _updateStatusSelected();

        if (clickTimer) {
          clearTimeout(clickTimer); clickTimer = null;
          // Double click
          openItem(el.dataset.path, el.dataset.type, el.dataset.name);
        } else {
          clickTimer = setTimeout(() => { clickTimer = null; }, 280);
        }
      });

      el.addEventListener('contextmenu', (e) => { e.preventDefault(); _showItemCtxMenu(e, el.dataset.path, el.dataset.type, el.dataset.name); });
    });
  }

  function _updateStatusSelected() {
    const sel = body.querySelector('#fe-status-selected');
    const sizEl= body.querySelector('#fe-status-size');
    if (state.selected) {
      sel.textContent = `"${state.selected.name}" selected`;
      sizEl.textContent = state.selected.type === 'file' ? WebOS.FS.formatSize(state.selected.size) : '';
    } else {
      sel.textContent = ''; sizEl.textContent = '';
    }
  }

  function openItem(path, type, name) {
    if (type === 'dir') {
      navigate(path);
    } else {
      const ext = name.split('.').pop().toLowerCase();
      if (['txt','md','js','json','css','html','py','sh','xml'].includes(ext)) {
        AppRegistry.launch('text-editor', { path });
      } else {
        Notify({ title: 'Open File', message: `Cannot open "${name}" — unsupported format`, type: 'warning' });
      }
    }
  }

  function _showItemCtxMenu(e, path, type, name) {
    const ctx    = document.getElementById('context-menu');
    const isFile = type === 'file';
    ctx.innerHTML = `
      <div class="ctx-item" id="ictx-open"><span class="ctx-item-icon">${isFile ? '📂' : '📁'}</span> Open</div>
      ${isFile ? `<div class="ctx-item" id="ictx-edit"><span class="ctx-item-icon">📝</span> Edit</div>` : ''}
      <div class="ctx-sep"></div>
      <div class="ctx-item" id="ictx-rename"><span class="ctx-item-icon">✏️</span> Rename</div>
      <div class="ctx-item danger" id="ictx-delete"><span class="ctx-item-icon">🗑️</span> Delete</div>
    `;
    ctx.style.left = e.clientX + 'px'; ctx.style.top = e.clientY + 'px';
    ctx.classList.remove('hidden');

    ctx.querySelector('#ictx-open').onclick = () => { ctx.classList.add('hidden'); openItem(path, type, name); };
    if (isFile) ctx.querySelector('#ictx-edit').onclick = () => { ctx.classList.add('hidden'); AppRegistry.launch('text-editor', { path }); };
    ctx.querySelector('#ictx-rename').onclick = () => {
      ctx.classList.add('hidden');
      WebOS.Kernel.Dialog.prompt({
        title: 'Rename', placeholder: 'New name', defaultValue: name,
        onConfirm: async (newName) => {
          if (!newName || newName === name) return;
          await WebOS.FS.renameEntry(path, newName);
          loadDir(state.currentPath);
        }
      });
    };
    ctx.querySelector('#ictx-delete').onclick = () => {
      ctx.classList.add('hidden');
      WebOS.Kernel.Dialog.confirm({
        title: 'Delete', message: `Delete "${name}"? This cannot be undone.`, dangerous: true,
        onConfirm: async () => {
          await WebOS.FS.deleteEntry(path);
          loadDir(state.currentPath);
        }
      });
    };
  }

  async function createFolder() {
    WebOS.Kernel.Dialog.prompt({
      title: 'New Folder', placeholder: 'Folder name', defaultValue: 'New Folder',
      onConfirm: async (name) => {
        if (!name.trim()) return;
        try {
          const path = (state.currentPath === '/' ? '' : state.currentPath) + '/' + name.trim();
          await WebOS.FS.createDir(path);
          loadDir(state.currentPath);
        } catch(e) { Notify({ title: 'Error', message: e.message, type: 'error' }); }
      }
    });
  }

  async function createFile() {
    WebOS.Kernel.Dialog.prompt({
      title: 'New File', placeholder: 'File name', defaultValue: 'new-file.txt',
      onConfirm: async (name) => {
        if (!name.trim()) return;
        try {
          const path = (state.currentPath === '/' ? '' : state.currentPath) + '/' + name.trim();
          await WebOS.FS.writeFile(path, '');
          loadDir(state.currentPath);
          AppRegistry.launch('text-editor', { path });
        } catch(e) { Notify({ title: 'Error', message: e.message, type: 'error' }); }
      }
    });
  }
}
