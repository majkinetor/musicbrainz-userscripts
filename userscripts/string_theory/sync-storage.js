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
    io.gm.set('string_theory.sync.stage', { before: before, after: filter(data) });
  }
  function apply(data) {
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
    data = filter(data);
    write('gm', io.gm, data.gm);
    if (origin && D.own(data.local, origin)) write('local', io.local, data.local[origin]);
  }
  function applyPending() {
    var pending = io.gm.get('string_theory.sync.stage');
    if (!pending) return false;
    var data = effective();
    apply(data);
    delete pending.before.local[origin]; delete pending.after.local[origin];
    if (Object.keys(pending.after.local).length) {
      // Keep the other origins' pending settings until a page on each origin can apply them.
      var actual = capture(); pending.before.gm = actual.gm; pending.after.gm = actual.gm;
      io.gm.set('string_theory.sync.stage', pending);
    } else io.gm.del('string_theory.sync.stage');
    return true;
  }
  function pending() {
    if (!io.gm.get('string_theory.sync.stage')) return false;
    var actual = capture(), target = effective();
    return D.stable(actual.gm) !== D.stable(target.gm) || origin && D.stable(actual.local[origin]) !== D.stable(target.local[origin]);
  }
  function document(data) { return { format: 'string-theory-sync', version: 1, at: Date.now(), data: data }; }
  function read(text) {
    if (text.length > 10 * 1024 * 1024) throw new Error('Backup exceeds 10 MB');
    return filter(D.validate(JSON.parse(text)).data);
  }
  return { capture: capture, effective: effective, merge: merge, stage: stage, apply: apply, applyPending: applyPending, pending: pending, document: document, read: read, filter: filter };
}
var stSyncStorage;
function stSyncStorageInit() {
  var origin = /^https:\/\/(?:musicbrainz\.org|(?:beta|test)\.musicbrainz\.org)$/.test(location.origin) ? location.origin : null;
  stSyncStorage = stSyncStore({
    origin: origin,
    gm: { keys: function () { return GM_listValues(); }, get: function (k) { return GM_getValue(k); }, set: function (k, v) { GM_setValue(k, v); }, del: function (k) { GM_deleteValue(k); } },
    local: { keys: function () { return Object.keys(localStorage); }, get: function (k) { var v = localStorage.getItem(k); return v === null ? undefined : v; }, set: function (k, v) { localStorage.setItem(k, String(v)); }, del: function (k) { localStorage.removeItem(k); } },
  });
  if (origin) try { stSyncStorage.applyPending(); } catch (e) { console.error('[String Theory] sync could not apply saved changes; recovery retained'); }
}
// A member may keep a settings object alive in a second tab. Preserve remote changes to fields
// that member hasn't edited, rather than saving its stale whole object over a newly synced value.
function __stSyncGuard() {
  var seen = Object.create(null), D = stSyncData;
  var copy = function (v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); };
  return {
    get: function (k, def) { var v = GM_getValue(k); if (stSyncAllow('gm', k, [])) seen[k] = copy(v); return v === undefined ? def : v; },
    set: function (k, v) {
      if (stSyncAllow('gm', k, []) && D.own(seen, k)) {
        var b = D.decode(seen[k]), l = D.decode(v), r = D.decode(GM_getValue(k));
        v = D.encode({ encoding: l.encoding, value: D.merge(b.value, l.value, r.value, 'local', function (p) { return k === 'view' && p.join('.') === 'stars' ? 'key' : null; }) });
      }
      GM_setValue(k, v); if (stSyncAllow('gm', k, [])) seen[k] = copy(v);
    },
  };
}
