/* ============================================
   NexOS — NexNotebook (Colab-style Python)
   Powered by Pyodide (Python in WebAssembly)
   ============================================ */

'use strict';

AppRegistry.register({
  id: 'python-repl',
  name: 'NexNotebook',
  icon: '🐍',

  launch(params) {
    const id = 'nexnotebook-win';
    if (WebOS.WindowManager.isOpen(id)) { WebOS.WindowManager.focusWindow(id); return; }

    WebOS.WindowManager.createWindow({
      id, title: 'NexNotebook — Python', icon: '🐍',
      width: 900, height: 650,
      content: _buildNotebookHTML(),
      onReady: (body) => _initNotebook(body),
    });
  }
});

function _buildNotebookHTML() {
  return `
    <style>
      /* ── NexNotebook Styles ── */
      .nb-root { display:flex; flex-direction:column; height:100%; font-family:'Inter',sans-serif; background:#0d1117; color:#c9d1d9; overflow:hidden; }

      /* Loading overlay */
      .nb-loading { position:absolute; inset:0; z-index:50; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#0d1117; gap:20px; transition:opacity .5s; }
      .nb-loading.hide { opacity:0; pointer-events:none; }
      .nb-load-spinner { width:48px; height:48px; border:3px solid rgba(88,166,255,.15); border-top-color:#58a6ff; border-radius:50%; animation:nbSpin 1s linear infinite; }
      @keyframes nbSpin { to { transform:rotate(360deg); } }
      .nb-load-title { font-size:20px; font-weight:600; background:linear-gradient(135deg,#58a6ff,#bc8cff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
      .nb-load-msg { font-size:13px; color:#8b949e; max-width:300px; text-align:center; }

      /* Toolbar */
      .nb-toolbar { display:flex; align-items:center; gap:8px; padding:8px 16px; background:linear-gradient(180deg,#161b22,#0d1117); border-bottom:1px solid #21262d; flex-shrink:0; }
      .nb-tb-btn { padding:5px 12px; font-size:12px; font-weight:500; border:1px solid #30363d; border-radius:6px; background:#21262d; color:#c9d1d9; cursor:pointer; transition:all .15s; display:flex; align-items:center; gap:5px; }
      .nb-tb-btn:hover { background:#30363d; border-color:#58a6ff; color:#fff; }
      .nb-tb-btn:active { transform:scale(.96); }
      .nb-tb-btn.primary { background:linear-gradient(135deg,#238636,#2ea043); border-color:#2ea043; color:#fff; }
      .nb-tb-btn.primary:hover { background:linear-gradient(135deg,#2ea043,#3fb950); }
      .nb-tb-btn.danger { border-color:#f85149; color:#f85149; }
      .nb-tb-btn.danger:hover { background:rgba(248,81,73,.15); }
      .nb-tb-sep { width:1px; height:20px; background:#30363d; margin:0 4px; }
      .nb-tb-spacer { flex:1; }
      .nb-kernel-badge { display:flex; align-items:center; gap:6px; font-size:12px; padding:4px 10px; border-radius:12px; background:rgba(35,134,54,.1); border:1px solid rgba(35,134,54,.3); }
      .nb-kernel-badge .dot { width:7px; height:7px; border-radius:50%; background:#3fb950; box-shadow:0 0 6px rgba(63,185,80,.5); }
      .nb-kernel-badge.busy .dot { background:#d29922; box-shadow:0 0 6px rgba(210,153,34,.5); animation:nbPulse 1s ease infinite; }
      .nb-kernel-badge.busy { background:rgba(210,153,34,.1); border-color:rgba(210,153,34,.3); }
      .nb-kernel-badge.loading .dot { background:#58a6ff; animation:nbPulse 1s ease infinite; }
      .nb-kernel-badge.loading { background:rgba(88,166,255,.1); border-color:rgba(88,166,255,.3); }
      .nb-kernel-badge.error .dot { background:#f85149; }
      .nb-kernel-badge.error { background:rgba(248,81,73,.1); border-color:rgba(248,81,73,.3); }
      @keyframes nbPulse { 0%,100%{opacity:1} 50%{opacity:.4} }

      /* Scrollable cells area */
      .nb-cells-wrap { flex:1; overflow-y:auto; padding:16px 24px 80px; }

      /* Cell */
      .nb-cell { margin-bottom:12px; border:1px solid #21262d; border-radius:8px; background:#161b22; transition:border-color .2s, box-shadow .2s; position:relative; }
      .nb-cell:hover { border-color:#30363d; }
      .nb-cell.focused { border-color:#58a6ff; box-shadow:0 0 0 1px rgba(88,166,255,.3); }
      .nb-cell.running { border-color:#d29922; box-shadow:0 0 0 1px rgba(210,153,34,.2); }
      .nb-cell.error-cell { border-color:#f85149; }

      /* Cell header */
      .nb-cell-head { display:flex; align-items:center; gap:8px; padding:6px 12px; border-bottom:1px solid #21262d; font-size:11px; color:#8b949e; }
      .nb-cell-run { width:28px; height:28px; border:none; border-radius:6px; background:linear-gradient(135deg,#238636,#2ea043); color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:12px; transition:all .15s; flex-shrink:0; }
      .nb-cell-run:hover { transform:scale(1.08); box-shadow:0 2px 8px rgba(46,160,67,.4); }
      .nb-cell-run:disabled { background:#30363d; color:#484f58; cursor:wait; transform:none; box-shadow:none; }
      .nb-cell-idx { font-family:'JetBrains Mono',monospace; color:#8b949e; min-width:36px; text-align:center; font-size:11px; }
      .nb-cell-actions { margin-left:auto; display:flex; gap:4px; opacity:0; transition:opacity .15s; }
      .nb-cell:hover .nb-cell-actions { opacity:1; }
      .nb-cell-act { width:24px; height:24px; border:none; background:transparent; color:#8b949e; cursor:pointer; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:13px; }
      .nb-cell-act:hover { background:#30363d; color:#c9d1d9; }

      /* Code editor */
      .nb-code-wrap { position:relative; }
      .nb-code { width:100%; border:none; outline:none; resize:none; padding:12px 14px; font-family:'JetBrains Mono',monospace; font-size:13.5px; line-height:1.55; background:transparent; color:#c9d1d9; min-height:38px; overflow:hidden; }
      .nb-code::placeholder { color:#484f58; }

      /* Output */
      .nb-output { border-top:1px solid #21262d; background:#0d1117; display:none; max-height:400px; overflow-y:auto; }
      .nb-output.visible { display:block; }
      .nb-out-pre { margin:0; padding:10px 14px; font-family:'JetBrains Mono',monospace; font-size:13px; line-height:1.5; white-space:pre-wrap; word-break:break-word; color:#c9d1d9; }
      .nb-out-pre .err { color:#f85149; }

      /* Add cell button */
      .nb-add-row { display:flex; justify-content:center; padding:8px 0; }
      .nb-add-btn { padding:4px 16px; font-size:12px; color:#58a6ff; background:transparent; border:1px dashed #30363d; border-radius:6px; cursor:pointer; transition:all .15s; }
      .nb-add-btn:hover { background:rgba(88,166,255,.08); border-color:#58a6ff; }

      /* Light theme overrides */
      [data-theme="light"] .nb-root { background:#fff; color:#24292f; }
      [data-theme="light"] .nb-toolbar { background:linear-gradient(180deg,#f6f8fa,#fff); border-color:#d0d7de; }
      [data-theme="light"] .nb-tb-btn { background:#f6f8fa; border-color:#d0d7de; color:#24292f; }
      [data-theme="light"] .nb-tb-btn:hover { background:#eaeef2; }
      [data-theme="light"] .nb-cell { background:#fff; border-color:#d0d7de; }
      [data-theme="light"] .nb-cell.focused { border-color:#0969da; box-shadow:0 0 0 1px rgba(9,105,218,.3); }
      [data-theme="light"] .nb-cell-head { border-color:#d0d7de; }
      [data-theme="light"] .nb-code { color:#24292f; }
      [data-theme="light"] .nb-output { background:#f6f8fa; border-color:#d0d7de; }
      [data-theme="light"] .nb-out-pre { color:#24292f; }
      [data-theme="light"] .nb-loading { background:#fff; }
    </style>

    <div class="nb-root" id="nb-root">
      <div class="nb-loading" id="nb-loading">
        <div class="nb-load-spinner"></div>
        <div class="nb-load-title">Loading Python Runtime</div>
        <div class="nb-load-msg" id="nb-load-msg">Downloading Pyodide WebAssembly (~15 MB, cached after first load)...</div>
      </div>

      <div class="nb-toolbar" id="nb-toolbar">
        <button class="nb-tb-btn primary" id="nb-run-all" title="Run All Cells">▶ Run All</button>
        <button class="nb-tb-btn" id="nb-add-code" title="Add Code Cell">+ Code</button>
        <div class="nb-tb-sep"></div>
        <button class="nb-tb-btn" id="nb-clear-all" title="Clear All Outputs">Clear Outputs</button>
        <button class="nb-tb-btn danger" id="nb-restart" title="Restart Kernel">⟳ Restart</button>
        <div class="nb-tb-spacer"></div>
        <div class="nb-kernel-badge loading" id="nb-badge">
          <span class="dot"></span>
          <span id="nb-badge-text">Loading...</span>
        </div>
      </div>

      <div class="nb-cells-wrap" id="nb-cells-wrap">
        <div id="nb-cells"></div>
        <div class="nb-add-row">
          <button class="nb-add-btn" id="nb-add-bottom">+ Add Cell</button>
        </div>
      </div>
    </div>
  `;
}

/* ── Notebook Controller ── */
function _initNotebook(body) {
  const cellsEl = body.querySelector('#nb-cells');
  const loadingEl = body.querySelector('#nb-loading');
  const loadMsgEl = body.querySelector('#nb-load-msg');
  const badgeEl = body.querySelector('#nb-badge');
  const badgeText = body.querySelector('#nb-badge-text');

  let worker = null;
  let cellCounter = 0;
  let executionCount = 0;
  let runningCellId = null;
  let cellOrder = []; // track cell IDs in order
  const cellOutputs = {}; // cellId -> accumulated output

  // ── Start Pyodide Worker ──
  function startWorker() {
    worker = new Worker('js/pyodide-worker.js');
    worker.onmessage = handleWorkerMsg;
    worker.postMessage({ type: 'init' });
    setBadge('loading', 'Loading...');
  }

  function handleWorkerMsg(e) {
    const msg = e.data;
    switch (msg.type) {
      case 'status':
        if (msg.status === 'ready') {
          setBadge('ready', 'Python 3.11');
          loadingEl.classList.add('hide');
          setTimeout(() => { loadingEl.style.display = 'none'; }, 500);
        } else if (msg.status === 'loading') {
          loadMsgEl.textContent = msg.message;
        } else if (msg.status === 'restarting') {
          setBadge('loading', 'Restarting...');
        } else if (msg.status === 'error') {
          setBadge('error', 'Error');
          loadMsgEl.textContent = msg.message;
        }
        break;

      case 'stdout':
        if (msg.cellId || runningCellId) {
          appendOutput(msg.cellId || runningCellId, msg.text, false);
        }
        break;

      case 'stderr':
        if (msg.cellId || runningCellId) {
          appendOutput(msg.cellId || runningCellId, msg.text, true);
        }
        break;

      case 'cell_start':
        // Mark cell as running
        markCellRunning(msg.cellId, true);
        break;

      case 'cell_complete':
        finishCell(msg.cellId);
        break;

      case 'cell_error':
        appendOutput(msg.cellId, msg.error + '\n', true);
        break;
    }
  }

  function setBadge(state, text) {
    badgeEl.className = 'nb-kernel-badge ' + state;
    badgeText.textContent = text;
  }

  // ── Cell Management ──
  function addCell(initialCode = '', insertAfterId = null) {
    cellCounter++;
    const cellId = 'cell_' + cellCounter;

    const cellEl = document.createElement('div');
    cellEl.className = 'nb-cell';
    cellEl.id = cellId;
    cellEl.dataset.cellId = cellId;

    cellEl.innerHTML = `
      <div class="nb-cell-head">
        <button class="nb-cell-run" id="run-${cellId}" title="Run (Ctrl+Enter)">▶</button>
        <span class="nb-cell-idx" id="idx-${cellId}">[ ]</span>
        <span style="color:#484f58;font-size:11px">Python</span>
        <div class="nb-cell-actions">
          <button class="nb-cell-act" title="Move Up" data-action="up">↑</button>
          <button class="nb-cell-act" title="Move Down" data-action="down">↓</button>
          <button class="nb-cell-act" title="Delete Cell" data-action="delete" style="color:#f85149">✕</button>
        </div>
      </div>
      <div class="nb-code-wrap">
        <textarea class="nb-code" id="code-${cellId}" placeholder="# Write Python code here..." spellcheck="false"></textarea>
      </div>
      <div class="nb-output" id="outcont-${cellId}">
        <pre class="nb-out-pre" id="out-${cellId}"></pre>
      </div>
    `;

    // Insert position
    if (insertAfterId) {
      const afterEl = body.querySelector('#' + insertAfterId);
      if (afterEl && afterEl.nextSibling) {
        cellsEl.insertBefore(cellEl, afterEl.nextSibling);
        const idx = cellOrder.indexOf(insertAfterId);
        cellOrder.splice(idx + 1, 0, cellId);
      } else {
        cellsEl.appendChild(cellEl);
        cellOrder.push(cellId);
      }
    } else {
      cellsEl.appendChild(cellEl);
      cellOrder.push(cellId);
    }

    const textarea = cellEl.querySelector(`#code-${cellId}`);
    textarea.value = initialCode;

    // Auto-resize
    const autoResize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(38, textarea.scrollHeight) + 'px';
    };
    textarea.addEventListener('input', autoResize);
    setTimeout(autoResize, 10);

    // Focus handling
    textarea.addEventListener('focus', () => {
      body.querySelectorAll('.nb-cell').forEach(c => c.classList.remove('focused'));
      cellEl.classList.add('focused');
    });

    // Keyboard shortcuts
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = textarea.selectionStart, end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, s) + '    ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = s + 4;
        autoResize();
      }
      // Ctrl+Enter: Run this cell
      if (e.key === 'Enter' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        runCell(cellId);
      }
      // Shift+Enter: Run and move to next cell
      if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        runCell(cellId);
        const idx = cellOrder.indexOf(cellId);
        if (idx === cellOrder.length - 1) {
          addCell('', cellId);
        }
        const nextId = cellOrder[idx + 1];
        if (nextId) focusCell(nextId);
      }
      // Alt+Enter: Run and insert new cell below
      if (e.key === 'Enter' && e.altKey) {
        e.preventDefault();
        runCell(cellId);
        const newId = addCell('', cellId);
        if (newId) focusCell(newId);
      }
    });

    // Run button
    cellEl.querySelector(`#run-${cellId}`).addEventListener('click', () => runCell(cellId));

    // Cell actions (move up/down, delete)
    cellEl.querySelectorAll('.nb-cell-act').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'delete') deleteCell(cellId);
        else if (action === 'up') moveCell(cellId, -1);
        else if (action === 'down') moveCell(cellId, 1);
      });
    });

    textarea.focus();
    return cellId;
  }

  function focusCell(cellId) {
    const ta = body.querySelector(`#code-${cellId}`);
    if (ta) ta.focus();
  }

  function deleteCell(cellId) {
    if (cellOrder.length <= 1) return; // Keep at least one cell
    const el = body.querySelector('#' + cellId);
    if (el) el.remove();
    cellOrder = cellOrder.filter(id => id !== cellId);
    delete cellOutputs[cellId];
  }

  function moveCell(cellId, direction) {
    const idx = cellOrder.indexOf(cellId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= cellOrder.length) return;

    // Swap in order
    [cellOrder[idx], cellOrder[newIdx]] = [cellOrder[newIdx], cellOrder[idx]];

    // Swap in DOM
    const el = body.querySelector('#' + cellId);
    const otherEl = body.querySelector('#' + cellOrder[idx]);
    if (direction === -1) {
      cellsEl.insertBefore(el, otherEl);
    } else {
      cellsEl.insertBefore(otherEl, el);
    }
  }

  // ── Execution ──
  function runCell(cellId) {
    if (!worker) return;
    if (runningCellId) return; // One cell at a time

    const textarea = body.querySelector(`#code-${cellId}`);
    if (!textarea) return;
    const code = textarea.value.trim();
    if (!code) return;

    // Clear old output
    const outCont = body.querySelector(`#outcont-${cellId}`);
    const outPre = body.querySelector(`#out-${cellId}`);
    outPre.innerHTML = '';
    outCont.classList.add('visible');
    cellOutputs[cellId] = '';

    runningCellId = cellId;
    markCellRunning(cellId, true);
    setBadge('busy', 'Running...');

    const idxEl = body.querySelector(`#idx-${cellId}`);
    if (idxEl) idxEl.textContent = '[*]';

    worker.postMessage({ type: 'execute', cellId, code });
  }

  function markCellRunning(cellId, isRunning) {
    const cellEl = body.querySelector('#' + cellId);
    const runBtn = body.querySelector(`#run-${cellId}`);
    if (isRunning) {
      cellEl?.classList.add('running');
      if (runBtn) { runBtn.disabled = true; runBtn.textContent = '⏳'; }
    } else {
      cellEl?.classList.remove('running');
      if (runBtn) { runBtn.disabled = false; runBtn.textContent = '▶'; }
    }
  }

  function appendOutput(cellId, text, isError) {
    if (!text) return;
    const outPre = body.querySelector(`#out-${cellId}`);
    const outCont = body.querySelector(`#outcont-${cellId}`);
    if (!outPre) return;
    outCont?.classList.add('visible');

    if (isError) {
      const span = document.createElement('span');
      span.className = 'err';
      span.textContent = text;
      outPre.appendChild(span);
    } else {
      outPre.appendChild(document.createTextNode(text));
    }

    // Auto-scroll output
    if (outCont) outCont.scrollTop = outCont.scrollHeight;
  }

  function finishCell(cellId) {
    executionCount++;
    markCellRunning(cellId, false);

    const idxEl = body.querySelector(`#idx-${cellId}`);
    if (idxEl) idxEl.textContent = `[${executionCount}]`;

    const outPre = body.querySelector(`#out-${cellId}`);
    if (outPre && !outPre.textContent.trim()) {
      body.querySelector(`#outcont-${cellId}`)?.classList.remove('visible');
    }

    // Check if there's a cell error
    if (outPre && outPre.querySelector('.err')) {
      body.querySelector('#' + cellId)?.classList.add('error-cell');
    }

    runningCellId = null;
    setBadge('ready', 'Python 3.11');
  }

  // ── Run All Cells sequentially ──
  async function runAllCells() {
    for (const cellId of [...cellOrder]) {
      const ta = body.querySelector(`#code-${cellId}`);
      if (!ta || !ta.value.trim()) continue;

      runCell(cellId);
      // Wait for cell to finish
      await new Promise(resolve => {
        const check = setInterval(() => {
          if (!runningCellId) { clearInterval(check); resolve(); }
        }, 100);
      });
    }
  }

  // ── Toolbar Events ──
  body.querySelector('#nb-add-code').addEventListener('click', () => addCell());
  body.querySelector('#nb-add-bottom').addEventListener('click', () => addCell());
  body.querySelector('#nb-run-all').addEventListener('click', () => runAllCells());
  body.querySelector('#nb-clear-all').addEventListener('click', () => {
    body.querySelectorAll('.nb-out-pre').forEach(el => el.innerHTML = '');
    body.querySelectorAll('.nb-output').forEach(el => el.classList.remove('visible'));
    body.querySelectorAll('.nb-cell').forEach(el => el.classList.remove('error-cell'));
    body.querySelectorAll('.nb-cell-idx').forEach(el => el.textContent = '[ ]');
    executionCount = 0;
  });
  body.querySelector('#nb-restart').addEventListener('click', () => {
    if (!worker) return;
    WebOS.Kernel.Dialog.confirm({
      title: 'Restart Kernel',
      message: 'This will clear all variables and restart the Python runtime. Continue?',
      dangerous: true,
      onConfirm: () => {
        worker.postMessage({ type: 'restart' });
        executionCount = 0;
        runningCellId = null;
        body.querySelectorAll('.nb-cell-idx').forEach(el => el.textContent = '[ ]');
        body.querySelectorAll('.nb-out-pre').forEach(el => el.innerHTML = '');
        body.querySelectorAll('.nb-output').forEach(el => el.classList.remove('visible'));
        body.querySelectorAll('.nb-cell').forEach(el => {
          el.classList.remove('error-cell', 'running');
        });
        body.querySelectorAll('.nb-cell-run').forEach(btn => {
          btn.disabled = false; btn.textContent = '▶';
        });
      }
    });
  });

  // ── Boot ──
  addCell('# Welcome to NexNotebook!\n# Python runs in your browser via WebAssembly.\n# No installation needed.\n\nprint("Hello from NexNotebook! 🐍")');
  startWorker();
}
