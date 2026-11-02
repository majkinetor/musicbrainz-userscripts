// Storage projection and three-way merge for String Theory's external storage (#885).
// Included by build.mjs before the sync runtime; pure helpers are also exercised in Node.
var stSyncData = (function () {
  var own = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var object = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); };
  var keys = function () {
    var out = Object.create(null);
    Array.prototype.forEach.call(arguments, function (o) { if (object(o)) Object.keys(o).forEach(function (k) { out[k] = true; }); });
    return Object.keys(out).sort();
  };
  function stable(v) {
    if (v === undefined) return 'undefined';
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (object(v)) return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
    return JSON.stringify(v);
  }
  function safe(v, depth) {
    if ((depth || 0) > 64) throw new Error('Backup is nested too deeply');
    if (object(v) || Array.isArray(v)) Object.keys(v).forEach(function (k) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') throw new Error('Backup contains an unsafe property');
      safe(v[k], (depth || 0) + 1);
    });
    else if (v !== null && typeof v !== 'string' && typeof v !== 'boolean' && (typeof v !== 'number' || !isFinite(v))) throw new Error('Backup contains an invalid value');
    return v;
  }
  function decode(v) {
    if (typeof v === 'string' && /^\s*[\[{]/.test(v)) {
      try { return { encoding: 'json', value: JSON.parse(v) }; } catch (e) { /* ordinary text */ }
    }
    return { encoding: 'value', value: v };
  }
  function encode(entry) { return entry.encoding === 'json' ? JSON.stringify(entry.value) : entry.value; }
  // The predicate sees the storage kind, key and nested field path. Arrays remain atomic unless
  // their owner supplies an identity (stars); a column order must never become a union of orders.
  function project(value, allow, path) {
    path = path || [];
    if (!allow(path, value)) return undefined;
    if (Array.isArray(value)) return value.map(function (v, i) { return project(v, allow, path.concat(String(i))); });
    if (!object(value)) return value;
    var out = {};
    Object.keys(value).forEach(function (k) { var v = project(value[k], allow, path.concat(k)); if (v !== undefined) out[k] = v; });
    return out;
  }
  // Overlay only portable fields, including their deletion. A receiving device keeps its own
  // excluded fields even when they live beside portable data in one JSON-encoded GM value.
  function overlay(current, incoming, allow, path, identity) {
    path = path || [];
    if (!allow(path, incoming)) return current;
    var id = identity && identity(path);
    if (id && Array.isArray(current) && Array.isArray(incoming)) {
      var previous = Object.create(null);
      current.forEach(function (v) { if (v && typeof v[id] === 'string') previous[v[id]] = v; });
      return incoming.map(function (v, i) { return overlay(previous[v[id]], v, allow, path.concat(String(i)), identity); });
    }
    if (object(current) && (object(incoming) || incoming === undefined)) {
      var out = {};
      keys(current, incoming).forEach(function (k) {
        var v = overlay(current[k], incoming && incoming[k], allow, path.concat(k), identity);
        if (v !== undefined) out[k] = v;
      });
      return Object.keys(out).length || incoming !== undefined ? out : undefined;
    }
    return incoming;
  }
  function merge(base, local, remote, policy, identity, path, conflicts) {
    path = path || []; conflicts = conflicts || [];
    if (stable(local) === stable(remote)) return local;
    if (stable(base) === stable(local)) return remote;
    if (stable(base) === stable(remote)) return local;
    if (object(local) && object(remote) && (object(base) || base === undefined)) {
      var out = {};
      keys(base, local, remote).forEach(function (k) {
        var v = merge(base && base[k], local[k], remote[k], policy, identity, path.concat(k), conflicts);
        if (v !== undefined) out[k] = v;
      });
      return out;
    }
    var id = identity && identity(path);
    if (id && Array.isArray(local) && Array.isArray(remote) && (Array.isArray(base) || base === undefined)) {
      var index = function (list) {
        var out = Object.create(null);
        (list || []).forEach(function (v) { var k = v && v[id]; if (typeof k !== 'string' || !k || own(out, k)) throw new Error('Invalid or duplicate saved item'); out[k] = v; });
        return out;
      };
      var b = index(base), l = index(local), r = index(remote), result = merge(b, l, r, policy, null, path, conflicts);
      var order = remote.concat(local).map(function (v) { return v[id]; }).filter(function (k, i, a) { return a.indexOf(k) === i; });
      return order.filter(function (k) { return own(result, k); }).map(function (k) { return result[k]; });
    }
    conflicts.push(path);
    return policy === 'local' ? local : remote;
  }
  function validate(doc) {
    safe(doc);
    if (!object(doc) || doc.format !== 'string-theory-sync' || doc.version !== 1 || !object(doc.data) || !object(doc.data.gm) || !object(doc.data.local)) throw new Error('Not a supported String Theory backup');
    function entries(o) {
      Object.keys(o).forEach(function (k) {
        var e = o[k];
        if (!object(e) || (e.encoding !== 'json' && e.encoding !== 'value') || !own(e, 'value')) throw new Error('Invalid backup entry');
        if (e.encoding === 'json' && !object(e.value) && !Array.isArray(e.value)) throw new Error('Invalid encoded backup entry');
      });
    }
    entries(doc.data.gm);
    if (own(doc.data.gm, 'view')) {
      var view = doc.data.gm.view.value;
      if (!object(view)) throw new Error('Invalid Event Horizon settings');
      if (own(view, 'stars')) {
        if (!Array.isArray(view.stars)) throw new Error('Invalid starred entities');
        var ids = Object.create(null);
        view.stars.forEach(function (v) {
          if (!object(v) || typeof v.key !== 'string' || !v.key || own(ids, v.key)) throw new Error('Invalid or duplicate starred entity');
          ids[v.key] = true;
        });
      }
    }
    Object.keys(doc.data.local).forEach(function (origin) {
      if (!/^https:\/\/(?:musicbrainz\.org|(?:beta|test)\.musicbrainz\.org)$/.test(origin) || !object(doc.data.local[origin])) throw new Error('Invalid backup origin');
      entries(doc.data.local[origin]);
      Object.keys(doc.data.local[origin]).forEach(function (k) { var e = doc.data.local[origin][k]; if (e.encoding === 'value' && typeof e.value !== 'string') throw new Error('Invalid local storage entry'); });
    });
    return doc;
  }
  return { own: own, object: object, keys: keys, stable: stable, safe: safe, decode: decode, encode: encode, project: project, overlay: overlay, merge: merge, validate: validate };
})();
