// The IO boundary is injectable so two device stores can exercise real capture/apply/merge paths.
function stSyncStore(io) {
  var D = stSyncData, origin = io.origin;
  function allowed(kind, key) { return function (p) { return stSyncAllow(kind, key, p); }; }
  function entry(kind, key, raw) {
    if (!stSyncAllow(kind, key, []) || raw === undefined) return undefined;
    var e = D.decode(raw), p = D.project(e.value, allowed(kind, key));
    return p === undefined ? undefined : { encoding: e.encoding, value: p };
  }
  function capture() {
    var data = { gm: {}, local: {} };
    io.gm.keys().forEach(function (key) { var e = entry('gm', key, io.gm.get(key)); if (e) data.gm[key] = e; });
    if (origin) {
      data.local[origin] = {};
      io.local.keys().forEach(function (key) { var e = entry('local', key, io.local.get(key)); if (e) data.local[origin][key] = e; });
    }
    D.safe(data);
    return data;
  }
  function filter(data) {
    var out = { gm: {}, local: {} };
    Object.keys(data.gm).forEach(function (k) { var e = data.gm[k]; if (stSyncAllow('gm', k, [])) out.gm[k] = { encoding: e.encoding, value: D.project(e.value, allowed('gm', k)) }; });
    Object.keys(data.local).forEach(function (o) {
      out.local[o] = {};
      Object.keys(data.local[o]).forEach(function (k) { var e = data.local[o][k]; if (stSyncAllow('local', k, [])) out.local[o][k] = { encoding: e.encoding, value: D.project(e.value, allowed('local', k)) }; });
    });
    return out;
  }
  function merge(base, local, remote, policy, conflicts) {
    // localStorage for another MB origin isn't a deletion just because this page can't see it.
    var l = { gm: local.gm, local: Object.assign({}, base && base.local || {}, local.local) };
    return D.merge(base, l, remote, policy, function (p) { return p.join('.') === 'gm.view.value.stars' ? 'key' : null; }, [], conflicts);
  }
  function effective() {
    var data = capture(), stage = io.gm.get('string_theory.sync.stage');
    if (!stage) return data;
    var result = merge(stage.before, data, stage.after, 'local');
    // This origin wasn't open when another origin downloaded its settings. There is no local
    // observation to compare against yet, so let that downloaded value win shared fields once.
    if (origin && !D.own(stage.before.local, origin) && D.own(stage.after.local, origin)) {
      result.local[origin] = D.merge(undefined, data.local[origin], stage.after.local[origin], 'remote');
    }
    return result;
  }
  function stage(data) {
    var before = capture();
    io.gm.set('string_theory.sync.recovery', document(effective()));
    pendingMemo = null, io.gm.set('string_theory.sync.stage', { before: before, after: filter(data) });
  }
  function write(kind, storage, incoming) {
      var currentKeys = storage.keys().filter(function (k) { return stSyncAllow(kind, k, []); });
      D.keys(Object.fromEntries(currentKeys.map(function (k) { return [k, true]; })), incoming).forEach(function (k) {
        if (!stSyncAllow(kind, k, [])) return;
        var raw = storage.get(k), before = raw === undefined ? undefined : D.decode(raw), next = incoming[k];
        var value = D.overlay(before && before.value, next && next.value, allowed(kind, k), [], function (p) { return kind === 'gm' && k === 'view' && p.join('.') === 'stars' ? 'key' : null; });
        if (value === undefined) storage.del(k);
        else {
          var encoded = D.encode({ encoding: next ? next.encoding : before.encoding, value: value });
          if (D.stable(encoded) !== D.stable(raw)) storage.set(k, encoded);
        }
      });
  }
  function apply(data) {
    data = filter(data);
    write('gm', io.gm, data.gm);
    if (origin && D.own(data.local, origin)) write('local', io.local, data.local[origin]);
  }
  function othersOnly(stage) { return origin && !D.own(stage.after.local, origin) && !D.own(stage.before.local, origin) && D.stable(stage.before.gm) === D.stable(stage.after.gm); }
  function applyPending() {
    var pending = io.gm.get('string_theory.sync.stage');
    if (!pending) return false;
    // Only other origins wait: nothing here to apply, and the merge below costs a whole capture.
    if (othersOnly(pending)) return false;
    var data = effective();
    apply(data);
    delete pending.before.local[origin]; delete pending.after.local[origin];
    if (Object.keys(pending.after.local).length) {
      // Keep the other origins' pending settings until a page on each origin can apply them.
      // gm is applied: an empty before and after leave it to this page's values
      pending.before.gm = {}; pending.after.gm = {};
      pendingMemo = null, io.gm.set('string_theory.sync.stage', pending);
    } else pendingMemo = null, io.gm.del('string_theory.sync.stage');
    return true;
  }
  // #1095: what a page load does, so it must stay cheap. The tab that synced applied gm and its
  // own origin; this page applies only the localStorage that waits for its origin, and reads
  // only its own keys. A gm part left over (a tab closed mid-apply) waits for the next sync.
  function applyLocal() {
    var pending = io.gm.get('string_theory.sync.stage');
    if (!pending || !origin || !(D.own(pending.after.local, origin) || D.own(pending.before.local, origin))) return false;
    var now = {};
    io.local.keys().forEach(function (key) { var e = entry('local', key, io.local.get(key)); if (e) now[key] = e; });
    var to = pending.after.local[origin] || {};
    var result = D.own(pending.before.local, origin) ? D.merge(pending.before.local[origin], now, to, 'local') : D.merge(undefined, now, to, 'remote');
    write('local', io.local, result);
    delete pending.before.local[origin]; delete pending.after.local[origin];
    pendingMemo = null;
    if (Object.keys(pending.after.local).length || D.stable(pending.before.gm) !== D.stable(pending.after.gm)) io.gm.set('string_theory.sync.stage', pending);
    else io.gm.del('string_theory.sync.stage');
    return true;
  }
  // the merge is slow, and the stage changes only when this script writes it
  var pendingMemo = null;
  function pending() {
    if (pendingMemo !== null) return pendingMemo;
    var stage = io.gm.get('string_theory.sync.stage');
    if (!stage || othersOnly(stage)) return pendingMemo = false;
    var actual = capture(), target = effective();
    return pendingMemo = D.stable(actual.gm) !== D.stable(target.gm) || origin && D.stable(actual.local[origin]) !== D.stable(target.local[origin]);
  }
  function document(data) { return { format: 'string-theory-sync', version: 1, at: Date.now(), data: data }; }
  function read(text, info) {
    if (text.length > 10 * 1024 * 1024) throw new Error('Backup exceeds 10 MB');
    var data = D.validate(JSON.parse(text)).data, filtered = filter(data);
    if (info) info.filtered = D.stable(filtered) !== D.stable(data);
    return filtered;
  }
  return { capture: capture, effective: effective, merge: merge, stage: stage, apply: apply, applyPending: applyPending, applyLocal: applyLocal, pending: pending, document: document, read: read, filter: filter };
}
var stSyncStorage;
function stSyncStorageInit() {
  var origin = /^https:\/\/(?:musicbrainz\.org|(?:beta|test)\.musicbrainz\.org)$/.test(location.origin) ? location.origin : null;
  stSyncStorage = stSyncStore({
    origin: origin,
    gm: { keys: function () { return GM_listValues(); }, get: function (k) { return GM_getValue(k); }, set: function (k, v) { __stGuardNote(k); GM_setValue(k, v); }, del: function (k) { __stGuardNote(k); GM_deleteValue(k); } },
    local: { keys: function () { return Object.keys(localStorage); }, get: function (k) { var v = localStorage.getItem(k); return v === null ? undefined : v; }, set: function (k, v) { localStorage.setItem(k, String(v)); }, del: function (k) { localStorage.removeItem(k); } },
  });
  if (!origin || window.top !== window || /[?&]st-(?:dropbox|google)=callback(?:&|$)/.test(location.search || '')) return;
  // Only this origin's waiting localStorage, when the page is idle (#1095). A stage that fails
  // once fails on every load: drop it.
  var run = function () { try { stSyncStorage.applyLocal(); } catch (e) { GM_deleteValue('string_theory.sync.stage'); console.error('[String Theory] sync could not apply saved changes; recovery retained', e); } };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 10000 }); else setTimeout(run, 3000);
}
// A member may keep a settings object alive in a second tab. Preserve remote changes to fields
// that member hasn't edited, rather than saving its stale whole object over a newly synced value.
// A read or a save must cost nothing more than the plain GM call: a change listener notes when
// another writer changes a key, and only the next save of that key merges, against the value the
// key had before that change (what this member last read or wrote).
// sync's own writes in this tab are not remote: they tell every guard here before they write
var __stGuards = [];
function __stGuardNote(k) { if (!__stGuards.length) return; var old = GM_getValue(k); __stGuards.forEach(function (b) { if (!stSyncData.own(b, k)) b[k] = old; }); }
function __stSyncGuard() {
  var D = stSyncData, allow = Object.create(null), listen = Object.create(null), base = Object.create(null);
  __stGuards.push(base);
  var ok = function (k) { return k in allow ? allow[k] : (allow[k] = stSyncAllow('gm', k, [])); };
  var watch = function (k) {
    if (listen[k]) return; listen[k] = true;
    GM_addValueChangeListener(k, function (name, old, now, remote) {
      if (!remote) return;   // this tab's write: the guard is for another tab's (#885)
      if (!D.own(base, k)) base[k] = old;
    });
  };
  if (typeof GM_addValueChangeListener !== 'function') {
    // no change events: the old way, a copy on each read and a merge on each save
    var seen = Object.create(null), copy = function (v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
    watch = function (k) { if (!D.own(seen, k)) seen[k] = copy(GM_getValue(k)); };
    var oldSet = function (k) { if (D.own(seen, k)) base[k] = seen[k]; };
  }
  return {
    get: function (k, def) { var v = GM_getValue(k); if (ok(k)) { if (seen) seen[k] = copy(v); else watch(k); } return v === undefined ? def : v; },
    set: function (k, v) {
      if (ok(k)) {
        if (seen) oldSet(k); else watch(k);
        if (D.own(base, k)) {
          var b = D.decode(base[k]), l = D.decode(v), r = D.decode(GM_getValue(k));
          v = D.encode({ encoding: l.encoding, value: D.merge(b.value, l.value, r.value, 'local', function (p) { return k === 'view' && p.join('.') === 'stars' ? 'key' : null; }) });
          delete base[k];
        }
      }
      GM_setValue(k, v);
      if (seen && ok(k)) seen[k] = copy(v);
    },
  };
}
