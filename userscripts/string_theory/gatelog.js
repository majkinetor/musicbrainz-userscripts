// Gate log: every request through the shared MusicBrainz gate (dev/net/mb-gate.mjs), from every
// script and tab, and the gate's state, live. It is for telling MusicBrainz's own load apart from
// ours: the gate's mbnTrace keeps each tab's last events in localStorage (mbu:mb-gate-trace:<tab>).
var ST_GATE_KEY = 'mbu:mb-gate', ST_GATE_PRE = 'mbu:mb-gate-trace:';
var stGateOv = null;
var ST_GATE_CSS = ''
  + '#st-gate{width:min(1100px,96vw);height:min(82vh,760px);display:flex;flex-direction:column;font:13px/1.45 var(--mbu-font);color:var(--mbu-text);text-align:left;outline:none}'
  + '#st-gate.full{position:fixed;inset:0;width:auto!important;max-width:none!important;height:auto!important;max-height:none!important;margin:0;border-radius:0}'
  + '#st-gate .mbu-ov-title{font:700 20px/1.3 var(--mbu-font);letter-spacing:-.01em}'
  + '#st-gate .mbu-ov-h button.b{min-height:30px;padding:0 10px;border:0;border-radius:var(--mbu-radius);background:none;color:var(--mbu-accent-text);font:inherit;cursor:pointer}#st-gate .mbu-ov-h button.b:hover{background:var(--mbu-bg-hover)}'
  + '#st-gate .mbu-ov-h button.b[aria-pressed=true]{background:var(--mbu-accent-soft)}'
  + '#st-gate-state{display:flex;flex-wrap:wrap;gap:4px 20px;padding:8px 16px;border-bottom:1px solid var(--mbu-border)}'
  + '#st-gate-state span{white-space:nowrap}#st-gate-state b{font-weight:600}#st-gate-state .k{color:var(--mbu-text-weak)}'
  + '#st-gate-state .hot b{color:var(--mbu-danger,#c0392b)}'
  + '#st-gate-sum{padding:6px 16px;border-bottom:1px solid var(--mbu-border);color:var(--mbu-text-weak)}'
  + '#st-gate-body{flex:1 1 auto;min-height:0;overflow:auto;scrollbar-width:thin;scrollbar-color:var(--mbu-border) transparent}'
  + '#st-gate table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}'
  + '#st-gate th{position:sticky;top:0;background:var(--mbu-bg);text-align:left;font-weight:600;padding:4px 8px;border-bottom:1px solid var(--mbu-border)}'
  + '#st-gate td{padding:2px 8px;border-bottom:1px solid var(--mbu-divider,var(--mbu-border));vertical-align:top}'
  + '#st-gate td.t,#st-gate td.e,#st-gate td.tab{white-space:nowrap}#st-gate td.tab,#st-gate td.t{color:var(--mbu-text-weak)}'
  + '#st-gate td.l{overflow-wrap:anywhere;font-family:var(--mbu-mono,monospace);font-size:12px}'
  + '#st-gate tr.bad td{background:var(--mbu-danger-soft,rgba(192,57,43,.12))}#st-gate tr.me td.tab{color:var(--mbu-accent-text)}'
  + '#st-gate td.none{padding:24px;text-align:center;color:var(--mbu-text-weak)}';

function stGateState() { try { return JSON.parse(localStorage.getItem(ST_GATE_KEY) || 'null') || {}; } catch (e) { return {}; } }
function stGateTab() { try { return sessionStorage.getItem(ST_GATE_KEY + '-tab') || ''; } catch (e) { return ''; } }
// every tab's events, oldest first, each with its tab id
function stGateEvents() {
  var out = [];
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
    case 'lead': x.push('waits up to ' + stGateSec(ev.w) + ' for a page being drawn (' + (ev.by || '?') + ')'); break;
    case 'lead+': x.push('takes the lead for ' + stGateSec(ev.w) + ' (' + (ev.by || '?') + ')'); break;
    case 'lead-': x.push('ends the lead (' + (ev.by || '?') + ')'); break;
    case 'cancel': x.push('cancelled after ' + stGateSec(ev.w)); break;
    case 'join': x.push('the same request is already on its way: shares its answer'); break;
    case 'error': x.push(ev.err || 'network error'); break;
    case 'check': x.push('browser check ' + (ev.ok ? 'passed' : 'failed') + ' in ' + stGateSec(ev.w)); break;
    case 'answer':
      x.push('HTTP ' + ev.st);
      if (ev.ra != null) x.push('Retry-After ' + ev.ra);
      if (ev.hold) x.push('everyone holds ' + stGateSec(ev.hold));
      if (ev.hot) x.push('hot ' + ev.hot);
      if (ev.who || ev.rem != null || ev.lim) x.push('rate limit' + (ev.who ? ' ' + ev.who : '') + (ev.rem != null ? ', ' + ev.rem + ' left' : '') + (ev.lim ? ' of ' + ev.lim : '') + (ev.rst ? ', reset ' + ev.rst : ''));
      break;
  }
  return x.join(' · ');
}
function stGateBad(ev) { return ev.e === 'error' || (ev.e === 'check' && !ev.ok) || (ev.e === 'answer' && (ev.st === 429 || ev.st === 503 || ev.st >= 500 || !ev.st)); }
function stGateSummary(all) {
  var now = Date.now(), last = all.filter(function (ev) { return now - ev.t <= 60000; });
  var starts = last.filter(function (ev) { return ev.e === 'start'; });
  var n = function (st) { return last.filter(function (ev) { return ev.e === 'answer' && ev.st === st; }).length; };
  var ok = last.filter(function (ev) { return ev.e === 'answer' && ev.st >= 200 && ev.st < 500 && ev.st !== 429; }).length;
  var gap = starts.length > 1 ? (starts[starts.length - 1].t - starts[0].t) / (starts.length - 1) : 0;
  var tabs = {}; starts.forEach(function (ev) { tabs[ev.tab] = 1; });
  return 'Last 60 s, all tabs: ' + starts.length + ' started' + (gap ? ' (one every ' + stGateSec(gap) + ')' : '')
    + ' · ' + ok + ' answered · ' + n(503) + '× 503 · ' + n(429) + '× 429 · from ' + Object.keys(tabs).length + ' tab' + (Object.keys(tabs).length === 1 ? '' : 's');
}
function stGateStateHtml(s, me) {
  var now = Date.now(), cool = (s.cool || 0) - now, q = Math.max(0, Math.round(((s.tat || 0) - now) / 1000)), iq = Math.max(0, Math.round(((s.itat || 0) - now) / 1000));
  var hot = now > (s.cool || 0) + 30000 ? 0 : (s.hot || 0), lead = s.lead && (s.leadUntil || 0) > now;
  var f = function (k, v, cls) { return '<span' + (cls ? ' class="' + cls + '"' : '') + '><span class="k">' + k + '</span> <b>' + v + '</b></span>'; };
  return f('Hold', cool > 0 ? stGateSec(cool) + ' left' : 'none', cool > 0 ? 'hot' : '')
    + f('Hot', hot + (s.hot && !hot ? ' (stale ' + s.hot + ')' : ''), hot ? 'hot' : '')
    + f('Background queue', q ? q + ' s ahead' : 'empty')
    + f('Interactive queue', iq ? iq + ' s ahead' : 'empty')
    + f('Lead', lead ? stEsc(String(s.lead).slice(0, 12)) + ', ' + stGateSec(s.leadUntil - now) + ' left' : 'none')
    + f('This tab', stEsc(me || 'no requests yet'));
}
function stGateMarkdown(all, me) {
  var s = stGateState(), now = Date.now();
  var out = ['# MusicBrainz gate log', '', 'Copied ' + new Date().toISOString() + ', this tab ' + (me || '-'), '',
    'State: ' + JSON.stringify(s) + ' (now ' + now + ')', '', stGateSummary(all), '',
    '| Time | Tab | Script | Event | Request | What |', '| --- | --- | --- | --- | --- | --- |'];
  var cell = function (v) { return String(v == null ? '' : v).replace(/\|/g, '\\|').replace(/\n/g, ' '); };
  all.forEach(function (ev) {
    out.push('| ' + stGateTime(ev.t) + ' | ' + cell(ev.tab) + (ev.tab === me ? ' (this)' : '') + ' | ' + cell(ev.s) + ' | ' + cell(ev.e) + (ev.b === 0 ? ' (i)' : '')
      + ' | ' + cell(ev.l) + ' | ' + cell(stGateWhat(ev)) + ' |');
  });
  return out.join('\n');
}

function stGateOpen() {
  if (stGateOv && stGateOv.isConnected) return;
  var U = stUI(), T = stTokens();
  if (!document.getElementById('st-gate-css')) {
    var css = document.createElement('style'); css.id = 'st-gate-css';
    css.textContent = T.MBU_TOKENS + U.MBU_UI_CSS + ST_GATE_CSS;
    (document.head || document.documentElement).appendChild(css);
  }
  var focusBack = document.activeElement, mine = false, sig = '';
  var ov = document.createElement('div');
  ov.className = 'mbu-ov'; ov.id = 'st-gate-ov';
  ov.innerHTML = '<div class="mbu-ov-panel mbu-ui" id="st-gate" role="dialog" aria-label="Gate log" tabindex="-1">'
    + '<div class="mbu-ov-h"><span class="mbu-ov-title">Gate log</span>'
    + '<button type="button" class="b" id="st-gate-mine" aria-pressed="false" data-tip="Show only the requests of this tab">This tab only</button>'
    + '<button type="button" class="b" id="st-gate-copy" data-tip="Copy the state and every event as Markdown">Copy</button>'
    + '<button type="button" class="b" id="st-gate-clear" data-tip="Delete the events of every tab">Clear</button>'
    + '<button type="button" class="mbu-ov-x" id="st-gate-full" data-tip="Full screen" aria-label="Full screen">⛶</button>'
    + '<button type="button" class="mbu-ov-x" id="st-gate-x" aria-label="Close">✕</button></div>'
    + '<div id="st-gate-state"></div><div id="st-gate-sum"></div>'
    + '<div id="st-gate-body"><table><thead><tr><th>Time</th><th>Tab</th><th>Script</th><th>Event</th><th>Request</th><th>What</th></tr></thead><tbody></tbody></table></div></div>';
  (document.body || document.documentElement).appendChild(ov);
  stGateOv = ov;
  var panel = ov.querySelector('#st-gate'), body = ov.querySelector('tbody');
  var draw = function () {
    var me = stGateTab(), all = stGateEvents();
    ov.querySelector('#st-gate-state').innerHTML = stGateStateHtml(stGateState(), me);
    ov.querySelector('#st-gate-sum').textContent = stGateSummary(all);
    var shown = mine ? all.filter(function (ev) { return ev.tab === me; }) : all;
    var now = shown.length + ':' + (shown.length ? shown[shown.length - 1].t : 0) + ':' + mine;
    if (now === sig) return;
    sig = now;
    body.innerHTML = shown.length ? shown.slice().reverse().map(function (ev) {
      return '<tr class="' + (stGateBad(ev) ? 'bad' : '') + (ev.tab === me ? ' me' : '') + '"><td class="t">' + stGateTime(ev.t) + '</td><td class="tab">' + stEsc(ev.tab) + '</td><td>' + stEsc(ev.s || '') + '</td>'
        + '<td class="e">' + stEsc(ev.e) + (ev.b === 0 ? ' <span data-tip="Interactive: a click or a search, ahead of background work">(i)</span>' : '') + '</td>'
        + '<td class="l">' + stEsc(ev.l || '') + '</td><td>' + stEsc(stGateWhat(ev)) + '</td></tr>';
    }).join('') : '<tr><td class="none" colspan="6">No requests went through the gate yet. Open or reload a MusicBrainz page that uses a script, then look again.</td></tr>';
  };
  draw();
  var timer = setInterval(function () { if (!ov.isConnected) { clearInterval(timer); return; } draw(); }, 500);
  var close = function () { clearInterval(timer); ov.remove(); document.removeEventListener('keydown', key, true); try { if (focusBack) focusBack.focus(); } catch (e) { /* gone */ } };
  var key = function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  document.addEventListener('keydown', key, true);
  ov.querySelector('#st-gate-x').onclick = close;
  ov.querySelector('#st-gate-mine').onclick = function () { mine = !mine; this.setAttribute('aria-pressed', String(mine)); draw(); };
  ov.querySelector('#st-gate-copy').onclick = function () {
    stCopy(stGateMarkdown(stGateEvents(), stGateTab()), function (ok) { try { U.mbuToast(ok ? 'Gate log copied' : 'Could not copy the gate log'); } catch (e) { /* no toast */ } });
  };
  ov.querySelector('#st-gate-clear').onclick = function () {
    try { for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (k && k.indexOf(ST_GATE_PRE) === 0) localStorage.removeItem(k); } } catch (e) { /* no storage */ }
    sig = ''; draw();
  };
  var fullBtn = ov.querySelector('#st-gate-full');
  fullBtn.onclick = function () {
    var on = !panel.classList.contains('full');
    panel.classList.toggle('full', on);
    fullBtn.textContent = on ? '❐' : '⛶';
    fullBtn.dataset.tip = on ? 'Restore the size' : 'Full screen';
  };
  ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
  try { panel.focus(); } catch (e) { /* no focus */ }
}
