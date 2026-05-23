/* ============================================
   NexOS — Pyodide Web Worker (Python Kernel)
   Runs CPython 3.11 via WebAssembly in browser
   ============================================ */

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';

let pyodide = null;
let isReady = false;
let currentCellId = null; // Track which cell is running for stdout routing

// Load Pyodide
async function initPyodide() {
  try {
    importScripts(PYODIDE_CDN + 'pyodide.js');

    self.postMessage({ type: 'status', status: 'loading', message: 'Downloading Python runtime...' });

    pyodide = await loadPyodide({
      indexURL: PYODIDE_CDN,
      stdout: (text) => {
        // Route stdout to the currently running cell
        self.postMessage({ type: 'stdout', text: text + '\n', cellId: currentCellId || '' });
      },
      stderr: (text) => {
        self.postMessage({ type: 'stderr', text: text + '\n', cellId: currentCellId || '' });
      }
    });

    // Pre-install micropip for package management
    await pyodide.loadPackage('micropip');

    // Initial setup
    currentCellId = '__init__';
    await pyodide.runPythonAsync(`
import micropip
import sys
    `);
    currentCellId = null;

    isReady = true;
    self.postMessage({ type: 'status', status: 'ready', message: 'Python kernel ready' });

  } catch (err) {
    self.postMessage({ type: 'status', status: 'error', message: 'Failed to load Python: ' + err.message });
  }
}

// Execute a cell
async function executeCell(cellId, code) {
  if (!isReady) {
    self.postMessage({ type: 'cell_error', cellId: cellId, error: 'Python kernel is not ready yet. Please wait...' });
    self.postMessage({ type: 'cell_complete', cellId: cellId });
    return;
  }

  currentCellId = cellId;
  self.postMessage({ type: 'cell_start', cellId: cellId });

  try {
    // Use runPythonAsync which supports top-level await
    // Pyodide's stdout/stderr callbacks handle output routing
    await pyodide.runPythonAsync(code);
  } catch (err) {
    // Extract clean error message
    let errorMsg = err.message || String(err);
    self.postMessage({ type: 'stderr', text: errorMsg + '\n', cellId: cellId });
  }

  self.postMessage({ type: 'cell_complete', cellId: cellId });
  currentCellId = null;
}

// Handle messages from main thread
self.onmessage = async function(e) {
  const msg = e.data;

  switch (msg.type) {
    case 'init':
      await initPyodide();
      break;
    case 'execute':
      await executeCell(msg.cellId, msg.code);
      break;
    case 'restart':
      isReady = false;
      currentCellId = null;
      pyodide = null;
      self.postMessage({ type: 'status', status: 'restarting', message: 'Restarting kernel...' });
      await initPyodide();
      break;
  }
};
