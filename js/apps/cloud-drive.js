/* ============================================
   NexOS — Cloud Drive App
   ============================================ */

'use strict';

AppRegistry.register({
  id: 'cloud-drive',
  name: 'Cloud Drive',
  icon: '☁️',

  launch() {
    const id = 'cloud-drive-win';
    if (WebOS.WindowManager.isOpen(id)) { WebOS.WindowManager.focusWindow(id); return; }

    WebOS.WindowManager.createWindow({
      id, title: 'Cloud Drive', icon: '☁️',
      width: 900, height: 580,
      content: `
        <div class="app-container">
          <!-- Toolbar -->
          <div class="cloud-toolbar">
            <span style="font-size:13px;font-weight:600;color:var(--cyan)">☁️ NexOS Cloud Drive</span>
            <div class="cloud-region-badge" id="cd-region-badge">
              <span id="cd-region-flag">🇺🇸</span>
              <span id="cd-region-name">us-east-1</span>
            </div>
            <div style="margin-left:auto;display:flex;gap:6px">
              <button class="app-btn primary" id="cd-sync">🔄 Sync Now</button>
              <button class="app-btn"         id="cd-upload">⬆️ Upload</button>
              <button class="app-btn"         id="cd-new-folder">📁 New Folder</button>
            </div>
          </div>

          <div class="cloud-layout">
            <!-- Sidebar -->
            <div class="cloud-sidebar">
              <div class="fe-nav-item active" data-section="files">
                <span class="fe-nav-icon">📁</span> My Drive
              </div>
              <div class="fe-nav-item" data-section="shared">
                <span class="fe-nav-icon">👥</span> Shared
              </div>
              <div class="fe-nav-item" data-section="recent">
                <span class="fe-nav-icon">🕐</span> Recent
              </div>
              <div class="fe-nav-item" data-section="backup">
                <span class="fe-nav-icon">💾</span> Backup
              </div>
              <div class="fe-nav-item" data-section="trash">
                <span class="fe-nav-icon">🗑️</span> Trash
              </div>

              <!-- Storage meter -->
              <div class="cloud-storage-meter" style="margin-top:auto">
                <div class="cloud-storage-label">
                  <span>Storage</span>
                  <span id="cd-used-label">0 B / 5 GB</span>
                </div>
                <div class="cloud-storage-bar-wrap">
                  <div class="cloud-storage-bar" id="cd-storage-bar" style="width:0%"></div>
                </div>
                <div style="font-size:10px;color:var(--text-disabled);margin-top:2px" id="cd-pct">0% used</div>
              </div>
            </div>

            <!-- Main content -->
            <div class="cloud-main">
              <div class="cloud-file-list" id="cd-file-list">
                <div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:12px;color:var(--text-muted)">
                  <div style="font-size:48px;animation:syncPulse 2s ease-in-out infinite">☁️</div>
                  <div>Loading cloud files...</div>
                </div>
              </div>
            </div>
          </div>

          <div class="app-status-bar">
            <span id="cd-status">Ready</span>
            <span id="cd-sync-status" style="margin-left:auto">●&nbsp; All files synced</span>
          </div>
        </div>
      `,
      onReady: (body) => _initCloudDrive(body),
    });
  }
});

function _initCloudDrive(body) {
  let currentSection = 'files';
  let selectedFiles  = new Set();

  _updateRegion();
  _updateStorage();
  _loadFiles('files');

  // Sidebar nav
  body.querySelectorAll('.fe-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      body.querySelectorAll('.fe-nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      currentSection = item.dataset.section;
      _loadFiles(currentSection);
    });
  });

  // Toolbar actions
  body.querySelector('#cd-sync').addEventListener('click', async () => {
    body.querySelector('#cd-sync').textContent = '⏳ Syncing...';
    body.querySelector('#cd-sync').disabled = true;
    await WebOS.Cloud.forceSync();
    setTimeout(() => {
      body.querySelector('#cd-sync').textContent = '🔄 Sync Now';
      body.querySelector('#cd-sync').disabled = false;
      _loadFiles(currentSection);
      _updateStorage();
      Notify({ title: 'Sync Complete', message: 'All files synced to cloud', type: 'success', icon: '☁️', duration: 3000 });
    }, 2000);
  });

  body.querySelector('#cd-upload').addEventListener('click', () => {
    WebOS.Kernel.Dialog.prompt({
      title: 'Upload File', message: 'Enter file content to upload:', placeholder: 'filename.txt',
      onConfirm: async (name) => {
        if (!name) return;
        const path    = '/cloud/' + name;
        const content = `# ${name}\nCloud file created at ${new Date().toLocaleString()}\n\nThis file is synced to the cloud.`;
        await WebOS.FS.writeFile(path, content);
        WebOS.Cloud.queueSync(path);
        setTimeout(() => {
          _loadFiles(currentSection); _updateStorage();
          Notify({ title: 'Upload Started', message: `"${name}" is being uploaded to cloud`, type: 'info', icon: '⬆️', duration: 3000 });
        }, 300);
      }
    });
  });

  body.querySelector('#cd-new-folder').addEventListener('click', () => {
    WebOS.Kernel.Dialog.prompt({
      title: 'New Cloud Folder', placeholder: 'Folder name', defaultValue: 'New Folder',
      onConfirm: async (name) => {
        if (!name) return;
        await WebOS.FS.createDir('/cloud/' + name);
        _loadFiles(currentSection);
      }
    });
  });

  // Listen for cloud sync events
  WebOS.Kernel.Events.on('cloud:synced', () => {
    if (body.isConnected) { _loadFiles(currentSection); _updateStorage(); }
  });
  WebOS.Kernel.Events.on('cloud:fileSynced', () => {
    if (body.isConnected) _updateStorage();
  });
  WebOS.Kernel.Events.on('cloud:metadataUpdated', () => {
    if (body.isConnected) { _loadFiles(currentSection); _updateStorage(); }
  });

  function _updateRegion() {
    const r = WebOS.Cloud.getRegion();
    body.querySelector('#cd-region-flag').textContent = r.flag;
    body.querySelector('#cd-region-name').textContent = r.id;
  }

  function _updateStorage() {
    const used = WebOS.Cloud.getUsedStorage();
    const max  = WebOS.Cloud.getMaxStorage();
    const pct  = (used / max * 100).toFixed(1);
    body.querySelector('#cd-storage-bar').style.width = pct + '%';
    body.querySelector('#cd-used-label').textContent  = `${WebOS.FS.formatSize(used)} / 5 GB`;
    body.querySelector('#cd-pct').textContent         = `${pct}% used`;
  }

  async function _loadFiles(section) {
    const list = body.querySelector('#cd-file-list');
    const status = body.querySelector('#cd-status');

    // Get files from local FS cloud sync
    let items = [];

    try {
      if (section === 'files') {
        items = await WebOS.FS.listDir('/cloud');
        const docItems = await WebOS.FS.listDir('/documents');
        items = [...docItems, ...items];
      } else if (section === 'backup') {
        items = await WebOS.FS.listDir('/cloud/backup');
      } else if (section === 'recent') {
        const allFiles = await WebOS.FS.getAllFiles();
        items = allFiles.filter(f => f.type === 'file').sort((a,b)=>b.modified-a.modified).slice(0,15);
      } else if (section === 'shared') {
        const cloudFiles = WebOS.Cloud.listCloudFiles('/shared');
        items = cloudFiles.map(f => ({
          ...f,
          synced: true // Display files on cloud as already synced
        }));
      } else {
        items = [];
      }
    } catch(e) { items = []; }

    status.textContent = `${items.length} item${items.length!==1?'s':''}`;

    if (items.length === 0) {
      list.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;color:var(--text-muted)">
          <div style="font-size:52px;opacity:0.4">☁️</div>
          <div>No files in this section</div>
          <button class="app-btn primary" id="cd-add-files">Add Files</button>
        </div>
      `;
      list.querySelector('#cd-add-files')?.addEventListener('click', () => AppRegistry.launch('files'));
      return;
    }

    // Header row
    list.innerHTML = `
      <div class="cloud-file-item" style="opacity:0.4;cursor:default;pointer-events:none;border-bottom:1px solid var(--border-subtle)">
        <span class="cloud-file-icon" style="opacity:0"> </span>
        <div class="cloud-file-info">
          <div class="cloud-file-name" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Name</div>
        </div>
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;width:100px;text-align:right">Modified</span>
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;width:70px;text-align:right">Size</span>
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;width:80px;text-align:right">Status</span>
      </div>
      ${items.map(item => {
        const syncStatus = item.synced !== false ? 'synced' : WebOS.Cloud.syncQueue.includes(item.path) ? 'syncing' : 'pending';
        const syncLabel  = { synced: '✅ Synced', syncing: '🔄 Syncing', pending: '⏳ Pending', error: '❌ Error' };
        return `
          <div class="cloud-file-item" data-path="${item.path}">
            <span class="cloud-file-icon">${WebOS.FS.getFileIcon(item.name, item.type)}</span>
            <div class="cloud-file-info">
              <div class="cloud-file-name">${item.name}</div>
              <div class="cloud-file-meta">${item.path}</div>
            </div>
            <span style="font-size:11px;color:var(--text-muted);width:100px;text-align:right;flex-shrink:0">${WebOS.FS.formatDate(item.modified)}</span>
            <span style="font-size:11px;color:var(--text-muted);width:70px;text-align:right;flex-shrink:0">${item.type==='dir'?'—':WebOS.FS.formatSize(item.size)}</span>
            <span class="cloud-file-sync-status sync-status-${syncStatus}" style="flex-shrink:0">
              <span class="sync-icon">${syncStatus==='syncing'?'🔄':syncStatus==='synced'?'✓':syncStatus==='pending'?'⏳':'✕'}</span>
              ${syncStatus}
            </span>
          </div>
        `;
      }).join('')}
    `;

    // Item click
    list.querySelectorAll('.cloud-file-item[data-path]').forEach(el => {
      let timer = null;
      el.addEventListener('click', () => {
        list.querySelectorAll('.cloud-file-item.selected').forEach(s => s.classList.remove('selected'));
        el.classList.add('selected');
        status.textContent = `Selected: ${el.dataset.path}`;
        if (timer) { clearTimeout(timer); timer = null;
          // Double click - open file
          const item = items.find(i => i.path === el.dataset.path);
          if (item?.type === 'file') {
            WebOS.FS.exists(el.dataset.path).then(async (exists) => {
              if (!exists) {
                Notify({title:'Downloading',message:`Fetching ${item.name} from Cloud...`,type:'info',icon:'☁️'});
                await WebOS.Cloud.downloadFile(el.dataset.path).catch(e => Notify({title:'Error',message:'Failed to download file',type:'error'}));
              }
              AppRegistry.launch('text-editor', { path: el.dataset.path });
            });
          }
        } else { timer = setTimeout(() => timer = null, 300); }
      });

      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        _showCloudCtxMenu(e, el.dataset.path, items.find(i=>i.path===el.dataset.path));
      });
    });
  }

  function _showCloudCtxMenu(e, path, item) {
    const ctx = document.getElementById('context-menu');
    ctx.innerHTML = `
      <div class="ctx-item" id="cctx-open"><span class="ctx-item-icon">📂</span> Open</div>
      <div class="ctx-item" id="cctx-sync"><span class="ctx-item-icon">🔄</span> Sync Now</div>
      <div class="ctx-item" id="cctx-download"><span class="ctx-item-icon">⬇️</span> Download</div>
      ${path.endsWith('.js') ? `<div class="ctx-sep"></div><div class="ctx-item" id="cctx-execute" style="color:var(--cyan)"><span class="ctx-item-icon">⚡</span> Run in Cloud</div>` : ''}
      <div class="ctx-sep"></div>
      <div class="ctx-item" id="cctx-share"><span class="ctx-item-icon">👥</span> Share...</div>
      <div class="ctx-item" id="cctx-versions"><span class="ctx-item-icon">⏱️</span> Version History</div>
      <div class="ctx-sep"></div>
      <div class="ctx-item danger" id="cctx-delete"><span class="ctx-item-icon">🗑️</span> Delete</div>
    `;
    ctx.style.left = e.clientX + 'px'; ctx.style.top = e.clientY + 'px';
    ctx.classList.remove('hidden');

    ctx.querySelector('#cctx-open').onclick = async () => { 
      ctx.classList.add('hidden'); 
      if (item?.type==='file') {
        if (!await WebOS.FS.exists(path)) {
          Notify({title:'Downloading',message:`Fetching from Cloud...`,type:'info',icon:'☁️'});
          await WebOS.Cloud.downloadFile(path).catch(()=>{});
        }
        AppRegistry.launch('text-editor',{path}); 
      }
    };
    ctx.querySelector('#cctx-sync').onclick = () => { ctx.classList.add('hidden'); WebOS.Cloud.queueSync(path); Notify({title:'Sync Queued',message:path,type:'info',icon:'🔄',duration:2000}); };
    ctx.querySelector('#cctx-download').onclick = async () => { 
      ctx.classList.add('hidden'); 
      Notify({title:'Downloading',message:`Saving "${path.split('/').pop()}" locally...`,type:'info',icon:'⬇️'});
      await WebOS.Cloud.downloadFile(path).catch(e => Notify({title:'Error',message:e.message,type:'error'}));
      Notify({title:'Downloaded',message:`Saved successfully.`,type:'success',icon:'✅',duration:2000}); 
      _loadFiles(currentSection);
    };
    
    const execBtn = ctx.querySelector('#cctx-execute');
    if (execBtn) {
      execBtn.onclick = async () => {
        ctx.classList.add('hidden');
        Notify({title:'Cloud Execution',message:`Running script on server...`,type:'info',icon:'⚡'});
        try {
          let node = await WebOS.FS.getStat(path);
          if (!node) {
            await WebOS.Cloud.downloadFile(path);
            node = await WebOS.FS.getStat(path);
          }
          const res = await WebOS.Cloud.executeScript(node?.content || '');
          WebOS.Kernel.Dialog.alert({
            title: 'Serverless Execution Result',
            message: `<strong>Output Logs:</strong><br><pre style="background:var(--surface-sunken);padding:10px;border-radius:6px;max-height:200px;overflow-y:auto;font-family:monospace;margin-top:10px;color:var(--text-muted);font-size:12px">${res.logs || 'No output returned'}</pre>`
          });
        } catch(e) {
          WebOS.Kernel.Dialog.alert({ title: 'Execution Failed', message: `<span style="color:var(--danger)">${e.message}</span>` });
        }
      };
    }

    ctx.querySelector('#cctx-delete').onclick = () => {
      ctx.classList.add('hidden');
      WebOS.Kernel.Dialog.confirm({
        title:'Delete Cloud File', message:`Delete "${path.split('/').pop()}" from cloud and local storage?`, dangerous:true,
        onConfirm: async () => { 
          await WebOS.Cloud.deleteCloudFile(path).catch(()=>{});
          await WebOS.FS.deleteEntry(path).catch(()=>{}); 
          _loadFiles(currentSection); _updateStorage(); 
        }
      });
    };

    ctx.querySelector('#cctx-share').onclick = () => {
      ctx.classList.add('hidden');
      WebOS.Kernel.Dialog.prompt({
        title: 'Share File',
        message: `Enter username to share "${path.split('/').pop()}" with:`,
        onSubmit: async (username) => {
          if (!username) return;
          try {
            await WebOS.Cloud.shareFile(path, username);
            Notify({title:'Shared', message:`File shared with ${username}`, type:'success', icon:'✅'});
          } catch(e) {
            Notify({title:'Error', message:e.message, type:'error', icon:'❌'});
          }
        }
      });
    };

    ctx.querySelector('#cctx-versions').onclick = async () => {
      ctx.classList.add('hidden');
      try {
        const versions = await WebOS.Cloud.getVersions(path);
        if (!versions || versions.length === 0) {
          WebOS.Kernel.Dialog.alert({ title: 'Version History', message: 'No previous versions found for this file.' });
          return;
        }

        const html = versions.map(v => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05)">
            <div>
              <div style="font-weight:bold; color:var(--cyan)">Version ${v.version}</div>
              <div style="font-size:11px; color:var(--text-muted)">${new Date(v.timestamp).toLocaleString()} • ${WebOS.FS.formatSize(v.size)}</div>
            </div>
            <button class="app-btn" onclick="document.dispatchEvent(new CustomEvent('restore_ver', {detail:{path:'${path}', ver:${v.version}}}))">Restore</button>
          </div>
        `).join('');

        const dlg = WebOS.Kernel.Dialog.alert({
          title: `Version History: ${path.split('/').pop()}`,
          message: `<div style="max-height:300px; overflow-y:auto; padding-right:8px;">${html}</div>`
        });

        // Add a temporary listener for the restore button clicks inside the HTML
        const restoreListener = async (e) => {
          document.removeEventListener('restore_ver', restoreListener);
          try {
            await WebOS.Cloud.restoreVersion(e.detail.path, e.detail.ver);
            Notify({title:'Restored', message:`Restored version ${e.detail.ver}`, type:'success', icon:'✅'});
            _loadFiles(currentSection);
          } catch(err) {
            Notify({title:'Error', message:err.message, type:'error', icon:'❌'});
          }
        };
        document.addEventListener('restore_ver', restoreListener);

      } catch(e) {
        Notify({title:'Error', message:e.message, type:'error', icon:'❌'});
      }
    };
  }
}
