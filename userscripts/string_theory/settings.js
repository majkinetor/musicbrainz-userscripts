// String Theory's settings window (#851). build.mjs writes this file into the bundle, inside the scope of
// its toggles, where these are defined: stMembers ([folder, name, version, @icon] per member), ST_VERSION,
// ST_BRANCH (the branch a test build was made on, empty on main and stable),
// ST_ICON, ST_HOME, ST_ON_MB, stFlip(folder), __stReadOff(), __stStarters (folder → { so, soStarted(), go() }), mbuShared(), mbRestackCorner(), and stUI()
// and stTokens(), which return the shared UI and token blocks (each made once, the first time the window
// opens). Plain ES5, as the bundle's own code: no build step touches it.
var stCfgOv = null;
function stEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}
function stCmpVer(a, b) {
  var pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (var i = 0; i < Math.max(pa.length, pb.length); i++) { var d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
}
var ST_REPO = 'majkinetor/musicbrainz-userscripts';
function stInstallUrl(ref) { return 'https://github.com/' + ST_REPO + '/raw/refs/heads/' + ref + '/userscripts/string_theory/string_theory.user.js'; }
// only the first few KB: @version is on the metadata block's third line
function stRemoteVersion(ref, cb) {
  var url = 'https://raw.githubusercontent.com/' + ST_REPO + '/refs/heads/' + ref + '/userscripts/string_theory/string_theory.user.js?t=' + Date.now();
  var done = function (txt) { var m = txt && /@version +([0-9.]+)/.exec(txt); cb(m ? m[1] : null); };
  try {
    if (typeof GM_xmlhttpRequest === 'function') {
      GM_xmlhttpRequest({ method: 'GET', url: url, headers: { Range: 'bytes=0-4095' }, timeout: 15000,
        onload: function (r) { done(r.status >= 200 && r.status < 300 ? r.responseText : null); },
        onerror: function () { done(null); }, ontimeout: function () { done(null); } });
    } else {
      fetch(url, { headers: { Range: 'bytes=0-4095' }, cache: 'no-store' })
        .then(function (r) { return r.ok ? r.text() : null; }).then(done, function () { done(null); });
    }
  } catch (e) { done(null); }
}
// Icons are drawn with different margins, so the same box shows them at different sizes: crop an SVG
// icon to what it draws, square and with a little room for strokes. A raster icon is left as it is.
var stFitCache = {};
function stFitIcon(src) {
  if (!src) return '';
  if (stFitCache[src]) return stFitCache[src];
  var out = src;
  try {
    var txt = null, m = /^<img\b[^>]*?\ssrc="([^"]*)"/i.exec(src);
    if (m) {
      var url = m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      var d = /^data:image[/]svg\+xml([^,]*),([\s\S]*)$/i.exec(url);
      if (d) txt = /;base64/i.test(d[1]) ? decodeURIComponent(escape(atob(d[2]))) : decodeURIComponent(d[2]);
    } else if (/^<svg\b/i.test(src)) txt = src;
    if (txt) {
      var box = document.createElement('div');
      box.style.cssText = 'position:absolute;left:-9999px;top:0;width:128px;height:128px;visibility:hidden;pointer-events:none';
      box.innerHTML = txt;
      (document.body || document.documentElement).appendChild(box);
      var svg = box.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', '128');
        svg.setAttribute('height', '128');
        var b = svg.getBBox();
        if (b.width > 0 && b.height > 0) {
          var side = Math.max(b.width, b.height) * 1.08, cx = b.x + b.width / 2, cy = b.y + b.height / 2;
          svg.setAttribute('viewBox', [cx - side / 2, cy - side / 2, side, side].map(function (n) { return Math.round(n * 100) / 100; }).join(' '));
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          svg.removeAttribute('style');
          out = '<img alt="" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg)) + '">';
        }
      }
      box.remove();
    }
  } catch (e) { /* keep the icon as it is */ }
  stFitCache[src] = out;
  return out;
}
// getBBox counts what a clip path or a mask hides (Art Station's sky), so the box can still be too big:
// once an icon is drawn, crop it again to its visible pixels.
var stPixCache = {};
function stFitPixels(root) {
  Array.prototype.forEach.call(root.querySelectorAll('img[src^="data:image/svg+xml"]'), function (img) {
    var src = img.getAttribute('src');
    if (stPixCache[src]) { if (stPixCache[src] !== src) img.src = stPixCache[src]; return; }
    try {
      var txt = decodeURIComponent(src.slice(src.indexOf(',') + 1));
      var svg = new DOMParser().parseFromString(txt, 'image/svg+xml').documentElement;
      var vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
      if (vb.length !== 4 || !(vb[2] > 0) || vb[2] !== vb[3]) { stPixCache[src] = src; return; }
      var N = 256;
      svg.setAttribute('width', N);
      svg.setAttribute('height', N);
      var im = new Image();
      im.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = c.height = N;
          var x = c.getContext('2d');
          x.drawImage(im, 0, 0, N, N);
          var px = x.getImageData(0, 0, N, N).data, x0 = N, y0 = N, x1 = -1, y1 = -1;
          for (var i = 0; i < N * N; i++) if (px[i * 4 + 3] > 8) {
            var yy = Math.floor(i / N), xx = i % N;
            if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
          }
          if (x1 < 0) { stPixCache[src] = src; return; }
          var k = vb[2] / N, w = (x1 - x0 + 1) * k, h = (y1 - y0 + 1) * k;
          var side = Math.max(w, h) * 1.06, cx = vb[0] + (x0 + x1 + 1) / 2 * k, cy = vb[1] + (y0 + y1 + 1) / 2 * k;
          svg.setAttribute('viewBox', [cx - side / 2, cy - side / 2, side, side].map(function (n) { return Math.round(n * 100) / 100; }).join(' '));
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          var out = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
          stPixCache[src] = out;
          Array.prototype.forEach.call(root.querySelectorAll('img'), function (o) { if (o.getAttribute('src') === src) o.src = out; });
        } catch (e) { stPixCache[src] = src; }
      };
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    } catch (e) { stPixCache[src] = src; }
  });
}
function stCopy(text, ok) {
  try { if (typeof GM_setClipboard === 'function') { GM_setClipboard(text, 'text'); ok(true); return; } } catch (e) { /* fall back */ }
  try { navigator.clipboard.writeText(text).then(function () { ok(true); }, function () { ok(false); }); } catch (e) { ok(false); }
}
// What runs the bundle, the same facts a script's log starts with (mbuStartupInfo): manager, browser, site
function stEnvLines() {
  var out = [], g = null;
  try { g = (typeof GM_info !== 'undefined' && GM_info) || null; } catch (e) { /* no GM_info */ }
  var p = (g && g.platform) || {};
  if (g && g.scriptHandler) out.push(['Manager', g.scriptHandler + (g.version ? ' ' + g.version : '')]);
  if (p.browserName) out.push(['Browser', p.browserName + (p.browserVersion ? ' ' + p.browserVersion : '') + (p.os ? ' (' + p.os + ')' : '')]);
  else { try { out.push(['Browser', navigator.userAgent]); } catch (e) { /* no navigator */ } }
  try {
    var site = location.hostname;
    if (/(^|\.)musicbrainz\.(org|eu)$/i.test(site)) site += ', in ' + ((document.documentElement && document.documentElement.lang) || ((document.cookie.match(/(?:^|;\s*)lang=([^;]+)/) || [])[1]) || 'en');
    out.push(['Site', site]);
  } catch (e) { /* no location */ }
  return out;
}
// The versions to paste into an issue as Markdown.
// The channel String Theory was installed from: the install address when the manager tells it, else the
// channel whose version About last read is this one, else the branch a test build was made on.
var stRemote = {};
function stChannel() {
  var g = null; try { g = (typeof GM_info !== 'undefined' && GM_info) || null; } catch (e) { /* no GM_info */ }
  var sc = (g && g.script) || {}, urls = [g && g.scriptUpdateURL, sc.updateURL, sc.downloadURL, g && g.scriptURL, sc.fileURL];
  for (var i = 0; i < urls.length; i++) {
    var u = typeof urls[i] === 'string' ? urls[i] : '', m;
    if ((m = /\/refs\/heads\/([^/]+)\//.exec(u)) || (m = /\/raw\/(?!refs\/)([^/]+)\/userscripts\//.exec(u))) {
      return m[1] === 'main' ? 'Latest' : m[1] === 'stable' ? 'Stable' : /^[0-9a-f]{7,40}$/.test(m[1]) ? 'pinned ' + m[1].slice(0, 8) : 'branch ' + m[1];
    }
  }
  if (ST_BRANCH) return 'branch ' + ST_BRANCH;
  if (stRemote.stable === ST_VERSION) return 'Stable';
  if (stRemote.main === ST_VERSION) return 'Latest';
  return '';
}
function stVersionsText() {
  var off = __stReadOff(), ch = stChannel();
  // A details section keeps a long list from taking over the issue; Markdown doesn't render inside <summary>
  var lines = ['<details>', '<summary><b>String Theory</b> <code>v' + ST_VERSION + '</code>' + (ch ? ' (' + ch + ')' : '') + '</summary>\n'];
  stMembers.forEach(function (m) { lines.push('- [' + (off.indexOf(m[0]) < 0 ? 'x' : ' ') + '] ' + m[1] + ' `v' + m[2] + '`'); });
  lines.push('');
  stEnvLines().forEach(function (e) { lines.push('**' + e[0] + ':** ' + e[1] + '  '); });
  lines[lines.length - 1] = lines[lines.length - 1].replace(/ {2}$/, '');
  lines.push('', '</details>');
  return lines.join('\n');
}
var ST_CSS = ''
  + '#st-cfg{width:min(620px,94vw);padding:14px 16px;box-sizing:border-box;overflow:auto;font:13px/1.4 var(--mbu-font);outline:none}'
  + '#st-cfg .st-sec{margin:0 0 14px}#st-cfg .st-sec:last-child{margin:0}'
  + '#st-cfg .st-nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 10px;border-bottom:1px solid var(--mbu-border)}'
  + '#st-cfg .st-tabs{display:flex;gap:2px}'
  + '#st-cfg .st-tabs button{font:inherit;font-size:12px;font-weight:600;margin:0 0 -1px;padding:5px 12px;border:1px solid transparent;border-bottom:0;border-radius:var(--mbu-radius) var(--mbu-radius) 0 0;background:none;color:var(--mbu-text-dim);cursor:pointer}'
  + '#st-cfg .st-tabs button:hover{color:inherit}'
  + '#st-cfg .st-tabs button[aria-selected=true]{color:inherit;background:var(--mbu-bg);border-color:var(--mbu-border)}'
  + '#st-cfg h3{margin:0 0 4px;padding:0;border:0;background:none;font:600 11px/1.4 var(--mbu-font);text-transform:uppercase;letter-spacing:.06em;color:var(--mbu-text-weak)}'
  + '#st-cfg .st-row{display:flex;align-items:center;gap:8px;min-height:28px;margin:0;font-weight:400}'
  + '#st-cfg .st-row>label:first-child{flex:0 0 64px}'
  + '#st-cfg #st-p-s .st-row{flex-wrap:wrap;margin:7px 0}#st-cfg #st-p-s .st-row>label{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;flex:0 0 auto}#st-cfg #st-sync-status{color:var(--mbu-text-weak);overflow-wrap:anywhere}'
  + '#st-cfg #st-sync-backups{max-height:220px;overflow:auto}#st-cfg #st-sync-backups .st-row{padding:5px 0;border-bottom:1px solid var(--mbu-border)}#st-cfg #st-sync-backup-status{color:var(--mbu-text-weak)}'
  + '#st-cfg #st-p-g .st-row>.st-lbl:first-child{flex:0 0 96px;white-space:nowrap}#st-cfg #st-p-g .st-lbl{white-space:nowrap}#st-cfg #st-p-g select{flex:0 1 150px;width:150px;min-width:0;height:26px}#st-cfg .st-time{box-sizing:border-box;width:60px;height:26px;padding:0 6px;text-align:center;font:inherit;color:inherit;background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:15px}'
  + '#st-cfg label.st-row{cursor:pointer}#st-cfg label.st-row input{margin:0}'
  + '#st-cfg-news{margin-right:10px;white-space:nowrap}#st-cfg-news>.st-nwi{display:none}'
  + '@media (max-width:640px){#st-cfg-news{display:inline-flex;align-items:center;justify-content:center;min-width:32px;min-height:32px;margin-right:4px;color:#f5b400}#st-cfg-news>.st-nwi{display:block;filter:drop-shadow(0 0 3px #ffd54a) drop-shadow(0 0 7px rgba(255,200,40,.6))}#st-cfg-news>.st-nwt{display:none}}'
  + '#st-cfg .st-ver{margin-left:auto;color:var(--mbu-text-weak);font-size:11px;white-space:nowrap}'
  + '#st-cfg .st-note{flex:1 1 auto;color:var(--mbu-text-dim);font-size:12px}'
  + '#st-cfg .st-b{flex:0 0 auto;font:inherit;font-size:12px;padding:3px 10px;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);cursor:pointer}'
  + '#st-cfg .st-b:hover{background:var(--mbu-bg-hover)}#st-cfg .st-b:disabled{opacity:.6;cursor:default}'
  + '#st-cfg a{color:var(--mbu-accent-text)}'
  + '#st-cfg .st-upd{margin:4px 0 12px;padding:6px 10px;border-radius:var(--mbu-radius);background:var(--mbu-bg-sunken);font-size:12px}'
  + '#st-cfg .st-upd>div{display:flex;align-items:center;gap:8px;min-height:24px}#st-cfg .st-upd b{flex:0 0 auto;min-width:64px;font-weight:600;white-space:nowrap}#st-cfg .st-upd span{white-space:nowrap}'
  + '#st-cfg .st-upd .st-newer{color:var(--mbu-ok);font-weight:600}'
  + '#st-cfg .st-lbl{flex:0 0 auto;color:var(--mbu-text-weak)!important;font:600 11px/1.4 var(--mbu-font, system-ui, sans-serif);text-transform:uppercase;letter-spacing:.06em}'
  + '#st-cfg .st-seg{display:inline-flex;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);overflow:hidden;margin-right:10px}'
  + '#st-cfg .st-seg button{font:inherit;font-size:12px;border:0;margin:0;border-radius:0;background:none;color:inherit;padding:2px 10px;min-height:22px;line-height:18px;cursor:pointer}'
  + '#st-cfg .st-seg button+button{border-left:1px solid var(--mbu-border)}#st-cfg .st-seg button:hover{background:var(--mbu-bg-hover)}'
  + '#st-cfg .st-seg button[aria-checked=true]{background:var(--mbu-accent-soft);color:var(--mbu-accent-text)}'
  + '#st-cfg .st-step{display:inline-flex;align-items:center;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius)}'
  + '#st-cfg .st-step button{font:inherit;font-size:15px;line-height:1;border:0!important;margin:0!important;padding:0!important;border-radius:0!important;background:none!important;color:inherit;box-sizing:border-box;flex:0 0 28px;width:28px!important;min-width:28px!important;height:22px!important;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}'
  + '#st-cfg .st-step button:hover:not(:disabled){background:var(--mbu-bg-hover)!important}#st-cfg .st-step button:disabled{opacity:.4;cursor:default}'
  + '#st-cfg .st-step output{min-width:50px;text-align:center;font-variant-numeric:tabular-nums}'
  + '#st-cfg .st-strip{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:4px 6px;margin:2px 0;border:1px dashed var(--mbu-border);border-radius:var(--mbu-radius);touch-action:none;min-height:24px}'
  + '#st-cfg .st-di{display:grid;place-items:center;flex:0 0 auto;width:28px;height:28px;border-radius:50%;cursor:grab;user-select:none}'
  + '#st-cfg .st-di>img,#st-cfg .st-di>svg{width:100%;height:100%;display:block;pointer-events:none}'
  + '#st-cfg .st-di.st-drag{outline:2px solid var(--mbu-accent);outline-offset:2px;cursor:grabbing}'
  + '#st-cfg .st-cap{color:var(--mbu-text-dim);font-size:12px}'
  + '#st-cfg .st-links{display:flex;gap:14px;margin-left:auto;white-space:nowrap}'
  + '#st-cfg .st-scripts{display:grid;grid-template-columns:1fr 1fr;column-gap:40px}#st-cfg .st-scripts .st-row{min-height:24px;gap:6px;white-space:nowrap}'
  + '#st-cfg .st-si{flex:0 0 18px;width:18px;height:18px;display:grid;place-items:center}#st-cfg .st-si>img,#st-cfg .st-si>svg{width:100%;height:100%;display:block}'
  + '#st-cfg h3.st-h{margin:10px 0 4px;padding:0 0 3px;border-bottom:1px solid var(--mbu-border);font:700 14px/1.3 var(--mbu-font);text-transform:none;letter-spacing:0;color:var(--mbu-text)!important}#st-cfg h3.st-h:first-child{margin-top:2px}'
  + '#st-cfg .st-key{min-width:96px;font-variant-numeric:tabular-nums}#st-cfg .st-key[data-rec]{border-color:var(--mbu-accent);color:var(--mbu-accent-text)}'
  + '#st-cfg [hidden]{display:none!important}'
  // one size for the window: the tabs share a cell, and the one not shown keeps its room, as do Time's and Sun's extras
  + '#st-cfg .st-panes,#st-cfg .st-th-x{display:grid}#st-cfg .st-panes>.st-sec,#st-cfg .st-th-x>*{grid-area:1/1;margin:0}#st-cfg .st-th-x{display:inline-grid;align-items:center}#st-cfg .st-tx{display:inline-flex;align-items:center;gap:6px}'
  + '#st-cfg .st-panes>.st-sec[hidden]{display:block!important;visibility:hidden}'
  + '#st-cfg-ov{background:none;pointer-events:none}#st-cfg-ov>#st-cfg{pointer-events:auto}'
  // a phone: the whole screen, one column, each label above its control (majkinetor)
  + '@media (max-width:640px){#st-cfg{position:fixed!important;inset:0!important;width:auto!important;max-width:none!important;height:auto!important;max-height:none!important;margin:0!important;border-radius:0!important;transform:none!important;padding:12px 14px calc(16px + env(safe-area-inset-bottom,0px))!important;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain}'
  + '#st-cfg *{min-width:0;max-width:100%}#st-cfg .st-row{flex-wrap:wrap;row-gap:4px;height:auto;margin:6px 0}'
  + '#st-cfg .st-row>.st-lbl,#st-cfg #st-p-g .st-row>.st-lbl:first-child{flex:1 0 100%;white-space:normal;margin-top:4px}'
  + '#st-cfg .st-seg{flex-wrap:wrap;margin-right:6px}#st-cfg .st-seg button{min-height:32px;padding:4px 12px}'
  + '#st-cfg .st-step button{height:32px!important;width:36px!important;flex-basis:36px}'
  + '#st-cfg #st-p-g select{flex:1 1 auto;width:auto;height:32px}'
  + '#st-cfg .st-scripts{grid-template-columns:1fr}#st-cfg .st-scripts .st-row{white-space:normal}'
  + '#st-cfg .st-nav{row-gap:4px}#st-cfg .st-links{margin-left:0}#st-cfg .st-ver{white-space:normal}'
  + '#st-cfg .st-cap,#st-cfg .st-note,#st-cfg .st-upd span,#st-cfg .st-lbl,#st-cfg #st-p-g .st-lbl{white-space:normal;overflow-wrap:anywhere}#st-cfg .st-upd>div{flex-wrap:wrap}'
  + '#st-cfg .st-di{width:36px;height:36px}#st-cfg .st-strip{gap:10px}#st-cfg .mbu-cfg-h{flex-wrap:wrap;row-gap:4px;cursor:default}}';
// a launcher opens its script's settings on right-click: pass the click on to the live one
function stLive(name) {
  var els = Array.prototype.filter.call(document.querySelectorAll('[data-mb-corner="br"][data-mb-corner-label]'), function (el) {
    return el.id !== 'mbu-dock' && el.dataset.mbCornerLabel === name;
  });
  return els.filter(function (el) { return el.dataset.mbuDocked !== 'off'; })[0] || els[0] || null;
}
// On any page: the script opens them itself when it runs here (mbu-open-settings), else its launcher's
// right-click does, else String Theory starts it only to open its settings, off or not on this page.
// toFront(false) puts String Theory's window behind them; false back means the script has none.
function stOpenFor(name, toFront) {
  toFront = toFront || function () {};
  var m = stMembers.filter(function (x) { return x[1] === name; })[0], folder = m ? m[0] : name, el = stLive(name);
  toFront(false);
  if (!document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: folder, cancelable: true }))) return true;
  if (el) { el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })); return true; }
  var st = __stStarters[folder];
  if (st && st.so && !st.soStarted()) { st.go(); return true; }
  toFront(true);
  try { stUI().mbuToast('⚠ ' + name + ' has no settings'); } catch (err) { /* no toast */ }
  return false;
}
// tab: 'g' General, 'a' About (MusicBrainz only; elsewhere there is only About); 'l' is General's Dock section
function stSettings(tab) {
  var dock = tab === 'l';
  if (dock) tab = 'g';
  var toDock = function () { var d = ST_ON_MB && stCfgOv && stCfgOv.querySelector('#st-dock'); if (dock && d) d.scrollIntoView({ block: 'start' }); };
  if (stCfgOv && stCfgOv.isConnected) {
    if (tab && stCfgOv.querySelector('#st-tab-' + tab)) stCfgOv.querySelector('#st-tab-' + tab).click();
    stCfgOv.querySelector('#st-cfg').focus();
    toDock();
    return;
  }
  var U = stUI(), T = stTokens(), html = document.documentElement;
  if (!document.getElementById('st-cfg-css')) {
    var css = document.createElement('style');
    css.id = 'st-cfg-css';
    css.textContent = T.MBU_TOKENS + U.MBU_UI_CSS + ST_CSS;
    (document.head || html).appendChild(css);
  }
  var h = U.mbuCfgHeader({ icon: '<img src="' + ST_ICON + '" alt="">', name: 'String Theory', version: ST_VERSION, script: 'string_theory' });
  if (ST_ON_MB) h = h.replace('<span class="mbu-cfg-sp"></span>', '<span class="mbu-cfg-sp"></span><a href="#" id="st-cfg-news" aria-label="What\'s new">'
    + '<svg class="st-nwi" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" fill="currentColor" fill-opacity=".35"/></svg>'
    + '<span class="st-nwt">What\'s new</span></a>');
  var links = '<span class="st-links">'
    + '<a href="https://milic.info/musicbrainz-userscripts" target="_blank" rel="noopener">Website</a>'
    + '<a href="https://github.com/' + ST_REPO + '/issues" target="_blank" rel="noopener">Issues</a></span>';
  if (ST_ON_MB) {
    var seg = function (id, label, opts) {
      return '<span class="st-lbl" id="' + id + '-l">' + label + '</span><span class="st-seg" role="radiogroup" id="' + id + '" aria-labelledby="' + id + '-l">'
        + opts.map(function (o) { return '<button type="button" role="radio" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</span>';
    };
    h += '<div class="st-nav"><div class="st-tabs" role="tablist"><button type="button" role="tab" id="st-tab-g" aria-controls="st-p-g" aria-selected="true">General</button>'
      + '<button type="button" role="tab" id="st-tab-s" aria-controls="st-p-s" aria-selected="false">Sync</button>'
      + '<button type="button" role="tab" id="st-tab-a" aria-controls="st-p-a" aria-selected="false">About</button></div>' + links + '</div><div class="st-panes">'
      + '<section class="st-sec" id="st-p-g" role="tabpanel" aria-labelledby="st-tab-g">'
      + '<h3 class="st-h">Theme</h3>'
      + '<div class="st-row">' + seg('st-th-mode', 'Mode', [['light', 'Light'], ['dark', 'Dark'], ['auto', 'System'], ['sun', 'Sun'], ['time', 'Time']])
      + '<span class="st-th-x"><span class="st-tx" id="st-th-time"><label class="st-lbl" for="st-th-from">Dark</label><input type="text" id="st-th-from" class="st-time" inputmode="numeric" maxlength="5" placeholder="HH:MM" aria-label="Dark from, 24-hour time"><label for="st-th-to">to</label><input type="text" id="st-th-to" class="st-time" inputmode="numeric" maxlength="5" placeholder="HH:MM" aria-label="Dark to, 24-hour time"></span>'
      + '<span class="st-cap" id="st-th-sun">Asks for your location once</span></span></div>'
      + '<div class="st-row">' + ['light', 'dark'].map(function (v) {
        return '<label class="st-lbl" for="st-th-' + v + '">' + (v === 'dark' ? 'Dark theme' : 'Light theme') + '</label><select id="st-th-' + v + '">'
          + __stTheme.names(v).map(function (n) { return '<option>' + stEsc(n) + '</option>'; }).join('') + '</select>';
      }).join('') + '</div>'
      + '<h3 class="st-h" id="st-dock">Dock</h3>'
      + '<div class="st-row">' + seg('st-side', 'Side', [['left', 'Left'], ['right', 'Right']]) + seg('st-flow', 'Orientation', [['column', 'Column'], ['row', 'Row']])
      + '<span class="st-lbl">Size</span><span class="st-step"><button type="button" id="st-size-dn" aria-label="Smaller">−</button>'
      + '<output id="st-size"></output><button type="button" id="st-size-up" aria-label="Bigger">+</button></span></div>'
      + '<div class="st-row">' + seg('st-hover', 'Hover', [['none', 'None'], ['shelf', 'Shelf']]) + '</div>'
      + '<div class="st-strip" id="st-order"></div>'
      + '<div class="st-cap">Drag to reorder, the first nearest the corner; right-click for its settings.</div>'
      + '<h3 class="st-h">Command palette</h3>'
      + '<div class="st-row">' + seg('st-pal-on', 'Palette', [['on', 'On'], ['off', 'Off']])
      + '<span class="st-lbl" id="st-pal-key-l">Hotkey</span><button type="button" class="st-b st-key" id="st-pal-key" aria-labelledby="st-pal-key-l"></button></div>'
      + '<div class="st-cap">Click the hotkey, then press the new one.</div>'
      + '</section>';
    h += '<section class="st-sec" id="st-p-s" role="tabpanel" aria-labelledby="st-tab-s" hidden>' + stSyncMarkup() + '</section>';
  }
  var off = __stReadOff(), known = mbuShared('dockKnown') || {};
  h += '<section class="st-sec" id="st-p-a"' + (ST_ON_MB ? ' role="tabpanel" aria-labelledby="st-tab-a" hidden' : '') + '>'
    + (ST_ON_MB ? '' : '<div class="st-row">' + links + '</div>')
    + '<div class="st-upd" id="st-upd"></div>'
    + '<div class="st-scripts" data-tip="Right-click a script for its settings">' + stMembers.map(function (m) {
      var icon = m[3] ? '<img alt="" src="' + stEsc(m[3]) + '">' : known[m[1]] || '';
      return '<label class="st-row" data-name="' + stEsc(m[1]) + '"><input type="checkbox" data-st-m="' + stEsc(m[0]) + '"' + (off.indexOf(m[0]) < 0 ? ' checked' : '') + '>'
        + '<span class="st-si">' + stFitIcon(icon) + '</span>' + stEsc(m[1]) + '<span class="st-ver">v' + stEsc(m[2]) + '</span></label>';
    }).join('') + '</div>'
    + '<div class="st-row"><span class="st-note" id="st-apply">A change applies from the next page load.</span>'
    + '<button type="button" class="st-b" id="st-reload" hidden>Reload</button><button type="button" class="st-b" id="st-copy-md">Copy as Markdown</button></div>'
    + '</section>' + (ST_ON_MB ? '</div>' : '');

  var ov = document.createElement('div');
  ov.className = 'mbu-ov';
  ov.id = 'st-cfg-ov';
  ov.innerHTML = '<div class="mbu-ov-panel mbu-ui" id="st-cfg" tabindex="-1" role="dialog" aria-label="String Theory settings">' + h + '</div>';
  (document.body || html).appendChild(ov);
  stCfgOv = ov;
  var panel = ov.querySelector('#st-cfg'), q = function (s) { return panel.querySelector(s); };
  var close = function () { ov.remove(); document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onOut, true); };
  var newsLink = ov.querySelector('#st-cfg-news');
  if (newsLink) newsLink.addEventListener('click', function (e) { e.preventDefault(); close(); stNewsOpen(); });
  // #851: a script's settings opened from here sit above this window, which stays open; the one used last
  // is in front and takes Escape. A floating (position: fixed) element is taken for such a window.
  var front = true, toFront = function (on) { front = on; ov.style.zIndex = on ? '' : '9000'; };   // #851: behind every script's window, the lowest of which is 9990
  var floating = function (t) {
    for (var n = t; n && n.nodeType === 1 && n !== ov; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return true;
    return false;
  };
  var onKey = function (e) {
    if (e.key !== 'Escape') return;
    if (!front) { toFront(true); return; }   // the script's window closes first, this one on the next Escape
    e.stopPropagation(); close();
  };
  document.addEventListener('keydown', onKey, true);
  var onOut = function (e) {
    if (panel.contains(e.target)) { if (!front) toFront(true); return; }
    if (e.target.closest && e.target.closest('#mbu-toast')) return;
    if (floating(e.target)) { toFront(false); return; }
    close();
  };
  document.addEventListener('mousedown', onOut, true);
  if (ST_ON_MB) q('.st-tabs').onclick = function (e) {
    var t = e.target.closest('[role=tab]');
    if (!t) return;
    var enteringAbout = t.id === 'st-tab-a' && t.getAttribute('aria-selected') !== 'true';
    Array.prototype.forEach.call(q('.st-tabs').children, function (b) {
      b.setAttribute('aria-selected', String(b === t));
      q('#' + b.getAttribute('aria-controls')).hidden = b !== t;
    });
    if (enteringAbout) checkUpdates();
  };
  var live = stLive, openFor = function (name) { stOpenFor(name, toFront); };
  q('.st-scripts').addEventListener('contextmenu', function (e) {
    var r = e.target.closest('[data-name]');
    if (!r) return;
    e.preventDefault();
    openFor(r.dataset.name);
  });

  if (ST_ON_MB) {
    stSyncBind(q('#st-p-s'));
    var restack = function () { ['br', 'bl', 'tr', 'tl'].forEach(function (c) { try { mbRestackCorner(c); } catch (e) { /* a corner's script broke */ } }); };
    var size = function () { return Math.round((Number(mbuShared('cornerSize')) || 1) * 10) * 10; };
    var show = function () {
      var pick = function (id, v) { Array.prototype.forEach.call(q(id).children, function (b) { b.setAttribute('aria-checked', String(b.dataset.v === v)); }); };
      pick('#st-side', mbuShared('cornerSide') === 'left' ? 'left' : 'right');
      pick('#st-flow', mbuShared('cornerFlow') === 'row' ? 'row' : 'column');
      pick('#st-hover', mbuShared('dockHover') === 'shelf' ? 'shelf' : 'none');
      var v = size();
      q('#st-size').textContent = v + ' %';
      q('#st-size-dn').disabled = v <= 60;
      q('#st-size-up').disabled = v >= 160;
    };
    var segSet = function (key, alt) {
      return function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        mbuShared(key, b.dataset.v === alt ? alt : null);
        restack(); show();
      };
    };
    var showTheme = function () {
      var th = __stTheme.read();
      Array.prototype.forEach.call(q('#st-th-mode').children, function (b) { b.setAttribute('aria-checked', String(b.dataset.v === th.mode)); });
      q('#st-th-dark').value = th.dark; q('#st-th-light').value = th.light;
      q('#st-th-from').value = th.from; q('#st-th-to').value = th.to;
      q('#st-th-time').style.visibility = th.mode === 'time' ? '' : 'hidden';
      q('#st-th-sun').style.visibility = th.mode === 'sun' ? '' : 'hidden';
    };
    q('#st-th-mode').onclick = function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      __stTheme.setMode(b.dataset.v, showTheme);
      showTheme();
    };
    ['dark', 'light'].forEach(function (v) {
      q('#st-th-' + v).onchange = function (e) { var p = {}; p[v] = e.target.value; __stTheme.set(p); };
    });
    ['from', 'to'].forEach(function (k) {
      // text, not type=time: that one shows AM/PM by the browser's locale
      q('#st-th-' + k).oninput = function (e) {
        var m = e.target.value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
        if (!m) return;
        var p = {}; p[k] = (m[1].length < 2 ? '0' : '') + m[1] + ':' + m[2]; __stTheme.set(p);
      };
      q('#st-th-' + k).onchange = showTheme;   // tidies what was typed, or restores it
    });
    showTheme();
    var showPal = function () {
      var p = stPalRead();
      Array.prototype.forEach.call(q('#st-pal-on').children, function (b) { b.setAttribute('aria-checked', String(b.dataset.v === (p.on ? 'on' : 'off'))); });
      var k = q('#st-pal-key');
      k.removeAttribute('data-rec');
      k.textContent = stKeyLabel(p.key);
    };
    q('#st-pal-on').onclick = function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      stPalSet({ on: b.dataset.v === 'on' });
      showPal();
    };
    // the next key pressed with it, modifiers held, is the hotkey; Escape keeps the old one
    q('#st-pal-key').onclick = function () {
      var k = q('#st-pal-key');
      k.setAttribute('data-rec', '');
      k.textContent = 'Press keys…';
      var rec = function (e) {
        if (/^(Control|Alt|Shift|Meta|OS|AltGraph)$/.test(e.key)) return;
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        window.removeEventListener('keydown', rec, true);
        stPalRecording = false;
        if (e.key !== 'Escape') {
          var h = stKeyOf(e);
          if (!h.ctrl && !h.alt && !h.meta) { try { U.mbuToast('⚠ A hotkey needs Ctrl, Alt or Meta'); } catch (err) { /* no toast */ } } else stPalSet({ key: h });
        }
        showPal();
      };
      stPalRecording = true;
      window.addEventListener('keydown', rec, true);
    };
    showPal();
    q('#st-side').onclick = segSet('cornerSide', 'left');
    q('#st-flow').onclick = segSet('cornerFlow', 'row');
    q('#st-hover').onclick = segSet('dockHover', 'shelf');
    var step = function (d) {
      var v = Math.min(160, Math.max(60, size() + d));
      mbuShared('cornerSize', v === 100 ? null : v / 100);
      restack(); show();
    };
    q('#st-size-dn').onclick = function () { step(-10); };
    q('#st-size-up').onclick = function () { step(10); };

    // Every launcher any page has shown (dockKnown), in dockOrder, then as the page stacks them.
    var strip = q('#st-order'), order = mbuShared('dockOrder');
    order = Array.isArray(order) ? order : [];
    var rank = function (n) {
      var i = order.indexOf(n), el = i < 0 && live(n);
      return i >= 0 ? i - 1e5 : el ? Number(el.dataset.mbCornerOrder) || 0 : 1e5;
    };
    Object.keys(known).sort(function (a, b) { return rank(a) - rank(b) || (a < b ? -1 : 1); }).forEach(function (n) {
      var d = document.createElement('div');
      d.className = 'st-di';
      d.dataset.name = n;
      d.dataset.tip = n;
      d.innerHTML = stFitIcon(known[n]);
      strip.appendChild(d);
    });
    if (!strip.children.length) strip.innerHTML = '<span class="st-cap">The launchers show here once a page has them.</span>';
    var drag = null;
    strip.addEventListener('pointerdown', function (e) {
      var d = e.button === 0 && e.target.closest('.st-di');
      if (!d) return;
      e.preventDefault();
      drag = d;
      d.classList.add('st-drag');
      try { strip.setPointerCapture(e.pointerId); } catch (err) { /* old browser */ }
    });
    strip.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var over = Array.prototype.filter.call(strip.children, function (c) {
        var r = c.getBoundingClientRect();
        return c !== drag && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 3 && e.clientY <= r.bottom + 3;
      })[0];
      if (!over) return;
      var r = over.getBoundingClientRect();
      strip.insertBefore(drag, e.clientX < r.left + r.width / 2 ? over : over.nextSibling);
    });
    var drop = function () {
      if (!drag) return;
      drag.classList.remove('st-drag');
      drag = null;
      var names = Array.prototype.map.call(strip.querySelectorAll('.st-di'), function (c) { return c.dataset.name; });
      if (names.join('\n') === order.join('\n')) return;
      order = names;
      mbuShared('dockOrder', names);
      restack();
    };
    strip.addEventListener('pointerup', drop);
    strip.addEventListener('pointercancel', drop);
    strip.addEventListener('contextmenu', function (e) {
      var d = e.target.closest('.st-di');
      if (!d) return;
      e.preventDefault();
      openFor(d.dataset.name);
    });
    show();
  }

  var updateCheck = 0;
  function checkUpdates() {
    var check = ++updateCheck, box = q('#st-upd');
    var refs = ['main', 'stable'];
    if (ST_BRANCH) refs.push(ST_BRANCH);
    // a row per channel from the start, so the box keeps its size when the answers come
    var got = {}, left = refs.length, draw = function (checking) {
        box.innerHTML = refs.map(function (r) {
          var v2 = got[r], name = r === 'main' ? 'Latest' : r === 'stable' ? 'Stable' : r;
          var state = checking ? 'checking…' : !v2 ? 'couldn’t be read'
            : stCmpVer(v2, ST_VERSION) === 0 ? 'the one you have'
            : stCmpVer(v2, ST_VERSION) > 0 ? '<span class="st-newer">newer</span>' : 'older';
          return '<div><b>' + stEsc(name) + '</b><span>' + (v2 ? 'v' + stEsc(v2) : '') + '</span><span>' + state
            + '</span><span class="mbu-sp" style="flex:1"></span>'
            + (v2 && stCmpVer(v2, ST_VERSION) !== 0 ? '<a href="' + stEsc(stInstallUrl(r)) + '" target="_blank" rel="noopener">Install</a>' : '') + '</div>';
        }).join('');
    };
    draw(true);
    refs.forEach(function (ref) {
      stRemoteVersion(ref, function (v) {
        got[ref] = v;
        if (v) stRemote[ref] = v;
        if (--left || check !== updateCheck) return;
        draw(false);
      });
    });
  }
  if (!ST_ON_MB) checkUpdates();
  else if (tab && tab !== 'g' && q('#st-tab-' + tab)) q('#st-tab-' + tab).click();
  Array.prototype.forEach.call(panel.querySelectorAll('[data-st-m]'), function (box) {
    box.onchange = function () {
      stFlip(box.getAttribute('data-st-m'));
      q('#st-reload').hidden = false;
      q('#st-apply').textContent = 'Reload the page to apply.';
    };
  });
  q('#st-reload').onclick = function () { location.reload(); };
  q('#st-copy-md').onclick = function () {
    stCopy(stVersionsText(), function (ok) { try { U.mbuToast(ok ? '✓ Versions copied as Markdown' : '⚠ Couldn’t copy the versions'); } catch (e) { /* no toast */ } });
  };
  stFitPixels(panel);
  U.mbuControls(panel);
  U.mbuCfgDrag(panel);
  panel.focus();
  toDock();
}
