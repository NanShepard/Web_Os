/* ============================================
   NexOS — Window Manager
   ============================================ */

'use strict';

WebOS.WindowManager = (() => {
  let zCounter = 100;
  const windows = new Map(); // id → { el, state, config }

  function init() {
    // Close context menu on click
    document.addEventListener('mousedown', (e) => {
      const ctx = document.getElementById('context-menu');
      if (ctx && !ctx.contains(e.target)) ctx.classList.add('hidden');
    });
  }

  // ── Create Window ──
  function createWindow(config) {
    const id = config.id || `win-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    if (windows.has(id)) {
      focusWindow(id);
      return windows.get(id);
    }

    const defaults = {
      id, title: 'Window', icon: '🪟', width: 820, height: 560,
      x: null, y: null, resizable: true, minWidth: 320, minHeight: 240,
      content: '', onClose: null, onFocus: null,
    };
    const cfg = { ...defaults, ...config };

    // Center window if no position given
    const desktop = document.getElementById('desktop');
    const dw = desktop.offsetWidth, dh = desktop.offsetHeight;
    if (cfg.x === null) cfg.x = Math.max(0, (dw - cfg.width) / 2 + (Math.random() - 0.5) * 100);
    if (cfg.y === null) cfg.y = Math.max(0, (dh - cfg.height) / 2 + (Math.random() - 0.5) * 60);
    cfg.x = Math.max(0, Math.min(cfg.x, dw - cfg.width));
    cfg.y = Math.max(0, Math.min(cfg.y, dh - cfg.height));

    // Build DOM
    const el = document.createElement('div');
    el.className = 'os-window focused';
    el.id = id;
    el.style.cssText = `width:${cfg.width}px;height:${cfg.height}px;left:${cfg.x}px;top:${cfg.y}px;z-index:${++zCounter};`;

    el.innerHTML = `
      ${cfg.resizable ? `
        <div class="resize-handle resize-n"  data-dir="n"></div>
        <div class="resize-handle resize-s"  data-dir="s"></div>
        <div class="resize-handle resize-e"  data-dir="e"></div>
        <div class="resize-handle resize-w"  data-dir="w"></div>
        <div class="resize-handle resize-ne" data-dir="ne"></div>
        <div class="resize-handle resize-nw" data-dir="nw"></div>
        <div class="resize-handle resize-se" data-dir="se"></div>
        <div class="resize-handle resize-sw" data-dir="sw"></div>
      ` : ''}
      <div class="window-titlebar" data-win-id="${id}">
        <div class="window-controls">
          <button class="wc-btn wc-close"  data-action="close"  title="Close"><span class="wc-icon">✕</span></button>
          <button class="wc-btn wc-min"    data-action="min"    title="Minimize"><span class="wc-icon">─</span></button>
          <button class="wc-btn wc-max"    data-action="max"    title="Maximize"><span class="wc-icon">⤢</span></button>
        </div>
        <span class="window-icon">${cfg.icon}</span>
        <span class="window-title">${cfg.title}</span>
      </div>
      <div class="window-body" id="${id}-body">
        ${cfg.content}
      </div>
    `;

    document.getElementById('windows-container').appendChild(el);

    const winState = { minimized: false, maximized: false, prevBounds: null };
    windows.set(id, { el, state: winState, config: cfg });

    // Attach interactions
    _attachDrag(el, id);
    if (cfg.resizable) _attachResize(el, id);
    _attachWindowButtons(el, id);

    // Focus on click
    el.addEventListener('mousedown', () => focusWindow(id), true);

    // Update taskbar
    WebOS.Taskbar.addApp(id, cfg.title, cfg.icon);
    focusWindow(id);

    // Post-create callback
    if (cfg.onReady) {
      requestAnimationFrame(() => {
        // Use getElementById (not querySelector) — IDs may contain
        // path characters (/ . -) that are invalid in CSS selectors
        const body = document.getElementById(`${id}-body`);
        cfg.onReady(body);
      });
    }

    return { el, config: cfg, getBody: () => document.getElementById(`${id}-body`) };
  }

  // ── Window control buttons ──
  function _attachWindowButtons(el, id) {
    el.querySelector('.wc-close').addEventListener('click', e => { e.stopPropagation(); closeWindow(id); });
    el.querySelector('.wc-min').addEventListener('click',  e => { e.stopPropagation(); minimizeWindow(id); });
    el.querySelector('.wc-max').addEventListener('click',  e => { e.stopPropagation(); maximizeToggle(id); });

    // Double-click titlebar to maximize
    el.querySelector('.window-titlebar').addEventListener('dblclick', () => maximizeToggle(id));
  }

  // ── Focus ──
  function focusWindow(id) {
    windows.forEach((w, wid) => {
      w.el.classList.toggle('focused', wid === id);
    });
    const w = windows.get(id);
    if (w) {
      w.el.style.zIndex = ++zCounter;
      WebOS.Taskbar.setActive(id);
      WebOS.Kernel.Events.emit('window:focus', { id });
    }
  }

  // ── Close ──
  function closeWindow(id) {
    const w = windows.get(id);
    if (!w) return;

    w.el.style.animation = 'windowClose 0.25s ease both';
    setTimeout(() => {
      w.el.remove();
      windows.delete(id);
      WebOS.Taskbar.removeApp(id);
      if (w.config.onClose) w.config.onClose();
      WebOS.Kernel.Events.emit('window:close', { id });
      // Focus most recent window
      if (windows.size > 0) {
        const last = [...windows.keys()].pop();
        focusWindow(last);
      } else {
        WebOS.Taskbar.setActive(null);
      }
    }, 240);
  }

  // ── Minimize ──
  function minimizeWindow(id) {
    const w = windows.get(id);
    if (!w) return;
    w.state.minimized = true;
    w.el.style.animation = 'windowMinimize 0.22s ease both';
    setTimeout(() => {
      w.el.style.display = 'none';
      w.el.style.animation = '';
    }, 210);
    WebOS.Taskbar.setMinimized(id, true);
    WebOS.Kernel.Events.emit('window:minimize', { id });

    // Focus next window
    const visible = [...windows.entries()].filter(([wid, wd]) => !wd.state.minimized && wid !== id);
    if (visible.length) focusWindow(visible[visible.length - 1][0]);
    else WebOS.Taskbar.setActive(null);
  }

  function restoreWindow(id) {
    const w = windows.get(id);
    if (!w || !w.state.minimized) return;
    w.state.minimized = false;
    w.el.style.display = '';
    w.el.style.animation = 'windowOpen 0.25s cubic-bezier(0.34,1.56,0.64,1) both';
    WebOS.Taskbar.setMinimized(id, false);
    focusWindow(id);
    WebOS.Kernel.Events.emit('window:restore', { id });
  }

  // ── Maximize ──
  function maximizeToggle(id) {
    const w = windows.get(id);
    if (!w) return;

    if (w.state.maximized) {
      // Restore
      const pb = w.state.prevBounds;
      if (pb) {
        w.el.style.cssText = `width:${pb.w}px;height:${pb.h}px;left:${pb.x}px;top:${pb.y}px;z-index:${w.el.style.zIndex};`;
      }
      w.el.classList.remove('maximized');
      w.state.maximized = false;
    } else {
      // Save bounds
      w.state.prevBounds = {
        x: parseInt(w.el.style.left), y: parseInt(w.el.style.top),
        w: parseInt(w.el.style.width), h: parseInt(w.el.style.height),
      };
      w.el.classList.add('maximized');
      w.el.style.width = ''; w.el.style.height = ''; w.el.style.left = ''; w.el.style.top = '';
      w.state.maximized = true;
    }
    WebOS.Kernel.Events.emit('window:maxToggle', { id, maximized: w.state.maximized });
  }

  // ── Drag ──
  function _attachDrag(el, id) {
    const titlebar = el.querySelector('.window-titlebar');
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;

    titlebar.addEventListener('mousedown', (e) => {
      if (e.target.closest('.window-controls') || e.target.closest('.window-action-btn')) return;
      const w = windows.get(id);
      if (w?.state.maximized) return;

      dragging = true;
      sx = e.clientX; sy = e.clientY;
      ox = parseInt(el.style.left) || 0;
      oy = parseInt(el.style.top)  || 0;
      el.classList.add('dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const w = windows.get(id);
      if (!w) { dragging = false; return; }

      const dx = e.clientX - sx, dy = e.clientY - sy;
      let nx = ox + dx, ny = oy + dy;

      const desktop = document.getElementById('desktop');
      nx = Math.max(-el.offsetWidth + 80, Math.min(nx, desktop.offsetWidth - 80));
      ny = Math.max(0, Math.min(ny, desktop.offsetHeight - 40));

      el.style.left = nx + 'px';
      el.style.top  = ny + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (dragging) { dragging = false; el.classList.remove('dragging'); }
    });
  }

  // ── Resize ──
  function _attachResize(el, id) {
    let resizing = false, dir = '', sx = 0, sy = 0;
    let ox = 0, oy = 0, ow = 0, oh = 0;

    el.querySelectorAll('.resize-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        const w = windows.get(id);
        if (w?.state.maximized) return;
        resizing = true;
        dir = handle.dataset.dir;
        sx = e.clientX; sy = e.clientY;
        ox = parseInt(el.style.left)   || 0;
        oy = parseInt(el.style.top)    || 0;
        ow = parseInt(el.style.width)  || el.offsetWidth;
        oh = parseInt(el.style.height) || el.offsetHeight;
        el.classList.add('resizing');
        e.preventDefault(); e.stopPropagation();
      });
    });

    document.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const w = windows.get(id);
      if (!w) { resizing = false; return; }

      const dx = e.clientX - sx, dy = e.clientY - sy;
      const min = { w: w.config.minWidth || 320, h: w.config.minHeight || 240 };
      let nx = ox, ny = oy, nw = ow, nh = oh;

      if (dir.includes('e')) nw = Math.max(min.w, ow + dx);
      if (dir.includes('s')) nh = Math.max(min.h, oh + dy);
      if (dir.includes('w')) { nw = Math.max(min.w, ow - dx); nx = ox + ow - nw; }
      if (dir.includes('n')) { nh = Math.max(min.h, oh - dy); ny = oy + oh - nh; }

      el.style.left   = nx + 'px';
      el.style.top    = ny + 'px';
      el.style.width  = nw + 'px';
      el.style.height = nh + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (resizing) { resizing = false; el.classList.remove('resizing'); }
    });
  }

  // ── Utilities ──
  function getWindow(id)   { return windows.get(id); }
  function getAllWindows()  { return [...windows.values()]; }
  function isOpen(id)      { return windows.has(id); }
  function setTitle(id, t) {
    const w = windows.get(id);
    if (w) w.el.querySelector('.window-title').textContent = t;
  }

  function toggleWindow(id) {
    const w = windows.get(id);
    if (!w) return false;
    if (w.state.minimized) restoreWindow(id);
    else if (w.el.classList.contains('focused')) minimizeWindow(id);
    else focusWindow(id);
    return true;
  }

  return { init, createWindow, closeWindow, minimizeWindow, restoreWindow, maximizeToggle, focusWindow, toggleWindow, getWindow, getAllWindows, isOpen, setTitle };
})();
