/* ============================================
   NexOS — Text Editor App
   ============================================ */

'use strict';

AppRegistry.register({
  id: 'text-editor',
  name: 'Text Editor',
  icon: '📝',

  launch(params) {
    const id = params?.path
      ? `editor-${params.path.replace(/[^a-zA-Z0-9-]/g, '_')}`
      : `editor-${Date.now()}`;
    if (WebOS.WindowManager.isOpen(id)) { WebOS.WindowManager.focusWindow(id); return; }

    WebOS.WindowManager.createWindow({
      id, title: params?.path ? params.path.split('/').pop() : 'Untitled.txt',
      icon: '📝', width: 800, height: 540,
      content: `
        <div class="app-container" style="background:#07090f">
          <div class="app-toolbar" id="ed-toolbar">
            <button class="app-btn"         id="ed-new">📄 New</button>
            <button class="app-btn primary" id="ed-save">💾 Save</button>
            <div style="width:1px;height:20px;background:var(--border-subtle);margin:0 4px"></div>
            <button class="app-btn"  id="ed-undo">↩ Undo</button>
            <button class="app-btn"  id="ed-redo">↪ Redo</button>
            <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
              <button class="app-btn" id="ed-word-wrap" title="Toggle word wrap">⇌</button>
              <span class="editor-lang-badge" id="ed-lang">TXT</span>
            </div>
          </div>
          <div class="editor-container" id="ed-container">
            <div class="editor-line-numbers" id="ed-lines"></div>
            <textarea id="editor-textarea" spellcheck="false" autocorrect="off" autocapitalize="off"></textarea>
          </div>
          <div class="app-status-bar">
            <span id="ed-cursor-pos">Line 1, Col 1</span>
            <span id="ed-char-count">0 characters</span>
            <span id="ed-file-path" style="color:var(--text-muted)">Untitled</span>
            <span id="ed-saved-status" style="margin-left:auto;color:var(--green)">●  Saved</span>
          </div>
        </div>
      `,
      onReady: (body) => _initEditor(body, id, params),
    });
  }
});

function _initEditor(body, winId, params) {
  const textarea  = body.querySelector('#editor-textarea');
  const lineNums  = body.querySelector('#ed-lines');
  const cursorPos = body.querySelector('#ed-cursor-pos');
  const charCount = body.querySelector('#ed-char-count');
  const filePathEl= body.querySelector('#ed-file-path');
  const savedEl   = body.querySelector('#ed-saved-status');
  const langBadge = body.querySelector('#ed-lang');

  let currentPath = params?.path || null;
  let saved       = true;
  let undoStack   = []; let redoStack = [];
  let wordWrap    = false;

  // Load file
  if (currentPath) {
    WebOS.FS.readFile(currentPath).then(content => {
      textarea.value = content;
      undoStack = [content];
      _updateAll();
    }).catch(() => {
      textarea.value = '';
      _updateAll();
    });
    filePathEl.textContent = currentPath;
    _setLang(currentPath);
  } else {
    textarea.value = '';
    undoStack = [''];
  }

  // Toolbar buttons
  body.querySelector('#ed-save').addEventListener('click', saveFile);
  body.querySelector('#ed-new').addEventListener('click',  newFile);
  body.querySelector('#ed-undo').addEventListener('click', undo);
  body.querySelector('#ed-redo').addEventListener('click', redo);
  body.querySelector('#ed-word-wrap').addEventListener('click', toggleWordWrap);

  // Keyboard shortcuts
  textarea.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') { e.preventDefault(); saveFile(); }
      if (e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if (e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'a') { e.preventDefault(); textarea.select(); }
    }

    // Tab key → insert spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart, end = textarea.selectionEnd;
      textarea.value = textarea.value.slice(0,start) + '  ' + textarea.value.slice(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      _updateAll();
    }
  });

  textarea.addEventListener('input', () => {
    _markUnsaved();
    _updateAll();
    // Push to undo stack
    const cur = textarea.value;
    if (undoStack[undoStack.length-1] !== cur) {
      undoStack.push(cur);
      if (undoStack.length > 200) undoStack.shift();
      redoStack = [];
    }
  });

  textarea.addEventListener('keyup',    _updateCursor);
  textarea.addEventListener('click',    _updateCursor);
  textarea.addEventListener('scroll',   _syncScroll);

  function undo() {
    if (undoStack.length < 2) return;
    redoStack.push(undoStack.pop());
    textarea.value = undoStack[undoStack.length-1];
    _updateAll(); _markUnsaved();
  }

  function redo() {
    if (!redoStack.length) return;
    const state = redoStack.pop();
    undoStack.push(state);
    textarea.value = state;
    _updateAll(); _markUnsaved();
  }

  function toggleWordWrap() {
    wordWrap = !wordWrap;
    textarea.style.whiteSpace    = wordWrap ? 'pre-wrap' : 'pre';
    textarea.style.overflowWrap  = wordWrap ? 'break-word' : 'normal';
    textarea.style.overflowX     = wordWrap ? 'hidden' : 'auto';
  }

  async function saveFile() {
    if (!currentPath) {
      WebOS.Kernel.Dialog.prompt({
        title: 'Save As', placeholder: 'filename.txt', defaultValue: 'untitled.txt',
        onConfirm: async (name) => {
          if (!name.trim()) return;
          currentPath = '/home/' + name.trim();
          filePathEl.textContent = currentPath;
          _setLang(currentPath);
          WebOS.WindowManager.setTitle(winId, name.trim());
          await _doSave();
        }
      });
    } else {
      await _doSave();
    }
  }

  async function _doSave() {
    try {
      await WebOS.FS.writeFile(currentPath, textarea.value);
      _markSaved();
      Notify({ title: 'File Saved', message: currentPath, type: 'success', icon: '💾', duration: 2000 });
    } catch(e) {
      Notify({ title: 'Save Error', message: e.message, type: 'error' });
    }
  }

  function newFile() {
    if (!saved) {
      WebOS.Kernel.Dialog.confirm({
        title: 'Unsaved Changes',
        message: 'Discard changes and open a new file?',
        onConfirm: () => { textarea.value = ''; currentPath = null; filePathEl.textContent = 'Untitled'; WebOS.WindowManager.setTitle(winId,'Untitled'); _markSaved(); _updateAll(); }
      });
    } else {
      textarea.value = ''; currentPath = null; filePathEl.textContent = 'Untitled';
      WebOS.WindowManager.setTitle(winId, 'Untitled'); _markSaved(); _updateAll();
    }
  }

  function _markUnsaved() {
    saved = false;
    savedEl.textContent = '●  Unsaved';
    savedEl.style.color = 'var(--yellow)';
  }

  function _markSaved() {
    saved = true;
    savedEl.textContent = '●  Saved';
    savedEl.style.color = 'var(--green)';
  }

  function _updateAll() {
    _updateLineNumbers();
    _updateCursor();
    charCount.textContent = `${textarea.value.length} characters`;
  }

  function _updateLineNumbers() {
    const lines = (textarea.value.match(/\n/g) || []).length + 1;
    let html = '';
    for (let i = 1; i <= lines; i++) html += `<div>${i}</div>`;
    lineNums.innerHTML = html;
  }

  function _updateCursor() {
    const text = textarea.value.slice(0, textarea.selectionStart);
    const line = (text.match(/\n/g) || []).length + 1;
    const col  = text.length - text.lastIndexOf('\n');
    cursorPos.textContent = `Line ${line}, Col ${col}`;
  }

  function _syncScroll() {
    lineNums.scrollTop = textarea.scrollTop;
  }

  function _setLang(path) {
    const ext = path.split('.').pop().toLowerCase();
    const langs = { js:'JS', ts:'TS', html:'HTML', css:'CSS', json:'JSON', md:'MD', py:'PY', sh:'SH', txt:'TXT', xml:'XML' };
    langBadge.textContent = langs[ext] || ext.toUpperCase();
  }

  _updateAll();
}
