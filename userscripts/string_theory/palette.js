// String Theory's command palette (#890): a hotkey (Ctrl+K by default) opens a list of commands, filtered as
// you type, as in VS Code. build.mjs writes this file into the bundle after settings.js, in the same scope.
// Its setting is the GM value 'string_theory.palette': { on, key: { ctrl, alt, shift, meta, key }, pins, recent }.
// Plain ES5, as the rest of the bundle's own code.
var ST_PAL_KEY = 'string_theory.palette';
var ST_PAL_HOTKEY = { ctrl: true, alt: false, shift: false, meta: false, key: 'k' };
var stPal = null, stPalOv = null, stPalRecording = false;
function stPalRead() {
  if (stPal) return stPal;
  var v; try { v = GM_getValue(ST_PAL_KEY, null); } catch (e) { v = null; }
  v = v && typeof v === 'object' ? v : {};
  var list = function (a) { return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string'; }) : []; };
  stPal = { on: v.on !== false, key: v.key && v.key.key ? v.key : ST_PAL_HOTKEY, pins: list(v.pins), recent: list(v.recent) };
  return stPal;
}
function stPalSet(patch) {
  var p = stPalRead();
  Object.keys(patch).forEach(function (k) { p[k] = patch[k]; });
  try { GM_setValue(ST_PAL_KEY, p); } catch (e) { /* not kept */ }
}
// e.code, not e.key, for letters and digits: Alt and Shift change what e.key says
function stKeyOf(e) {
  var c = /^(Key|Digit)(.)$/.exec(e.code || ''), k = c ? c[2].toLowerCase() : String(e.key || '').toLowerCase();
  return { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, key: k === ' ' ? 'space' : k };
}
function stKeyLabel(h) {
  var k = h.key.length === 1 ? h.key.toUpperCase() : h.key.charAt(0).toUpperCase() + h.key.slice(1);
  return [h.ctrl && 'Ctrl', h.alt && 'Alt', h.shift && 'Shift', h.meta && 'Meta', k].filter(Boolean).join('+');
}
function stKeyIs(e, h) {
  var k = stKeyOf(e);
  return k.key === h.key && k.ctrl === !!h.ctrl && k.alt === !!h.alt && k.shift === !!h.shift && k.meta === !!h.meta;
}

var ST_PAL_CSS = ''
  + '#st-pal-ov{align-items:flex-start;padding-top:12vh;background:none}'
  + '#st-pal{width:min(640px,94vw);max-height:min(70vh,560px);font:13px/1.4 var(--mbu-font);outline:none}'
  + '#st-pal-q{box-sizing:border-box;width:100%;margin:0;padding:12px 14px;border:0;border-bottom:1px solid var(--mbu-border);border-radius:0;background:var(--mbu-bg);color:var(--mbu-text);font:15px/1.3 var(--mbu-font);outline:none;box-shadow:none}'
  + '#st-pal-list{flex:1 1 auto;overflow:auto;margin:0;padding:4px 0;list-style:none}'
  + '#st-pal-list .st-pal-g{padding:8px 14px 2px;color:var(--mbu-text-weak);font:600 11px/1.4 var(--mbu-font);text-transform:uppercase;letter-spacing:.06em}'
  + '#st-pal-list .st-pal-i{display:flex;align-items:center;gap:8px;margin:0;padding:5px 8px 5px 14px;cursor:pointer;color:var(--mbu-text);white-space:nowrap}'
  + '#st-pal-list .st-pal-i[aria-selected=true]{background:var(--mbu-accent-soft)}'
  + '#st-pal-list .st-pal-c{flex:0 0 auto;color:var(--mbu-text-dim)}'
  + '#st-pal-list .st-pal-l{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}'
  + '#st-pal-list mark{background:none;color:var(--mbu-accent-text);font-weight:700;padding:0}'
  + '#st-pal-list .st-pal-h{flex:0 0 auto;color:var(--mbu-text-weak);font-size:12px}'
  + '#st-pal-list .st-pal-pin{flex:0 0 auto;width:24px;height:22px;display:inline-flex;align-items:center;justify-content:center;margin:0;padding:0;border:0;border-radius:var(--mbu-radius);background:none;color:var(--mbu-text-weak);cursor:pointer;visibility:hidden;font-size:13px;line-height:1}'
  + '#st-pal-list .st-pal-pin:hover{background:var(--mbu-bg-hover);color:var(--mbu-text)}'
  + '#st-pal-list .st-pal-i:hover .st-pal-pin,#st-pal-list .st-pal-i[aria-selected=true] .st-pal-pin,#st-pal-list .st-pal-pin[aria-pressed=true]{visibility:visible}'
  + '#st-pal-list .st-pal-pin[aria-pressed=true]{color:var(--mbu-accent-text)}'
  + '#st-pal-list .st-pal-none{padding:10px 14px;color:var(--mbu-text-dim)}'
  + '#st-pal-foot{display:flex;gap:14px;flex-wrap:wrap;padding:6px 14px;border-top:1px solid var(--mbu-border);color:var(--mbu-text-weak);font-size:11px}'
  + '#st-pal-foot kbd{font:inherit;font-weight:600;color:var(--mbu-text-dim)}';

// ── the commands ────────────────────────────────────────────────────────────
// Each is { id, cat, label, hint?, run(), preview?() }. The id is what a pin and the recent list keep.
// preview runs when the command is highlighted (with the arrows, or first after typing) and is undone
// when another is, or when the palette closes without Enter.
var ST_ENTITIES = 'artist|release|release-group|recording|work|label|area|place|series|event|instrument|genre|url';
var ST_ENTITY_NAMES = { artist: 'Artist', release: 'Release', 'release-group': 'Release group', recording: 'Recording', work: 'Work', label: 'Label', area: 'Area', place: 'Place', series: 'Series', event: 'Event', instrument: 'Instrument', genre: 'Genre', url: 'URL' };
function stGo(path) { return function () { location.href = path; }; }
// the page shown: Event Horizon can show another than the tab loaded (#847)
function stPagePath() { return document.documentElement.getAttribute('data-mbu-page') || location.pathname; }
function stPalCommands() {
  var out = [], add = function (c) { out.push(c); }, U = stUI();
  var toast = function (m) { try { U.mbuToast(m); } catch (e) { /* no toast */ } };

  // Settings
  add({ id: 'set:st', cat: 'Settings', label: 'String Theory', run: function () { stSettings('g'); } });
  if (ST_ON_MB) {
    add({ id: 'set:dock', cat: 'Settings', label: 'Dock', run: function () { stSettings('l'); } });
    add({ id: 'set:about', cat: 'Settings', label: 'About and updates', run: function () { stSettings('a'); } });
  }
  stMembers.forEach(function (m) {
    add({ id: 'set:' + m[0], cat: 'Settings', label: m[1], run: function () { stOpenFor(m[1]); } });
  });

  // Theme: highlighting one shows it, Enter keeps it
  if (ST_ON_MB) {
    [['light', 'Light'], ['dark', 'Dark'], ['auto', 'System'], ['sun', 'Sun'], ['time', 'Time']].forEach(function (o) {
      add({ id: 'theme:' + o[0], cat: 'Theme', label: o[1], hint: __stTheme.read().mode === o[0] ? 'current' : '',
        preview: function () { if (o[0] !== 'sun' || __stTheme.read().lat != null) __stTheme.preview({ mode: o[0] }); },
        run: function () { __stTheme.setMode(o[0]); } });
    });
    ['dark', 'light'].forEach(function (v) {
      var th = __stTheme.read();
      __stTheme.names(v).forEach(function (n) {
        add({ id: 'theme:' + v + ':' + n, cat: v === 'dark' ? 'Dark theme' : 'Light theme', label: n, hint: th[v] === n ? 'current' : '',
          // shown in its own variant, whatever the mode; kept for when that variant is on
          preview: function () { var p = { mode: v }; p[v] = n; __stTheme.preview(p); },
          run: function () {
            var p = {}; p[v] = n; __stTheme.set(p);
            if (__stTheme.variant() !== v) toast('✓ ' + n + ' is your ' + v + ' theme; this page stays ' + __stTheme.variant());
          } });
      });
    });
  }

  // Open: each launcher on this page, as a click on it would
  Array.prototype.forEach.call(document.querySelectorAll('[data-mb-corner][data-mb-corner-label]'), function (el) {
    var n = el.dataset.mbCornerLabel;
    if (el.id === 'mbu-dock' || el.dataset.mbuDocked === 'off' || out.some(function (c) { return c.id === 'open:' + n; })) return;
    add({ id: 'open:' + n, cat: 'Open', label: n, run: function () { el.click(); } });
  });

  if (ST_ON_MB) {
    // Go to: what the page shows, then MusicBrainz's own pages
    var m = new RegExp('^/(' + ST_ENTITIES + ')/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})').exec(stPagePath());
    if (m) {
      var type = m[1], base = '/' + type + '/' + m[2], T = ST_ENTITY_NAMES[type];
      var subs = [['', 'Overview'], ['/edit', 'Edit']];
      if (type === 'release') subs.push(['/edit-relationships', 'Edit relationships'], ['/cover-art', 'Cover art'], ['/discids', 'Disc IDs']);
      if (type === 'artist') subs.push(['/releases', 'Releases'], ['/recordings', 'Recordings'], ['/works', 'Works'], ['/events', 'Events'], ['/relationships', 'Relationships']);
      if (type === 'label' || type === 'place' || type === 'area') subs.push(['/relationships', 'Relationships']);
      if (type !== 'url') subs.push(['/aliases', 'Aliases'], ['/tags', 'Tags']);
      subs.push(['/details', 'Details'], ['/edits', 'Edit history'], ['/open_edits', 'Open edits']);
      subs.forEach(function (s) { add({ id: 'go:this' + s[0], cat: 'This ' + T.toLowerCase(), label: s[1], run: stGo(base + s[0]) }); });
      // the entities its header and sidebar link to (a release's artists, release group, labels)
      var seen = {}, linkRe = new RegExp('^/(' + ST_ENTITIES + ')/[0-9a-f-]{36}$');
      Array.prototype.forEach.call(document.querySelectorAll('#content > div[class$="header"] a[href], #sidebar a[href^="/label/"], #sidebar a[href^="/release-group/"]'), function (a) {
        var href = a.getAttribute('href'), lm = linkRe.exec(href || ''), text = (a.textContent || '').trim();
        if (!lm || href === base || seen[href] || !text || out.length > 400) return;
        seen[href] = 1;
        add({ id: 'go:' + href, cat: 'Go to', label: ST_ENTITY_NAMES[lm[1]] + ' · ' + text, recentless: true, run: stGo(href) });
      });
    }
    [['/', 'Home'], ['/search/edits', 'Search edits'], ['/edit/open', 'Open edits'], ['/edit/subscribed', 'Subscribed edits']]
      .forEach(function (g) { add({ id: 'go:' + g[0], cat: 'Go to', label: g[1], run: stGo(g[0]) }); });
    // Event Horizon's homepage: its starred entities and the pages visited last, from the store the bundle's members share
    var gm = function (k, d) { try { return GM_getValue(k, d); } catch (e) { return d; } };
    var view = gm('view', null), stars = view && Array.isArray(view.stars) ? view.stars : [], visits = gm('visits', []), starred = {};
    var homeItem = function (cat, v) {
      var kind = String(v.key || '').split('/')[0], name = ST_ENTITY_NAMES[kind] || (kind === 'collection' ? 'Collection' : '');
      if (!name || !/^[a-z-]+\/[0-9a-f-]{36}$/.test(v.key) || !v.title) return;
      add({ id: cat.toLowerCase() + ':' + v.key, cat: cat, label: name + ' · ' + v.title + (v.by ? ' – ' + v.by : ''), recentless: true, run: stGo('/' + v.key) });
    };
    stars.forEach(function (v) { if (v && v.key) { starred[v.key] = 1; homeItem('Starred', v); } });
    (Array.isArray(visits) ? visits : []).forEach(function (v) { if (v && v.key && !starred[v.key]) homeItem('Visited', v); });
    // MusicBrainz's forms for a new entity (the ids stay go:, so pins made before keep working)
    [['/release/add', 'Release'], ['/artist/create', 'Artist'], ['/label/create', 'Label'], ['/work/create', 'Work'],
      ['/recording/create', 'Standalone recording'], ['/release-group/create', 'Release group'], ['/place/create', 'Place'],
      ['/series/create', 'Series'], ['/event/create', 'Event']]
      .forEach(function (g) { add({ id: 'go:' + g[0], cat: 'Add', label: g[1], run: stGo(g[0]) }); });
    // the signed-in editor's pages, from the header's link to their profile
    var me = null;
    Array.prototype.some.call(document.querySelectorAll('a[href^="/user/"]'), function (a) {
      var um = /^\/user\/([^/?#]+)$/.exec(a.getAttribute('href'));
      if (um && a.closest('.header, header, #header, nav')) { me = um[1]; return true; }
      return false;
    });
    if (me) {
      [['', 'My profile'], ['/edits', 'My edits'], ['/edits/open', 'My open edits'], ['/votes', 'My votes'],
        ['/collections', 'My collections'], ['/subscriptions/artist', 'My subscriptions'], ['/ratings', 'My ratings'], ['/tags', 'My tags']]
        .forEach(function (g) { add({ id: 'go:me' + g[0], cat: 'Go to', label: g[1], run: stGo('/user/' + me + g[0]) }); });
    }

    // Dock
    var restack = function () { ['br', 'bl', 'tr', 'tl'].forEach(function (c) { try { mbRestackCorner(c); } catch (e) { /* a corner's script broke */ } }); };
    var dock = document.getElementById('mbu-dock');
    if (dock) add({ id: 'dock:fold', cat: 'Dock', label: document.documentElement.hasAttribute('data-mbu-dock-open') ? 'Fold' : 'Unfold', run: function () { dock.click(); } });
    add({ id: 'dock:side', cat: 'Dock', label: 'Move to the ' + (mbuShared('cornerSide') === 'left' ? 'right' : 'left'),
      run: function () { mbuShared('cornerSide', mbuShared('cornerSide') === 'left' ? null : 'left'); restack(); } });
    add({ id: 'dock:flow', cat: 'Dock', label: mbuShared('cornerFlow') === 'row' ? 'Column' : 'Row',
      run: function () { mbuShared('cornerFlow', mbuShared('cornerFlow') === 'row' ? null : 'row'); restack(); } });
  }

  // Scripts: on and off, from the next page load
  var off = __stReadOff();
  stMembers.forEach(function (sm) {
    var isOff = off.indexOf(sm[0]) >= 0;
    add({ id: 'script:' + sm[0], cat: 'Scripts', label: (isOff ? 'Turn on ' : 'Turn off ') + sm[1], run: function () {
      stFlip(sm[0]);
      toast('✓ ' + sm[1] + ' turns ' + (isOff ? 'on' : 'off') + ' from the next page load');
    } });
  });

  // String Theory
  add({ id: 'st:copy', cat: 'String Theory', label: 'Copy versions as Markdown', run: function () {
    stCopy(stVersionsText(), function (ok) { toast(ok ? '✓ Versions copied as Markdown' : '⚠ Couldn’t copy the versions'); });
  } });
  add({ id: 'st:docs', cat: 'String Theory', label: 'Documentation', run: function () { window.open('https://github.com/' + ST_REPO + '/blob/main/userscripts/string_theory/DOCS.md', '_blank', 'noopener'); } });
  // the versions go on the clipboard, to paste into the new issue; the tab opens first, while the key press still allows it
  add({ id: 'st:newissue', cat: 'String Theory', label: 'New issue', hint: 'copies the versions', run: function () {
    window.open('https://github.com/' + ST_REPO + '/issues/new', '_blank', 'noopener');
    stCopy(stVersionsText(), function (ok) { toast(ok ? '✓ Versions copied: paste them into the issue' : '⚠ Couldn’t copy the versions'); });
  } });
  add({ id: 'st:issue', cat: 'String Theory', label: 'Issues', run: function () { window.open('https://github.com/' + ST_REPO + '/issues', '_blank', 'noopener'); } });
  add({ id: 'st:reload', cat: 'String Theory', label: 'Reload the page', run: function () { location.reload(); } });
  return out;
}
// Typed text that isn't a command can still be a search: one per entity type, last in the list
var ST_SEARCHES = [['artist', 'Artist'], ['release', 'Release'], ['release_group', 'Release group'], ['recording', 'Recording'], ['work', 'Work'], ['label', 'Label'],
  ['area', 'Area'], ['place', 'Place'], ['series', 'Series'], ['event', 'Event'], ['instrument', 'Instrument'], ['tag', 'Tag'], ['editor', 'Editor']];
function stPalSearches(q) {
  if (!ST_ON_MB || !q) return [];
  return ST_SEARCHES.map(function (s) {
    return { id: 'search:' + s[0], cat: 'Search', label: s[1] + ' “' + q + '”', recentless: true, pinless: true,
      run: stGo('/search?type=' + s[0] + '&method=indexed&query=' + encodeURIComponent(q)) };
  });
}

// Every word typed is found in "Category: label", at a word's start ranking first; failing that, the
// letters in order (vs → "Settings: Fusion" no, "ver" → "Copy versions"). Lower scores rank first.
function stPalMatch(c, q) {
  var text = (c.cat + ': ' + c.label).toLowerCase(), words = q.toLowerCase().split(/\s+/).filter(Boolean), score = 0, hits = [];
  if (!words.length) return { score: 0, hits: [] };
  var ok = words.every(function (w) {
    var i = text.indexOf(w), at = -1;
    for (var j = i; j >= 0; j = text.indexOf(w, j + 1)) if (j === 0 || /[\s:·“(-]/.test(text.charAt(j - 1))) { at = j; break; }
    if (i < 0) return false;
    score += at >= 0 ? at / 100 : 10 + i / 100;
    hits.push([at >= 0 ? at : i, w.length]);
    return true;
  });
  if (ok) {
    // what was typed, whole and in order, ranks above the same words scattered ("theme: dark")
    var phrase = text.indexOf(words.join(' '));
    if (phrase === 0) score -= 2; else if (phrase > 0 && /[\s:·“(-]/.test(text.charAt(phrase - 1))) score -= 1;
    return { score: score, hits: hits };
  }
  var flat = words.join(''), k = 0, first = -1, last = 0;
  hits = [];
  for (var n = 0; n < text.length && k < flat.length; n++) if (text.charAt(n) === flat.charAt(k)) { if (first < 0) first = n; last = n; hits.push([n, 1]); k++; }
  return k === flat.length ? { score: 100 + (last - first) / 10, hits: hits } : null;
}
function stPalMark(c, hits) {
  var text = c.cat + ': ' + c.label, marks = [];
  for (var i = 0; i < text.length; i++) marks.push(false);
  (hits || []).forEach(function (h) { for (var j = h[0]; j < h[0] + h[1] && j < text.length; j++) marks[j] = true; });
  var html = function (from, to) {
    var s = '', open = false;
    for (var j = from; j < to; j++) {
      if (marks[j] !== open) { s += marks[j] ? '<mark>' : '</mark>'; open = marks[j]; }
      s += stEsc(text.charAt(j));
    }
    return s + (open ? '</mark>' : '');
  };
  var cut = c.cat.length + 2;
  return '<span class="st-pal-c">' + html(0, cut) + '</span><span class="st-pal-l">' + html(cut, text.length) + '</span>';
}

function stPalette() {
  if (stPalOv && stPalOv.isConnected) { stPalOv.querySelector('#st-pal-q').focus(); return; }
  var U = stUI(), T = stTokens(), html = document.documentElement;
  if (!document.getElementById('st-pal-css')) {
    var css = document.createElement('style');
    css.id = 'st-pal-css';
    css.textContent = T.MBU_TOKENS + U.MBU_UI_CSS + ST_PAL_CSS;
    (document.head || html).appendChild(css);
  }
  var cmds = stPalCommands(), byId = {};
  cmds.forEach(function (c) { byId[c.id] = c; });
  var ov = document.createElement('div');
  ov.className = 'mbu-ov';
  ov.id = 'st-pal-ov';
  ov.innerHTML = '<div class="mbu-ov-panel mbu-ui" id="st-pal" role="dialog" aria-label="String Theory commands">'
    + '<input id="st-pal-q" type="text" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="st-pal-list" placeholder="Type a command, or a name to search">'
    + '<ul id="st-pal-list" role="listbox"></ul>'
    + '<div id="st-pal-foot"><span><kbd>↑↓</kbd> move</span><span><kbd>Enter</kbd> run</span><span><kbd>Alt+P</kbd> pin</span><span><kbd>Esc</kbd> close</span></div></div>';
  (document.body || html).appendChild(ov);
  stPalOv = ov;
  var input = ov.querySelector('#st-pal-q'), list = ov.querySelector('#st-pal-list');
  var focusBack = document.activeElement, shown = [], active = -1, previewed = null, done = false;

  var unpreview = function () { if (previewed) { previewed = null; try { __stTheme.preview(null); } catch (e) { /* no themes */ } } };
  var close = function () {
    if (done) return;
    done = true;
    unpreview();
    ov.remove();
    window.removeEventListener('keydown', onKey, true);
    if (focusBack && focusBack.focus && focusBack.isConnected) try { focusBack.focus(); } catch (e) { /* gone */ }
  };
  var row = function (c, hits) {
    var pinned = stPalRead().pins.indexOf(c.id) >= 0;
    return '<li class="st-pal-i" role="option" aria-selected="false" data-id="' + stEsc(c.id) + '">' + stPalMark(c, hits)
      + (c.hint ? '<span class="st-pal-h">' + stEsc(c.hint) + '</span>' : '')
      + (c.pinless ? '' : '<button type="button" class="st-pal-pin" tabindex="-1" aria-pressed="' + pinned + '" aria-label="' + (pinned ? 'Unpin' : 'Pin') + '" data-tip="' + (pinned ? 'Unpin' : 'Pin to the top') + '">' + (pinned ? '★' : '☆') + '</button>')
      + '</li>';
  };
  var render = function (keep) {
    var q = input.value.trim(), p = stPalRead(), h = '', keepId = keep && shown[active] && shown[active].id;
    shown = [];
    var group = function (title, items) {
      if (!items.length) return;
      if (title) h += '<li class="st-pal-g" role="presentation">' + stEsc(title) + '</li>';
      items.forEach(function (it) { shown.push(it.c); h += row(it.c, it.hits); });
    };
    if (!q) {
      var pins = p.pins.map(function (id) { return byId[id]; }).filter(Boolean);
      var recent = p.recent.map(function (id) { return byId[id]; }).filter(function (c) { return c && pins.indexOf(c) < 0; });
      var wrap = function (c) { return { c: c }; };
      group('Pinned', pins.map(wrap));
      group('Recent', recent.map(wrap));
      group(pins.length || recent.length ? 'All' : '', cmds.filter(function (c) { return pins.indexOf(c) < 0 && recent.indexOf(c) < 0; }).map(wrap));
    } else {
      var hits = [];
      cmds.forEach(function (c, i) {
        var mm = stPalMatch(c, q);
        if (!mm) return;
        // a pinned or recent command ranks a little higher; ties keep the list's order
        var bonus = p.pins.indexOf(c.id) >= 0 ? 0.5 : p.recent.indexOf(c.id) >= 0 ? 0.25 : 0;
        hits.push({ c: c, hits: mm.hits, s: mm.score - bonus, i: i });
      });
      hits.sort(function (a, b) { return a.s - b.s || a.i - b.i; });
      group('', hits);
      group(hits.length ? 'Search MusicBrainz' : '', stPalSearches(q).map(function (c) { return { c: c }; }));
    }
    list.innerHTML = h || '<li class="st-pal-none">No command matches</li>';
    var at = keepId ? shown.map(function (c) { return c.id; }).indexOf(keepId) : -1;
    select(at >= 0 ? at : 0, !keep);
  };
  var select = function (i, doPreview) {
    if (!shown.length) { active = -1; unpreview(); return; }
    active = Math.max(0, Math.min(shown.length - 1, i));
    var els = list.querySelectorAll('.st-pal-i');
    Array.prototype.forEach.call(els, function (el, n) { el.setAttribute('aria-selected', String(n === active)); });
    var el = els[active];
    if (el) {
      var lr = list.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (active === 0) list.scrollTop = 0;   // the group heading above the first shows too
      else if (r.top < lr.top) list.scrollTop -= lr.top - r.top;
      else if (r.bottom > lr.bottom) list.scrollTop += r.bottom - lr.bottom;
    }
    if (doPreview === false) return;
    var c = shown[active];
    if (c && c.preview) { previewed = c; try { c.preview(); } catch (e) { /* nothing shown */ } } else unpreview();
  };
  var run = function (c) {
    if (!c) return;
    if (!c.recentless) {
      var r = stPalRead().recent.filter(function (id) { return id !== c.id; });
      r.unshift(c.id);
      stPalSet({ recent: r.slice(0, 8) });
    }
    previewed = null;   // kept: run saves what was shown
    close();
    try { c.run(); } catch (e) { try { console.error('[String Theory] ' + c.cat + ': ' + c.label + ' failed:', e); } catch (x) { /* no console */ } }
  };
  var pin = function (c) {
    if (!c || c.pinless) return;
    var pins = stPalRead().pins.slice(), i = pins.indexOf(c.id);
    if (i < 0) pins.push(c.id); else pins.splice(i, 1);
    stPalSet({ pins: pins });
    render(true);
  };
  var page = function () { return Math.max(1, Math.floor(list.clientHeight / 30) - 1); };
  // on the window, in the capture phase: before the page's own keys and String Theory's settings window
  var onKey = function (e) {
    if (!ov.contains(e.target) && e.target !== document.body && e.target !== document.documentElement) return;
    var k = e.key, nav = true;
    if (k === 'Escape') close();
    else if (k === 'ArrowDown') select(active + 1);
    else if (k === 'ArrowUp') select(active - 1);
    else if (k === 'PageDown') select(active + page());
    else if (k === 'PageUp') select(active - page());
    else if ((k === 'Home' || k === 'End') && e.ctrlKey) select(k === 'Home' ? 0 : shown.length - 1);
    else if (k === 'Enter') run(shown[active]);
    else if (e.altKey && e.code === 'KeyP') pin(shown[active]);
    else if (stKeyIs(e, stPalRead().key)) close();
    else nav = false;
    if (nav) e.preventDefault();
    e.stopPropagation();   // typing stays in the box: the page's own hotkeys don't see it
  };
  window.addEventListener('keydown', onKey, true);
  input.addEventListener('input', function () { render(false); });
  list.addEventListener('mousedown', function (e) { e.preventDefault(); });   // the box keeps the focus
  list.addEventListener('click', function (e) {
    var li = e.target.closest('.st-pal-i');
    if (!li) return;
    var c = shown[Array.prototype.indexOf.call(list.querySelectorAll('.st-pal-i'), li)];
    if (e.target.closest('.st-pal-pin')) pin(c); else run(c);
  });
  list.addEventListener('mousemove', function (e) {
    var li = e.target.closest('.st-pal-i');
    if (!li) return;
    var i = Array.prototype.indexOf.call(list.querySelectorAll('.st-pal-i'), li);
    if (i !== active) select(i, false);   // the pointer only points: no preview
  });
  ov.addEventListener('mousedown', function (e) { if (e.target === ov) { e.preventDefault(); close(); } });
  render(false);
  input.focus();
}
// the hotkey, in the top frame only; not while the settings window records a new one
function stPalListen() {
  window.addEventListener('keydown', function (e) {
    if (stPalRecording || e.repeat || (stPalOv && stPalOv.isConnected)) return;
    var p = stPalRead();
    if (!p.on || !stKeyIs(e, p.key)) return;
    e.preventDefault();
    e.stopPropagation();
    try { stPalette(); } catch (err) { try { console.error('[String Theory] command palette failed:', err); } catch (x) { /* no console */ } }
  }, true);
}
