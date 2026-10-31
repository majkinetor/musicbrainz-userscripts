// String Theory's settings window (#851). build.mjs writes this file into the bundle, inside the scope of
// its toggles, where these are defined: stMembers ([folder, name, version] per member), ST_VERSION,
// ST_ICON, ST_HOME, ST_ON_MB, stFlip(folder), __stReadOff(), mbuShared(), mbRestackCorner(), and stUI()
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
  try { var s = GM_info.script || {}; u = s.downloadURL || s.updateURL || GM_info.scriptUpdateURL || ''; } catch (e) { /* no GM_info */ }
  var m = /musicbrainz-userscripts[/](?:raw[/])?(?:refs[/]heads[/])?(.+?)[/]userscripts[/]string_theory[/]/.exec(u);
  if (!m) return { kind: 'unknown', url: u };
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
  return 'Unknown: not installed from GitHub';
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
function stCopy(text, ok) {
  try { if (typeof GM_setClipboard === 'function') { GM_setClipboard(text, 'text'); ok(true); return; } } catch (e) { /* fall back */ }
  try { navigator.clipboard.writeText(text).then(function () { ok(true); }, function () { ok(false); }); } catch (e) { ok(false); }
}
function stVersionsText() {
  var off = __stReadOff(), ch = stChannel(), lines = ['String Theory v' + ST_VERSION + ' (' + (ch.kind === 'branch' || ch.kind === 'pinned' ? ch.kind + ' ' + ch.ref : ch.kind) + ')'];
  stMembers.forEach(function (m) { lines.push('  ' + m[1] + ' v' + m[2] + (off.indexOf(m[0]) < 0 ? '' : ' (off)')); });
  try { if (GM_info.scriptHandler) lines.push('Manager: ' + GM_info.scriptHandler + (GM_info.version ? ' ' + GM_info.version : '')); } catch (e) { /* no GM_info */ }
  return lines.join('\n');
}
var ST_CSS = ''
  + '#st-cfg{width:min(460px,94vw);padding:14px 16px;box-sizing:border-box;overflow:auto;font:13px/1.4 var(--mbu-font);outline:none}'
  + '#st-cfg .mbu-cfg-h .mbu-ov-x{margin:-4px -6px -4px 0}'
  + '#st-cfg .st-sec{margin:0 0 14px}#st-cfg .st-sec:last-child{margin:0}'
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
  + '#st-cfg .st-upd>div{display:flex;align-items:center;gap:8px;min-height:24px}#st-cfg .st-upd b{flex:0 0 64px;font-weight:600}'
  + '#st-cfg .st-upd .st-mine{color:var(--mbu-text-weak)}#st-cfg .st-upd .st-newer{color:var(--mbu-ok);font-weight:600}'
  + '#st-cfg [hidden]{display:none!important}';
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
    var eh = html.hasAttribute('data-mbu-dock');
    h += '<section class="st-sec"><h3>Launchers</h3>'
      + '<div class="st-row"><label for="st-side">Side</label><select id="st-side"><option value="right">Right</option><option value="left">Left</option></select></div>'
      + '<div class="st-row"><label for="st-flow">Layout</label><select id="st-flow"><option value="column">Column</option><option value="row">Row</option></select></div>'
      + '<div class="st-row"><label for="st-size">Size</label><input type="number" id="st-size" min="60" max="160" step="10"><span>%</span></div>'
      + '<label class="st-row"><input type="checkbox" id="st-dock"' + (eh ? ' checked disabled' : '') + '> Fold them into String Theory’s icon'
      + (eh ? '<span class="st-ver">always, in Event Horizon</span>' : '') + '</label>'
      + '<div class="st-row"><span class="st-note">Drag a launcher to move them.</span><button type="button" class="st-b" id="st-reset">Reset position and size</button></div>'
      + '</section>';
  }
  var off = __stReadOff();
  h += '<section class="st-sec"><h3>About</h3>'
    + '<div class="st-row"><span class="st-note" id="st-chan"></span><button type="button" class="st-b" id="st-check">Check for updates</button></div>'
    + '<div class="st-upd" id="st-upd" hidden></div>'
    + '<div class="st-row"><a href="' + stEsc(ST_HOME) + '" target="_blank" rel="noopener">String Theory on GitHub</a></div>'
    + '</section>'
    + '<section class="st-sec"><h3>Scripts</h3>'
    + stMembers.map(function (m) {
      return '<label class="st-row"><input type="checkbox" data-st-m="' + stEsc(m[0]) + '"' + (off.indexOf(m[0]) < 0 ? ' checked' : '') + '> '
        + stEsc(m[1]) + '<span class="st-ver">v' + stEsc(m[2]) + '</span></label>';
    }).join('')
    + '<div class="st-row"><span class="st-note" id="st-apply">A change applies from the next page load.</span>'
    + '<button type="button" class="st-b" id="st-reload" hidden>Reload</button><button type="button" class="st-b" id="st-copy">Copy versions</button></div>'
    + '</section>';

  var ov = document.createElement('div');
  ov.className = 'mbu-ov';
  ov.id = 'st-cfg-ov';
  ov.innerHTML = '<div class="mbu-ov-panel mbu-ui" id="st-cfg" tabindex="-1" role="dialog" aria-label="String Theory settings">' + h + '</div>';
  (document.body || html).appendChild(ov);
  stCfgOv = ov;
  var panel = ov.querySelector('#st-cfg'), q = function (s) { return panel.querySelector(s); };
  var close = function () { ov.remove(); document.removeEventListener('keydown', onKey, true); };
  var onKey = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
  q('#st-x').onclick = close;

  if (ST_ON_MB) {
    var restack = function () { ['br', 'bl', 'tr', 'tl'].forEach(function (c) { try { mbRestackCorner(c); } catch (e) { /* a corner's script broke */ } }); };
    var sizeIn = q('#st-size');
    var showSize = function () { sizeIn.value = String(Math.round((Number(mbuShared('cornerSize')) || 1) * 100)); };
    q('#st-side').value = mbuShared('cornerSide') === 'left' ? 'left' : 'right';
    q('#st-flow').value = mbuShared('cornerFlow') === 'row' ? 'row' : 'column';
    showSize();
    if (!html.hasAttribute('data-mbu-dock')) q('#st-dock').checked = mbuShared('stDock') !== false;
    q('#st-side').onchange = function () { mbuShared('cornerSide', this.value === 'left' ? 'left' : null); restack(); };
    q('#st-flow').onchange = function () { mbuShared('cornerFlow', this.value === 'row' ? 'row' : null); restack(); };
    var setSize = function () {
      var v = Math.round(Number(sizeIn.value));
      if (!isFinite(v) || v < 60 || v > 160) return;
      mbuShared('cornerSize', v === 100 ? null : v / 100);
      restack();
    };
    sizeIn.addEventListener('input', setSize);
    sizeIn.addEventListener('change', function () { setSize(); showSize(); });
    q('#st-dock').onchange = function () { mbuShared('stDock', this.checked ? null : false); restack(); };
    q('#st-reset').onclick = function () { mbuShared('cornerOffset', null); mbuShared('cornerSize', null); showSize(); restack(); };
  }

  var ch = stChannel();
  q('#st-chan').textContent = stChannelText(ch);
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
  q('#st-copy').onclick = function () {
    stCopy(stVersionsText(), function (ok) { try { U.mbuToast(ok ? '✓ Versions copied' : '⚠ Couldn’t copy the versions'); } catch (e) { /* no toast */ } });
  };
  U.mbuControls(panel);
  U.mbuCfgDrag(panel);
  panel.focus();
}
