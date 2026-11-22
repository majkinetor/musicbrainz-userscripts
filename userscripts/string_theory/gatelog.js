// Gate log: every request through the shared MusicBrainz gate (dev/net/mb-gate.mjs), from every
// script and tab, and the gate's state, live. It is for telling MusicBrainz's own load apart from
// ours: the gate's mbnTrace keeps each tab's last events in localStorage (mbu:mb-gate-trace:<tab>).
//
// The window floats like the Activity log: dragged by its title bar, minimised to it, resized by
// its corner, and its open, minimised, full-screen, place and size are remembered (GM, ST_GATE_WIN),
// so a reload brings it back as it was (stGateReopen). The events are grouped into requests
// (stGateGroups): one row per request, its tries, result, wait and rate limit, and a click opens
// its steps. Above the rows, the last 60 s as one lane per tab, with MusicBrainz's holds shaded.
var ST_GATE_KEY = 'mbu:mb-gate', ST_GATE_PRE = 'mbu:mb-gate-trace:', ST_GATE_WIN = 'st:gatelog-win';
var ST_GATE_SPAN = 60000, ST_GATE_RETRY = 2500;   // the lanes' span; a retry follows its 429/503 within this
var stGateWin = null;
var ST_GATE_CSS = ''
  + '#st-gate{position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:var(--mbu-z-modal);display:flex;flex-direction:column;'
  + 'width:min(1100px,96vw);height:min(78vh,760px);background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:11px;'
  + 'box-shadow:var(--mbu-shadow-lg);font:13px/1.45 var(--mbu-font);color:var(--mbu-text);text-align:left;overflow:hidden}'
  + '#st-gate .mbu-logpop-h b{font-weight:600}#st-gate .st-gate-n{color:var(--mbu-text-weak);font-size:12px}'
  // minimised: the title bar only, docked at the bottom left
  + '#st-gate.min{height:auto!important;width:auto!important}'
  + '#st-gate.min>:not(.mbu-logpop-h),#st-gate.min .mbu-logpop-h>:not(b):not(.st-gate-n):not(.mbu-logpop-min){display:none}'
  + '#st-gate.full{top:12px!important;left:12px!important;right:12px!important;bottom:12px!important;width:auto!important;height:auto!important;transform:none!important}'
  + '#st-gate.full .mbu-logpop-h{cursor:default}#st-gate.full .mbu-logpop-grip{display:none}'
  // the gate's state, as chips
  + '#st-gate-state{display:flex;flex-wrap:wrap;gap:6px;padding:8px 13px 0}'
  + '#st-gate-state>span{white-space:nowrap;padding:2px 9px;border-radius:999px;background:var(--mbu-bg-hover);font-size:12px}'
  + '#st-gate-state .k{color:var(--mbu-text-weak)}#st-gate-state b{font-weight:600}'
  + '#st-gate-state .hot{background:var(--mbu-error-bg);color:var(--mbu-error)}'
  // the totals and the lanes
  + '#st-gate-sum{padding:8px 13px 2px;color:var(--mbu-text-weak);font-size:12px}#st-gate-sum b{color:var(--mbu-text);font-weight:600}'
  + '#st-gate-sum .bad b{color:var(--mbu-error)}#st-gate-sum .re b{color:var(--mbu-warn)}'
  + '#st-gate-lanes{position:relative;flex:0 0 auto;margin:4px 13px 8px;padding-left:180px}'
  + '.st-gl-bands{position:absolute;top:0;bottom:16px;left:180px;right:0}'
  + '.st-gl-band{position:absolute;top:0;bottom:0;background:var(--mbu-error-bg)}'
  + '.st-gl-lane{position:relative;height:30px;border-top:1px solid var(--mbu-divider)}'
  + '.st-gl-name{position:absolute;left:-180px;width:172px;top:0;line-height:30px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--mbu-text-weak)}'
  + '.st-gl-name b{color:var(--mbu-text);font-weight:600}.st-gl-lane.me .st-gl-name b{color:var(--mbu-accent-text)}'
  + '.st-gl-w,.st-gl-f{position:absolute;top:5px;height:20px;min-width:5px;border-radius:3px;box-shadow:inset 1px 0 0 var(--mbu-bg)}.st-gl-w:hover,.st-gl-f:hover{filter:brightness(1.25)}'
  + '.st-gl-w{background:var(--mbu-border)}.st-gl-f{background:var(--mbu-ok)}.st-gl-f.bad{background:var(--mbu-error)}.st-gl-f.re{background:var(--mbu-warn)}.st-gl-f.go{background:var(--mbu-info)}'
  + '.st-gl-ax{position:relative;height:16px;border-top:1px solid var(--mbu-border-soft);font-size:11px;color:var(--mbu-text-weak)}'
  + '.st-gl-ax span{position:absolute;top:1px;transform:translateX(-50%);white-space:nowrap}.st-gl-ax span:first-child{transform:none}.st-gl-ax span:last-child{transform:translateX(-100%)}'
  + '.st-gl-none{line-height:30px;font-size:12px;color:var(--mbu-text-weak)}'
  // the filter row
  + '#st-gate-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:0 13px 8px}'
  + '#st-gate-q{flex:0 1 260px;min-width:120px;min-height:30px;box-sizing:border-box}'
  + '.st-gate-seg{display:inline-flex;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);overflow:hidden}'
  + '.st-gate-seg button,#st-gate-mine{min-height:30px;padding:0 11px;border:0;background:none;color:var(--mbu-accent-text);font:inherit;font-size:12px;cursor:pointer}'
  + '.st-gate-seg button+button{border-left:1px solid var(--mbu-border)}'
  + '.st-gate-seg button:hover,#st-gate-mine:hover{background:var(--mbu-bg-hover)}'
  + '.st-gate-seg button[aria-pressed=true],#st-gate-mine[aria-pressed=true]{background:var(--mbu-accent-soft)}'
  + '#st-gate-mine{border:1px solid var(--mbu-border);border-radius:var(--mbu-radius)}'
  // the requests
  + '#st-gate-body{flex:1 1 auto;min-height:0;overflow:auto;scrollbar-width:thin;scrollbar-color:var(--mbu-border) transparent;border-top:1px solid var(--mbu-border-soft)}'
  + '#st-gate table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}'
  + '#st-gate th{position:sticky;top:0;z-index:1;background:var(--mbu-bg);text-align:left;font-weight:600;font-size:12px;padding:5px 8px;border-bottom:1px solid var(--mbu-border)}'
  + '#st-gate td{padding:4px 8px;border-bottom:1px solid var(--mbu-divider);vertical-align:middle}'
  + '#st-gate tr.rq{cursor:pointer}#st-gate tr.rq:hover td,#st-gate tr.rq.open td{background:var(--mbu-bg-hover)}'
  + '#st-gate tr.sys td{color:var(--mbu-text-weak)}'
  + '#st-gate td.t,#st-gate td.tab,#st-gate td.w{white-space:nowrap;color:var(--mbu-text-weak)}#st-gate tr.me td.tab{color:var(--mbu-accent-text)}'
  + '#st-gate td.s{white-space:nowrap}#st-gate td.l{overflow-wrap:anywhere;font-family:var(--mbu-font-mono);font-size:12px}'
  + '#st-gate .i{color:var(--mbu-text-weak);font-size:11px}'
  + '.st-gate-tries{display:inline-flex;gap:3px;vertical-align:middle}.st-gate-tries i{width:10px;height:10px;border-radius:2px;background:var(--mbu-border)}'
  + '.st-gate-tries i.ok{background:var(--mbu-ok)}.st-gate-tries i.re{background:var(--mbu-warn)}.st-gate-tries i.bad{background:var(--mbu-error)}.st-gate-tries i.go{background:var(--mbu-info)}'
  + '.st-gate-pill{display:inline-block;padding:0 8px;border-radius:999px;font-size:12px;white-space:nowrap;background:var(--mbu-bg-hover)}'
  + '.st-gate-pill.ok{background:var(--mbu-ok-bg);color:var(--mbu-ok)}.st-gate-pill.re{background:var(--mbu-warn-bg);color:var(--mbu-warn)}'
  + '.st-gate-pill.bad{background:var(--mbu-error-bg);color:var(--mbu-error)}.st-gate-pill.go{background:var(--mbu-info-bg);color:var(--mbu-info)}'
  + '.st-gate-meter{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;font-size:12px;color:var(--mbu-text-weak)}'
  + '.st-gate-meter span{display:inline-block;width:48px;height:5px;border-radius:3px;background:var(--mbu-divider);overflow:hidden}.st-gate-meter span i{display:block;height:100%;background:var(--mbu-ok)}'
  + '.st-gate-meter.low span i{background:var(--mbu-warn)}.st-gate-meter.out span i{background:var(--mbu-error)}'
  + '#st-gate tr.steps td{padding:4px 8px 10px 28px;background:var(--mbu-bg-hover)}'
  + '#st-gate tr.steps ol{margin:0;padding:0;list-style:none;font-size:12px}#st-gate tr.steps li{display:flex;gap:10px}'
  + '#st-gate tr.steps li .t{color:var(--mbu-text-weak);white-space:nowrap}#st-gate tr.steps li .e{min-width:56px;font-weight:600}#st-gate tr.steps li.bad .e{color:var(--mbu-error)}'
  + '.st-gl-req{position:relative;margin:2px 0 8px;max-width:640px}.st-gl-req .st-gl-lane{border-top:0;background:var(--mbu-bg)}.st-gl-req .st-gl-ax span:nth-child(2){transform:translateX(-50%)}'
  + '#st-gate td.none{padding:24px;text-align:center;color:var(--mbu-text-weak)}'
  // a phone: the whole screen, whatever was saved
  + '@media (max-width:600px){#st-gate,#st-gate.full{top:0!important;left:0!important;right:0!important;bottom:0!important;width:auto!important;height:auto!important;transform:none!important;border-radius:0;border:0}'
  + '#st-gate .mbu-logpop-full,#st-gate .mbu-logpop-min,#st-gate .mbu-logpop-grip{display:none}#st-gate .mbu-logpop-h{cursor:default;flex-wrap:wrap}'
  + '#st-gate-lanes{padding-left:90px}.st-gl-bands{left:90px}.st-gl-name{left:-90px;width:84px}}';

function stGateState() { try { return JSON.parse(localStorage.getItem(ST_GATE_KEY) || 'null') || {}; } catch (e) { return {}; } }
function stGateTab() { try { return sessionStorage.getItem(ST_GATE_KEY + '-tab') || ''; } catch (e) { return ''; } }
// every tab's events, oldest first, each with its tab id
function stGateEvents() {
  var out = [];
  // this tab's newest events wait in memory up to a second (mbnTrace): write them first
  try { if (globalThis.__mbnTrace && globalThis.__mbnTrace.flush) globalThis.__mbnTrace.flush(); } catch (e) { /* none yet */ }
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k || k.indexOf(ST_GATE_PRE) !== 0) continue;
      var tab = k.slice(ST_GATE_PRE.length), l = [];
      try { l = JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { /* broken: skip */ }
      if (Array.isArray(l)) l.forEach(function (ev) { if (ev && ev.t) { ev.tab = tab; out.push(ev); } });
    }
  } catch (e) { /* no storage */ }
  return out.sort(function (a, b) { return a.t - b.t; });
}
function stGateSec(ms) { return Math.round((+ms || 0) / 100) / 10 + 's'; }
function stGateTime(t) {
  var d = new Date(t), p = function (n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; };
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + '.' + p(d.getMilliseconds(), 3);
}
// what one event says, in words
function stGateWhat(ev) {
  var x = [];
  switch (ev.e) {
    case 'book': x.push('waits ' + stGateSec(ev.w) + (ev.why === 'hold' ? ' (MusicBrainz hold)' : ' (pacing)')); if (ev.q) x.push(ev.q + ' queued'); if (ev.re) x.push('booked again after a hold'); break;
    case 'start': if (ev.w) x.push('after ' + stGateSec(ev.w)); break;
    case 'hidden': x.push('waits up to ' + stGateSec(ev.w) + ' for the queue to be free (this tab is hidden)'); break;
    case 'lead': x.push('waits up to ' + stGateSec(ev.w) + ' for a page being drawn (' + (ev.by || '?') + ')'); break;
    case 'lead+': x.push('takes the lead for ' + stGateSec(ev.w) + ' (' + (ev.by || '?') + ')'); break;
    case 'lead-': x.push('ends the lead (' + (ev.by || '?') + ')'); break;
    case 'cancel': x.push('cancelled after ' + stGateSec(ev.w)); break;
    case 'join': x.push('a request that covers this one is already on its way' + (ev.with ? ' (' + ev.with + ')' : '') + ': shares its answer'); break;
    case 'merge': x.push('asks together with a waiting request' + (ev.with ? ' (' + ev.with + ')' : '') + (ev.add ? ', which adds ' + ev.add : '') + ': one answer for both'); break;
    case 'cache': x.push('answered from the cache (' + (ev.w || 0) + 's old): no request'); break;
    case 'error': x.push(ev.err || 'network error'); break;
    case 'check': x.push('browser check ' + (ev.ok ? 'passed' : 'failed') + ' in ' + stGateSec(ev.w)); break;
    case 'answer':
      x.push('HTTP ' + ev.st);
      if (ev.ra != null) x.push('Retry-After ' + ev.ra);
      if (ev.hold) x.push('everyone holds ' + stGateSec(ev.hold));
      if (ev.shold) x.push('searches hold ' + stGateSec(ev.shold));
      if (ev.hot) x.push('hot ' + ev.hot);
      if (ev.who || ev.rem != null || ev.lim) x.push('rate limit' + (ev.who ? ' ' + ev.who : '') + (ev.rem != null ? ', ' + ev.rem + ' left' : '') + (ev.lim ? ' of ' + ev.lim : '') + (ev.rst ? ', reset ' + ev.rst : ''));
      break;
  }
  return x.join(' · ');
}
function stGateBad(ev) { return ev.e === 'error' || (ev.e === 'check' && !ev.ok) || (ev.e === 'answer' && (ev.st === 429 || ev.st === 503 || ev.st >= 500 || !ev.st)); }
function stGateThrottled(st) { return st === 429 || st === 503; }
// one try's colour: on its way, ok, busy (retried) or failed
function stGateTryCls(st) { return st == null ? 'go' : st === -1 ? 'bad' : stGateThrottled(st) ? 're' : st >= 500 || !st ? 'bad' : 'ok'; }
function stGateTryTip(st) { return st == null ? 'On its way' : st === -1 ? 'Network error' : 'HTTP ' + st; }

// The events, grouped into requests. An event with an id (mbnRid) belongs to that request. One
// without (an older event, or a caller that gives none) goes by the run of events with the same
// tab, script, label and kind: it ends at an answer that is not a
// 429/503, at an error, a cancel, or a 429/503 that no retry follows within ST_GATE_RETRY (the gate
// books the retry at once). A join is a request of its own; an event without a label (the lead,
// the browser check) is a system row.
// A request: { id, tab, s, l, b, t, end, evs, tries: [{ t, w, st, end }], res, cls, label, wait }
//   cls: ok | re (answered after a retry) | bad | go (still on its way) | '' (shared, cancelled)
function stGateGroups(all, now) {
  var groups = [], open = {};
  var done = function (g, res) { g.res = res; delete open[g.key]; };
  all.forEach(function (ev) {
    if (!ev.l) { groups.push({ sys: true, id: 'y' + ev.tab + ev.t + ev.e, tab: ev.tab, s: ev.s, t: ev.t, end: ev.t, evs: [ev], tries: [] }); return; }
    var key = ev.tab + '|' + (ev.s || '') + '|' + (ev.id ? '#' + ev.id : ev.l + '|' + ev.b), g = open[key];
    if (g && g.pend && ev.t - g.pend > ST_GATE_RETRY) { done(g, 'gave up'); g = null; }
    if (ev.e === 'join' || ev.e === 'cache') { groups.push({ id: (ev.e === 'join' ? 'j' : 'c') + key + ev.t, key: key, tab: ev.tab, s: ev.s, l: ev.l, b: ev.b, t: ev.t, end: ev.t, evs: [ev], tries: [], res: ev.e === 'join' ? 'shared' : 'cached' }); return; }
    if (!g) { g = open[key] = { id: 'r' + key + ev.t, key: key, tab: ev.tab, s: ev.s, l: ev.l, b: ev.b, t: ev.t, end: ev.t, evs: [], tries: [] }; groups.push(g); }
    g.evs.push(ev); g.end = ev.t;
    if (ev.e !== 'answer') g.pend = 0;
    var last = g.tries[g.tries.length - 1];
    if (ev.e === 'start') g.tries.push({ t: ev.t, w: ev.w || 0 });
    else if (ev.e === 'answer') {
      if (last && last.st == null) { last.st = ev.st || 0; last.end = ev.t; } else g.tries.push({ t: ev.t, w: 0, st: ev.st || 0, end: ev.t });
      g.ans = ev;
      if (stGateThrottled(ev.st)) g.pend = ev.t; else done(g, String(ev.st || 'no status'));
    } else if (ev.e === 'error') { if (last && last.st == null) { last.st = -1; last.end = ev.t; } done(g, 'error'); }
    else if (ev.e === 'cancel') done(g, 'cancelled');
  });
  groups.forEach(function (g) {
    if (g.sys) { var y = g.evs[0]; g.cls = stGateBad(y) ? 'bad' : ''; g.label = y.e === 'check' ? (y.ok ? 'check passed' : 'check failed') : y.e; return; }
    if (!g.res) {
      if (g.pend) g.res = now - g.pend > ST_GATE_RETRY ? 'gave up' : 'retrying';
      else if (now - g.end > ST_GATE_SPAN) g.res = 'no answer';   // its tab went away mid-request
      else g.res = g.tries.length ? 'in flight' : 'waiting';
    }
    var st = g.ans ? g.ans.st : 0, retried = g.tries.length > 1;
    if (g.res === 'in flight' || g.res === 'waiting' || g.res === 'retrying') g.cls = 'go';
    else if (g.res === 'shared' || g.res === 'cancelled') g.cls = '';
    else if (g.res === 'gave up' || g.res === 'error' || g.res === 'no answer' || !st || st >= 500) g.cls = 'bad';
    else g.cls = retried ? 're' : 'ok';
    g.label = g.res === 'gave up' && st ? st + ', gave up' : g.res === '200' ? 'ok' : g.res;
    if (retried && g.cls !== 'go') g.label += ' after ' + g.tries.length + ' tries';
    g.wait = g.tries.reduce(function (n, x) { return n + (x.w || 0); }, 0);
  });
  return groups;
}
function stGateCount(groups) {
  var c = { n: 0, ok: 0, re: 0, bad: 0, go: 0 };
  groups.forEach(function (g) { if (g.sys) return; c.n++; if (c[g.cls] != null) c[g.cls]++; });
  return c;
}
// the totals line: every request kept, and those of the last 60 s
function stGateSumHtml(groups, now) {
  var all = stGateCount(groups), recent = groups.filter(function (g) { return now - g.t <= ST_GATE_SPAN; }), c = stGateCount(recent);
  var starts = recent.filter(function (g) { return !g.sys && g.tries.length; }).map(function (g) { return g.tries[0].t; }).sort(function (a, b) { return a - b; });
  var gap = starts.length > 1 ? (starts[starts.length - 1] - starts[0]) / (starts.length - 1) : 0;
  var tabs = {}; recent.forEach(function (g) { tabs[g.tab] = 1; });
  var n = Object.keys(tabs).length;
  return '<b>' + all.n + '</b> request' + (all.n === 1 ? '' : 's') + ' in the log · last 60 s: <b>' + c.n + '</b>'
    + (gap ? ' (one every ' + stGateSec(gap) + ')' : '') + ' · <b>' + c.ok + '</b> ok · <span class="re"><b>' + c.re + '</b> retried</span>'
    + ' · <span class="bad"><b>' + c.bad + '</b> failed</span>' + (c.go ? ' · <b>' + c.go + '</b> on the way' : '') + ' · from ' + n + ' tab' + (n === 1 ? '' : 's');
}
function stGateStateHtml(s, me) {
  var now = Date.now(), cool = (s.cool || 0) - now, q = Math.max(0, Math.round(((s.tat || 0) - now) / 1000)), iq = Math.max(0, Math.round(((s.itat || 0) - now) / 1000));
  var hot = now > (s.cool || 0) + 30000 ? 0 : (s.hot || 0), lead = s.lead && (s.leadUntil || 0) > now;
  var f = function (k, v, cls, tip) { return '<span' + (cls ? ' class="' + cls + '"' : '') + (tip ? ' data-tip="' + tip + '"' : '') + '><span class="k">' + k + '</span> <b>' + v + '</b></span>'; };
  return f('Hold', cool > 0 ? stGateSec(cool) + ' left' : 'none', cool > 0 ? 'hot' : '', 'Every tab waits\nMusicBrainz said it is busy')
    + f('Hot', hot + (s.hot && !hot ? ' (stale ' + s.hot + ')' : ''), hot ? 'hot' : '', 'Busy answers in a row\nEach one makes the next hold longer')
    + f('Background queue', q ? q + ' s ahead' : 'empty')
    + f('Interactive queue', iq ? iq + ' s ahead' : 'empty')
    + f('Lead', lead ? stEsc(String(s.lead).slice(0, 12)) + ', ' + stGateSec(s.leadUntil - now) + ' left' : 'none', '', 'A page being drawn goes first\nBackground requests wait for it')
    + f('This tab', stEsc(me || 'no requests yet'));
}
// the last 60 s: one lane per tab, a bar per try (its wait weak, its flight in its result's colour),
// and a band across every lane for each hold MusicBrainz asked for
function stGateLanesHtml(groups, all, now, me) {
  var t0 = now - ST_GATE_SPAN, pct = function (t) { return Math.max(0, Math.min(100, (t - t0) / ST_GATE_SPAN * 100)); };
  var bar = function (cls, a, b, tip) { return '<i class="' + cls + '"' + (tip ? ' data-tip="' + stEsc(tip) + '"' : '') + ' style="left:' + pct(a).toFixed(2) + '%;width:' + (pct(b) - pct(a)).toFixed(2) + '%"></i>'; };
  var lanes = {}, order = [];
  groups.forEach(function (g) {
    if (g.sys || (g.cls !== 'go' && g.end < t0)) return;
    if (!lanes[g.tab]) { lanes[g.tab] = { s: {}, bars: [] }; order.push(g.tab); }
    var L = lanes[g.tab], from = g.t;
    if (g.s) L.s[g.s] = 1;
    var who = (g.s ? g.s + '\n' : '') + g.l;
    g.tries.forEach(function (x) {
      var end = x.end || now;
      if (x.t > from) L.bars.push(bar('st-gl-w', from, x.t, who + '\nWaits in the gate'));
      L.bars.push(bar('st-gl-f ' + stGateTryCls(x.st), x.t, end, who + '\n' + stGateTryTip(x.st) + ' · ' + stGateSec(end - x.t)));
      from = end;
    });
    if (g.res === 'waiting') L.bars.push(bar('st-gl-w', from, now, who + '\nWaits in the gate'));
  });
  if (me && !lanes[me]) { lanes[me] = { s: {}, bars: [] }; order.push(me); }
  order.sort(function (a, b) { return (b === me) - (a === me); });   // this tab first
  var bands = all.filter(function (ev) { return ev.e === 'answer' && ev.hold && ev.t + ev.hold > t0; }).map(function (ev) {
    return bar('st-gl-band', ev.t, ev.t + ev.hold);
  }).join('');
  var rows = order.map(function (tab) {
    var s = Object.keys(lanes[tab].s).join(', ');
    return '<div class="st-gl-lane' + (tab === me ? ' me' : '') + '"><span class="st-gl-name" data-tip="' + stEsc('Tab ' + tab + (tab === me ? ' (this tab)' : '') + (s ? '\n' + s : '')) + '"><b>'
      + stEsc(tab === me ? 'This tab' : tab.slice(0, 8)) + '</b>' + (s ? ' ' + stEsc(s) : '') + '</span>' + lanes[tab].bars.join('') + '</div>';
  }).join('') || '<div class="st-gl-lane"><span class="st-gl-none">No requests in the last 60 s</span></div>';
  return '<div class="st-gl-bands">' + bands + '</div>' + rows
    + '<div class="st-gl-ax"><span style="left:0">−60 s</span><span style="left:25%">−45 s</span><span style="left:50%">−30 s</span><span style="left:75%">−15 s</span><span style="left:100%">now</span></div>';
}
// one request on its own time line: its gate waits weak, each try in its result's colour
function stGateReqLaneHtml(g, now) {
  if (!g.tries.length && g.res !== 'waiting') return '';
  var end = g.end;
  g.tries.forEach(function (x) { end = Math.max(end, x.end || now); });
  if (g.res === 'waiting') end = now;
  var span = Math.max(end - g.t, 1), pct = function (t) { return Math.max(0, Math.min(100, (t - g.t) / span * 100)); };
  var bar = function (cls, a, b, tip) { return '<i class="' + cls + '" data-tip="' + stEsc(tip) + '" style="left:' + pct(a).toFixed(2) + '%;width:' + (pct(b) - pct(a)).toFixed(2) + '%"></i>'; };
  var bars = [], from = g.t;
  g.tries.forEach(function (x, i) {
    var e = x.end || now;
    if (x.t > from) bars.push(bar('st-gl-w', from, x.t, 'Waits in the gate · ' + stGateSec(x.t - from)));
    bars.push(bar('st-gl-f ' + stGateTryCls(x.st), x.t, e, 'Try ' + (i + 1) + ': ' + stGateTryTip(x.st) + ' · ' + stGateSec(e - x.t)));
    from = e;
  });
  if (g.res === 'waiting') bars.push(bar('st-gl-w', from, now, 'Waits in the gate · ' + stGateSec(now - from)));
  return '<div class="st-gl-req"><div class="st-gl-lane">' + bars.join('') + '</div>'
    + '<div class="st-gl-ax"><span style="left:0">0</span><span style="left:50%">' + stGateSec(span / 2) + '</span><span style="left:100%">' + stGateSec(span) + '</span></div></div>';
}
function stGateRowHtml(g, me, isOpen, now) {
  var tab = '<td class="tab">' + stEsc(g.tab === me ? 'this tab' : String(g.tab).slice(0, 8)) + '</td>';
  if (g.sys) {
    return '<tr class="sys' + (g.tab === me ? ' me' : '') + '"><td class="t">' + stGateTime(g.t) + '</td>' + tab + '<td class="s">' + stEsc(g.s || '') + '</td>'
      + '<td class="l">' + stEsc(stGateWhat(g.evs[0])) + '</td><td></td><td><span class="st-gate-pill ' + g.cls + '">' + stEsc(g.label) + '</span></td><td></td><td></td></tr>';
  }
  var tries = g.tries.map(function (x) { return '<i class="' + stGateTryCls(x.st) + '" data-tip="' + stGateTryTip(x.st) + '"></i>'; }).join('');
  var a = g.ans, meter = '';
  if (a && a.lim && a.rem != null) {
    var share = Math.max(0, Math.min(1, a.rem / a.lim));
    meter = '<span class="st-gate-meter' + (a.rem <= 0 ? ' out' : share < 0.25 ? ' low' : '') + '" data-tip="' + stEsc('Rate limit' + (a.who ? ' (' + a.who + ')' : '') + ': ' + a.rem + ' of ' + a.lim + ' left' + (a.rst ? '\nReset in ' + a.rst + ' s' : '')) + '"><span><i style="width:' + Math.round(share * 100) + '%"></i></span>' + a.rem + '/' + a.lim + '</span>';
  }
  var flight = g.tries.reduce(function (n, x) { return n + (x.end ? x.end - x.t : 0); }, 0);
  var row = '<tr class="rq' + (g.tab === me ? ' me' : '') + (isOpen ? ' open' : '') + '" data-id="' + stEsc(g.id) + '"><td class="t">' + stGateTime(g.t) + '</td>' + tab
    + '<td class="s">' + stEsc(g.s || '') + (g.b === 0 ? ' <span class="i" data-tip="Interactive: a click or a search\nIt goes ahead of background work">(i)</span>' : '') + '</td>'
    + '<td class="l">' + stEsc(g.l) + '</td><td><span class="st-gate-tries">' + tries + '</span></td>'
    + '<td><span class="st-gate-pill ' + g.cls + '">' + stEsc(g.label) + '</span></td>'
    + '<td class="w" data-tip="Waited in the gate + on the way to MusicBrainz">' + stGateSec(g.wait) + (flight ? ' + ' + stGateSec(flight) : '') + '</td><td>' + meter + '</td></tr>';
  if (!isOpen) return row;
  return row + '<tr class="steps"><td colspan="8">' + stGateReqLaneHtml(g, now || Date.now()) + '<ol>' + g.evs.map(function (ev) {
    return '<li' + (stGateBad(ev) ? ' class="bad"' : '') + '><span class="t">' + stGateTime(ev.t) + '</span><span class="e">' + stEsc(ev.e) + '</span><span>' + stEsc(stGateWhat(ev)) + '</span></li>';
  }).join('') + '</ol></td></tr>';
}
function stGateMarkdown(all, me) {
  var s = stGateState(), now = Date.now(), c = stGateCount(stGateGroups(all, now));
  var out = ['# MusicBrainz gate log', '', 'Copied ' + new Date().toISOString() + ', this tab ' + (me || '-'), '',
    'State: ' + JSON.stringify(s) + ' (now ' + now + ')', '',
    'Requests: ' + c.n + ' (' + c.ok + ' ok, ' + c.re + ' retried, ' + c.bad + ' failed, ' + c.go + ' on the way)', '',
    '| Time | Tab | Script | Event | Request | What |', '| --- | --- | --- | --- | --- | --- |'];
  var cell = function (v) { return String(v == null ? '' : v).replace(/\|/g, '\\|').replace(/\n/g, ' '); };
  all.forEach(function (ev) {
    out.push('| ' + stGateTime(ev.t) + ' | ' + cell(ev.tab) + (ev.tab === me ? ' (this)' : '') + ' | ' + cell(ev.s) + ' | ' + cell(ev.e) + (ev.b === 0 ? ' (i)' : '')
      + ' | ' + cell(ev.l) + ' | ' + cell(stGateWhat(ev)) + ' |');
  });
  return out.join('\n');
}

// the window's remembered state: open, min, full, left, top, w, h, mode, mine
function stGateWinState() { try { return JSON.parse(GM_getValue(ST_GATE_WIN, '{}') || '{}') || {}; } catch (e) { return {}; } }
function stGateRemember(patch) { try { GM_setValue(ST_GATE_WIN, JSON.stringify(Object.assign(stGateWinState(), patch))); } catch (e) { /* no storage: it just forgets */ } }
// at start: the window comes back if it was left open (top frame only)
function stGateReopen() {
  try { if (window.top !== window || !stGateWinState().open) return; } catch (e) { return; }
  var go = function () { try { stGateOpen(true); } catch (e) { /* no window */ } };
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go, { once: true });
}
function stGateClose() {
  if (stGateWin) { stGateWin.off(); stGateWin.el.remove(); stGateWin = null; }
  stGateRemember({ open: false });
}

// asked for (the palette): it opens whole, a minimised one too. At start (again) it comes back as it was left
function stGateOpen(again) {
  if (again !== true) stGateRemember({ min: false });
  if (stGateWin && stGateWin.el.isConnected) { stGateWin.show(); return; }
  stGateWin = null;
  var old = document.getElementById('st-gate');
  if (old) old.remove();   // a window left behind by a failed open
  try { stGateBuild(); } catch (e) {
    // a saved state this build cannot use (a size or place from an older screen, say): forget it and try once more
    try { console.error('String Theory: the Gate log failed to open', e); } catch (x) { /* no console */ }
    if (stGateWin) { try { stGateWin.off(); } catch (x) { /* gone */ } stGateWin = null; }
    var left = document.getElementById('st-gate');
    if (left) left.remove();
    try { GM_setValue(ST_GATE_WIN, '{}'); } catch (x) { /* no storage */ }
    stGateBuild();
  }
}

function stGateBuild() {
  var U = stUI(), T = stTokens();
  if (!document.getElementById('st-gate-css')) {
    var css = document.createElement('style'); css.id = 'st-gate-css';
    css.textContent = T.MBU_TOKENS + U.MBU_UI_CSS + ST_GATE_CSS;
    (document.head || document.documentElement).appendChild(css);
  }
  stGateRemember({ open: true });
  var st = stGateWinState(), mine = !!st.mine, mode = st.mode || 'all', q = '', sig = '', opened = {};
  var pop = document.createElement('div');
  pop.id = 'st-gate'; pop.className = 'mbu-ui'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Gate log');
  pop.innerHTML = '<div class="mbu-logpop-h"><b>Gate log</b> <span class="st-gate-n"></span><span class="mbu-logpop-sp"></span>'
    + '<button type="button" class="mbu-logpop-copy" data-tip="Copy as Markdown\nThe state and every event, ready for a GitHub issue">⧉ Copy</button>'
    + '<button type="button" class="mbu-logpop-clear" data-tip="Clear the gate log\nThe events of every tab are deleted">Clear</button>'
    + '<button type="button" class="mbu-logpop-full" data-tip="Full screen\nA double-click on the title bar does the same">⛶</button>'
    + '<button type="button" class="mbu-logpop-min" data-tip="Minimize">–</button>'
    + '<button type="button" class="mbu-logpop-x" data-tip="Close">✕</button></div>'
    + '<div id="st-gate-state"></div><div id="st-gate-sum"></div><div id="st-gate-lanes"></div>'
    + '<div id="st-gate-bar"><input id="st-gate-q" class="mbu-input" type="search" placeholder="Filter" autocomplete="off" data-tip="Show only the requests with this text\nIt matches the request, the script, the tab and the result">'
    + '<span class="st-gate-seg" role="group" aria-label="Show"><button type="button" data-m="all" data-tip="Every request">All</button>'
    + '<button type="button" data-m="bad" data-tip="Only the requests that failed">Failed</button>'
    + '<button type="button" data-m="re" data-tip="Only the requests that took more than one try">Retried</button></span>'
    + '<button type="button" id="st-gate-mine" data-tip="Show only the requests of this tab">This tab only</button></div>'
    + '<div id="st-gate-body"><table><thead><tr><th>Time</th><th>Tab</th><th>Script</th><th>Request</th><th>Tries</th><th>Result</th><th>Wait</th><th>Rate limit</th></tr></thead><tbody></tbody></table></div>'
    + '<div class="mbu-logpop-grip" data-tip="Resize"></div>';
  document.documentElement.appendChild(pop);   // outside the body, which Event Horizon swaps
  var $ = function (s) { return pop.querySelector(s); };
  var body = $('tbody'), qEl = $('#st-gate-q'), mineBtn = $('#st-gate-mine'), scroller = $('#st-gate-body');
  var seg = function () { Array.prototype.forEach.call(pop.querySelectorAll('.st-gate-seg button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.m === mode)); }); };
  seg(); mineBtn.setAttribute('aria-pressed', String(mine));
  var drawFailed = '', lanesHeld = false, shownIds = [];
  var draw = function () {
    try { drawNow(); } catch (e) {
      var msg = String(e && e.message || e);
      if (msg !== drawFailed) { drawFailed = msg; try { console.error('String Theory: the Gate log could not show its events', e); } catch (x) { /* no console */ } }
      sig = '';
      try { body.innerHTML = '<tr><td class="none" colspan="8">The gate log could not show its events (' + msg.replace(/[<&]/g, '') + '). Clear it to start again.</td></tr>'; } catch (x) { /* no body */ }
    }
  };
  var drawNow = function () {
    var me = stGateTab(), all = stGateEvents(), now = Date.now(), groups = stGateGroups(all, now), n = stGateCount(groups).n;
    $('.st-gate-n').textContent = n + ' request' + (n === 1 ? '' : 's');
    if (pop.classList.contains('min')) return;
    $('#st-gate-state').innerHTML = stGateStateHtml(stGateState(), me);
    $('#st-gate-sum').innerHTML = stGateSumHtml(groups, now);
    if (!lanesHeld) $('#st-gate-lanes').innerHTML = stGateLanesHtml(groups, all, now, me);   // held still under the mouse, so a tip stays put
    var shown = groups.filter(function (g) {
      if (mine && g.tab !== me) return false;
      if (mode === 'bad' && g.cls !== 'bad') return false;
      if (mode === 're' && (g.sys || g.tries.length < 2)) return false;
      return !q || ((g.l || '') + ' ' + (g.s || '') + ' ' + g.tab + ' ' + (g.label || '')).toLowerCase().indexOf(q) >= 0;
    });
    shownIds = shown.filter(function (g) { return !g.sys; }).map(function (g) { return g.id; });
    if (shownIds.length < n) {   // a filter hides some: say how many are left, and which filter
      var why = [mine && 'this tab only', mode === 'bad' && 'failed', mode === 're' && 'retried', q && 'text'].filter(Boolean).join(', ');
      $('.st-gate-n').textContent = shownIds.length + ' of ' + n + ' requests shown' + (why ? ' (' + why + ')' : '');
    }
    var key = shown.map(function (g) { return g.id + ':' + g.evs.length + ':' + g.label; }).join('|') + '#' + Object.keys(opened).join('|') + '#' + me;
    if (key === sig) return;
    sig = key;
    var top = scroller.scrollTop;
    body.innerHTML = shown.length ? shown.slice().reverse().map(function (g) { return stGateRowHtml(g, me, !!opened[g.id], now); }).join('')
      : '<tr><td class="none" colspan="8">' + (all.length ? 'No request matches.' : 'No requests went through the gate yet. Open or reload a MusicBrainz page that uses a script, then look again.') + '</td></tr>';
    scroller.scrollTop = top;
  };
  body.addEventListener('click', function (e) {
    var tr = e.target.closest('tr.rq');
    if (!tr) return;
    var id = tr.dataset.id;
    if (opened[id]) delete opened[id]; else opened[id] = 1;
    draw();
  });
  // a right click on a row opens every row, or closes them all when every one is open
  body.addEventListener('contextmenu', function (e) {
    if (!e.target.closest('tr.rq, tr.steps')) return;
    e.preventDefault();
    var allOpen = shownIds.length && shownIds.every(function (id) { return opened[id]; });
    opened = {};
    if (!allOpen) shownIds.forEach(function (id) { opened[id] = 1; });
    draw();
  });
  var lanes = $('#st-gate-lanes');
  lanes.addEventListener('mouseenter', function () { lanesHeld = true; });
  lanes.addEventListener('mouseleave', function () { lanesHeld = false; draw(); });
  qEl.addEventListener('input', function () { q = qEl.value.trim().toLowerCase(); draw(); });
  $('.st-gate-seg').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    mode = b.dataset.m === mode ? 'all' : b.dataset.m; seg(); stGateRemember({ mode: mode }); draw();
  });
  mineBtn.onclick = function () { mine = !mine; mineBtn.setAttribute('aria-pressed', String(mine)); stGateRemember({ mine: mine }); draw(); };
  $('.mbu-logpop-copy').onclick = function () {
    stCopy(stGateMarkdown(stGateEvents(), stGateTab()), function (ok) { try { U.mbuToast(ok ? 'Gate log copied' : 'Could not copy the gate log'); } catch (e) { /* no toast */ } });
  };
  $('.mbu-logpop-clear').onclick = function () {
    try { for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (k && k.indexOf(ST_GATE_PRE) === 0) localStorage.removeItem(k); } } catch (e) { /* no storage */ }
    opened = {}; sig = ''; draw();
  };
  // the window: placed, minimised, full screen and sized as it was left
  if (st.left != null) { pop.style.left = st.left; pop.style.top = st.top; pop.style.transform = 'none'; }
  if (st.w && st.h) { pop.style.width = st.w; pop.style.height = st.h; }
  var r0 = pop.getBoundingClientRect();
  if (!(r0.width > 100 && r0.height > 60) || r0.width > window.innerWidth || r0.height > window.innerHeight) { pop.style.width = ''; pop.style.height = ''; r0 = pop.getBoundingClientRect(); }
  if (r0.top < 0 || r0.left < -r0.width + 80 || r0.left > window.innerWidth - 80 || r0.top > window.innerHeight - 40) {
    pop.style.left = ''; pop.style.top = ''; pop.style.transform = '';   // off screen: back to the middle
  }
  var restore = { left: pop.style.left, top: pop.style.top, bottom: '', transform: pop.style.transform };
  var minBtn = $('.mbu-logpop-min'), fullBtn = $('.mbu-logpop-full');
  var setMin = function (m) {
    pop.classList.toggle('min', m);
    minBtn.textContent = m ? '▢' : '–'; minBtn.dataset.tip = m ? 'Restore' : 'Minimize';
    if (m) Object.assign(pop.style, { left: '14px', bottom: '14px', top: 'auto', transform: 'none' });   // dock at the bottom left
    else { Object.assign(pop.style, restore); sig = ''; draw(); }
  };
  var setFull = function (f) {
    pop.classList.toggle('full', f);
    fullBtn.textContent = f ? '❐' : '⛶'; fullBtn.dataset.tip = (f ? 'Restore the size' : 'Full screen') + '\nA double-click on the title bar does the same';
  };
  minBtn.onclick = function () {
    var m = !pop.classList.contains('min');
    if (m && pop.classList.contains('full')) { setFull(false); stGateRemember({ full: false }); }   // minimising leaves full screen
    setMin(m); stGateRemember({ min: m });
  };
  fullBtn.onclick = function () { var f = !pop.classList.contains('full'); setFull(f); stGateRemember({ full: f }); };
  $('.mbu-logpop-x').onclick = function () { stGateClose(); };
  var head = $('.mbu-logpop-h');
  head.addEventListener('dblclick', function (e) { if (!e.target.closest('button, input') && !pop.classList.contains('min')) fullBtn.click(); });
  // a phone shows it full screen: a minimised or moved one from a wider screen would hide it
  var phone = window.matchMedia && window.matchMedia('(max-width:600px)').matches;
  if (st.min && !phone) setMin(true); else if (st.full) setFull(true);
  // dragged by its title bar, kept on screen
  head.addEventListener('mousedown', function (e) {
    if (e.button !== 0 || e.target.closest('button, input') || pop.classList.contains('full') || phone) return;
    e.preventDefault();
    var r = pop.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    Object.assign(pop.style, { left: r.left + 'px', top: r.top + 'px', bottom: '', transform: 'none' });
    var mv = function (ev) {
      pop.style.left = Math.max(0, Math.min(window.innerWidth - pop.offsetWidth, ev.clientX - ox)) + 'px';
      pop.style.top = Math.max(0, Math.min(window.innerHeight - 36, ev.clientY - oy)) + 'px';
    };
    var up = function () {
      document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
      if (pop.classList.contains('min')) return;   // a minimised bar moves, but its window keeps its place
      restore = { left: pop.style.left, top: pop.style.top, bottom: '', transform: 'none' };
      stGateRemember({ left: pop.style.left, top: pop.style.top });
    };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });
  // resized by its corner, the top-left corner pinned
  $('.mbu-logpop-grip').addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    var r = pop.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
    Object.assign(pop.style, { left: r.left + 'px', top: r.top + 'px', bottom: '', transform: 'none' });
    var mv = function (ev) {
      pop.style.width = Math.max(420, Math.min(window.innerWidth - r.left, r.width + ev.clientX - x0)) + 'px';
      pop.style.height = Math.max(200, Math.min(window.innerHeight - r.top, r.height + ev.clientY - y0)) + 'px';
    };
    var up = function () {
      document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
      restore = { left: pop.style.left, top: pop.style.top, bottom: '', transform: 'none' };
      stGateRemember({ left: pop.style.left, top: pop.style.top, w: pop.style.width, h: pop.style.height });
    };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });
  // Escape, anywhere but a field outside the window: a filled filter is emptied, else the window closes
  var onKey = function (e) {
    if (e.key !== 'Escape' || pop.classList.contains('min')) return;
    if (!pop.contains(e.target) && e.target.closest && e.target.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"]')) return;
    e.preventDefault(); e.stopPropagation();
    if (e.target === qEl && qEl.value) { qEl.value = ''; q = ''; draw(); return; }
    stGateClose();
  };
  window.addEventListener('keydown', onKey, true);
  var timer = setInterval(function () { if (!pop.isConnected) { clearInterval(timer); return; } draw(); }, 500);
  stGateWin = {
    el: pop,
    off: function () { clearInterval(timer); window.removeEventListener('keydown', onKey, true); },
    show: function () { if (pop.classList.contains('min')) minBtn.click(); try { qEl.focus(); } catch (e) { /* no focus */ } }
  };
  draw();
}
