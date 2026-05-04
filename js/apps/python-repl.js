/* ============================================
   NexOS — NexNotebook (Colab-style Python)
   ============================================ */

'use strict';

AppRegistry.register({
  id: 'python-repl', // Keeping original ID so desktop icon still works
  name: 'NexNotebook',
  icon: '🐍',

  launch(params) {
    const id = 'nexnotebook-win';
    if (WebOS.WindowManager.isOpen(id)) { WebOS.WindowManager.focusWindow(id); return; }

    WebOS.WindowManager.createWindow({
      id, title: 'NexNotebook (Python Kernel)', icon: '🐍',
      width: 800, height: 600,
      content: `
        <style>
          .nb-container { display: flex; flex-direction: column; height: 100%; background: #f8f9fa; color: #333; overflow-y: auto; padding-bottom: 50px; font-family: 'Inter', sans-serif; }
          .nb-toolbar { padding: 10px 20px; background: #fff; border-bottom: 1px solid #ddd; display: flex; gap: 10px; position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
          .nb-btn { padding: 6px 12px; background: #fff; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500; color: #444; transition: 0.2s; }
          .nb-btn:hover { background: #f0f0f0; border-color: #bbb; }
          .nb-btn-primary { background: #007bff; color: #fff; border-color: #007bff; }
          .nb-btn-primary:hover { background: #0069d9; border-color: #0062cc; }
          .nb-btn-run { background: #28a745; color: #fff; border: none; padding: 6px 10px; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .nb-btn-run:hover { background: #218838; transform: scale(1.05); }
          .nb-btn-run:disabled { background: #6c757d; cursor: not-allowed; transform: none; }
          
          .nb-cells { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
          .nb-cell { display: flex; gap: 12px; }
          .nb-cell-controls { width: 40px; display: flex; flex-direction: column; align-items: center; gap: 8px; padding-top: 4px; }
          .nb-cell-body { flex: 1; border: 1px solid #ddd; border-radius: 8px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.02); overflow: hidden; }
          
          .nb-editor-container { padding: 0; }
          .nb-editor { width: 100%; min-height: 40px; border: none; outline: none; padding: 12px; font-family: 'JetBrains Mono', monospace; font-size: 14px; resize: none; background: #fdfdfd; color: #24292e; line-height: 1.5; }
          
          .nb-output { padding: 12px; border-top: 1px solid #eee; background: #fff; margin: 0; display: none; }
          .nb-output pre { margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #333; white-space: pre-wrap; word-wrap: break-word; }
          
          [data-theme="dark"] .nb-container { background: #1e1e1e; color: #d4d4d4; }
          [data-theme="dark"] .nb-toolbar { background: #252526; border-color: #333; }
          [data-theme="dark"] .nb-btn { background: #3c3c3c; border-color: #555; color: #ccc; }
          [data-theme="dark"] .nb-btn:hover { background: #4a4a4a; }
          [data-theme="dark"] .nb-cell-body { background: #1e1e1e; border-color: #444; }
          [data-theme="dark"] .nb-editor { background: #1e1e1e; color: #d4d4d4; }
          [data-theme="dark"] .nb-output { background: #1e1e1e; border-color: #333; }
          [data-theme="dark"] .nb-output pre { color: #d4d4d4; }
        </style>

        <div class="nb-container" id="nb-root">
          <div class="nb-toolbar">
            <button class="nb-btn nb-btn-primary" id="nb-add-code">+ Code</button>
            <button class="nb-btn" id="nb-clear-outputs">Clear Outputs</button>
            <div style="flex:1"></div>
            <span style="display:flex;align-items:center;font-size:13px;color:#28a745" id="nb-kernel-status">● Connected</span>
          </div>
          <div class="nb-cells" id="nb-cells"></div>
        </div>
      `,
      onReady: (body) => _initNotebook(body, params),
    });
  }
});

function _initNotebook(body, params) {
  const cellsContainer = body.querySelector('#nb-cells');
  const addCodeBtn     = body.querySelector('#nb-add-code');
  const clearBtn       = body.querySelector('#nb-clear-outputs');
  const statusEl       = body.querySelector('#nb-kernel-status');

  let cellCounter = 0;
  let currentlyRunningCell = null;
  let socket = null;

  // Initialize Socket.io
  if (typeof io !== 'undefined') {
    socket = io();
    socket.emit('start_repl');

    socket.on('repl_output', (data) => {
      handleKernelOutput(data);
    });
  } else {
    statusEl.textContent = '○ Disconnected';
    statusEl.style.color = '#dc3545';
  }

  // Bind toolbar
  addCodeBtn.addEventListener('click', () => addCell('code'));
  clearBtn.addEventListener('click', () => {
    body.querySelectorAll('.nb-output pre').forEach(el => el.textContent = '');
    body.querySelectorAll('.nb-output').forEach(el => el.style.display = 'none');
  });

  // Add initial cell
  addCell('code');

  function addCell(type, initialCode = '') {
    cellCounter++;
    const cellId = 'cell_' + cellCounter;
    
    const cellEl = document.createElement('div');
    cellEl.className = 'nb-cell';
    cellEl.id = cellId;
    
    cellEl.innerHTML = `
      <div class="nb-cell-controls">
        <button class="nb-btn-run" title="Run cell" id="btn-run-${cellId}">▶</button>
        <div style="font-size:11px; color:#888; margin-top:4px" id="idx-${cellId}">[ ]</div>
      </div>
      <div class="nb-cell-body">
        <div class="nb-editor-container">
          <textarea class="nb-editor" id="editor-${cellId}" placeholder="# Enter python code here..."></textarea>
        </div>
        <div class="nb-output" id="outcont-${cellId}">
          <pre id="out-${cellId}"></pre>
        </div>
      </div>
    `;

    cellsContainer.appendChild(cellEl);

    const textarea = cellEl.querySelector(`#editor-${cellId}`);
    textarea.value = initialCode;

    // Auto-resize textarea
    const resizeObj = () => {
      textarea.style.height = 'auto';
      textarea.style.height = (textarea.scrollHeight) + 'px';
    };
    textarea.addEventListener('input', resizeObj);
    setTimeout(resizeObj, 10);

    // Keyboard shortcuts
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.shiftKey)) {
        e.preventDefault();
        runCell(cellId);
      }
    });

    const runBtn = cellEl.querySelector(`#btn-run-${cellId}`);
    runBtn.addEventListener('click', () => runCell(cellId));

    textarea.focus();
  }

  function runCell(cellId) {
    if (!socket) return;
    if (currentlyRunningCell) return; // Prevent running multiple cells at once
    
    const textarea = body.querySelector(`#editor-${cellId}`);
    const code = textarea.value.trim();
    if (!code) return;

    // Reset output
    const outCont = body.querySelector(`#outcont-${cellId}`);
    const outPre = body.querySelector(`#out-${cellId}`);
    outPre.textContent = '';
    outCont.style.display = 'block';

    const runBtn = body.querySelector(`#btn-run-${cellId}`);
    const idxEl = body.querySelector(`#idx-${cellId}`);
    
    runBtn.disabled = true;
    runBtn.textContent = '⌛';
    idxEl.textContent = '[*]';
    statusEl.textContent = '● Busy';
    statusEl.style.color = '#ffc107';

    currentlyRunningCell = cellId;

    // Send code to execution
    socket.emit('execute_cell', { cellId, code });
  }

  // We buffer output in case markers are split across packets
  let outputBuffer = ''; 

  function handleKernelOutput(data) {
    if (!currentlyRunningCell) return;

    outputBuffer += data;

    const marker = `__NEXOS_CELL_COMPLETE__${currentlyRunningCell}__`;
    const markerIndex = outputBuffer.indexOf(marker);

    if (markerIndex !== -1) {
      // Cell execution finished
      const outData = outputBuffer.substring(0, markerIndex).replace(/\r\n/g, '\n');
      outputBuffer = outputBuffer.substring(markerIndex + marker.length);
      
      appendOutput(currentlyRunningCell, outData);
      finishCell(currentlyRunningCell);
    } else {
      // No marker yet, but we can flush what we have so far (up to the last newline to be safe)
      // Actually, to prevent breaking the marker string, we only flush if the buffer is larger than marker length
      if (outputBuffer.length > 50) {
        const safeChunk = outputBuffer.substring(0, outputBuffer.length - 40);
        appendOutput(currentlyRunningCell, safeChunk.replace(/\r\n/g, '\n'));
        outputBuffer = outputBuffer.substring(outputBuffer.length - 40);
      }
    }
  }

  function appendOutput(cellId, text) {
    if (!text) return;
    const outPre = body.querySelector(`#out-${cellId}`);
    if (outPre) outPre.textContent += text;
  }

  let executionCount = 0;
  function finishCell(cellId) {
    executionCount++;
    const runBtn = body.querySelector(`#btn-run-${cellId}`);
    const idxEl = body.querySelector(`#idx-${cellId}`);
    
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.textContent = '▶';
    }
    if (idxEl) {
      idxEl.textContent = `[${executionCount}]`;
    }

    const outPre = body.querySelector(`#out-${cellId}`);
    if (outPre && !outPre.textContent.trim()) {
      body.querySelector(`#outcont-${cellId}`).style.display = 'none';
    }

    currentlyRunningCell = null;
    outputBuffer = '';

    statusEl.textContent = '● Idle';
    statusEl.style.color = '#28a745';
  }
}
