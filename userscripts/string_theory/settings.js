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
// Where String Theory was installed from says which channel it follows (DEVELOP.md → Branches and
// channels): main is latest, stable the releases, a 40-hex commit a pinned copy, anything else a branch.
function stChannel() {
  var u = '';
  try {
    var s = GM_info.script || {};
    u = s.downloadURL || s.updateURL || GM_info.scriptUpdateURL || '';
    // Managers keep the install URL in different fields when the script has no @downloadURL:
    // take any URL in GM_info that points at the bundle.
    if (!u) JSON.stringify(GM_info, function (k, v) {
      if (!u && typeof v === 'string' && /^https?:[/][/].*string_theory\.user\.js/.test(v)) u = v;
      return v;
    });
  } catch (e) { /* no GM_info */ }
  try { console.debug('[String Theory] install URL: ' + (u || '(none)')); } catch (e) { /* no console */ }
  var m = /musicbrainz-userscripts[/](?:raw[/])?(?:refs[/]heads[/])?(.+?)[/]userscripts[/]string_theory[/]/.exec(u);
  // a manager that doesn't say where the script came from: a test build still knows its branch
  if (!m) return ST_BRANCH && !/github/i.test(u) ? { kind: 'branch', ref: ST_BRANCH } : { kind: 'unknown', url: u };
  var ref = decodeURIComponent(m[1]);
  if (/^[0-9a-f]{40}$/.test(ref)) return { kind: 'pinned', ref: ref };
  if (ref === 'main') return { kind: 'latest', ref: ref };
  if (ref === 'stable') return { kind: 'stable', ref: ref };
  return { kind: 'branch', ref: ref };
}
function stChannelText(ch) {
  if (ch.kind === 'latest') return 'Latest: updates with every change';
  if (ch.kind === 'stable') return 'Stable: updates with each release';
  if (ch.kind === 'branch') return 'Branch ' + ch.ref + ': a test build';
  if (ch.kind === 'pinned') return 'Pinned to ' + ch.ref.slice(0, 7) + ': never updates';
  return ch.url ? 'Installed from ' : 'Installed from an unknown source';
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
// The versions to paste into an issue; md: as Markdown
function stVersionsText(md) {
  var off = __stReadOff(), ch = stChannel(), chan = ch.kind === 'branch' || ch.kind === 'pinned' ? ch.kind + ' ' + ch.ref : ch.kind;
  var mark = function (t) { return md ? '`' + t + '`' : t; };
  var lines = [(md ? '**String Theory** ' : 'String Theory ') + mark('v' + ST_VERSION) + ' (' + chan + ')' + (md ? '\n' : '')];
  stMembers.forEach(function (m) { lines.push((md ? '- ' : '  ') + m[1] + ' ' + mark('v' + m[2]) + (off.indexOf(m[0]) < 0 ? '' : ' (off)')); });
  if (md) lines.push('');
  stEnvLines().forEach(function (e) { lines.push(md ? '**' + e[0] + ':** ' + e[1] + '  ' : e[0] + ': ' + e[1]); });
  if (md) lines[lines.length - 1] = lines[lines.length - 1].replace(/ {2}$/, '');
  return lines.join('\n');
}
var ST_CSS = ''
  + '#st-cfg{width:min(620px,94vw);padding:14px 16px;box-sizing:border-box;overflow:auto;font:13px/1.4 var(--mbu-font);outline:none}'
  + '#st-cfg .mbu-cfg-h .mbu-ov-x{margin:-4px -6px -4px 0}'
  + '#st-cfg .st-sec{margin:0 0 14px}#st-cfg .st-sec:last-child{margin:0}'
  + '#st-cfg .st-tabs{display:flex;gap:2px;margin:0 0 10px;border-bottom:1px solid var(--mbu-border)}'
  + '#st-cfg .st-tabs button{font:inherit;font-size:12px;font-weight:600;margin:0 0 -1px;padding:5px 12px;border:1px solid transparent;border-bottom:0;border-radius:var(--mbu-radius) var(--mbu-radius) 0 0;background:none;color:var(--mbu-text-dim);cursor:pointer}'
  + '#st-cfg .st-tabs button:hover{color:inherit}'
  + '#st-cfg .st-tabs button[aria-selected=true]{color:inherit;background:var(--mbu-bg);border-color:var(--mbu-border)}'
  + '#st-cfg h3{margin:0 0 4px;padding:0;border:0;background:none;font:600 11px/1.4 var(--mbu-font);text-transform:uppercase;letter-spacing:.06em;color:var(--mbu-text-weak)}'
  + '#st-cfg .st-row{display:flex;align-items:center;gap:8px;min-height:30px;margin:0;font-weight:400}'
  + '#st-cfg .st-row>label:first-child{flex:0 0 64px}'
  + '#st-cfg label.st-row{cursor:pointer}#st-cfg label.st-row input{margin:0}'
  + '#st-cfg .st-ver{margin-left:auto;color:var(--mbu-text-weak);font-size:11px;white-space:nowrap}'
  + '#st-cfg .st-note{flex:1 1 auto;color:var(--mbu-text-dim);font-size:12px}'
  + '#st-cfg .st-b{flex:0 0 auto;font:inherit;font-size:12px;padding:3px 10px;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);cursor:pointer}'
  + '#st-cfg .st-b:hover{background:var(--mbu-bg-hover)}#st-cfg .st-b:disabled{opacity:.6;cursor:default}'
  + '#st-cfg a{color:var(--mbu-accent-text)}'
  + '#st-cfg .st-upd{margin:4px 0 0;padding:6px 10px;border-radius:var(--mbu-radius);background:var(--mbu-bg-sunken);font-size:12px}'
  + '#st-cfg .st-upd>div{display:flex;align-items:center;gap:8px;min-height:24px}#st-cfg .st-upd b{flex:0 0 auto;min-width:64px;font-weight:600;white-space:nowrap}#st-cfg .st-upd span{white-space:nowrap}'
  + '#st-cfg .st-upd .st-mine{color:var(--mbu-text-weak)}#st-cfg .st-upd .st-newer{color:var(--mbu-ok);font-weight:600}'
  + '#st-cfg .st-lbl{flex:0 0 auto;color:var(--mbu-text-dim)}'
  + '#st-cfg .st-seg{display:inline-flex;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);overflow:hidden;margin-right:10px}'
  + '#st-cfg .st-seg button{font:inherit;font-size:12px;border:0;margin:0;border-radius:0;background:none;color:inherit;padding:2px 10px;min-height:22px;line-height:18px;cursor:pointer}'
  + '#st-cfg .st-seg button+button{border-left:1px solid var(--mbu-border)}#st-cfg .st-seg button:hover{background:var(--mbu-bg-hover)}'
  + '#st-cfg .st-seg button[aria-checked=true]{background:var(--mbu-accent);color:var(--mbu-text-on-accent)}'
  + '#st-cfg .st-step{display:inline-flex;align-items:center;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius)}'
  + '#st-cfg .st-step button{font:inherit;font-size:15px;line-height:1;border:0;margin:0;border-radius:0;background:none;color:inherit;width:28px;height:22px;cursor:pointer}'
  + '#st-cfg .st-step button:hover:not(:disabled){background:var(--mbu-bg-hover)}#st-cfg .st-step button:disabled{opacity:.4;cursor:default}'
  + '#st-cfg .st-step output{min-width:50px;text-align:center;font-variant-numeric:tabular-nums}'
  + '#st-cfg .st-strip{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px;margin:4px 0 2px;border:1px dashed var(--mbu-border);border-radius:var(--mbu-radius);touch-action:none;min-height:24px}'
  + '#st-cfg .st-di{display:grid;place-items:center;flex:0 0 auto;border-radius:50%;cursor:grab;user-select:none}'
  + '#st-cfg .st-di>img,#st-cfg .st-di>svg{width:100%;height:100%;display:block;pointer-events:none}'
  + '#st-cfg .st-di.st-drag{outline:2px solid var(--mbu-accent);outline-offset:2px;cursor:grabbing}'
  + '#st-cfg .st-cap{color:var(--mbu-text-dim);font-size:12px}'
  + '#st-cfg .st-links{flex-wrap:wrap;gap:4px 14px}'
  + '#st-cfg .st-scripts{display:grid;grid-template-columns:1fr 1fr;column-gap:16px}#st-cfg .st-scripts .st-row{min-height:24px;gap:6px;white-space:nowrap}'
  + '#st-cfg .st-si{flex:0 0 18px;width:18px;height:18px;display:grid;place-items:center}#st-cfg .st-si>img,#st-cfg .st-si>svg{width:100%;height:100%;display:block}'
  + '#st-cfg [hidden]{display:none!important}'
  + '#st-cfg-ov{background:none;pointer-events:none}#st-cfg-ov>#st-cfg{pointer-events:auto}';
function stSettings() {
  if (stCfgOv && stCfgOv.isConnected) { stCfgOv.querySelector('#st-cfg').focus(); return; }
  var U = stUI(), T = stTokens(), html = document.documentElement;
  if (!document.getElementById('st-cfg-css')) {
    var css = document.createElement('style');
    css.id = 'st-cfg-css';
    css.textContent = T.MBU_TOKENS + U.MBU_UI_CSS + ST_CSS;
    (document.head || html).appendChild(css);
  }
  var h = U.mbuCfgHeader({ icon: '<img src="' + ST_ICON + '" alt="">', name: 'String Theory', version: ST_VERSION, script: 'string_theory' })
    .replace(/<[/]div>$/, '<button type="button" class="mbu-ov-x" id="st-x" aria-label="Close">×</button></div>');
  if (ST_ON_MB) {
    var seg = function (id, label, opts) {
      return '<span class="st-lbl" id="' + id + '-l">' + label + '</span><span class="st-seg" role="radiogroup" id="' + id + '" aria-labelledby="' + id + '-l">'
        + opts.map(function (o) { return '<button type="button" role="radio" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</span>';
    };
    h += '<div class="st-tabs" role="tablist"><button type="button" role="tab" id="st-tab-l" aria-controls="st-p-l" aria-selected="true">Launchers</button>'
      + '<button type="button" role="tab" id="st-tab-a" aria-controls="st-p-a" aria-selected="false">About</button></div>'
      + '<section class="st-sec" id="st-p-l" role="tabpanel" aria-labelledby="st-tab-l">'
      + '<div class="st-row">' + seg('st-side', 'Side', [['right', 'Right'], ['left', 'Left']]) + seg('st-flow', 'Orientation', [['column', 'Column'], ['row', 'Row']])
      + '<span class="st-lbl">Size</span><span class="st-step"><button type="button" id="st-size-dn" aria-label="Smaller">−</button>'
      + '<output id="st-size"></output><button type="button" id="st-size-up" aria-label="Bigger">+</button></span></div>'
      + '<div class="st-strip" id="st-order"></div>'
      + '<div class="st-cap">Drag an icon to reorder; the first sits nearest the corner. Right-click one for its settings.</div>'
      + '</section>';
  }
  var off = __stReadOff(), known = mbuShared('dockKnown') || {};
  h += '<section class="st-sec" id="st-p-a"' + (ST_ON_MB ? ' role="tabpanel" aria-labelledby="st-tab-a" hidden' : '') + '>'
    + '<div class="st-row"><span class="st-note" id="st-chan"></span><button type="button" class="st-b" id="st-check">Check for updates</button></div>'
    + '<div class="st-upd" id="st-upd" hidden></div>'
    + '<div class="st-row st-links"><a href="' + stEsc(ST_HOME) + '" target="_blank" rel="noopener">GitHub</a>'
    + '<a href="https://github.com/' + ST_REPO + '/issues" target="_blank" rel="noopener">Issues</a>'
    + '<a href="https://milic.info/musicbrainz-userscripts" target="_blank" rel="noopener">Website</a></div>'
    + '<div class="st-scripts" title="Right-click a script for its settings">' + stMembers.map(function (m) {
      var icon = m[3] ? '<img alt="" src="' + stEsc(m[3]) + '">' : known[m[1]] || '';
      return '<label class="st-row" data-name="' + stEsc(m[1]) + '"><input type="checkbox" data-st-m="' + stEsc(m[0]) + '"' + (off.indexOf(m[0]) < 0 ? ' checked' : '') + '>'
        + '<span class="st-si">' + stFitIcon(icon) + '</span>' + stEsc(m[1]) + '<span class="st-ver">v' + stEsc(m[2]) + '</span></label>';
    }).join('') + '</div>'
    + '<div class="st-row"><span class="st-note" id="st-apply">A change applies from the next page load.</span>'
    + '<button type="button" class="st-b" id="st-reload" hidden>Reload</button><button type="button" class="st-b" id="st-copy">Copy versions</button><button type="button" class="st-b" id="st-copy-md">Copy as Markdown</button></div>'
    + '</section>';

  var ov = document.createElement('div');
  ov.className = 'mbu-ov';
  ov.id = 'st-cfg-ov';
  ov.innerHTML = '<div class="mbu-ov-panel mbu-ui" id="st-cfg" tabindex="-1" role="dialog" aria-label="String Theory settings">' + h + '</div>';
  (document.body || html).appendChild(ov);
  stCfgOv = ov;
  var panel = ov.querySelector('#st-cfg'), q = function (s) { return panel.querySelector(s); };
  var close = function () { ov.remove(); document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onOut, true); };
  // #851: a script's settings opened from here sit above this window, which stays open; the one used last
  // is in front and takes Escape. A floating (position: fixed) element is taken for such a window.
  var front = true, toFront = function (on) { front = on; ov.style.zIndex = on ? '' : 'calc(var(--mbu-z-modal) - 1)'; };
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
  q('#st-x').onclick = close;
  if (ST_ON_MB) q('.st-tabs').onclick = function (e) {
    var t = e.target.closest('[role=tab]');
    if (!t) return;
    Array.prototype.forEach.call(q('.st-tabs').children, function (b) {
      b.setAttribute('aria-selected', String(b === t));
      q('#' + b.getAttribute('aria-controls')).hidden = b !== t;
    });
  };
  // a launcher opens its script's settings on right-click: pass the click on to the live one
  var live = function (name) {
    var els = Array.prototype.filter.call(document.querySelectorAll('[data-mb-corner="br"][data-mb-corner-label]'), function (el) {
      return el.id !== 'mbu-dock' && el.dataset.mbCornerLabel === name;
    });
    return els.filter(function (el) { return el.dataset.mbuDocked !== 'off'; })[0] || els[0] || null;
  };
  // On any page: the script opens them itself when it runs here (mbu-open-settings), else its launcher's
  // right-click does, else String Theory starts it only to open its settings, off or not on this page
  var openFor = function (name) {
    var m = stMembers.filter(function (x) { return x[1] === name; })[0], folder = m ? m[0] : name, el = live(name);
    toFront(false);
    if (!document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: folder, cancelable: true }))) return;
    if (el) { el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })); return; }
    var st = __stStarters[folder];
    if (st && st.so && !st.soStarted()) { st.go(); return; }
    toFront(true);
    try { U.mbuToast('⚠ ' + name + ' has no settings'); } catch (err) { /* no toast */ }
  };
  q('.st-scripts').addEventListener('contextmenu', function (e) {
    var r = e.target.closest('[data-name]');
    if (!r) return;
    e.preventDefault();
    openFor(r.dataset.name);
  });

  if (ST_ON_MB) {
    var restack = function () { ['br', 'bl', 'tr', 'tl'].forEach(function (c) { try { mbRestackCorner(c); } catch (e) { /* a corner's script broke */ } }); };
    var size = function () { return Math.round((Number(mbuShared('cornerSize')) || 1) * 10) * 10; };
    var show = function () {
      var pick = function (id, v) { Array.prototype.forEach.call(q(id).children, function (b) { b.setAttribute('aria-checked', String(b.dataset.v === v)); }); };
      pick('#st-side', mbuShared('cornerSide') === 'left' ? 'left' : 'right');
      pick('#st-flow', mbuShared('cornerFlow') === 'row' ? 'row' : 'column');
      var v = size(), px = Math.round(34 * v / 100) + 'px';
      q('#st-size').textContent = v + ' %';
      q('#st-size-dn').disabled = v <= 60;
      q('#st-size-up').disabled = v >= 160;
      Array.prototype.forEach.call(strip.children, function (d) { d.style.width = d.style.height = px; });
    };
    var segSet = function (key, alt) {
      return function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        mbuShared(key, b.dataset.v === alt ? alt : null);
        restack(); show();
      };
    };
    q('#st-side').onclick = segSet('cornerSide', 'left');
    q('#st-flow').onclick = segSet('cornerFlow', 'row');
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
      d.title = n;
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

  var ch = stChannel();
  q('#st-chan').textContent = stChannelText(ch);
  if (ch.kind === 'unknown' && ch.url) {
    var link = document.createElement('a');
    link.href = ch.url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = ch.url;
    q('#st-chan').appendChild(link);
  }
  q('#st-check').onclick = function () {
    var btn = this, box = q('#st-upd');
    var refs = ['main', 'stable'];
    if (ch.kind === 'branch') refs.push(ch.ref);
    btn.disabled = true;
    btn.textContent = 'Checking…';
    var got = {}, left = refs.length;
    refs.forEach(function (ref) {
      stRemoteVersion(ref, function (v) {
        got[ref] = v;
        if (--left) return;
        btn.disabled = false;
        btn.textContent = 'Check again';
        box.hidden = false;
        box.innerHTML = refs.map(function (r) {
          var v2 = got[r], name = r === 'main' ? 'Latest' : r === 'stable' ? 'Stable' : r;
          var mine = (ch.kind === 'latest' && r === 'main') || ch.kind === r || (ch.kind === 'branch' && r === ch.ref);
          var state = !v2 ? 'couldn’t be read'
            : stCmpVer(v2, ST_VERSION) === 0 ? 'the one you have'
            : stCmpVer(v2, ST_VERSION) > 0 ? '<span class="st-newer">newer</span>' : 'older';
          return '<div><b>' + stEsc(name) + '</b><span>' + (v2 ? 'v' + stEsc(v2) : '') + '</span><span' + (mine ? ' class="st-mine"' : '') + '>' + state
            + (mine ? ' · your channel' : '') + '</span><span class="mbu-sp" style="flex:1"></span>'
            + (v2 && stCmpVer(v2, ST_VERSION) !== 0 ? '<a href="' + stEsc(stInstallUrl(r)) + '" target="_blank" rel="noopener">Install</a>' : '') + '</div>';
        }).join('');
      });
    });
  };
  Array.prototype.forEach.call(panel.querySelectorAll('[data-st-m]'), function (box) {
    box.onchange = function () {
      stFlip(box.getAttribute('data-st-m'));
      q('#st-reload').hidden = false;
      q('#st-apply').textContent = 'Reload the page to apply.';
    };
  });
  q('#st-reload').onclick = function () { location.reload(); };
  q('#st-copy-md').onclick = function () {
    stCopy(stVersionsText(true), function (ok) { try { U.mbuToast(ok ? '✓ Versions copied as Markdown' : '⚠ Couldn’t copy the versions'); } catch (e) { /* no toast */ } });
  };
  q('#st-copy').onclick = function () {
    stCopy(stVersionsText(), function (ok) { try { U.mbuToast(ok ? '✓ Versions copied' : '⚠ Couldn’t copy the versions'); } catch (e) { /* no toast */ } });
  };
  stFitPixels(panel);
  U.mbuControls(panel);
  U.mbuCfgDrag(panel);
  panel.focus();
}
