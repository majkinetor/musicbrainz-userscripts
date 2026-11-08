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
// A branch's newest commit, asked of GitHub's API, so its commit-pinned link installs exactly that build:
// a branch link is served from GitHub's cache, which can hand out the build before for a few minutes.
function stHeadSha(ref, cb) {
  var url = 'https://api.github.com/repos/' + ST_REPO + '/commits/' + ref;
  var done = function (txt) { var m = txt && /^[0-9a-f]{40}$/.exec(String(txt).trim()); cb(m ? m[0] : null); };
  try {
    if (typeof GM_xmlhttpRequest === 'function') {
      GM_xmlhttpRequest({ method: 'GET', url: url, headers: { Accept: 'application/vnd.github.sha' }, timeout: 15000,
        onload: function (r) { done(r.status >= 200 && r.status < 300 ? r.responseText : null); },
        onerror: function () { done(null); }, ontimeout: function () { done(null); } });
    } else {
      fetch(url, { headers: { Accept: 'application/vnd.github.sha' }, cache: 'no-store' })
        .then(function (r) { return r.ok ? r.text() : null; }).then(done, function () { done(null); });
    }
  } catch (e) { done(null); }
}
// Install the branch's newest commit, pinned. The tab opens at once, while the click still counts, and
// is sent on when GitHub answers; if it can't, the branch link is the fallback.
function stInstallPinned(ref) {
  var w = window.open('about:blank', '_blank');
  if (w) try { w.opener = null; } catch (_) {}
  stHeadSha(ref, function (sha) {
    var url = sha ? 'https://github.com/' + ST_REPO + '/raw/' + sha + '/userscripts/string_theory/string_theory.user.js' : stInstallUrl(ref);
    if (w) w.location.href = url; else window.open(url, '_blank', 'noopener');
  });
}
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
  + '#st-cfg #st-p-s .st-sync-between{justify-content:space-between}#st-cfg #st-p-s .st-sync-group{border-top:1px solid var(--mbu-border);margin-top:18px;padding-top:12px}#st-cfg #st-p-s h3{font:600 13px/1.4 var(--mbu-font);text-transform:none;letter-spacing:0;color:var(--mbu-text);margin:0}'
  + '#st-cfg #st-p-s details{margin-top:14px}#st-cfg #st-p-s summary{cursor:pointer;color:var(--mbu-text-dim)}#st-cfg #st-p-s .st-sync-backup-row>span:first-child{flex:1}#st-cfg #st-p-s .st-sync-link{border:0;background:none;color:var(--mbu-accent-text);padding-inline:0}#st-cfg #st-p-s .st-sync-primary{color:var(--mbu-accent-text);font-weight:600}#st-cfg #st-p-s .st-sync-footer{justify-content:flex-end}#st-cfg #st-sync-status{margin:6px 0}#st-cfg #st-sync-last{font-size:11px}'
  + '#st-cfg #st-p-g .st-row>.st-lbl:first-child{flex:0 0 96px;white-space:nowrap}#st-cfg #st-p-g .st-lbl{white-space:nowrap}#st-cfg #st-p-g select{flex:0 1 150px;width:150px;min-width:0;height:26px}#st-cfg .st-time{box-sizing:border-box;width:60px;height:26px;padding:0 6px;text-align:center;font:inherit;color:inherit;background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:15px}'
  + '#st-cfg label.st-row{cursor:pointer}#st-cfg label.st-row input{margin:0}'
  + '#st-cfg-news{white-space:nowrap}'
  + '#st-cfg .st-ver{margin-left:auto;color:var(--mbu-text-weak);font-size:11px;white-space:nowrap}'
  + '#st-cfg .st-note{flex:1 1 auto;color:var(--mbu-text-dim);font-size:12px}'
  + '#st-cfg .st-b{flex:0 0 auto;font:inherit;font-size:12px;padding:3px 10px;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);cursor:pointer}'
  + '#st-cfg .st-b:hover{background:var(--mbu-bg-hover)}#st-cfg .st-b:disabled{opacity:.6;cursor:default}'
  + '#st-cfg a{color:var(--mbu-accent-text)}'
  + '#st-cfg .st-upd{margin:4px 0 12px;padding:6px 10px;border-radius:var(--mbu-radius);background:var(--mbu-bg-sunken);font-size:12px}'
  + '#st-cfg .st-upd>div{display:flex;align-items:center;gap:8px;min-height:24px}#st-cfg .st-upd b{flex:0 0 auto;min-width:64px;font-weight:600;white-space:nowrap}#st-cfg .st-upd span{white-space:nowrap}'
  + '#st-cfg .st-upd .st-newer{color:var(--mbu-ok);font-weight:600}#st-cfg .st-upd>div.st-upd-new{background:color-mix(in srgb,var(--mbu-ok) 14%,transparent);border-radius:var(--mbu-radius);margin:0 -6px;padding:0 6px}#st-cfg .st-upd>div.st-upd-new>span:first-of-type{color:var(--mbu-ok);font-weight:600}'
  + '#st-cfg #st-tc-open{cursor:pointer}'
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
ST_CSS += '#st-cfg h3.st-about-h{font:600 13px/1.4 var(--mbu-font);text-transform:none;letter-spacing:0;color:var(--mbu-text);margin:0 0 12px}#st-cfg #st-p-s .st-row:has(>#st-sync-reload[hidden]):has(>#st-sync-backup-status:empty){display:none}';
ST_CSS +='#st-cfg{width:min(760px,94vw);container-type:inline-size}#st-cfg .st-panes{display:block}#st-cfg .st-panes>.st-sec[hidden]{display:none!important}#st-cfg .st-title{flex-wrap:nowrap!important;white-space:nowrap;gap:12px}#st-cfg .st-title .mbu-cfg-name{flex-shrink:0}#st-cfg .st-title .mbu-cfg-sp,#st-cfg .st-title .mbu-cfg-ver{display:none}#st-cfg .st-title .st-tabs{margin-left:auto;flex-shrink:0}#st-cfg .st-title .st-tabs button{border:0;border-bottom:2px solid transparent;background:none;border-radius:0;margin:0;padding:5px 0;color:var(--mbu-text-dim)}#st-cfg .st-title .st-tabs{gap:18px}#st-cfg .st-title .st-tabs button[aria-selected=true]{border-bottom-color:var(--mbu-accent);color:var(--mbu-accent-text)}#st-cfg .st-title #st-tab-menu{margin-left:auto;width:100px;flex-shrink:0}#st-cfg .st-title .mbu-ov-x{margin-left:0}'
  + '#st-cfg .st-footer{display:flex;flex-wrap:wrap;align-items:center;gap:18px;margin-top:20px;padding-top:12px;border-top:1px solid var(--mbu-border)}#st-cfg .st-footer .st-links{margin-left:0}#st-cfg .st-footer #st-cfg-news{margin-right:0}#st-cfg .st-footer .mbu-help{margin-left:auto}#st-cfg .st-group{margin:0;padding:12px 0 18px}#st-cfg .st-group+.st-group{border-top:1px solid var(--mbu-border);padding-top:18px}#st-cfg .st-group>h3.st-h{border:0;margin:0 0 12px;padding:0;font-size:13px}#st-cfg .st-lbl{font:inherit!important;letter-spacing:0;text-transform:none;color:var(--mbu-text)!important}#st-cfg .st-field-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:8px 28px}#st-cfg .st-field{display:grid;grid-template-columns:100px minmax(0,180px);align-items:center;gap:10px;min-width:0}#st-cfg .st-field select{width:100%;max-width:180px}#st-cfg .st-field .st-seg{justify-self:start}#st-cfg .st-mode-label{display:none}#st-cfg .st-seg{border:0;gap:14px;border-radius:0;margin:0;overflow:visible}#st-cfg .st-seg button{border:0!important;border-bottom:2px solid transparent!important;border-radius:0;padding:4px 0;background:none;color:var(--mbu-text-dim)}#st-cfg .st-seg button[aria-checked=true]{background:none;border-bottom-color:var(--mbu-accent)!important;color:var(--mbu-accent-text)}#st-cfg .st-step{border:0;border-radius:0}#st-cfg .st-key{justify-self:start;border:0;border-bottom:1px solid var(--mbu-border);border-radius:0;background:none}#st-cfg .st-strip{border:0;padding:0;margin:12px 0 6px;gap:10px}#st-cfg .st-th-x{display:block}#st-cfg .st-th-x:has(.st-tx[hidden]):has(.st-cap[hidden]){display:none}'
  + '#st-cfg #st-p-s .st-sync-between{justify-content:flex-start;gap:20px}#st-cfg #st-p-s .st-sync-backup-row>span:first-child{flex:0 0 100px}#st-cfg #st-p-s .st-sync-footer{display:none}#st-cfg #st-p-s .st-sync-group{margin-top:18px;padding-top:16px}#st-cfg .st-upd{background:none;padding:0;margin:0 0 20px}#st-cfg .st-upd>div{display:grid;grid-template-columns:70px minmax(0,max-content) minmax(0,max-content) auto;gap:12px;margin:10px 0}#st-cfg .st-upd b{min-width:0}#st-cfg .st-upd-links{display:flex;gap:12px;white-space:nowrap}#st-cfg .st-upd span{white-space:normal}#st-cfg .st-scripts{grid-template-columns:minmax(0,1fr);gap:4px 28px}#st-cfg .st-scripts .st-row{white-space:normal}#st-cfg .st-ver{font-size:11px}#st-cfg .st-title [hidden]{display:none!important}@container(min-width:620px){#st-cfg .st-field-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@container(min-width:520px){#st-cfg .st-scripts{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){#st-cfg .st-title{gap:8px}#st-cfg .st-title .mbu-cfg-name{font-size:14px}#st-cfg .st-title .st-tabs{gap:12px}#st-cfg .st-title .st-tabs button{font-size:12px;min-height:30px}#st-cfg #st-p-g .st-field select{width:100%;height:30px}#st-cfg .st-field .st-lbl{margin:0}#st-cfg .st-upd>div{grid-template-columns:62px minmax(0,1fr) auto}#st-cfg .st-upd .st-channel-state{display:none}#st-cfg .st-seg button{padding:6px 0;min-height:30px}}';
ST_CSS += '#st-cfg .st-th-x{margin-inline-start:18px}#st-cfg #st-th-time{font:400 12px/18px var(--mbu-font);gap:8px;min-height:28px}#st-cfg #st-th-time .st-time{font:inherit;height:28px}#st-cfg .st-panes{display:grid}#st-cfg .st-panes>.st-sec{grid-area:1/1}#st-cfg .st-panes>.st-sec[hidden]{display:block!important;visibility:hidden}';
ST_CSS += '#st-cfg{font-size:12px;padding:12px 14px}#st-cfg .st-title{gap:8px;margin-bottom:8px}#st-cfg .st-title .mbu-cfg-ver{display:inline}#st-cfg .st-title .mbu-cfg-name{font-size:inherit}#st-cfg .st-title .mbu-help{margin-left:0}#st-cfg .st-title .st-tabs{gap:14px}#st-cfg .st-group{padding:8px 0 12px}#st-cfg .st-group+.st-group{padding-top:12px}#st-cfg .st-group>h3.st-h,#st-cfg h3.st-about-h{margin-bottom:8px}#st-cfg .st-field-grid{gap:4px 22px}#st-cfg .st-field{grid-template-columns:88px minmax(0,160px);gap:8px}#st-cfg .st-row{min-height:24px}#st-cfg .st-group>.st-row{margin:0}#st-cfg .st-strip{margin:8px 0 4px}#st-cfg .st-cap{font-size:11px}#st-cfg .st-footer{margin-top:12px;padding-top:8px;gap:14px}#st-cfg .st-upd{margin:0 0 12px;font-size:11px}#st-cfg .st-upd>div{grid-template-columns:58px minmax(0,max-content) minmax(0,max-content) auto;min-height:20px;margin:3px 0;gap:8px}#st-cfg .st-scripts{gap:0 22px}#st-cfg .st-scripts .st-row{min-height:22px}#st-cfg .st-ver{font-size:10px}#st-cfg #st-p-s .st-row{margin:4px 0;min-height:24px}#st-cfg #st-p-s .st-sync-group{margin-top:12px;padding-top:10px}#st-cfg #st-p-s details{margin-top:10px}#st-cfg #st-sync-status{margin:4px 0}#st-cfg #st-p-s .st-sync-backup-row>span:first-child{flex-basis:88px}#st-cfg #st-th-time{font:400 12px/18px var(--mbu-font)}#st-cfg .st-upd .st-channel-state{overflow-wrap:anywhere}@media(max-width:640px){#st-cfg .st-upd>div{grid-template-columns:58px minmax(0,1fr) auto}#st-cfg .st-row{margin:4px 0}#st-cfg .st-title{gap:6px}}';
ST_CSS += '#st-cfg .st-sync-columns{display:grid;grid-template-columns:minmax(0,1fr);gap:12px 28px}#st-cfg #st-p-s .st-sync-options>h3{margin:4px 0 8px}@container(min-width:620px){#st-cfg .st-sync-columns{grid-template-columns:repeat(2,minmax(0,1fr))}}';
ST_CSS += '#st-cfg .st-title .mbu-ov-x{padding:0;margin:0;align-self:center;width:26px;height:26px}#st-cfg .st-title .mbu-ov-x svg{width:18px;height:18px;display:block}#st-cfg .st-title .mbu-help{align-self:center}';
ST_CSS += '#st-cfg .st-footer .st-links{margin-left:auto}';
ST_CSS += '#st-cfg .st-section-lead{display:flex;align-items:center;gap:16px;margin:0 0 4px}#st-cfg .st-section-lead>h3.st-h,#st-cfg .st-palette-enabled>h3.st-h{flex:0 0 auto;border:0;margin:0;padding:0;font:600 13px/1.4 var(--mbu-font)}#st-cfg .st-section-lead>.st-row{flex:0 1 auto;min-width:0;margin:0;flex-wrap:wrap}#st-cfg .st-inline-side,#st-cfg .st-palette-enabled{display:flex;align-items:center;gap:12px;min-height:28px}#st-cfg .st-inline-side .st-lbl{margin:0}#st-cfg .st-section-lead .st-seg{flex-wrap:wrap}#st-cfg .st-palette-enabled>h3.st-h{font-size:12px}#st-cfg .st-group:has(.st-palette-enabled)>.st-field-grid{margin-top:0}';
ST_CSS += '#st-cfg .st-section-lead{align-items:flex-start}#st-cfg .st-section-lead>h3.st-h{margin-top:5px}#st-cfg .st-section-lead>.st-inline-side+.st-inline-side{margin-inline-start:18px}';
ST_CSS += '#st-cfg{background:var(--mbu-bg)!important}';
// a button pair wraps as one, never one button left behind; on a phone Time's hours get their own line under Theme
ST_CSS += '#st-cfg #st-p-s .st-sync-acts{display:inline-flex;flex-wrap:wrap;align-items:center;gap:inherit}'
  + '@media (max-width:640px){#st-cfg .st-section-lead{flex-wrap:wrap;row-gap:4px}#st-cfg .st-section-lead>.st-row{display:contents}#st-cfg .st-section-lead .st-th-x{flex:1 0 100%;margin:0}#st-cfg #st-p-s .st-sync-between{row-gap:6px}}';
ST_CSS += '#st-cfg #st-p-s{position:relative}#st-cfg .st-backup-columns{display:grid;grid-template-columns:minmax(0,1fr);gap:4px 28px}#st-cfg .st-sync-spinner{display:inline-block;box-sizing:border-box;width:12px;height:12px;margin-left:8px;vertical-align:middle;border:1.5px solid var(--mbu-text-weak);border-right-color:transparent;border-radius:50%;animation:st-sync-spin .8s linear infinite}#st-cfg #st-sync-remote{position:absolute;inset:0;z-index:2;background:var(--mbu-bg);padding:0;display:flex;flex-direction:column;min-height:0}#st-cfg .st-backup-head{display:flex;align-items:center;gap:10px;padding:0 0 8px;border-bottom:1px solid var(--mbu-border)}#st-cfg .st-backup-head h3{margin:0}#st-cfg #st-sync-backups{display:flex;flex:1;flex-direction:column;min-height:0;max-height:none;overflow:hidden;padding-top:6px}#st-cfg .st-backup-choices{flex:1;min-height:0;overflow:auto}#st-cfg .st-backup-choice{display:flex;align-items:center;gap:12px;justify-content:space-between;width:100%;border:0;border-radius:0;background:none;color:var(--mbu-text);font:inherit;text-align:left;padding:7px 8px;cursor:pointer}#st-cfg .st-backup-choice small{color:var(--mbu-text-weak);font-size:11px}#st-cfg .st-backup-choice[aria-pressed=true]{background:var(--mbu-accent-soft);color:var(--mbu-accent-text)}#st-cfg .st-backup-actions{display:flex;gap:8px;flex-wrap:wrap;padding-top:8px;margin-top:4px;border-top:1px solid var(--mbu-border)}@container(min-width:620px){#st-cfg .st-backup-columns{grid-template-columns:repeat(2,minmax(0,1fr))}}@keyframes st-sync-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){#st-cfg .st-sync-spinner{animation:none}}';
ST_CSS += '#st-cfg .st-backup-head{flex-wrap:wrap;gap:8px}#st-cfg .st-backup-head h3{margin-right:auto}#st-cfg .st-backup-head .st-backup-actions{margin:0;padding:0;border:0;gap:6px}#st-cfg .st-backup-choices{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));align-content:start;gap:3px 12px}#st-cfg .st-backup-choice{min-width:0}';
ST_CSS += '#st-cfg #st-sync-backup-actions{margin:0 0 0 auto}';
ST_CSS += '#st-cfg #st-sync-dav input{flex:1 1 140px;min-width:0;height:26px;box-sizing:border-box;padding:0 8px;border:1px solid var(--mbu-border);border-radius:4px;background:var(--mbu-bg);color:var(--mbu-text);font:inherit}#st-cfg #st-sync-dav #st-sync-dav-url{flex-basis:100%}';
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
  // Event Horizon's effect presets, when it's on and has any: each theme can bring one
  var ehFx = __stReadOff().indexOf('event_horizon') < 0 && mbuShared('ehFxPresets') || [];
  ehFx = Array.isArray(ehFx) ? ehFx.slice().sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }); }) : [];
  if (!document.getElementById('st-cfg-css')) {
    var css = document.createElement('style');
    css.id = 'st-cfg-css';
    css.textContent = T.MBU_TOKENS + U.MBU_UI_CSS + ST_CSS;
    (document.head || html).appendChild(css);
  }
  var h = U.mbuCfgHeader({ icon: '<img src="' + ST_ICON + '" alt="">', name: 'String Theory', version: ST_VERSION, script: 'string_theory' });
  if (ST_ON_MB) h = h.replace('<span class="mbu-cfg-sp"></span>', '<span class="mbu-cfg-sp"></span><a href="#" id="st-cfg-news">What\'s new</a>');
  var links = '<span class="st-links">'
    + '<a href="https://milic.info/musicbrainz-userscripts" target="_blank" rel="noopener">Website</a>'
    + '<a href="https://github.com/' + ST_REPO + '/issues" target="_blank" rel="noopener">Issues</a>'
    + '<a href="https://community.metabrainz.org/t/string-theory-and-other-majkinetor-scripts/815740/10000000" target="_blank" rel="noopener">Forum</a></span>';
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
      + (ehFx.length ? '<div class="st-row">' + ['light', 'dark'].map(function (v) {
        return '<label class="st-lbl" for="st-th-eh-' + v + '" data-tip="Event Horizon’s effect preset for the ' + v + ' theme&#10;Applied each time that theme comes on; changes in Event Horizon after it stay">' + (v === 'dark' ? 'Dark effect' : 'Light effect') + '</label><select id="st-th-eh-' + v + '"></select>';
      }).join('') + '</div>' : '')
      + '<h3 class="st-h">Idle</h3>'
      + '<div class="st-row">' + seg('st-idle-on', 'Idle', [['on', 'On'], ['off', 'Off']])
      + '<label class="st-lbl" for="st-idle-minutes">After (minutes)</label><input id="st-idle-minutes" type="number" min="1" max="1440" step="1"></div>'
      + '<div class="st-row"><label class="st-lbl" for="st-idle-theme">Idle theme</label><select id="st-idle-theme"><option value="">Current theme</option><option value="*">Random</option>'
      + __stTheme.names().map(function (n) { return '<option>' + stEsc(n) + '</option>'; }).join('') + '</select>'
      + (ehFx.length ? '<label class="st-lbl" for="st-idle-effect">Idle effect</label><select id="st-idle-effect"><option value="">Current effect</option><option value="*">Random</option><option value="-">No effect</option>' + ehFx.map(function (n) { return '<option>' + stEsc(n) + '</option>'; }).join('') + '</select>' : '') + '</div>'
      + '<h3 class="st-h" id="st-dock">Dock</h3>'
      + '<div class="st-row">' + seg('st-side', 'Side', [['left', 'Left'], ['right', 'Right']]) + seg('st-flow', 'Orientation', [['column', 'Column'], ['row', 'Row']])
      + '<span class="st-lbl">Size</span><span class="st-step"><button type="button" id="st-size-dn" aria-label="Smaller">−</button>'
      + '<output id="st-size"></output><button type="button" id="st-size-up" aria-label="Bigger">+</button></span></div>'
      + '<div class="st-row">' + seg('st-hover', 'Hover', [['none', 'None'], ['shelf', 'Shelf']]) + '</div>'
      + '<div class="st-row">' + seg('st-count', 'Counter', [['pill', 'Pill'], ['seg', 'Segmented'], ['bare', 'Bare']]) + seg('st-count-pos', 'Position', [['on', 'On icon'], ['side', 'Beside']]) + '</div>'
      + '<div class="st-strip" id="st-order"></div>'
      + '<div class="st-cap">Drag to reorder, the first nearest the corner; right-click for its settings.</div>'
      + '<h3 class="st-h">Command palette</h3>'
      + '<div class="st-row">' + seg('st-pal-on', 'Palette', [['on', 'On'], ['off', 'Off']])
      + '<span class="st-lbl" id="st-pal-key-l">Hotkey</span><button type="button" class="st-b st-key" id="st-pal-key" aria-labelledby="st-pal-key-l" data-tip="Change the command palette hotkey&#10;Click, then press the new shortcut"></button></div>'
      + '</section>';
    h += '<section class="st-sec" id="st-p-s" role="tabpanel" aria-labelledby="st-tab-s" hidden>' + stSyncMarkup() + '</section>';
  }
  var off = __stReadOff(), known = mbuShared('dockKnown') || {};
  h += '<section class="st-sec" id="st-p-a"' + (ST_ON_MB ? ' role="tabpanel" aria-labelledby="st-tab-a" hidden' : '') + '>'
    + (ST_ON_MB ? '' : '<div class="st-row">' + links + '</div>')
    + '<h3 class="st-about-h">Updates</h3><div class="st-upd" id="st-upd"></div>'
    + '<h3 class="st-about-h">Scripts</h3><div class="st-scripts" data-tip="Right-click a script for its settings">' + stMembers.map(function (m) {
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
  // a phone: MusicBrainz's page is wider than the screen, so the browser's layout viewport (which a fixed
  // inset:0 window fills) is too, and the screen shows a panned part of it. Fit the window to what shows.
  var vv = window.visualViewport, narrow = window.matchMedia('(max-width:640px)');
  var pin = function () {
    var on = vv && narrow.matches, s = panel.style;
    [['left', vv && vv.offsetLeft], ['top', vv && vv.offsetTop], ['width', vv && vv.width], ['height', vv && vv.height]].forEach(function (p) {
      if (on) s.setProperty(p[0], p[1] + 'px', 'important'); else s.removeProperty(p[0]);
    });
    if (on) { s.setProperty('right', 'auto', 'important'); s.setProperty('bottom', 'auto', 'important'); } else { s.removeProperty('right'); s.removeProperty('bottom'); }
  };
  pin();
  if (vv) { vv.addEventListener('resize', pin); vv.addEventListener('scroll', pin); }
  var close = function () { if (vv) { vv.removeEventListener('resize', pin); vv.removeEventListener('scroll', pin); } if (tabObserver) tabObserver.disconnect(); ov.remove(); document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onOut, true); };
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
    var backups = q('#st-sync-remote');
    if (backups && !backups.hidden && !q('#st-p-s').hidden) { e.preventDefault(); e.stopPropagation(); q('#st-sync-backup-close').click(); return; }
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
  var tabObserver = null;
  if (ST_ON_MB) {
    var title = q('.mbu-cfg-h'), tabs = q('.st-tabs'), footer = document.createElement('div');
    title.classList.add('st-title'); footer.className = 'st-footer';
    var news = q('#st-cfg-news'), help = title.querySelector('.mbu-help'), linksNode = q('.st-links');
    if (news) footer.appendChild(news); if (linksNode) footer.appendChild(linksNode);
    panel.appendChild(footer); title.insertBefore(tabs, help); q('.st-nav').remove();
    var menu = document.createElement('select'); menu.id = 'st-tab-menu'; menu.setAttribute('aria-label', 'Settings tab'); menu.hidden = true;
    menu.innerHTML = '<option value="g">General</option><option value="s">Sync</option><option value="a">About</option>';
    title.insertBefore(menu, help); menu.onchange = function () { q('#st-tab-' + menu.value).click(); };
    // a quiet way to the theme chooser beside the help, drawn like it; the window steps aside so the page shows each theme
    var themes = document.createElement('button'); themes.type = 'button'; themes.className = 'mbu-help'; themes.id = 'st-tc-open';
    themes.setAttribute('aria-label', 'Theme chooser'); themes.dataset.tip = 'Theme chooser\nStep through every theme on this page';
    themes.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/></svg>';
    themes.onclick = function () { close(); setTimeout(stThemeChooser, 0); };
    title.insertBefore(themes, help);
    var x = title.querySelector('.mbu-cfg-x'); x.setAttribute('aria-label', 'Close settings');
    x.onclick = close;
    var fitTabs = function () {
      var version = title.querySelector('.mbu-cfg-ver'), name = title.querySelector('.mbu-cfg-name');
      tabs.hidden = false; menu.hidden = true; if (version) version.hidden = false; name.hidden = false;
      var measure = function () {
        var width = 0, children = Array.prototype.filter.call(title.children, function (n) { return getComputedStyle(n).display !== 'none'; });
        children.forEach(function (n) { width += n.getBoundingClientRect().width; });
        return width + Math.max(0, children.length - 1) * parseFloat(getComputedStyle(title).columnGap || 0) + 12;
      };
      if (version && measure() > title.clientWidth) version.hidden = true;
      if (measure() > title.clientWidth) name.hidden = true;
      tabs.hidden = measure() > title.clientWidth; menu.hidden = !tabs.hidden;
    };
    tabObserver = new ResizeObserver(fitTabs); tabObserver.observe(panel);
    var general = q('#st-p-g');
    var pairRow = function (row) {
      var nodes = Array.prototype.slice.call(row.children); row.classList.add('st-field-grid'); row.classList.remove('st-row');
      for (var i = 0; i + 1 < nodes.length; i += 2) { var f = document.createElement('div'); f.className = 'st-field'; f.appendChild(nodes[i]); f.appendChild(nodes[i + 1]); row.appendChild(f); }
    };
    q('#st-th-mode-l').classList.add('st-mode-label');
    pairRow(q('#st-th-light').parentElement); pairRow(q('#st-side').parentElement); pairRow(q('#st-hover').parentElement); pairRow(q('#st-count').parentElement); pairRow(q('#st-pal-on').parentElement);
    pairRow(q('#st-idle-on').parentElement); pairRow(q('#st-idle-theme').parentElement);
    if (ehFx.length) { var ehRow = q('#st-th-eh-light').parentElement, thGrid = q('#st-th-light').closest('.st-field-grid'); pairRow(ehRow); while (ehRow.firstChild) thGrid.appendChild(ehRow.firstChild); ehRow.remove(); }
    var dockGrid = q('#st-side').closest('.st-field-grid'), hoverGrid = q('#st-hover').closest('.st-field-grid');
    while (hoverGrid.firstChild) dockGrid.appendChild(hoverGrid.firstChild); hoverGrid.remove();
    var countGrid = q('#st-count').closest('.st-field-grid');
    while (countGrid.firstChild) dockGrid.appendChild(countGrid.firstChild); countGrid.remove();
    var sections = [], active = null; Array.prototype.slice.call(general.children).forEach(function (n) {
      if (n.tagName === 'H3') { active = document.createElement('section'); active.className = 'st-group'; sections.push(active); }
      if (active) active.appendChild(n);
    }); sections.forEach(function (n) { general.appendChild(n); });
    // Let the first control share its section's heading row, keeping Hotkey in the second field.
    var inlineLead = function (section, control) {
      var heading = section.querySelector('h3'), lead = document.createElement('div');
      lead.className = 'st-section-lead'; section.insertBefore(lead, heading); lead.appendChild(heading); lead.appendChild(control);
    };
    inlineLead(q('#st-th-mode').closest('.st-group'), q('#st-th-mode').parentElement);
    var sideField = q('#st-side').closest('.st-field'); sideField.classList.add('st-inline-side');
    inlineLead(sideField.closest('.st-group'), sideField);
    var flowField = q('#st-flow').closest('.st-field'); flowField.classList.add('st-inline-side'); sideField.parentElement.appendChild(flowField);
    var paletteField = q('#st-pal-on').closest('.st-field'), paletteHeading = paletteField.closest('.st-group').querySelector('h3');
    paletteHeading.textContent = 'Palette'; paletteField.classList.add('st-palette-enabled');
    q('#st-pal-on-l').classList.add('st-mode-label'); paletteField.insertBefore(paletteHeading, paletteField.firstChild);
    fitTabs();
  }
  if (ST_ON_MB) q('.st-tabs').onclick = function (e) {
    var t = e.target.closest('[role=tab]');
    if (!t) return;
    var enteringAbout = t.id === 'st-tab-a' && t.getAttribute('aria-selected') !== 'true';
    Array.prototype.forEach.call(q('.st-tabs').children, function (b) {
      b.setAttribute('aria-selected', String(b === t));
      q('#' + b.getAttribute('aria-controls')).hidden = b !== t;
    });
    q('#st-tab-menu').value = t.id.slice(-1);
    try { localStorage.setItem('st-cfg-tab', t.id.slice(-1)); } catch (_) {}
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
      pick('#st-count', mbuShared('dockCount') === 'seg' || mbuShared('dockCount') === 'bare' ? mbuShared('dockCount') : 'pill');
      pick('#st-count-pos', mbuShared('dockCountPos') === 'side' ? 'side' : 'on');
      var v = size();
      q('#st-size').textContent = v + ' %';
      q('#st-size-dn').disabled = v <= 60;
      q('#st-size-up').disabled = v >= 160;
    };
    var segSet = function (key, alt) {
      return function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        // alt: the one value stored, or a list of them; any other is the default, stored as null
        mbuShared(key, [].concat(alt).indexOf(b.dataset.v) >= 0 ? b.dataset.v : null);
        restack(); show();
      };
    };
    var showTheme = function () {
      var th = __stTheme.read();
      Array.prototype.forEach.call(q('#st-th-mode').children, function (b) { b.setAttribute('aria-checked', String(b.dataset.v === th.mode)); });
      q('#st-th-dark').value = th.dark; q('#st-th-light').value = th.light;
      // each theme's effect preset; one deleted in Event Horizon is already gone from the map
      if (ehFx.length) ['light', 'dark'].forEach(function (v) {
        var cur = th.eh[v + ':' + th[v]] || '', sel = q('#st-th-eh-' + v);
        sel.innerHTML = '<option value="">No preset</option><option value="-">No effect</option>' + ehFx.concat(cur && cur !== '-' && ehFx.indexOf(cur) < 0 ? [cur] : []).map(function (n) { return '<option>' + stEsc(n) + '</option>'; }).join('');
        sel.value = cur;
      });
      q('#st-th-from').value = th.from; q('#st-th-to').value = th.to;
      q('#st-th-time').hidden = th.mode !== 'time';
      q('#st-th-sun').hidden = th.mode !== 'sun';
    };
    q('#st-th-mode').onclick = function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      __stTheme.setMode(b.dataset.v, showTheme);
      showTheme();
    };
    ['dark', 'light'].forEach(function (v) {
      // the new theme brings the effect on show, as stepping in the theme chooser does, so a theme pick never changes it
      q('#st-th-' + v).onchange = function (e) {
        var th = __stTheme.read(), p = {}, on = th.eh[v + ':' + th[v]], map = {};
        p[v] = e.target.value;
        if (ehFx.length) {
          Object.keys(th.eh).forEach(function (k) { map[k] = th.eh[k]; });
          if (on) map[v + ':' + p[v]] = on; else delete map[v + ':' + p[v]];
          p.eh = map;
        }
        __stTheme.set(p); showTheme();
      };
      if (ehFx.length) q('#st-th-eh-' + v).onchange = function (e) {
        var th = __stTheme.read(), map = {};
        Object.keys(th.eh).forEach(function (k) { map[k] = th.eh[k]; });
        if (e.target.value) map[v + ':' + th[v]] = e.target.value; else delete map[v + ':' + th[v]];
        __stTheme.set({ eh: map });
      };
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
    var showIdle = function () {
      var i = __stTheme.read().idle;
      Array.prototype.forEach.call(q('#st-idle-on').children, function (b) { b.setAttribute('aria-checked', String((b.dataset.v === 'on') === i.on)); });
      q('#st-idle-minutes').value = i.minutes; q('#st-idle-theme').value = i.theme;
      if (q('#st-idle-effect')) q('#st-idle-effect').value = i.effect;
    };
    function setIdle(k, v) { var i = __stTheme.read().idle; i[k] = v; __stTheme.set({ idle: i }); showIdle(); }
    q('#st-idle-on').onclick = function (e) { var b = e.target.closest('button'); if (b) setIdle('on', b.dataset.v === 'on'); };
    q('#st-idle-minutes').onchange = function (e) { setIdle('minutes', Math.max(1, Math.min(1440, Math.round(Number(e.target.value) || 5)))); };
    q('#st-idle-theme').onchange = function (e) { setIdle('theme', e.target.value); };
    if (q('#st-idle-effect')) q('#st-idle-effect').onchange = function (e) { setIdle('effect', e.target.value); };
    showIdle();
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
    q('#st-count').onclick = segSet('dockCount', ['seg', 'bare']);
    q('#st-count-pos').onclick = segSet('dockCountPos', 'side');
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
    // The installed build is shown below the available channels.
    // a row per channel from the start, so the box keeps its size when the answers come
    var got = {}, left = refs.length, draw = function (checking) {
        box.innerHTML = refs.map(function (r) {
          var v2 = got[r], name = r === 'main' ? 'Latest' : r === 'stable' ? 'Stable' : r;
          var state = checking ? 'checking…' : !v2 ? 'couldn’t be read'
            : stCmpVer(v2, ST_VERSION) === 0 ? 'the one you have'
            : stCmpVer(v2, ST_VERSION) > 0 ? '<span class="st-newer">newer</span>' : 'older';
          return '<div data-channel="' + stEsc(r) + '"' + (v2 && stCmpVer(v2, ST_VERSION) > 0 ? ' class="st-upd-new"' : '') + '><b>' + stEsc(name) + '</b><span>' + (v2 ? 'v' + stEsc(v2) : '') + '</span><span class="st-channel-state">' + state
            + '</span>'
            + (v2 && stCmpVer(v2, ST_VERSION) !== 0 ? '<span class="st-upd-links"><a href="' + stEsc(stInstallUrl(r)) + '" target="_blank" rel="noopener">Install</a>'
              + (r === 'main' ? '<a href="#" data-st-pinned="' + stEsc(r) + '" data-tip="Install the newest commit by its own link&#10;Skips GitHub\u2019s cache, which can serve the build before for a few minutes">Pinned</a>' : '') + '</span>' : '') + '</div>';
        }).join('') + '<div><b>Installed</b><span>v' + stEsc(ST_VERSION) + '</span><span class="st-channel-state">' + stEsc(stChannel()) + '</span><span></span></div>';
    };
    draw(true);
    box.onclick = function (e) {
      var a = e.target.closest('[data-st-pinned]');
      if (!a) return;
      e.preventDefault();
      stInstallPinned(a.getAttribute('data-st-pinned'));
    };
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
  else {
    if (!tab) try { tab = localStorage.getItem('st-cfg-tab'); } catch (_) {}
    if (tab && tab !== 'g' && q('#st-tab-' + tab)) q('#st-tab-' + tab).click();
  }
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
