/* ============================================
   NexOS — Browser App
   ============================================ */

'use strict';

/* Sites that always block iframe embedding */
const IFRAME_BLOCKED_HOSTS = new Set([
  'google.com', 'www.google.com',
  'youtube.com', 'www.youtube.com',
  'github.com', 'www.github.com',
  'twitter.com', 'x.com', 'www.twitter.com',
  'instagram.com', 'www.instagram.com',
  'facebook.com', 'www.facebook.com',
  'reddit.com', 'www.reddit.com',
  'linkedin.com', 'www.linkedin.com',
  'netflix.com', 'www.netflix.com',
  'amazon.com', 'www.amazon.com',
  'stackoverflow.com',
]);

/* Search engines — tried in order when one is blocked */
const SEARCH_ENGINES = [
  { id: 'google',  name: 'Google',      icon: '🔍', build: q => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  { id: 'bing',    name: 'Bing',        icon: '🔎', build: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
  { id: 'brave',   name: 'Brave',       icon: '🦁', build: q => `https://search.brave.com/search?q=${encodeURIComponent(q)}` },
  { id: 'ddg',     name: 'DuckDuckGo', icon: '🦆', build: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  { id: 'yahoo',   name: 'Yahoo',       icon: '📡', build: q => `https://search.yahoo.com/search?p=${encodeURIComponent(q)}` },
];

function _isBlocked(url) {
  try {
    const host = new URL(url).hostname;
    return IFRAME_BLOCKED_HOSTS.has(host);
  } catch { return false; }
}

/* Extract raw search query from any search engine URL */
function _extractQuery(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get('q') || u.searchParams.get('p') || null;
  } catch { return null; }
}

/* Is this URL a search query (any engine)? */
function _isSearch(url) {
  const hosts = ['google.com','bing.com','search.brave.com','duckduckgo.com','search.yahoo.com'];
  try {
    const h = new URL(url).hostname;
    return hosts.some(d => h === d || h.endsWith('.' + d));
  } catch { return false; }
}

function _parseUrl(raw) {
  const q = (raw || '').trim();
  if (!q) return null;
  if (q.startsWith('http://') || q.startsWith('https://')) return q;
  const looksLikeDomain = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(q);
  if (looksLikeDomain) return 'https://' + q;
  // Default search engine = Google (opened in new tab anyway)
  return 'https://www.google.com/search?q=' + encodeURIComponent(q);
}

function _hostname(url) {
  try { return new URL(url).hostname; }
  catch { return url.slice(0, 40); }
}

// ──────────────────────────────────────────────
AppRegistry.register({
  id: 'browser',
  name: 'NexBrowser',
  icon: '🌐',

  launch(params) {
    const id = 'browser-win';
    if (WebOS.WindowManager.isOpen(id)) { WebOS.WindowManager.focusWindow(id); return; }

    WebOS.WindowManager.createWindow({
      id, title: 'NexBrowser', icon: '🌐',
      width: 980, height: 640,
      content: `
        <div class="app-container" style="background:#06090f">

          <!-- Nav bar -->
          <div class="browser-nav">
            <button class="browser-nav-btn" id="br-back"    title="Back">◀</button>
            <button class="browser-nav-btn" id="br-fwd"     title="Forward">▶</button>
            <button class="browser-nav-btn" id="br-refresh" title="Refresh">🔄</button>
            <button class="browser-nav-btn" id="br-home"    title="Home">🏠</button>

            <div class="browser-url-bar">
              <span id="br-secure" class="browser-secure-icon">🔍</span>
              <input type="text" id="browser-url-input"
                placeholder="Search Google or enter a URL..."
                autocomplete="off" spellcheck="false">
              <button class="br-go-btn" id="br-go">→</button>
            </div>

            <button class="browser-nav-btn" id="br-ext" title="Open in real browser tab" style="font-size:12px">↗</button>
            <button class="browser-nav-btn" id="br-bookmark" title="Bookmark">★</button>
          </div>

          <!-- Tab strip -->
          <div class="browser-tab-strip">
            <div class="browser-tab active">
              <span id="br-tab-icon">🌐</span>
              <span id="br-tab-title">New Tab</span>
            </div>
          </div>

          <!-- Content area -->
          <div id="br-content">

            <!-- ① Home page -->
            <div id="br-home-page" class="browser-new-tab">
              <div class="browser-new-tab-logo">🌐</div>
              <div class="browser-new-tab-title">NexBrowser</div>
              <div style="font-size:13px;color:var(--text-muted);margin-top:-8px">Cloud-Powered Web Browser</div>
              <div class="br-home-search">
                <span style="font-size:18px">🔍</span>
                <input type="text" id="br-home-input" placeholder="Search the web...">
                <button class="app-btn primary" id="br-home-go">Search ↗</button>
              </div>
              <div class="browser-quick-links" id="br-quick-links">
                ${[
                  ['🔍','Google','https://www.google.com'],
                  ['🐙','GitHub','https://github.com'],
                  ['📚','Wikipedia','https://www.wikipedia.org'],
                  ['🦊','MDN Docs','https://developer.mozilla.org'],
                  ['▶️','YouTube','https://www.youtube.com'],
                  ['🗞️','HN','https://news.ycombinator.com'],
                ].map(([icon,name,url]) =>
                  `<div class="quick-link" data-url="${url}">
                     <span class="quick-link-icon">${icon}</span>
                     <span class="quick-link-name">${name}</span>
                   </div>`
                ).join('')}
              </div>
            </div>

            <!-- ② Loading -->
            <div id="br-loading" style="display:none">
              <div class="br-spinner"></div>
              <div class="br-loading-text" id="br-loading-text">Connecting...</div>
            </div>

            <!-- ③ Blocked / external redirect page -->
            <div id="br-blocked" style="display:none">
              <div class="br-error-icon" id="br-err-icon">🔒</div>
              <h2 class="br-error-title" id="br-err-title">Cannot display this page inside NexBrowser</h2>
              <p class="br-error-sub" id="br-err-sub">
                Many websites block embedding for security reasons.
                You can open this page in your real browser instead.
              </p>
              <div class="br-blocked-actions">
                <button class="app-btn primary" id="br-open-ext-btn" style="gap:8px;font-size:14px;padding:10px 20px">
                  ↗&nbsp; Open in Browser Tab
                </button>
                <button class="app-btn" id="br-try-anyway-btn">Try in iframe anyway</button>
                <button class="app-btn" id="br-home-btn2">🏠 Home</button>
              </div>
              <div class="br-blocked-url" id="br-blocked-url"></div>
            </div>

            <!-- ④ iframe (for embeddable sites) -->
            <div id="br-iframe-wrap" style="display:none;flex:1;flex-direction:column;position:relative">
              <!-- sticky "open externally" bar shown when iframe is active -->
              <div class="br-iframe-bar" id="br-iframe-bar">
                <span id="br-iframe-bar-url" style="font-size:11px;font-family:var(--font-mono);color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1"></span>
                <button class="app-btn" id="br-iframe-ext" style="padding:3px 10px;font-size:12px;flex-shrink:0">↗ Open</button>
              </div>
              <iframe id="browser-iframe"
                style="flex:1;border:none;width:100%;background:#fff"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation">
              </iframe>
            </div>

          </div>

          <!-- Status bar -->
          <div class="app-status-bar">
            <span id="br-status">Ready</span>
            <span style="margin-left:auto;font-size:11px;color:var(--text-muted)">
              ☁️ ${WebOS.Cloud.getRegion().id}
            </span>
          </div>
        </div>
      `,
      onReady: (body) => _initBrowser(body, params),
    });
  }
});

// ──────────────────────────────────────────────
function _initBrowser(body, params) {
  const urlInput    = body.querySelector('#browser-url-input');
  const iframe      = body.querySelector('#browser-iframe');
  const homePage    = body.querySelector('#br-home-page');
  const loadingEl   = body.querySelector('#br-loading');
  const blockedEl   = body.querySelector('#br-blocked');
  const iframeWrap  = body.querySelector('#br-iframe-wrap');
  const statusEl    = body.querySelector('#br-status');
  const secureEl    = body.querySelector('#br-secure');
  const tabTitle    = body.querySelector('#br-tab-title');
  const tabIcon     = body.querySelector('#br-tab-icon');
  const homeInput   = body.querySelector('#br-home-input');

  let navHistory = [];
  let historyIdx = -1;
  let currentUrl = '';
  let loadTimer  = null;

  // ── Helpers ──────────────────────────────────
  function showPanel(name) {
    homePage.style.display   = name === 'home'    ? 'flex'  : 'none';
    loadingEl.style.display  = name === 'loading' ? 'flex'  : 'none';
    blockedEl.style.display  = name === 'blocked' ? 'flex'  : 'none';
    iframeWrap.style.display = name === 'iframe'  ? 'flex'  : 'none';
  }

  function setTab(icon, title) {
    tabIcon.textContent  = icon;
    tabTitle.textContent = title;
  }

  function setSecure(url) {
    if (!url || url === 'about:blank') { secureEl.textContent = '🔍'; secureEl.style.color = ''; return; }
    if (url.startsWith('https')) { secureEl.textContent = '🔒'; secureEl.style.color = 'var(--green)'; }
    else                         { secureEl.textContent = '⚠️'; secureEl.style.color = 'var(--yellow)'; }
  }

  // ── Navigation ───────────────────────────────
  function navigate(raw) {
    const url = _parseUrl(raw);
    if (!url) return;

    urlInput.value = url;
    navHistory = navHistory.slice(0, historyIdx + 1);
    navHistory.push(url);
    historyIdx = navHistory.length - 1;

    // ── Search queries: auto-open in new tab, show engine chooser ──
    if (_isSearch(url)) {
      const q = _extractQuery(url) || raw.trim();
      currentUrl = url;
      setSecure(url);
      setTab('🔍', `Search: ${q}`);
      WebOS.WindowManager.setTitle('browser-win', `Search: ${q}`);
      statusEl.textContent = 'Searching…';
      _showSearchPanel(q);
      return;
    }

    load(url);
  }

  // ── Search launched panel ────────────────────
  function _showSearchPanel(query) {
    // Hide all panels, inject search UI into the blocked panel (repurposed)
    showPanel('blocked');

    const enc = encodeURIComponent(query);
    const engines = SEARCH_ENGINES.map(e => `
      <button class="br-engine-btn" data-url="${e.build(query)}" title="Search ${e.name}">
        <span>${e.icon}</span> ${e.name}
      </button>
    `).join('');

    blockedEl.innerHTML = `
      <div class="br-search-panel">
        <div style="font-size:42px;margin-bottom:4px">🔍</div>
        <h2 style="font-size:20px;font-weight:700;color:var(--text-primary);">Search: <span style="color:var(--cyan)">${query}</span></h2>
        <p style="font-size:13px;color:var(--text-muted);max-width:420px;text-align:center;line-height:1.6">
          Search engines block embedding for security.<br>
          Choose an engine below — it opens in your browser.
        </p>
        <div class="br-engine-grid">${engines}</div>
        <button class="app-btn" id="br-search-home">🏠 Home</button>
      </div>
    `;

    // Attach engine buttons
    blockedEl.querySelectorAll('.br-engine-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url;
        window.open(url, '_blank');
        // Show which engine was used
        btn.style.borderColor = 'var(--cyan)';
        btn.style.color = 'var(--cyan)';
        statusEl.textContent = `Opened in ${btn.textContent.trim()}`;
        Notify({ title: 'Search Opened', message: `"${query}" → ${btn.querySelector('span').textContent + btn.textContent.trim().slice(1)}`, type: 'info', icon: '🔍', duration: 2500 });
      });
    });
    blockedEl.querySelector('#br-search-home')?.addEventListener('click', goHome);
  }

  function load(url) {
    currentUrl = url;
    urlInput.value = url;
    setSecure(url);
    clearTimeout(loadTimer);

    const host = _hostname(url);
    statusEl.textContent = `Connecting to ${host}…`;
    setTab('⏳', host);
    WebOS.WindowManager.setTitle('browser-win', host);

    // ── Known-blocked → skip iframe, show blocked page ──
    if (_isBlocked(url)) {
      showPanel('loading');
      body.querySelector('#br-loading-text').textContent = `Checking ${host}…`;
      loadTimer = setTimeout(() => showBlocked(url), 400);
      return;
    }

    // ── Try iframe ───────────────────────────────────
    showPanel('loading');
    body.querySelector('#br-loading-text').textContent = `Loading ${host}…`;

    iframe.src = 'about:blank';
    requestAnimationFrame(() => { iframe.src = url; });

    iframe.onload = () => {
      clearTimeout(loadTimer);

      let accessible = false;
      let pageTitle  = host;

      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc && doc.title) pageTitle = doc.title.slice(0, 40);
        if (doc && doc.body)  accessible = true;
      } catch(e) {
        // Cross-origin SecurityError → page loaded fine in iframe (just JS-restricted)
        accessible = true;
      }

      if (accessible) {
        body.querySelector('#br-iframe-bar-url').textContent = url;
        showPanel('iframe');
        statusEl.textContent = 'Done';
        setTab('🌐', pageTitle);
        WebOS.WindowManager.setTitle('browser-win', pageTitle.slice(0, 28));
      } else {
        showBlocked(url, false);
      }
    };

    iframe.onerror = () => {
      clearTimeout(loadTimer);
      showBlocked(url, false);
    };

    // 10s fallback
    loadTimer = setTimeout(() => {
      // If iframeWrap is visible we already succeeded; otherwise show blocked
      if (iframeWrap.style.display === 'none') showBlocked(url, false);
    }, 10000);
  }

  function showBlocked(url) {
    blockedEl.innerHTML = `
      <div class="br-error-icon">🔒</div>
      <h2 class="br-error-title">${_hostname(url)} cannot be embedded</h2>
      <p class="br-error-sub">
        This site uses X-Frame-Options or Content-Security-Policy to prevent iframe embedding.
        Open it in your real browser instead.
      </p>
      <div class="br-blocked-actions">
        <button class="app-btn primary" id="br-open-ext-btn" style="font-size:14px;padding:10px 20px">
          ↗1nbsp; Open in Browser Tab
        </button>
        <button class="app-btn" id="br-home-btn2">🏠 Home</button>
      </div>
      <div class="br-blocked-url">${url}</div>
    `;
    showPanel('blocked');
    statusEl.textContent = 'Blocked by site';
    setTab('🔒', _hostname(url));
    WebOS.WindowManager.setTitle('browser-win', `Blocked — ${_hostname(url)}`);
    blockedEl.querySelector('#br-open-ext-btn')?.addEventListener('click', () => window.open(url, '_blank'));
    blockedEl.querySelector('#br-home-btn2')?.addEventListener('click', goHome);
  }

  function goHome() {
    clearTimeout(loadTimer);
    currentUrl = '';
    urlInput.value = '';
    iframe.src = 'about:blank';
    showPanel('home');
    statusEl.textContent = 'Ready';
    setSecure('');
    setTab('🌐', 'New Tab');
    WebOS.WindowManager.setTitle('browser-win', 'NexBrowser');
    setTimeout(() => homeInput?.focus(), 80);
  }

  // ── Event listeners ──────────────────────────
  body.querySelector('#br-back').addEventListener('click',    () => { if (historyIdx > 0) { historyIdx--; load(navHistory[historyIdx]); urlInput.value = navHistory[historyIdx]; } });
  body.querySelector('#br-fwd').addEventListener('click',     () => { if (historyIdx < navHistory.length - 1) { historyIdx++; load(navHistory[historyIdx]); urlInput.value = navHistory[historyIdx]; } });
  body.querySelector('#br-refresh').addEventListener('click', () => { if (currentUrl) load(currentUrl); });
  body.querySelector('#br-home').addEventListener('click',    goHome);
  body.querySelector('#br-go').addEventListener('click',      () => navigate(urlInput.value));
  body.querySelector('#br-ext').addEventListener('click',     () => { if (currentUrl) window.open(currentUrl, '_blank'); });
  body.querySelector('#br-bookmark').addEventListener('click', () => {
    Notify({ title: 'Bookmarked', message: currentUrl || 'New Tab', type: 'success', icon: '★', duration: 2000 });
  });

  urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  navigate(urlInput.value);
    if (e.key === 'Escape') { urlInput.value = currentUrl; urlInput.blur(); }
  });
  urlInput.addEventListener('focus', () => urlInput.select());

  // Home page search
  body.querySelector('#br-home-go').addEventListener('click', () => {
    const url = _parseUrl(homeInput.value);
    if (url) window.open(url, '_blank');
  });
  homeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const url = _parseUrl(homeInput.value);
      if (url) window.open(url, '_blank');
    }
  });

  // Blocked page buttons
  body.querySelector('#br-open-ext-btn').addEventListener('click',   () => { if (currentUrl) window.open(currentUrl, '_blank'); });
  body.querySelector('#br-try-anyway-btn').addEventListener('click', () => {
    // Force iframe even for known-blocked (user's choice)
    showPanel('loading');
    iframe.src = 'about:blank';
    requestAnimationFrame(() => { iframe.src = currentUrl; });
    iframe.onload = () => {
      body.querySelector('#br-iframe-bar-url').textContent = currentUrl;
      showPanel('iframe');
      statusEl.textContent = 'Loaded (may be blocked)';
    };
  });
  body.querySelector('#br-home-btn2').addEventListener('click', goHome);
  body.querySelector('#br-iframe-ext').addEventListener('click', () => { if (currentUrl) window.open(currentUrl, '_blank'); });

  // Quick links → open in browser directly (they're all known-blocked)
  body.querySelectorAll('.quick-link').forEach(link => {
    link.addEventListener('click', () => {
      const url = link.dataset.url;
      navigate(url);
    });
  });

  if (params?.url) navigate(params.url);
  else homeInput?.focus();
}
