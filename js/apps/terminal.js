/* ============================================
   NexOS — Terminal App
   ============================================ */

'use strict';

AppRegistry.register({
  id: 'terminal',
  name: 'Terminal',
  icon: '💻',

  launch(params) {
    const id = 'terminal-win';
    if (WebOS.WindowManager.isOpen(id)) { WebOS.WindowManager.focusWindow(id); return; }

    WebOS.WindowManager.createWindow({
      id, title: 'Terminal', icon: '💻',
      width: 720, height: 460,
      content: `
        <div class="terminal-container" id="term-root">
          <div class="terminal-output" id="term-output"></div>
          <div class="terminal-input-row">
            <div class="term-prompt">
              <span class="prompt-user">${WebOS.Kernel.getUser()}</span><span class="prompt-at">@</span><span class="prompt-host">nexos</span><span class="prompt-at">:</span><span class="prompt-path" id="term-cwd">~</span>$ &nbsp;
            </div>
            <input type="text" id="terminal-input" spellcheck="false" autocomplete="off" autocorrect="off">
          </div>
        </div>
      `,
      onReady: (body) => _initTerminal(body, params),
    });
  }
});

function _initTerminal(body, params) {
  const output = body.querySelector('#term-output');
  const input  = body.querySelector('#terminal-input');
  const cwdEl  = body.querySelector('#term-cwd');

  let cwd = '/home';
  const history = [];
  let histIdx = -1;

  // Welcome message
  printLines([
    { text: `NexOS Terminal v2.4.1`, cls: 'info' },
    { text: `Logged in as: ${WebOS.Kernel.getUser()} | Cloud region: ${WebOS.Cloud.getRegion().id}`, cls: 'white' },
    { text: `Type 'help' to see available commands.`, cls: 'muted' },
    { text: ``, cls: 'white' },
  ]);

  // Run startup command if provided
  if (params?.cmd) setTimeout(() => runCommand(params.cmd), 200);

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const cmd = input.value.trim();
      if (cmd) { history.unshift(cmd); histIdx = -1; }
      print(`${WebOS.Kernel.getUser()}@nexos:${cwdDisplay()}$ ${cmd}`, 'cmd');
      input.value = '';
      if (cmd) await runCommand(cmd);
      scrollToBottom();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (histIdx < history.length - 1) { histIdx++; input.value = history[histIdx]; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx > 0) { histIdx--; input.value = history[histIdx]; }
      else { histIdx = -1; input.value = ''; }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      await autocomplete(input.value);
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      output.innerHTML = '';
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      print('^C', 'error');
    }
  });

  // Auto-focus
  body.addEventListener('click', () => input.focus());
  input.focus();

  function cwdDisplay() {
    if (cwd === '/home') return '~';
    if (cwd.startsWith('/home')) return '~' + cwd.slice(5);
    return cwd;
  }

  function print(text, cls = 'white') {
    const line = document.createElement('div');
    line.className = `term-line ${cls}`;
    line.textContent = text;
    output.appendChild(line);
    scrollToBottom();
  }

  function printLines(lines) {
    lines.forEach(l => print(l.text, l.cls));
  }

  function printHTML(html) {
    const line = document.createElement('div');
    line.className = 'term-line white';
    line.innerHTML = html;
    output.appendChild(line);
    scrollToBottom();
  }

  function scrollToBottom() {
    output.scrollTop = output.scrollHeight;
    if (cwdEl) cwdEl.textContent = cwdDisplay();
  }

  async function autocomplete(partial) {
    try {
      const items = await WebOS.FS.listDir(cwd);
      const names = items.map(i => i.name);
      const parts = partial.split(' ');
      const last  = parts[parts.length - 1];
      const matches = names.filter(n => n.startsWith(last));
      if (matches.length === 1) {
        parts[parts.length - 1] = matches[0];
        input.value = parts.join(' ');
      } else if (matches.length > 1) {
        print(matches.join('  '), 'muted');
      }
    } catch(e) {}
  }

  async function runCommand(raw) {
    const parts = raw.trim().split(/\s+/);
    const cmd   = parts[0].toLowerCase();
    const args  = parts.slice(1);

    // Cloud commands first
    if (cmd === 'cloud') {
      const result = await WebOS.Cloud.runShellCommand(raw);
      if (result !== null) { print(result, 'white'); return; }
    }

    switch (cmd) {
      case 'help':
        printLines([
          { text: 'NexOS Shell Commands:', cls: 'info' },
          { text: '  ls [path]        — list directory contents', cls: 'white' },
          { text: '  cd <path>        — change directory', cls: 'white' },
          { text: '  pwd              — print working directory', cls: 'white' },
          { text: '  mkdir <name>     — create directory', cls: 'white' },
          { text: '  touch <name>     — create empty file', cls: 'white' },
          { text: '  cat <file>       — print file contents', cls: 'white' },
          { text: '  echo <text>      — print text', cls: 'white' },
          { text: '  rm <path>        — remove file/folder', cls: 'white' },
          { text: '  cp <src> <dst>   — copy file', cls: 'white' },
          { text: '  mv <src> <dst>   — move/rename file', cls: 'white' },
          { text: '  nano <file>      — open text editor', cls: 'white' },
          { text: '  top              — process list', cls: 'white' },
          { text: '  df               — disk usage', cls: 'white' },
          { text: '  whoami           — current user', cls: 'white' },
          { text: '  uname            — system info', cls: 'white' },
          { text: '  date             — current date/time', cls: 'white' },
          { text: '  uptime           — system uptime', cls: 'white' },
          { text: '  clear            — clear terminal', cls: 'white' },
          { text: '  cloud help       — cloud commands', cls: 'cyan' },
          { text: '', cls: 'white' },
        ]);
        break;

      case 'ls':
      case 'dir': {
        const target = args[0] ? _resolvePath(args[0]) : cwd;
        try {
          const items = await WebOS.FS.listDir(target);
          if (items.length === 0) { print('(empty directory)', 'muted'); break; }
          const cols = items.map(i => {
            const color = i.type === 'dir' ? 'color:var(--cyan)' : 'color:var(--text-secondary)';
            const icon  = WebOS.FS.getFileIcon(i.name, i.type);
            const size  = i.type === 'file' ? WebOS.FS.formatSize(i.size).padStart(8) : '     DIR';
            return `<span style="${color}">${icon} ${i.name.padEnd(24)}${size}</span>`;
          });
          printHTML(cols.join('\n').split('\n').map(l => l).join('<br>'));
        } catch(e) { print(`ls: ${e.message}`, 'error'); }
        break;
      }

      case 'cd': {
        if (!args[0] || args[0] === '~') { cwd = '/home'; break; }
        const target = _resolvePath(args[0]);
        try {
          const stat = await WebOS.FS.getStat(target);
          if (!stat) { print(`cd: ${args[0]}: No such file or directory`, 'error'); break; }
          if (stat.type !== 'dir') { print(`cd: ${args[0]}: Not a directory`, 'error'); break; }
          cwd = target;
        } catch(e) { print(`cd: ${e.message}`, 'error'); }
        break;
      }

      case 'pwd':
        print(cwd, 'white');
        break;

      case 'mkdir': {
        if (!args[0]) { print('mkdir: missing operand', 'error'); break; }
        try {
          await WebOS.FS.createDir(_resolvePath(args[0]));
          print(`Directory created: ${args[0]}`, 'ok');
        } catch(e) { print(`mkdir: ${e.message}`, 'error'); }
        break;
      }

      case 'touch': {
        if (!args[0]) { print('touch: missing operand', 'error'); break; }
        try {
          await WebOS.FS.writeFile(_resolvePath(args[0]), '');
          print(`File created: ${args[0]}`, 'ok');
        } catch(e) { print(`touch: ${e.message}`, 'error'); }
        break;
      }

      case 'cat': {
        if (!args[0]) { print('cat: missing operand', 'error'); break; }
        try {
          const content = await WebOS.FS.readFile(_resolvePath(args[0]));
          print(content || '(empty file)', 'white');
        } catch(e) { print(`cat: ${e.message}`, 'error'); }
        break;
      }

      case 'echo':
        print(args.join(' '), 'white');
        break;

      case 'rm': {
        if (!args[0]) { print('rm: missing operand', 'error'); break; }
        try {
          await WebOS.FS.deleteEntry(_resolvePath(args[0]));
          print(`Removed: ${args[0]}`, 'ok');
        } catch(e) { print(`rm: ${e.message}`, 'error'); }
        break;
      }

      case 'mv': {
        if (!args[0] || !args[1]) { print('mv: missing operand', 'error'); break; }
        try {
          await WebOS.FS.renameEntry(_resolvePath(args[0]), args[1]);
          print(`Moved: ${args[0]} → ${args[1]}`, 'ok');
        } catch(e) { print(`mv: ${e.message}`, 'error'); }
        break;
      }

      case 'cp': {
        if (!args[0] || !args[1]) { print('cp: missing operand', 'error'); break; }
        try {
          const content = await WebOS.FS.readFile(_resolvePath(args[0]));
          await WebOS.FS.writeFile(_resolvePath(args[1]), content);
          print(`Copied: ${args[0]} → ${args[1]}`, 'ok');
        } catch(e) { print(`cp: ${e.message}`, 'error'); }
        break;
      }

      case 'nano':
      case 'vim':
      case 'vi':
      case 'edit': {
        if (!args[0]) { print(`${cmd}: missing filename`, 'error'); break; }
        const path = _resolvePath(args[0]);
        AppRegistry.launch('text-editor', { path });
        print(`Opened "${args[0]}" in Text Editor`, 'info');
        break;
      }

      case 'top':
      case 'htop':
        AppRegistry.launch('task-manager');
        print('Launched Task Manager', 'info');
        break;

      case 'df': {
        const used  = await WebOS.FS.getTotalSize();
        const total = 10 * 1024 * 1024 * 1024; // 10 GB virtual disk
        print(`Filesystem       Size   Used  Avail  Use%  Mounted on`, 'info');
        print(`nexos-vdisk     10 GB  ${WebOS.FS.formatSize(used).padEnd(6)} ${WebOS.FS.formatSize(total-used).padEnd(6)} ${((used/total)*100).toFixed(1)}%  /`, 'white');
        print(`nexos-cloud      5 GB  ${WebOS.FS.formatSize(WebOS.Cloud.getUsedStorage()).padEnd(6)} ${WebOS.FS.formatSize(WebOS.Cloud.getMaxStorage()-WebOS.Cloud.getUsedStorage()).padEnd(6)} ${((WebOS.Cloud.getUsedStorage()/WebOS.Cloud.getMaxStorage())*100).toFixed(1)}%  /cloud`, 'white');
        break;
      }

      case 'whoami':
        print(WebOS.Kernel.getUser(), 'white');
        break;

      case 'uname':
        print(`NexOS 2.4.1 (Cloud Edition) - WebKit/Browser - x86_64`, 'white');
        break;

      case 'date':
        print(new Date().toString(), 'white');
        break;

      case 'uptime': {
        const s  = WebOS.Kernel.getUptime();
        const m  = Math.floor(s/60), h = Math.floor(m/60);
        print(`up ${h > 0 ? h+'h ' : ''}${m%60}m ${s%60}s,  load: ${(Math.random()*2).toFixed(2)} ${(Math.random()*1.5).toFixed(2)} ${(Math.random()).toFixed(2)}`, 'white');
        break;
      }

      case 'clear':
        output.innerHTML = '';
        break;

      case 'neofetch':
      case 'fetch':
        _printNeofetch();
        break;

      case 'ps': {
        const procs = WebOS.Kernel.ProcessManager.getAll();
        print('  PID  NAME             STATUS', 'info');
        procs.forEach((p, i) => print(`  ${String(p.pid).slice(-5)}  ${p.name.padEnd(16)}  running`, 'white'));
        break;
      }

      case 'ssh': {
        if (!args[0]) { print('ssh: missing hostname', 'error'); break; }
        print(`Connecting to ${args[0]}...`, 'info');
        await new Promise(r => setTimeout(r, 800 + Math.random()*600));
        const server = WebOS.Cloud.getServers().find(s => args[0].includes(s.id)) || WebOS.Cloud.getServers()[0];
        print(`Connected to ${server.id} (${server.region}) — ${server.type}`, 'ok');
        print(`Welcome to NexOS Cloud Instance (${server.cores} vCPU, ${server.ram})`, 'white');
        break;
      }

      case 'ping': {
        if (!args[0]) { print('ping: usage: ping <host>', 'error'); break; }
        print(`PING ${args[0]} (127.0.0.1): 56 data bytes`, 'white');
        for (let i = 0; i < 4; i++) {
          await new Promise(r => setTimeout(r, 200 + Math.random() * 100));
          print(`64 bytes from ${args[0]}: icmp_seq=${i} ttl=64 time=${(Math.random()*30+5).toFixed(1)} ms`, 'white');
        }
        break;
      }

      case '':
        break;

      default:
        print(`${cmd}: command not found. Type 'help' for a list of commands.`, 'error');
    }
  }

  function _resolvePath(p) {
    if (p.startsWith('/')) return WebOS.FS.normalizePath(p);
    if (p === '..') {
      const parent = cwd.substring(0, cwd.lastIndexOf('/')) || '/';
      return parent;
    }
    if (p === '.') return cwd;
    return WebOS.FS.normalizePath((cwd === '/' ? '' : cwd) + '/' + p);
  }

  function _printNeofetch() {
    const user    = WebOS.Kernel.getUser();
    const uptime  = WebOS.Kernel.getUptime();
    const region  = WebOS.Cloud.getRegion();
    const m       = WebOS.Kernel.getMetrics();
    const memStr  = m.clientMemMB ? `${m.clientMemMB} MB / ${m.clientMemTotalMB} MB (${m.clientMem}%)` : `${WebOS.Kernel.ProcessManager.getMemUsage()}%`;
    const srvMem  = m.serverMemUsedMB ? `${m.serverMemUsedMB} MB / ${m.serverMemTotalMB} MB` : '—';
    const cpuStr  = m.serverCpuModel || 'Unknown';
    const host    = m.serverHostname || 'browser';
    printHTML(`
      <span style="color:var(--cyan)">
        ███╗  ██╗███████╗██╗  ██╗ ██████╗ ███████╗  <span style="color:white">${user}@nexos</span><br>
        ████╗ ██║██╔════╝╚██╗██╔╝██╔═══██╗██╔════╝  <span style="color:var(--text-muted)">──────────────────────</span><br>
        ██╔██╗██║█████╗   ╚███╔╝ ██║   ██║███████╗  <span style="color:var(--purple)">OS</span>:      NexOS 2.4.1 Cloud Edition<br>
        ██║╚████║██╔══╝   ██╔██╗ ██║   ██║╚════██║  <span style="color:var(--purple)">Host</span>:    ${host} (${m.serverPlatform || 'browser'})<br>
        ██║ ╚███║███████╗██╔╝ ██╗╚██████╔╝███████║  <span style="color:var(--purple)">CPU</span>:     ${cpuStr} (${m.serverCores || '?'})<br>
        ╚═╝  ╚══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝  <span style="color:var(--purple)">Shell</span>:   nexsh 1.0<br>
                                                     <span style="color:var(--purple)">Cloud</span>:   ${region.flag} ${region.id}<br>
                                                     <span style="color:var(--purple)">Client</span>:  ${memStr}<br>
                                                     <span style="color:var(--purple)">Server</span>:  ${srvMem}<br>
                                                     <span style="color:var(--purple)">Uptime</span>:  ${uptime}s<br>
      </span>
    `);
  }
}
