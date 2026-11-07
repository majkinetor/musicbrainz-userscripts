// String Theory's command palette (#890): a hotkey (Ctrl+K by default) opens a list of commands, filtered as
// you type, as in VS Code. build.mjs writes this file into the bundle after settings.js, in the same scope.
// Its setting is the GM value 'string_theory.palette': { on, key: { ctrl, alt, shift, meta, key }, pins, recent, last }.
// Plain ES5, as the rest of the bundle's own code.
var ST_PAL_KEY = 'string_theory.palette';
var ST_PAL_HOTKEY = { ctrl: true, alt: false, shift: false, meta: false, key: 'k' };
var stPal = null, stPalOv = null, stPalRecording = false;
function stPalRead() {
  if (stPal) return stPal;
  var v; try { v = GM_getValue(ST_PAL_KEY, null); } catch (e) { v = null; }
  v = v && typeof v === 'object' ? v : {};
  var list = function (a) { return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string'; }) : []; };
  stPal = { on: v.on !== false, key: v.key && v.key.key ? v.key : ST_PAL_HOTKEY, pins: list(v.pins), recent: list(v.recent), last: typeof v.last === 'string' ? v.last : '' };
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
  // above every window, a config window included: they share the modal z-index, where the later one wins
  + '#st-pal-ov{z-index:2147483600;align-items:flex-start;padding-top:12vh;background:none}'
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
  + '#st-pal-list .st-pal-i.st-pal-drag{opacity:.55;background:var(--mbu-accent-soft)}'
  + '#st-pal-list.st-pal-dragging,#st-pal-list.st-pal-dragging .st-pal-i{cursor:grabbing}'
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
    var newsN = stNewsUnread(stNewsRead()).length;
    add({ id: 'st:news', cat: 'String Theory', label: "What's new", hint: newsN ? newsN + ' new' : '', run: stNewsOpen });
  }
  if (ST_ON_MB) {
    add({ id: 'set:dock', cat: 'Settings', label: 'Dock', run: function () { stSettings('l'); } });
    add({ id: 'set:about', cat: 'Settings', label: 'About and updates', run: function () { stSettings('a'); } });
  }
  [['main', 'Latest'], ['stable', 'Stable']].forEach(function (r) {
    add({ id: 'st:install:' + r[0], cat: 'String Theory', label: 'Install ' + r[1].toLowerCase(), hint: stChannel() === r[1] ? 'current' : '',
      run: function () { window.open(stInstallUrl(r[0]), '_blank', 'noopener'); } });
  });
  add({ id: 'st:install:pinned', cat: 'String Theory', label: 'Install latest pinned', run: function () { stInstallPinned('main'); } });
  stMembers.forEach(function (m) {
    add({ id: 'set:' + m[0], cat: 'Settings', label: m[1], run: function () { stOpenFor(m[1]); } });
  });

  // Theme: highlighting one shows it, Enter keeps it
  if (ST_ON_MB) {
    add({ id: 'theme:chooser', cat: 'Theme', label: 'Theme chooser', run: function () { setTimeout(stThemeChooser, 0); } });
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

  // each member's own commands: window.__mbuPalette = { <script name>: function () { return [{ id, label, cat?, hint?, recentless?, run }] } },
  // asked again every time the palette opens, so a script lists what its page and windows offer now
  var reg = {}; try { reg = window.__mbuPalette || {}; } catch (e) { /* none */ }
  Object.keys(reg).forEach(function (name) {
    var list = []; try { list = reg[name]() || []; } catch (e) { try { console.error('[String Theory] ' + name + "'s commands failed:", e); } catch (x) { /* no console */ } }
    list.forEach(function (c) {
      if (!c || !c.id || !c.label || typeof c.run !== 'function') return;
      add({ id: 'x:' + name + ':' + c.id, cat: c.cat || name, label: c.label, hint: c.hint || '', recentless: !!c.recentless, run: c.run });
    });
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
    (Array.isArray(visits) ? visits : []).forEach(function (v) { if (v && v.key && !starred[v.key]) homeItem('Recent', v); });
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
  add({ id: 'st:site', cat: 'Go to', label: 'String Theory website', run: function () { window.open('https://milic.info/musicbrainz-userscripts', '_blank', 'noopener'); } });
  add({ id: 'st:docs', cat: 'String Theory', label: 'Documentation', run: function () { window.open('https://github.com/' + ST_REPO + '/blob/main/userscripts/string_theory/DOCS.md', '_blank', 'noopener'); } });
  // New issue: GitHub fills the title and body from the address. The title starts with the script's name, which the
  // repo's issue-label workflow turns into its area label (and takes off the title); the versions go under room for the report.
  // With log: the script's log of this page, or its last kept session (window.__mbuLogs, filled by every mbuLog).
  // A log too long for the address goes on the clipboard instead, with a line in the body saying so.
  var issueUrl = function (name, body) {
    return 'https://github.com/' + ST_REPO + '/issues/new?title=' + encodeURIComponent(name + ': ') + '&body=' + encodeURIComponent(body);
  };
  var newIssue = function (id, name, log, which) {
    add({ id: id, cat: log ? 'New issue with log' : 'New issue', label: name + (which ? ' · ' + which : ''), recentless: !!log, pinless: !!log, run: function () {
      var head = '\n\n---\n\n' + stVersionsText(), md = log ? log() : '', url = issueUrl(name, head + (md ? '\n\n' + md : ''));
      if (md && url.length > 7000) {
        url = issueUrl(name, head + '\n\n<!-- the log is on the clipboard: paste it here -->');
        stCopy(md, function (ok) { toast(ok ? '✓ The log is on the clipboard: paste it into the issue' : '⚠ Couldn’t copy the log'); });
      }
      window.open(url, '_blank', 'noopener');
    } });
  };
  newIssue('st:newissue', 'String Theory');
  stMembers.forEach(function (sm) { newIssue('newissue:' + sm[0], sm[1]); });
  // this page's log of each script that logged something here, then every kept session of the scripts with a history
  var logs = {}; try { logs = window.__mbuLogs || {}; } catch (e) { /* none */ }
  stMembers.forEach(function (sm) {
    var l = logs[sm[1] + '*'] || logs[sm[1]];   // a bundled script's name ends in *
    if (l && typeof l.markdown === 'function' && l.markdown()) newIssue('newissuelog:' + sm[0], sm[1], function () { return l.markdown(); }, 'this page');
  });
  var kept = []; try { kept = U.mbuLogHistory ? U.mbuLogHistory() : []; } catch (e) { /* none */ }
  kept.forEach(function (k) { newIssue('newissuelog:' + k.name + ':' + k.id, k.name, k.markdown, k.label); });
  add({ id: 'st:reload', cat: 'String Theory', label: 'Reload the page', run: function () { location.reload(); } });
  return out;
}
// Typed text that isn't a command can still be a search: one per entity type, last in the list
var ST_SEARCHES = [['artist', 'Artist'], ['release', 'Release'], ['release_group', 'Release group'], ['recording', 'Recording'], ['work', 'Work'], ['label', 'Label'],
  ['area', 'Area'], ['place', 'Place'], ['series', 'Series'], ['event', 'Event'], ['instrument', 'Instrument'], ['tag', 'Tag'], ['editor', 'Editor']];
// "search work blue" or "work blue" searches works for "blue"; "search" alone, or with the start of a type
// ("search rel"), offers the types, and Enter on one fills the box with it. first: these lead the list.
function stPalSearches(q) {
  if (!ST_ON_MB || !q) return { first: false, items: [] };
  var item = function (s, text) {
    return { id: 'search:' + s[0], cat: 'Search ' + s[1], label: text, recentless: true, pinless: true,
      run: stGo('/search?type=' + s[0] + '&method=indexed&query=' + encodeURIComponent(text)) };
  };
  var ask = function (s) { return { id: 'search:' + s[0], cat: 'Search ' + s[1], label: '…', recentless: true, pinless: true, fill: 'search ' + s[1].toLowerCase() + ' ' }; };
  var ex = /^search(?:\s+|$)([\s\S]*)$/i.exec(q), rest = (ex ? ex[1] : q).replace(/^([^:]*?)\s*:\s*/, '$1 '), low = rest.toLowerCase();
  // the longest type name the text starts with ("release group" before "release")
  var typed = null;
  ST_SEARCHES.forEach(function (s) {
    var n = s[1].toLowerCase();
    if ((low === n || low.indexOf(n + ' ') === 0) && (!typed || n.length > typed[1].length)) typed = s;
  });
  var text = typed ? rest.slice(typed[1].length).trim() : rest.trim();
  if (typed && text) {
    var others = ex ? [] : ST_SEARCHES.filter(function (s) { return s !== typed; }).map(function (s) { return item(s, q); });
    return { first: true, items: [item(typed, text)].concat(others) };
  }
  if (ex) {
    if (typed) return { first: true, items: [ask(typed)] };
    var starts = ST_SEARCHES.filter(function (s) { return s[1].toLowerCase().indexOf(low.trim()) === 0; });
    if (!text || starts.length) return { first: true, items: (text ? starts : ST_SEARCHES).map(ask) };
    return { first: true, items: ST_SEARCHES.map(function (s) { return item(s, text); }) };
  }
  return { first: false, items: ST_SEARCHES.map(function (s) { return item(s, q); }) };
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
  // letters in order across words, read as "Category: label" or as "label category" ("ehse" → Event Horizon Settings)
  var flat = words.join(''), cut = c.cat.length + 2, lab = c.label.toLowerCase(), best = null;
  // each letter costs nothing at a word's start or right after the letter before it, 1 elsewhere; the
  // cheapest placement wins, so "seh" / "ehs" take Settings, Event, Horizon and rank above scattered hits
  [[text, function (n) { return n; }], [lab + ' ' + c.cat.toLowerCase(), function (n) { return n < lab.length ? cut + n : n - lab.length - 1; }]].forEach(function (t) {
    var s = t[0], L = s.length, m = flat.length, cost = [], from = [];
    var startAt = function (n) { return n === 0 || /[\s:·“(-]/.test(s.charAt(n - 1)); };
    for (var k = 0; k < m; k++) {
      cost.push([]); from.push([]);
      for (var n = 0; n < L; n++) {
        cost[k][n] = Infinity;
        if (s.charAt(n) !== flat.charAt(k)) continue;
        if (!k) { cost[k][n] = startAt(n) ? 0 : 1; continue; }
        for (var p = 0; p < n; p++) {
          if (cost[k - 1][p] === Infinity) continue;
          var v = cost[k - 1][p] + (p === n - 1 || startAt(n) ? 0 : 1);
          if (v < cost[k][n]) { cost[k][n] = v; from[k][n] = p; }
        }
      }
    }
    var end = -1;
    for (var e = 0; e < L; e++) if (cost[m - 1][e] < Infinity && (end < 0 || cost[m - 1][e] < cost[m - 1][end])) end = e;
    if (end < 0) return;
    var hs = [], at = end;
    for (var j = m - 1; j >= 0; j--) { hs.unshift([t[1](at), 1]); at = from[j][at]; }
    var sc = 100 + cost[m - 1][end] * 5 + (end - hs.length) / 1000;
    if (!best || sc < best.score) best = { score: sc, hits: hs };
  });
  return best;
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

// the keypress and keyup of the Enter that ran a command: nothing on the page sees them
function stPalSwallowEnter() {
  var eat = function (e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === 'keyup') off();
  };
  var off = function () { window.removeEventListener('keypress', eat, true); window.removeEventListener('keyup', eat, true); clearTimeout(t); };
  var t = setTimeout(off, 1500);   // a keyup that never comes (focus left the window) frees it anyway
  window.addEventListener('keypress', eat, true);
  window.addEventListener('keyup', eat, true);
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
    + '<div id="st-pal-foot"><span><kbd>↑↓</kbd> move</span><span><kbd>Enter</kbd> run</span><span><kbd>Alt+P</kbd> pin</span><span><kbd>Alt+↑↓</kbd> move a pin</span><span><kbd>Esc</kbd> close</span></div></div>';
  (document.body || html).appendChild(ov);
  stPalOv = ov;
  var input = ov.querySelector('#st-pal-q'), list = ov.querySelector('#st-pal-list');
  var focusBack = document.activeElement, shown = [], active = -1, previewed = null, done = false, keyed = false;
  var pinCount = 0, drag = null, dragged = false;   // the pinned rows at the top (none while filtering), a drag of one

  var unpreview = function () { if (previewed) { previewed = null; try { __stTheme.preview(null); } catch (e) { /* no themes */ } } };
  var close = function () {
    if (done) return;
    done = true;
    stPalSet({ last: input.value });   // back in the box, selected, the next time
    unpreview();
    ov.remove();
    window.removeEventListener('keydown', onKey, true);
    if (focusBack && focusBack.focus && focusBack.isConnected) try { focusBack.focus(); } catch (e) { /* gone */ }
  };
  var row = function (c, hits, movable) {
    var pinned = stPalRead().pins.indexOf(c.id) >= 0;
    return '<li class="st-pal-i" role="option" aria-selected="false" data-id="' + stEsc(c.id) + '"' + (movable ? ' data-pinned=""' : '') + '>' + stPalMark(c, hits)
      + (c.hint ? '<span class="st-pal-h">' + stEsc(c.hint) + '</span>' : '')
      + (c.pinless ? '' : '<button type="button" class="st-pal-pin" tabindex="-1" aria-pressed="' + pinned + '" aria-label="' + (pinned ? 'Unpin' : 'Pin') + '" data-tip="' + (pinned ? 'Unpin' : 'Pin to the top') + '">' + (pinned ? '★' : '☆') + '</button>')
      + '</li>';
  };
  var render = function (keep) {
    var q = input.value.trim(), p = stPalRead(), h = '', keepId = keep && shown[active] && shown[active].id;
    shown = [];
    pinCount = 0;
    var group = function (title, items, movable) {
      if (!items.length) return;
      if (title) h += '<li class="st-pal-g" role="presentation">' + stEsc(title) + '</li>';
      items.forEach(function (it) { shown.push(it.c); h += row(it.c, it.hits, movable); });
    };
    if (!q) {
      var pins = p.pins.map(function (id) { return byId[id]; }).filter(Boolean);
      var recent = p.recent.map(function (id) { return byId[id]; }).filter(function (c) { return c && pins.indexOf(c) < 0; });
      var wrap = function (c) { return { c: c }; };
      group('Pinned', pins.map(wrap), true);
      pinCount = pins.length;
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
      var se = stPalSearches(q), found = se.items.map(function (c) { return { c: c }; });
      if (se.first) { group(hits.length ? 'Search MusicBrainz' : '', found); group('Commands', hits); }
      else { group('', hits); group(hits.length ? 'Search MusicBrainz' : '', found); }
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
    if (c.fill) { input.value = c.fill; render(false); input.focus(); return; }   // a step, not a command
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
  // the pins shown, in their new order: they take the places the shown ones had, so pins of commands
  // this page doesn't offer keep theirs
  var reorder = function (ids) {
    var n = 0, pins = stPalRead().pins.map(function (id) { return ids.indexOf(id) >= 0 ? ids[n++] : id; });
    stPalSet({ pins: pins });
    render(true);
  };
  var movePin = function (by) {
    var to = active + by;
    if (active < 0 || active >= pinCount || to < 0 || to >= pinCount) return;
    var ids = shown.slice(0, pinCount).map(function (c) { return c.id; });
    ids.splice(to, 0, ids.splice(active, 1)[0]);
    reorder(ids);
  };
  var page = function () { return Math.max(1, Math.floor(list.clientHeight / 30) - 1); };
  // on the window, in the capture phase: before the page's own keys and String Theory's settings window
  var onKey = function (e) {
    if (!ov.contains(e.target) && e.target !== document.body && e.target !== document.documentElement) return;
    var k = e.key, nav = true;
    if (/^(Arrow(Up|Down)|Page(Up|Down)|Home|End)$/.test(k)) keyed = true;
    if (k === 'Escape') close();
    else if (e.altKey && (k === 'ArrowUp' || k === 'ArrowDown')) movePin(k === 'ArrowUp' ? -1 : 1);
    else if (k === 'ArrowDown') select(active + 1);
    else if (k === 'ArrowUp') select(active - 1);
    else if (k === 'PageDown') select(active + page());
    else if (k === 'PageUp') select(active - page());
    else if ((k === 'Home' || k === 'End') && e.ctrlKey) select(k === 'Home' ? 0 : shown.length - 1);
    else if (k === 'Enter') {
      // the first row, unless the keys chose another; the pointer's row runs on a click. The focus goes
      // back to the page on close, so the rest of this press (keypress, keyup) is swallowed: it would
      // otherwise reach the element behind and run that too
      e.preventDefault();
      e.stopImmediatePropagation();
      stPalSwallowEnter();
      run(shown[keyed && active >= 0 ? active : 0]);
    }
    else if (e.altKey && e.code === 'KeyP') pin(shown[active]);
    else if (stKeyIs(e, stPalRead().key)) close();
    else nav = false;
    if (nav) e.preventDefault();
    e.stopPropagation();   // typing stays in the box: the page's own hotkeys don't see it
  };
  window.addEventListener('keydown', onKey, true);
  input.addEventListener('input', function () { keyed = false; render(false); });
  list.addEventListener('mousedown', function (e) { e.preventDefault(); });   // the box keeps the focus
  list.addEventListener('click', function (e) {
    var li = e.target.closest('.st-pal-i');
    if (!li || dragged) { dragged = false; return; }   // the click a drag ends with runs nothing
    var c = shown[Array.prototype.indexOf.call(list.querySelectorAll('.st-pal-i'), li)];
    if (e.target.closest('.st-pal-pin')) pin(c); else run(c);
  });
  // a pinned row drags up and down among the pinned; the order is kept when it's dropped
  list.addEventListener('pointerdown', function (e) {
    var li = e.target.closest('.st-pal-i[data-pinned]');
    if (!li || e.button !== 0 || e.target.closest('.st-pal-pin')) return;
    drag = { li: li, id: e.pointerId, y: e.clientY, on: false };
  });
  list.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.on) {
      if (Math.abs(e.clientY - drag.y) < 5) return;
      drag.on = true;
      try { drag.li.setPointerCapture(e.pointerId); } catch (x) { /* moves still reach the list */ }
      drag.li.classList.add('st-pal-drag');
      list.classList.add('st-pal-dragging');
    }
    var rows = Array.prototype.filter.call(list.querySelectorAll('.st-pal-i[data-pinned]'), function (el) { return el !== drag.li; });
    var before = null;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { before = rows[i]; break; }
    }
    if (before) { if (drag.li.nextSibling !== before) list.insertBefore(drag.li, before); }
    else if (rows.length && rows[rows.length - 1].nextSibling !== drag.li) list.insertBefore(drag.li, rows[rows.length - 1].nextSibling);
  });
  var drop = function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var was = drag;
    drag = null;
    if (!was.on) return;
    list.classList.remove('st-pal-dragging');
    dragged = e.type === 'pointerup';
    setTimeout(function () { dragged = false; }, 0);
    reorder(Array.prototype.map.call(list.querySelectorAll('.st-pal-i[data-pinned]'), function (el) { return el.getAttribute('data-id'); }));
  };
  list.addEventListener('pointerup', drop);
  list.addEventListener('pointercancel', drop);
  list.addEventListener('mousemove', function (e) {
    if (drag && drag.on) return;   // the rows move under the pointer: their places don't match the list yet
    var li = e.target.closest('.st-pal-i');
    if (!li) return;
    var i = Array.prototype.indexOf.call(list.querySelectorAll('.st-pal-i'), li);
    if (i !== active) select(i, false);   // the pointer only points: no preview
  });
  ov.addEventListener('mousedown', function (e) { if (e.target === ov) { e.preventDefault(); close(); } });
  input.value = stPalRead().last;
  render(!!input.value);   // the text left from last time previews nothing until it changes
  active = -1;   // nothing chosen on open: the first arrow down picks the first row
  Array.prototype.forEach.call(list.querySelectorAll('.st-pal-i'), function (el) { el.setAttribute('aria-selected', 'false'); });
  input.focus();
  input.select();
}
// the hotkey, in the top frame only; not while the settings window records a new one
function stPalListen() {
  if (__stTheme.chooser()) {
    var resume = function () { try { stThemeChooser(); } catch (e) { /* no chooser */ } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resume, { once: true }); else resume();
  }
  window.addEventListener('keydown', function (e) {
    if (stPalRecording || e.repeat || (stPalOv && stPalOv.isConnected)) return;
    var p = stPalRead();
    if (!p.on || !stKeyIs(e, p.key)) return;
    e.preventDefault();
    e.stopPropagation();
    try { stPalette(); } catch (err) { try { console.error('[String Theory] command palette failed:', err); } catch (x) { /* no console */ } }
  }, true);
}

// ── Theme chooser ───────────────────────────────────────────────────────────
// A slim bar at the bottom of the page that steps through every theme with the left and right keys,
// showing each on the whole page; nothing covers the view. All / Light / Dark limits them to one variant.
// With Event Horizon's effect presets, the effect beside (or up and down) picks the one the theme brings, shown as picked; stepping keeps the effect on show; the pencil beside opens Event Horizon's Effects tab. Keep (Enter) saves both, ✕ (Esc) goes back.
// It stays open across pages until closed (the runtime's chooser state), and above any popup: it sits in the top layer.
var ST_TC_CSS = ''
  + '#st-tc{position:fixed;inset:auto auto 16px 50%;margin:0;overflow:visible;transform:translateX(-50%);z-index:2147483600;display:flex;align-items:center;gap:6px;padding:6px 8px;'
  + 'background:color-mix(in srgb,var(--mbu-bg) 80%,transparent);backdrop-filter:blur(6px);color:var(--mbu-text);border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);font:13px/1.4 var(--mbu-font);max-width:calc(100vw - 32px);box-sizing:border-box}'
  + '#st-tc button{margin:0;height:30px;border:0!important;background:none!important;box-shadow:none!important;color:inherit;cursor:pointer}'
  + '#st-tc button:hover,#st-tc button:focus-visible{color:var(--mbu-accent-text,var(--mbu-accent))}'
  + '#st-tc .st-tc-n{min-width:170px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  + '#st-tc .st-tc-v{color:var(--mbu-text-weak)}'
  + '#st-tc .st-tc-i{color:var(--mbu-text-weak);font-size:12px;min-width:36px;text-align:center;cursor:pointer;user-select:none}#st-tc .st-tc-i:hover{color:var(--mbu-accent-text,var(--mbu-accent))}'
  // the effect: a flat dropdown, set off from the theme by a thin rule
  + '#st-tc select{margin:0 0 0 2px;height:30px;max-width:180px;padding:0 4px 0 10px;border:0!important;border-left:1px solid var(--mbu-border)!important;border-radius:0;background:none!important;box-shadow:none!important;color:inherit;font:inherit;cursor:pointer}'
  + '#st-tc select:hover,#st-tc select:focus-visible{color:var(--mbu-accent-text,var(--mbu-accent));outline:0}'
  + '#st-tc select option{background:var(--mbu-bg);color:var(--mbu-text)}'
  + '#st-tc #st-tc-ed{display:inline-flex;align-items:center;padding:0 6px}#st-tc #st-tc-ed svg{width:14px;height:14px}'
  // a phone: pinned to the bottom edge, the page's full width; the name takes what the buttons leave
  + '@media (max-width:640px){#st-tc{inset:auto 0 0 0;width:auto;transform:none;max-width:none;gap:2px;padding:6px 6px calc(6px + env(safe-area-inset-bottom,0px));border-width:1px 0 0;border-radius:0}'
  + '#st-tc .st-tc-n{flex:1 1 auto;min-width:0}#st-tc button{padding-inline:6px}#st-tc select{max-width:110px}}';
var stTcEl = null;
function stThemeChooser() {
  if (stTcEl && stTcEl.isConnected) return;
  var was = __stTheme.chooser();   // open on the last page: carry on where it was
  var U = stUI(), T = stTokens(), html = document.documentElement;
  if (!document.getElementById('st-tc-css')) {
    var css = document.createElement('style');
    css.id = 'st-tc-css';
    css.textContent = T.MBU_TOKENS + U.MBU_UI_CSS + ST_TC_CSS;
    (document.head || html).appendChild(css);
  }
  var th = __stTheme.read(), cur = __stTheme.variant(), all = [], only = was && /^(light|dark)$/.test(was.only) ? was.only : 'all', i = 0;
  // Event Horizon's effect presets, when it's on and has any; eh: the preset each theme brings, by 'variant:name', as picked here
  var fx = __stReadOff().indexOf('event_horizon') < 0 && mbuShared('ehFxPresets') || [];
  var fxSort = function (a) { return Array.isArray(a) ? a.slice().sort(function (x, y) { return x.localeCompare(y, undefined, { sensitivity: 'base', numeric: true }); }) : []; };
  fx = fxSort(fx);
  var eh = {}, ehWas = was && was.eh && typeof was.eh === 'object' ? was.eh : th.eh || {};
  Object.keys(ehWas).forEach(function (k) { eh[k] = ehWas[k]; });
  // only: 'all', 'light' or 'dark', which themes the arrows step through
  var list = function () {
    var was = all[i];
    all = [];
    [cur, cur === 'dark' ? 'light' : 'dark'].forEach(function (v) {
      if (only === 'all' || only === v) __stTheme.names(v).forEach(function (n) { all.push([v, n]); });
    });
    var at = function (v, n) { return all.findIndex(function (t) { return t[0] === v && t[1] === n; }); };
    i = was ? at(was[0], was[1]) : at(cur, th[cur]);
    if (i < 0) i = Math.max(0, at(all[0][0], th[all[0][0]]));
  };
  list();
  if (was) { var at = all.findIndex(function (t) { return t[0] === was.v && t[1] === was.n; }); if (at >= 0) i = at; }
  var bar = document.createElement('div');
  bar.id = 'st-tc';
  bar.className = 'mbu-ui';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Theme chooser');
  bar.innerHTML = '<button type="button" id="st-tc-f" aria-label="Themes to step through">' + { all: 'All', light: 'Light', dark: 'Dark' }[only] + '</button>'
    + '<span class="st-tc-n" aria-live="polite" data-tip="The theme on show&#10;Left: the previous theme&#10;Right: the next theme&#10;Click: the next theme, on its count&#10;Right-click: the previous theme, on its count"></span><span class="st-tc-i" data-th-i></span>'
    + (fx.length ? '<select id="st-tc-e" aria-label="Event Horizon effect this theme brings" data-tip="The Event Horizon effect this theme brings&#10;It stays as you step to other themes&#10;Up: the previous effect&#10;Down: the next effect&#10;Click: the next effect, on its count&#10;Right-click: the previous effect, on its count"></select>'
      + '<button type="button" id="st-tc-ed" aria-label="Edit the effects" data-tip="Edit the effects&#10;Opens Event Horizon&#39;s settings on Effects; the chooser stays"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M11 2.5l2.5 2.5L6 12.5 3 13l.5-3z"/><path d="M9.5 4l2.5 2.5"/></svg></button><span class="st-tc-i" data-fx-i></span>' : '')
    + '<button type="button" id="st-tc-k">Keep</button>'
    + '<button type="button" class="mbu-ov-x" id="st-tc-x" aria-label="Close">✕</button>';
  // a manual popover is in the top layer, above any z-index; a popup opened later goes over it, so it climbs back on top
  var top = typeof bar.showPopover === 'function';
  if (top) bar.setAttribute('popover', 'manual');
  var raise = function () {
    if (!bar.isConnected) return;
    if (!top) { if (bar !== html.lastElementChild) html.appendChild(bar); return; }
    try { if (bar.matches(':popover-open')) bar.hidePopover(); bar.showPopover(); } catch (e) { /* not shown */ }
  };
  html.appendChild(bar);   // outside the body, which Event Horizon swaps
  stTcEl = bar;
  raise();
  // something new on the page or its body (a popup, Event Horizon's swapped body) puts the bar back on top
  var watch = new MutationObserver(function (ms) {
    if (ms.some(function (m) {
      return (m.target === html || m.target === document.body) && Array.prototype.some.call(m.addedNodes, function (n) { return n !== bar && n.nodeType === 1; });
    })) raise();
  });
  watch.observe(html, { childList: true, subtree: true });
  document.addEventListener('toggle', function (e) { if (e.target !== bar && e.newState === 'open') raise(); }, true);
  // a popup that closes on a click outside it leaves the bar's clicks alone
  ['pointerdown', 'mousedown', 'click'].forEach(function (t) { bar.addEventListener(t, function (e) { e.stopPropagation(); }); });
  var show = function () {
    var t = all[i], p = { mode: t[0], eh: eh }; p[t[0]] = t[1];
    __stTheme.preview(p);
    __stTheme.chooserPut({ only: only, v: t[0], n: t[1], eh: eh, fx: last, ft: touched });
    var sel = bar.querySelector('#st-tc-e');
    if (sel) {
      var now = fxSort(mbuShared('ehFxPresets'));
      if (now.length) fx = now;
      // a preset deleted in Event Horizon still shows while it's picked, as in the settings
      var on = eh[t[0] + ':' + t[1]] || '';
      sel.innerHTML = '<option value="">Current effect</option><option value="-">No effect</option>' + fx.concat(on && on !== '-' && fx.indexOf(on) < 0 ? [on] : []).map(function (n) { return '<option>' + stEsc(n) + '</option>'; }).join('');
      sel.value = on;
      bar.querySelector('[data-fx-i]').textContent = (sel.selectedIndex + 1) + '/' + sel.options.length;
    }
    bar.querySelector('.st-tc-n').innerHTML = stEsc(t[1]) + ' <span class="st-tc-v">' + t[0] + '</span>';
    bar.querySelector('[data-th-i]').textContent = (i + 1) + '/' + all.length;
  };
  var ONLY = { all: ['light', 'Light'], light: ['dark', 'Dark'], dark: ['all', 'All'] };
  var filter = function () { var n = ONLY[only]; only = n[0]; bar.querySelector('#st-tc-f').textContent = n[1]; list(); bring(); show(); };
  // last: the effect on show; opening it is Event Horizon's preset on show when unchanged, else "Current effect", so opening
  // changes nothing; the themes stepped to bring it too, so stepping never changes the effect
  var k0 = all[i][0] + ':' + all[i][1], touched = !!(was && was.ft);
  var last = was && typeof was.fx === 'string' ? was.fx : html.getAttribute('data-eh-fx-cur') || '';
  if (!was) { if (last && fx.indexOf(last) >= 0) eh[k0] = last; else { last = ''; delete eh[k0]; } }
  var bring = function () { var t = all[i], k = t[0] + ':' + t[1]; if (last) eh[k] = last; else delete eh[k]; };
  var step = function (d) { i = (i + d + all.length) % all.length; bring(); show(); };
  // the effect: "Current effect" (none brought), "No effect", then the presets, round
  var pick = function (k, n) { touched = true; last = n || ''; if (n) eh[k] = n; else delete eh[k]; show(); };
  var stepFx = function (d) {
    var t = all[i], k = t[0] + ':' + t[1], on = eh[k] || '', ns = ['', '-'].concat(fx);
    if (on && ns.indexOf(on) < 0) ns.push(on);
    pick(k, ns[(ns.indexOf(on) + d + ns.length) % ns.length]);
  };
  var close = function (keep) {
    window.removeEventListener('keydown', onKey, true);
    watch.disconnect();
    __stTheme.chooserPut(null);
    bar.remove();
    if (!keep) { __stTheme.preview(null); return; }
    var t = all[i], p = {}; p[t[0]] = t[1];
    // the kept theme's effect only, and only once one was picked or the theme is another; what was picked for the others is dropped
    if (fx.length) {
      var map = {}, k = t[0] + ':' + t[1];
      Object.keys(th.eh || {}).forEach(function (x) { map[x] = th.eh[x]; });
      if (touched || k !== k0) { if (eh[k]) map[k] = eh[k]; else delete map[k]; }
      p.eh = map;
    }
    // the mode follows the kept theme only when it was fixed light or dark
    if (th.mode === 'light' || th.mode === 'dark') p.mode = t[0];
    __stTheme.set(p);
    if (__stTheme.variant() !== t[0]) try { U.mbuToast('✓ ' + t[1] + ' is your ' + t[0] + ' theme; this page stays ' + __stTheme.variant()); } catch (e) { /* no toast */ }
  };
  var onKey = function (e) {
    var a = document.activeElement;
    if (a && a.id === 'st-tc-e' && e.key !== 'Escape') return;   // the effect's own keys while it's open
    if (a && a.closest && a.closest('#eh-cfg')) return;   // Event Horizon's settings, opened by the pencil, keep their keys
    if (a && a !== document.body && !bar.contains(a) && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
    // Enter and Esc focused elsewhere (a link, a popup's button) are theirs: Esc closes the popup, not the chooser
    var away = a && a !== document.body && a !== html && !bar.contains(a);
    if (away && (e.key === 'Enter' || e.key === 'Escape')) return;
    // left and right step the themes, up and down the effect; with no effects, all four the themes
    if (fx.length && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) stepFx(e.key === 'ArrowUp' ? -1 : 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step(-1);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1);
    else if (e.key === 'Enter') close(true);
    else if (e.key === 'Escape') close(false);
    else return;
    e.preventDefault(); e.stopPropagation();
  };
  window.addEventListener('keydown', onKey, true);
  bar.querySelector('#st-tc-f').onclick = filter;
  // the counts step too: a click to the next, a right-click to the previous
  var count = function (el, go) {
    if (!el) return;
    el.onclick = function () { go(1); };
    el.oncontextmenu = function (e) { e.preventDefault(); go(-1); };
  };
  count(bar.querySelector('[data-th-i]'), step);
  count(bar.querySelector('[data-fx-i]'), stepFx);
  bar.querySelector('#st-tc-k').onclick = function () { close(true); };
  bar.querySelector('#st-tc-x').onclick = function () { close(false); };
  // the pencil: Event Horizon's settings open on Effects (or switch to it, open already); the chooser stays, and
  // a preset saved there joins its list when it's next shown
  if (fx.length) bar.querySelector('#st-tc-ed').onclick = function () {
    // the effect on show stays on, so the tab opens on it
    var on = eh[all[i][0] + ':' + all[i][1]] || '';
    if (on) html.setAttribute('data-st-eh-fx-edit', on);
    if (!document.getElementById('eh-cfg')) document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: 'event_horizon', cancelable: true }));
    var tab = document.querySelector('#eh-cfg [data-tab=effects]');
    if (tab) tab.click();
  };
  // picked, it's shown at once, and the arrows step the themes again
  if (fx.length) bar.querySelector('#st-tc-e').onchange = function (e) {
    var t = all[i];
    e.target.blur();
    pick(t[0] + ':' + t[1], e.target.value);
  };
  show();
}
