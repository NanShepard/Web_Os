/* ============================================
   NexOS — Task Manager App
   ============================================ */

'use strict';

AppRegistry.register({
  id: 'task-manager',
  name: 'Task Manager',
  icon: '📊',

  launch() {
    const id = 'task-manager-win';
    if (WebOS.WindowManager.isOpen(id)) { WebOS.WindowManager.focusWindow(id); return; }

    WebOS.WindowManager.createWindow({
      id, title: 'Task Manager', icon: '📊',
      width: 860, height: 560,
      content: `
        <div class="app-container">
          <div class="tm-tabs">
            <div class="tm-tab active" data-tab="processes">Processes</div>
            <div class="tm-tab"        data-tab="performance">Performance</div>
            <div class="tm-tab"        data-tab="cloud">Cloud</div>
            <div class="tm-tab"        data-tab="network">Network</div>
            <div style="margin-left:auto;display:flex;align-items:center;padding:0 12px;gap:8px">
              <button class="app-btn" id="tm-refresh">⟳ Refresh</button>
              <button class="app-btn danger" id="tm-end-task" disabled>End Task</button>
            </div>
          </div>
          <div class="tm-content" id="tm-content"></div>
          <div class="app-status-bar">
            <span id="tm-status">
              CPU: <span id="tm-cpu-status">—</span>% &nbsp;|&nbsp;
              RAM: <span id="tm-ram-status">—</span>% &nbsp;|&nbsp;
              Windows: <span id="tm-win-count">0</span>
            </span>
          </div>
        </div>
      `,
      onReady: (body) => _initTaskManager(body),
    });
  }
});

function _initTaskManager(body) {
  let currentTab = 'processes';
  let selectedPid  = null;
  let refreshTimer = null;
  let graphBars    = {};

  // Tabs
  body.querySelectorAll('.tm-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      body.querySelectorAll('.tm-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      renderTab();
    });
  });

  body.querySelector('#tm-refresh').addEventListener('click', renderTab);
  body.querySelector('#tm-end-task').addEventListener('click', () => {
    if (!selectedPid) return;
    WebOS.Kernel.ProcessManager.kill(selectedPid);
    selectedPid = null;
    body.querySelector('#tm-end-task').disabled = true;
    renderTab();
  });

  // Auto-refresh every 2s
  refreshTimer = setInterval(() => { if (body.isConnected) renderTab(true); else clearInterval(refreshTimer); }, 2000);
  renderTab();

  function renderTab(silent = false) {
    const content = body.querySelector('#tm-content');
    switch(currentTab) {
      case 'processes':  renderProcesses(content); break;
      case 'performance':renderPerformance(content, silent); break;
      case 'cloud':      renderCloud(content); break;
      case 'network':    renderNetwork(content); break;
    }
    _updateStatusBar();
  }

  function _updateStatusBar() {
    const cpu  = WebOS.Kernel.ProcessManager.getCpuUsage();
    const mem  = WebOS.Kernel.ProcessManager.getMemUsage();
    const wins = WebOS.WindowManager.getAllWindows().length;
    const cpuEl = body.querySelector('#tm-cpu-status');
    const ramEl = body.querySelector('#tm-ram-status');
    const winEl = body.querySelector('#tm-win-count');
    if (cpuEl) cpuEl.textContent = cpu;
    if (ramEl) ramEl.textContent = mem;
    if (winEl) winEl.textContent = wins;
  }

  // ── Processes Tab ──
  function renderProcesses(content) {
    const processes  = WebOS.Kernel.ProcessManager.getAll();
    const allWindows = WebOS.WindowManager.getAllWindows();

    const rows = [
      { pid: 1,    name: 'nexos-kernel',      cpu: 0.1, mem: 2.1,  status: 'running', type: 'System' },
      { pid: 2,    name: 'nexos-cloud-sync',  cpu: 0.5, mem: 1.8,  status: 'running', type: 'System' },
      { pid: 3,    name: 'nexos-fs',          cpu: 0.0, mem: 3.5,  status: 'running', type: 'System' },
      { pid: 4,    name: 'nexos-wm',          cpu: 0.2, mem: 1.2,  status: 'running', type: 'System' },
      { pid: 5,    name: 'nexos-taskbar',     cpu: 0.1, mem: 0.8,  status: 'running', type: 'System' },
      ...processes.map(p => ({
        pid:    p.pid,
        name:   p.name.toLowerCase().replace(' ','-'),
        cpu:    parseFloat((Math.random()*8+0.5).toFixed(1)),
        mem:    parseFloat((Math.random()*15+1).toFixed(1)),
        status: 'running',
        type:   'App',
      })),
    ];

    content.innerHTML = `
      <table class="tm-table">
        <thead>
          <tr>
            <th>Process Name</th>
            <th style="width:80px;text-align:right">PID</th>
            <th style="width:120px;text-align:right">CPU</th>
            <th style="width:120px;text-align:right">Memory</th>
            <th style="width:80px">Type</th>
            <th style="width:70px">Status</th>
          </tr>
        </thead>
        <tbody id="tm-proc-body">
          ${rows.map(r => `
            <tr data-pid="${r.pid}" class="${r.pid === selectedPid ? 'selected' : ''}">
              <td>
                <div class="tm-process-name">
                  <span style="font-size:14px">${r.type==='App'?'🪟':'⚙️'}</span>
                  <span>${r.name}</span>
                </div>
              </td>
              <td style="text-align:right;font-family:var(--font-mono);color:var(--text-muted)">${String(r.pid).slice(-5)}</td>
              <td style="text-align:right">
                <span class="tm-usage-bar"><span class="tm-usage-fill cpu" style="width:${Math.min(r.cpu*5,100)}%"></span></span>
                <span style="font-family:var(--font-mono)">${r.cpu}%</span>
              </td>
              <td style="text-align:right">
                <span class="tm-usage-bar"><span class="tm-usage-fill mem" style="width:${Math.min(r.mem*3,100)}%"></span></span>
                <span style="font-family:var(--font-mono)">${r.mem}%</span>
              </td>
              <td><span style="font-size:11px;color:var(--${r.type==='App'?'cyan':'purple'})">${r.type}</span></td>
              <td><span style="font-size:11px;color:var(--green)">● ${r.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Row selection
    content.querySelectorAll('tbody tr').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        content.querySelectorAll('tbody tr').forEach(r => r.style.background = '');
        row.style.background = 'rgba(0,212,255,0.07)';
        selectedPid = parseInt(row.dataset.pid);
        const endBtn = body.querySelector('#tm-end-task');
        const proc   = rows.find(r => r.pid === selectedPid);
        endBtn.disabled = !proc || proc.type !== 'App';
      });
    });
  }

  // ── Performance Tab ──
  const perfHistory = { cpu:[], mem:[], disk:[], cloud:[] };

  function renderPerformance(content, update = false) {
    const cpu  = WebOS.Kernel.ProcessManager.getCpuUsage();
    const mem  = WebOS.Kernel.ProcessManager.getMemUsage();
    const disk = Math.floor(Math.random() * 8  + 1);
    const cloud= Math.floor(Math.random() * 20 + 2);

    if (!update || !content.querySelector('.tm-perf-grid')) {
      content.innerHTML = `
        <div class="tm-perf-grid">
          ${_perfCard('CPU', cpu, '%', 'cyan', 'cpu')}
          ${_perfCard('Memory', mem, '%', 'purple', 'mem')}
          ${_perfCard('Disk I/O', disk, ' MB/s', 'green', 'disk')}
          ${_perfCard('Cloud Sync', cloud, ' KB/s', 'yellow', 'cloud')}
        </div>
        <div style="padding:14px;display:flex;flex-direction:column;gap:10px">
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">System Info</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
            ${[
              ['OS', 'NexOS 2.4.1'],
              ['Build', 'Cloud Edition'],
              ['Uptime', `${WebOS.Kernel.getUptime()}s`],
              ['Processes', `${WebOS.Kernel.ProcessManager.getAll().length + 5}`],
              ['Windows', `${WebOS.WindowManager.getAllWindows().length}`],
              ['Cloud Region', WebOS.Cloud.getRegion().id],
            ].map(([k,v])=>`
              <div style="background:rgba(255,255,255,0.025);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px 12px">
                <div style="font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">${k}</div>
                <div style="font-size:14px;font-family:var(--font-mono);color:var(--text-primary)">${v}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      // Update values only
      ['cpu','mem','disk','cloud'].forEach((key, i) => {
        const els = content.querySelectorAll('.tm-perf-value');
        const idx = content.querySelectorAll('.tm-perf-title');
        if (els[i]) {
          const vals = [cpu, mem, disk, cloud];
          const sfxs = ['%','%',' MB/s',' KB/s'];
          els[i].textContent = `${vals[i]}${sfxs[i]}`;
        }
      });
    }

    // Update graph bars
    ['cpu','mem','disk','cloud'].forEach((key,i) => {
      const vals = [cpu, mem, disk, cloud];
      const max  = [100, 100, 100, 100];
      if (!perfHistory[key]) perfHistory[key] = [];
      perfHistory[key].push(vals[i]);
      if (perfHistory[key].length > 20) perfHistory[key].shift();
      const graph = content.querySelector(`#graph-${key}`);
      if (graph) _renderGraph(graph, perfHistory[key], max[i], key);
    });
  }

  function _perfCard(title, value, suffix, color, key) {
    return `
      <div class="tm-perf-card">
        <div class="tm-perf-header">
          <span class="tm-perf-title">${title}</span>
          <div class="tm-perf-value ${color}">${value}${suffix}</div>
        </div>
        <div class="tm-graph" id="graph-${key}"></div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted)">
          <span>0%</span><span>100%</span>
        </div>
      </div>
    `;
  }

  function _renderGraph(container, data, maxVal, key) {
    const colors = { cpu:'var(--cyan)', mem:'var(--purple)', disk:'var(--green)', cloud:'var(--yellow)' };
    const w = container.offsetWidth;
    const barW = Math.max(2, Math.floor(w / 22));
    container.innerHTML = data.map((v, i) => `
      <div class="tm-graph-bar" style="
        left:${(i / 20) * 100}%;
        height:${Math.min((v/maxVal)*100, 100)}%;
        width:${barW}px;
        background:${colors[key]};
        opacity:${0.3 + (i/data.length)*0.7};
      "></div>
    `).join('');
  }

  // ── Cloud Tab ──
  function renderCloud(content) {
    const syncLog = WebOS.Cloud.getSyncLog().slice(0, 25);
    const used    = WebOS.Cloud.getUsedStorage();
    const max     = WebOS.Cloud.getMaxStorage();
    const servers = WebOS.Cloud.getServers();
    const region  = WebOS.Cloud.getRegion();
    const net     = WebOS.Cloud.getNetworkStats();

    content.innerHTML = `
      <div class="cloud-dashboard">
        <div class="cloud-stat-row">
          <div class="cloud-stat-card">
            <span class="cloud-stat-icon">☁️</span>
            <span class="cloud-stat-label">Cloud Storage</span>
            <span class="cloud-stat-value cyan">${WebOS.FS.formatSize(used)}</span>
            <span class="cloud-stat-sub">of 5 GB (${((used/max)*100).toFixed(1)}%)</span>
          </div>
          <div class="cloud-stat-card">
            <span class="cloud-stat-icon">⬆️</span>
            <span class="cloud-stat-label">Total Uploaded</span>
            <span class="cloud-stat-value green">${WebOS.FS.formatSize(net.totalUp)}</span>
            <span class="cloud-stat-sub">this session</span>
          </div>
          <div class="cloud-stat-card">
            <span class="cloud-stat-icon">🌐</span>
            <span class="cloud-stat-label">Active Region</span>
            <span class="cloud-stat-value purple" style="font-size:18px">${region.flag} ${region.id}</span>
            <span class="cloud-stat-sub">~${region.latency}ms latency</span>
          </div>
        </div>

        <div>
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Cloud Servers</div>
          <div class="server-list">
            ${servers.map(s => `
              <div class="server-item">
                <div class="server-status-dot ${s.status}"></div>
                <div class="server-name">${s.id}</div>
                <div class="server-region">${s.region}</div>
                <div class="server-stats">
                  <div class="server-stat">${s.type}</div>
                  <div class="server-stat"><span>${s.cores}</span> vCPU</div>
                  <div class="server-stat"><span>${s.ram}</span> RAM</div>
                  <div class="server-stat" style="color:${s.status==='online'?'var(--green)':'var(--red)'}">● ${s.status}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div>
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Sync Log</div>
          <div style="background:rgba(0,0,0,0.2);border:1px solid var(--border-subtle);border-radius:var(--radius-md);font-family:var(--font-mono);font-size:11.5px;max-height:180px;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:3px">
            ${syncLog.length === 0 ? '<span style="color:var(--text-muted)">No sync logs yet.</span>' :
              syncLog.map(l => {
                const time  = new Date(l.timestamp).toLocaleTimeString();
                const color = l.status === 'success' ? 'var(--green)' : 'var(--red)';
                return `<div><span style="color:var(--text-muted)">[${time}]</span> <span style="color:${color}">${l.status.toUpperCase().padEnd(7)}</span> <span style="color:var(--cyan)">${l.action.padEnd(14)}</span> ${l.path}</div>`;
              }).join('')
            }
          </div>
        </div>
      </div>
    `;
  }

  // ── Network Tab ──
  function renderNetwork(content) {
    const net = WebOS.Cloud.getNetworkStats();

    content.innerHTML = `
      <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
        <div class="cloud-stat-row">
          <div class="cloud-stat-card">
            <span class="cloud-stat-icon">⬆️</span>
            <span class="cloud-stat-label">Upload</span>
            <span class="cloud-stat-value cyan">${net.up || 0} B/s</span>
            <span class="cloud-stat-sub">Total: ${WebOS.FS.formatSize(net.totalUp || 0)}</span>
          </div>
          <div class="cloud-stat-card">
            <span class="cloud-stat-icon">⬇️</span>
            <span class="cloud-stat-label">Download</span>
            <span class="cloud-stat-value green">${net.down || 0} B/s</span>
            <span class="cloud-stat-sub">Total: ${WebOS.FS.formatSize(net.totalDown || 0)}</span>
          </div>
          <div class="cloud-stat-card">
            <span class="cloud-stat-icon">📶</span>
            <span class="cloud-stat-label">Latency</span>
            <span class="cloud-stat-value purple">${WebOS.Cloud.getRegion().latency}ms</span>
            <span class="cloud-stat-sub">${WebOS.Cloud.getRegion().id}</span>
          </div>
        </div>

        <div style="background:rgba(0,0,0,0.2);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:16px">
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Network Interfaces</div>
          ${[
            { name: 'nexos-cloud0',  type:'Cloud Tunnel', ip:'10.0.0.1',   speed:'1 Gbps',  status:'up' },
            { name: 'nexos-sync0',   type:'Sync Engine',  ip:'172.16.0.1', speed:'100 Mbps',status:'up' },
            { name: 'nexos-lo',      type:'Loopback',     ip:'127.0.0.1',  speed:'—',        status:'up' },
          ].map(iface => `
            <div style="display:flex;align-items:center;gap:14px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.03)">
              <div style="width:8px;height:8px;border-radius:50%;background:${iface.status==='up'?'var(--green)':'var(--red)'}"></div>
              <div style="flex:1;font-size:13px;font-family:var(--font-mono)">${iface.name}</div>
              <div style="font-size:11px;color:var(--text-muted);width:120px">${iface.type}</div>
              <div style="font-size:11px;color:var(--text-primary);font-family:var(--font-mono);width:100px">${iface.ip}</div>
              <div style="font-size:11px;color:var(--text-muted)">${iface.speed}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
}
