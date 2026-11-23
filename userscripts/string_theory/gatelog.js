// Gate log: every request through the shared MusicBrainz gate (dev/net/mb-gate.mjs), from every
// script and tab, and the gate's state, live. It is for telling MusicBrainz's own load apart from
// ours: the gate's mbnTrace keeps each tab's last events in localStorage (mbu:mb-gate-trace:<tab>).
//
// The window floats like the Activity log: dragged by its title bar, minimised to it, resized by
// its corner, and its open, minimised, full-screen, place and size are remembered (GM, ST_GATE_WIN),
// so a reload brings it back as it was (stGateReopen). The events are grouped into requests
// (stGateGroups): one row per request, its tries, result, wait and rate limit, and a click opens
// its steps. Above the rows, the last minutes (1 to 10, the user picks) as one lane per tab, with MusicBrainz's holds shaded.
var ST_GATE_KEY = 'mbu:mb-gate', ST_GATE_PRE = 'mbu:mb-gate-trace:', ST_GATE_WIN = 'st:gatelog-win';
var ST_GATE_SPANS = [60000, 120000, 300000, 600000];
var ST_GATE_SPAN = 300000, ST_GATE_RETRY = 2500;   // the lanes' span (the user picks it); a retry follows its 429/503 within this
function stGateSpanTxt(ms) { ms = ms || ST_GATE_SPAN; return ms % 60000 ? Math.round(ms / 1000) + ' s' : ms / 60000 + ' min'; }
var stGateWin = null;
var ST_GATE_CSS = ''
  + '#st-gate{position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:var(--mbu-z-modal);display:flex;flex-direction:column;'
  + 'width:min(1100px,96vw);height:min(78vh,760px);background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:11px;'
  + 'box-shadow:var(--mbu-shadow-lg);font:13px/1.45 var(--mbu-font);color:var(--mbu-text);text-align:left;overflow:hidden}'
  + '#st-gate .mbu-logpop-h b{font-weight:600}#st-gate .st-gate-n{color:var(--mbu-text-weak);font-size:12px}'
  // minimised: the title bar only, docked at the bottom left
  + '#st-gate.min{height:auto!important;width:auto!important}'
  + '#st-gate.min>:not(.mbu-logpop-h),#st-gate.min .mbu-logpop-h>:not(b):not(.st-gate-n):not(.mbu-logpop-min){display:none}'
  + '#st-gate.full{top:0!important;left:0!important;right:0!important;bottom:0!important;border-radius:0;border:0;width:auto!important;height:auto!important;transform:none!important}'
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
  + '.st-gl-ic{position:absolute;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;z-index:1;object-fit:contain}'
  + '.st-gl-ic.at{margin:-8px 0 0 -19px}#st-gate-hud-box .st-gl-ic.at{margin:-6px 0 0 -15px}#st-gate-hud-box .st-gl-ic{width:12px;height:12px;margin:-6px 0 0 -6px}#st-gate-hud-box .st-gl-cl b{display:none}#st-gate-hud-box .st-gl-cl{height:12px;margin-top:-6px}'
  + '.st-gl-cl{position:absolute;top:50%;height:18px;margin:-9px 0 0 -9px;z-index:2;display:flex;align-items:center;cursor:default}.st-gl-cl b{position:absolute;right:-6px;top:-5px;min-width:11px;height:11px;padding:0 2px;box-sizing:border-box;border-radius:6px;background:var(--mbu-accent);color:#fff;font-size:8px;line-height:11px;text-align:center}.st-gl-cl b{display:flex;padding:0;overflow:hidden;background:none}.st-gl-cl b i{font-style:normal;padding:0 2px;min-width:7px;background:var(--mbu-accent)}.st-gl-cl b i.x{background:#2f7fd6}.st-gl-cl.bad b{box-shadow:0 0 0 1px var(--mbu-error)}'
  + '.st-gl-pi{position:absolute;top:-2px;width:24px;height:24px;margin-left:-27px;z-index:1}.st-gl-pi svg{width:24px;height:24px;display:block}.st-gl-lt{display:block;width:24px;height:24px;border-radius:5px;color:#fff;font:700 14px/24px system-ui,sans-serif;text-align:center}.st-gl-pi .st-gl-ic{position:absolute;left:auto;top:auto;right:-5px;bottom:-5px;width:13px;height:13px;margin:0}'
  + '.st-gl-cl .st-gl-ic{position:static;margin:0}'
  + '.st-gl-zoom{position:fixed;z-index:2147483647;width:340px;padding:8px 10px;background:var(--mbu-bg);color:var(--mbu-text);border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);font-size:12px}'
  + '.st-gl-zh{color:var(--mbu-text-weak);margin-bottom:4px}.st-gl-zr{display:flex;align-items:center;gap:6px;height:26px}.st-gl-zr .st-gl-ic{position:static;margin:0}'
  + '.st-gl-zn{flex:0 0 220px;}.st-gl-zn .h{color:var(--mbu-text-weak);margin-right:6px}.st-gl-zn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.st-gl-zl{position:relative;flex:1;height:20px;margin-left:20px}.st-gl-zr .st-gl-ic.at{position:absolute;top:2px;margin:0 0 0 -19px}.st-gl-zl .st-gl-f{top:0;height:20px}.st-gl-zt{flex:0 0 44px;text-align:right;color:var(--mbu-text-weak)}'
  + '.st-gl-name{position:absolute;left:-180px;width:172px;top:0;line-height:30px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--mbu-text-weak)}'
  + '.st-gl-name b{color:var(--mbu-text);font-weight:600}.st-gl-lane.me .st-gl-name b{color:var(--mbu-accent-text)}'
  + '.st-gl-w,.st-gl-f{position:absolute;top:5px;height:20px;min-width:5px;border-radius:3px;box-shadow:inset 1px 0 0 var(--mbu-bg)}.st-gl-w,.st-gl-f{opacity:.6}.st-gl-w:hover,.st-gl-f:hover{opacity:1}'
  + '.st-gl-w{background:var(--mbu-border)}.st-gl-f{background:var(--mbu-ok)}.st-gl-f.bad{background:var(--mbu-error)}.st-gl-f.re{background:var(--mbu-warn)}.st-gl-f.go{background:var(--mbu-info)}.st-gl-f.off{background:var(--mbu-border)}'
  + '.st-gl-ax{position:relative;height:16px;border-top:1px solid var(--mbu-border-soft);font-size:11px;color:var(--mbu-text-weak)}'
  + '.st-gl-ax span{position:absolute;top:1px;transform:translateX(-50%);white-space:nowrap}.st-gl-ax span:first-child{transform:none}.st-gl-ax span:last-child{transform:translateX(-100%)}'
  + '.st-gl-none{line-height:30px;font-size:12px;color:var(--mbu-text-weak)}'
  // the filter row
  + '.st-gate-ent{display:inline-block;width:14px;height:14px;vertical-align:-2px;margin-right:5px;flex:none}'
  + '#st-gate .st-gate-facts{font-size:12px;color:var(--mbu-text-weak);padding:0 0 6px}#st-gate .st-gate-k{font-weight:600;color:var(--mbu-accent,var(--mbu-text))}#st-gate .st-gate-url{width:0;min-width:100%;box-sizing:border-box;font:12px/1.4 monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;user-select:text;padding:4px 0 6px;color:var(--mbu-text)}#st-gate .st-gate-url.all{white-space:normal;word-break:break-all}'
  + '#st-gate td.l{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:40ch}'
  + '#st-gate-bar{display:none;position:absolute;z-index:2;flex-direction:column;align-items:flex-start;gap:8px;padding:10px;background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);max-width:calc(100% - 8px)}#st-gate-bar.open{display:flex}'
  + '#st-gate-bar .st-gate-seg{flex-wrap:wrap}#st-gate-q{width:100%}'
  + '#st-gate th.st-gate-mh{width:1%;text-align:right;padding:0 4px}#st-gate-menu{min-width:30px;min-height:26px;border:0;background:none;color:var(--mbu-accent-text);font:inherit;cursor:pointer;border-radius:var(--mbu-radius)}#st-gate-menu:hover,#st-gate-menu[aria-expanded=true]{background:var(--mbu-bg-hover)}'
  + '#st-gate-hud{margin-right:4px}#st-gate-hud[aria-pressed=true]{background:var(--mbu-accent-soft)}'
  + '#st-gate-q{min-height:30px;box-sizing:border-box}'
  + '.st-gate-seg{display:inline-flex;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);overflow:hidden}'
  + '.st-gate-seg button,#st-gate-mine{min-height:30px;padding:0 11px;border:0;background:none;color:var(--mbu-accent-text);font:inherit;font-size:12px;cursor:pointer}'
  + '.st-gate-seg button+button{border-left:1px solid var(--mbu-border)}'
  + '.st-gate-seg button:hover,#st-gate-mine:hover{background:var(--mbu-bg-hover)}'
  + '.st-gate-seg button[aria-pressed=true],#st-gate-mine[aria-pressed=true]{background:var(--mbu-accent-soft)}'
  + '#st-gate-mine{border:1px solid var(--mbu-border);border-radius:var(--mbu-radius)}'
  // the requests
  + '#st-gate-body{flex:1 1 auto;min-height:0;overflow:auto;scrollbar-width:thin;scrollbar-color:var(--mbu-border) transparent;border-top:1px solid var(--mbu-border-soft)}'
  + '#st-gate table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}'
  + '#st-gate .st-gate-cf{border:0;background:none;color:var(--mbu-text-weak);padding:2px 4px;margin-left:2px;cursor:pointer;border-radius:var(--mbu-radius);vertical-align:-1px}#st-gate .st-gate-cf:hover{background:var(--mbu-bg-hover)}#st-gate .st-gate-cf.on{color:var(--mbu-info);background:color-mix(in srgb,var(--mbu-info) 22%,transparent)}#st-gate .st-gate-cf.on svg{fill:currentColor}'
  + '.st-gate-cfp{position:fixed;z-index:2147483647;min-width:160px;max-width:260px;background:var(--mbu-bg);color:var(--mbu-text);border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);padding:4px;font-size:12px}'
  + '.st-gate-cfp input{width:100%;box-sizing:border-box;margin-bottom:4px;padding:4px 6px;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);background:var(--mbu-bg);color:var(--mbu-text);font:inherit}'
  + '.st-gate-cfp ul{list-style:none;margin:0;padding:0;max-height:220px;overflow:auto;scrollbar-width:thin;scrollbar-color:var(--mbu-border) transparent}.st-gate-cfp li{display:flex;gap:8px;padding:4px 6px;cursor:pointer;border-radius:var(--mbu-radius);white-space:nowrap}.st-gate-cfp li span{flex:1;overflow:hidden;text-overflow:ellipsis}.st-gate-cfp li b{font-weight:400;color:var(--mbu-text-weak)}.st-gate-cfp li:hover,.st-gate-cfp li.act{background:var(--mbu-bg-hover)}.st-gate-cfp li.on{color:var(--mbu-accent);font-weight:600}'
  + '#st-gate-span{margin-right:6px;padding:2px 4px;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);background:var(--mbu-bg);color:var(--mbu-text);font:inherit;font-size:12px}'
  + '#st-gate th{position:sticky;top:0;z-index:1;background:var(--mbu-bg);text-align:left;font-weight:600;font-size:12px;padding:5px 8px;border-bottom:1px solid var(--mbu-border)}'
  + '#st-gate td{padding:4px 8px;border-bottom:1px solid var(--mbu-divider);vertical-align:middle}'
  + '#st-gate tr.rq{cursor:pointer}#st-gate tr.rq:hover td,#st-gate tr.rq.open td{background:var(--mbu-bg-hover)}'
  + '#st-gate tr.rq.sel td,#st-gate tr.rq.sel+tr.steps td{background:color-mix(in srgb,var(--mbu-info) 24%,transparent)}#st-gate tr.rq.sel td:first-child,#st-gate tr.rq.sel+tr.steps td{box-shadow:inset 3px 0 var(--mbu-info)}'
  + '#st-gate tr.sys td{color:var(--mbu-text-weak)}'
  + '#st-gate tr.sys.lead td{background:color-mix(in srgb,var(--mbu-info) 8%,transparent)}'
  + '#st-gate tr.rq.wr td{background:color-mix(in srgb,var(--mbu-warn) 8%,transparent)}'
  + '#st-gate td.t,#st-gate td.tab,#st-gate td.w{white-space:nowrap;color:var(--mbu-text-weak)}#st-gate tr.me td.tab{color:var(--mbu-accent-text)}'
  + '#st-gate td.s{white-space:nowrap}#st-gate td.l{overflow-wrap:anywhere;font-family:var(--mbu-font-mono);font-size:12px}'
  + '#st-gate .i{color:var(--mbu-text-weak);font-size:11px}#st-gate td.v{font-family:var(--mbu-font-mono);font-size:11px;color:var(--mbu-text-weak)}'
  + [2, 3, 4, 5, 6, 8, 10, 11].map(function (n) { return '#st-gate.hc' + n + ' tr>:nth-child(' + n + ')'; }).join(',') + '{display:none}'
  + '#st-gate-hud-box{position:fixed;right:14px;bottom:14px;width:520px;max-width:calc(100vw - 28px);z-index:var(--mbu-z-modal);background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:6px;padding:4px 8px 4px 188px;font-size:12px;opacity:.92}'
  + '#st-gate-hud-box .st-gate-hud-h{cursor:move;user-select:none;display:flex;gap:8px;align-items:center;margin-left:-180px;height:22px}#st-gate-hud-box .st-gate-hud-h>span:first-child{font-weight:600;cursor:pointer}'
  + '#st-gate-hud-box .st-gate-n{flex:1;color:var(--mbu-text-weak)}#st-gate-hud-box .bad{color:var(--mbu-error)}'
  + '#st-gate-hud-box .st-gate-hud-l{position:relative}#st-gate-hud-box .st-gl-bands{left:0}#st-gate-hud-box .st-gl-name{left:-180px;width:172px}#st-gate-hud-box .st-gl-lane{height:20px}#st-gate-hud-box .st-gl-name{line-height:20px}#st-gate-hud-box .st-gl-w,#st-gate-hud-box .st-gl-f{top:3px;height:14px}'
  + '.st-gate-tries{display:inline-flex;gap:3px;vertical-align:middle}.st-gate-tries i{--c:var(--mbu-border);width:9px;height:9px;box-sizing:border-box;border-radius:2px;border:1px solid color-mix(in srgb,var(--c) 75%,transparent);background:color-mix(in srgb,var(--c) 30%,transparent)}'
  + '.st-gate-tries i.ok{--c:var(--mbu-ok)}.st-gate-tries i.re{--c:var(--mbu-warn)}.st-gate-tries i.bad{--c:var(--mbu-error)}.st-gate-tries i.go{--c:var(--mbu-info)}'
  + '.st-gate-pill{display:inline-block;padding:0 8px;border-radius:999px;font-size:12px;white-space:nowrap;background:var(--mbu-bg-hover)}'
  + '.st-gate-pill.ok{background:var(--mbu-ok-bg);color:var(--mbu-ok)}.st-gate-pill.re{background:var(--mbu-warn-bg);color:var(--mbu-warn)}'
  + '.st-gate-pill.bad{background:var(--mbu-error-bg);color:var(--mbu-error)}.st-gate-pill.go{background:var(--mbu-info-bg);color:var(--mbu-info)}'
  + '.st-gate-meter{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;font-size:12px;color:var(--mbu-text-weak)}'
  + '.st-gate-meter span{display:inline-block;width:48px;height:5px;border-radius:3px;background:var(--mbu-divider);overflow:hidden}.st-gate-meter span i{display:block;height:100%;background:var(--mbu-ok)}'
  + '.st-gate-meter.low span i{background:var(--mbu-warn)}.st-gate-meter.out span i{background:var(--mbu-error)}'
  + '#st-gate tr.steps td{padding:4px 8px 10px 28px;background:var(--mbu-bg-hover)}'
  + '#st-gate tr.steps ol{margin:0;padding:0;list-style:none;font-size:12px}#st-gate tr.steps li{display:flex;gap:10px}'
  + '#st-gate tr.steps li .t{color:var(--mbu-text-weak);white-space:nowrap}#st-gate tr.steps li .e{min-width:56px;font-weight:600}#st-gate tr.steps li.bad .e{color:var(--mbu-error)}'
  + '.st-gl-req{position:relative;margin:2px 0 8px;max-width:640px}.st-gl-req .st-gl-lane{border-top:0;background:var(--mbu-bg);height:15px}.st-gl-req .st-gl-w,.st-gl-req .st-gl-f{top:2px;height:11px}.st-gl-req .st-gl-ax span:nth-child(2){transform:translateX(-50%)}'
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
    case 'hidden': x.push('waits for the queue to be free, now ' + stGateSec(ev.w) + (ev.cap ? ', at most ' + stGateSec(ev.cap) : '') + ' (this tab is hidden)'); break;
    case 'lead': x.push('waits up to ' + stGateSec(ev.w) + ' for a page being drawn (' + (ev.by || '?') + ')'); break;
    case 'lead+': x.push('takes the lead for ' + stGateSec(ev.w) + ' (' + (ev.by || '?') + ')'); break;
    case 'lead-': x.push((ev.why === 'lapsed' ? 'the lead lapsed (' : 'ends the lead (') + (ev.by || '?') + ')'); break;
    case 'giveup': x.push('gives up after ' + (ev.n || 1) + (ev.n > 1 ? ' tries' : ' try') + (ev.st ? ' (HTTP ' + ev.st + ')' : '')); break;
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
// -2: dropped (cancelled after its start) · -3: lost (no answer ever came)
function stGateTryCls(st) { return st == null ? 'go' : st === -2 ? 'off' : st === -1 || st === -3 ? 'bad' : stGateThrottled(st) ? 're' : st >= 500 || !st ? 'bad' : 'ok'; }
function stGateTryTip(st) { return st == null ? 'On its way' : st === -1 ? 'Network error' : st === -2 ? 'Dropped, no answer awaited' : st === -3 ? 'No answer seen' : 'HTTP ' + st; }
// a try still open this long is lost: MusicBrainz answers in seconds, and a lost start used to draw
// a solid "on its way" bar up to now for a whole minute
var ST_GATE_LOST = 30000;

// The events, grouped into requests. An event with an id (mbnRid) belongs to that request. One
// without (an older event, or a caller that gives none) goes by the run of events with the same
// tab, script, label and kind: it ends at an answer that is not a
// 429/503, at an error, a cancel, or a 429/503 that no retry follows within ST_GATE_RETRY (the gate
// books the retry at once). A join or a cache answer is a request of its own, or ends the open one
// with its id; an event without a label (the lead, the browser check) is a system row.
// A request: { id, tab, s, l, b, t, end, evs, tries: [{ t, w, st, end }], res, cls, label, wait }
//   cls: ok | re (answered after a retry) | bad | go (still on its way) | '' (shared, cached, cancelled)
var ST_GATE_COLS = [[2, 'Tab'], [3, 'Script'], [4, 'Verb'], [5, 'Reason'], [6, 'Entity'], [8, 'Tries'], [10, 'Wait'], [11, 'Rate limit']];
function stGateGroups(all, now) {
  var groups = [], open = {};
  var done = function (g, res) { g.res = res; delete open[g.key]; };
  all.forEach(function (ev) {
    if (!ev.l) { groups.push({ sys: true, id: 'y' + ev.tab + ev.t + ev.e, tab: ev.tab, s: ev.s, t: ev.t, end: ev.t, evs: [ev], tries: [] }); return; }
    var key = ev.tab + '|' + (ev.s || '') + '|' + (ev.id ? '#' + ev.id : ev.l + '|' + ev.b), g = open[key];
    if (g && g.pend && ev.t - g.pend > ST_GATE_RETRY) { done(g, 'gave up'); g = null; }
    // a request that waited, then found a twin's answer just before it left (or before a retry), ends there
    if ((ev.e === 'join' || ev.e === 'cache') && g) { g.evs.push(ev); g.end = ev.t; g.pend = 0; done(g, ev.e === 'join' ? 'shared' : 'cached'); return; }
    if (ev.e === 'join' || ev.e === 'cache') { groups.push({ id: (ev.e === 'join' ? 'j' : 'c') + key + ev.t, key: key, tab: ev.tab, s: ev.s, r: ev.r, en: ev.en, l: ev.l, m: ev.m, u: ev.u, h: ev.h, b: ev.b, t: ev.t, end: ev.t, evs: [ev], tries: [], res: ev.e === 'join' ? 'shared' : 'cached' }); return; }
    if (!g) { g = open[key] = { id: 'r' + key + ev.t, key: key, tab: ev.tab, s: ev.s, r: ev.r, en: ev.en, l: ev.l, m: ev.m, u: ev.u, h: ev.h, b: ev.b, t: ev.t, end: ev.t, evs: [], tries: [] }; groups.push(g); }
    g.evs.push(ev); g.end = ev.t;
    if (ev.e !== 'answer') g.pend = 0;
    var last = g.tries[g.tries.length - 1];
    // without an id, two requests with the same label overlap in one run: an answer goes to the
    // oldest open try (first in, first out) and the run stays open while another try waits
    var open1 = function () { for (var i = 0; i < g.tries.length; i++) if (g.tries[i].st == null) return g.tries[i]; return null; };
    if (ev.e === 'start') { g.tries.push({ t: ev.t, w: ev.w || 0 }); if (ev.bs != null) g.bs = ev.bs; }
    else if (ev.e === 'answer') {
      var x = ev.id ? (last && last.st == null ? last : null) : open1();
      if (x) { x.st = ev.st || 0; x.end = ev.t; } else g.tries.push({ t: ev.t, w: 0, st: ev.st || 0, end: ev.t });
      g.ans = ev;
      if (stGateThrottled(ev.st)) g.pend = ev.t; else if (ev.id || !open1()) done(g, String(ev.st || 'no status'));
    } else if (ev.e === 'error') { x = ev.id ? (last && last.st == null ? last : null) : open1(); if (x) { x.st = -1; x.end = ev.t; } done(g, 'error'); }
    else if (ev.e === 'giveup') done(g, 'gave up');
    else if (ev.e === 'cancel') { g.tries.forEach(function (y) { if (y.st == null) { y.st = -2; y.end = ev.t; } }); done(g, 'cancelled'); }
  });
  groups.forEach(function (g) {
    if (g.sys) { var y = g.evs[0]; g.cls = stGateBad(y) ? 'bad' : ''; g.label = y.e === 'check' ? (y.ok ? 'check passed' : 'check failed') : y.e; return; }
    if (!g.res) {
      if (g.pend) g.res = now - g.pend > ST_GATE_RETRY ? 'gave up' : 'retrying';
      else if (now - g.end > ST_GATE_LOST) g.res = 'no answer';   // its tab went away mid-request, or its answer was never told
      else g.res = g.tries.length ? 'in flight' : 'waiting';
    }
    // a finished request has no try on its way: one left open is lost, drawn as a tick, not up to now
    if (g.res !== 'in flight' && g.res !== 'waiting' && g.res !== 'retrying') g.tries.forEach(function (x) { if (x.st == null) { x.st = -3; x.end = Math.min(x.t + 1000, now); } });
    var st = g.ans ? g.ans.st : 0, retried = g.tries.length > 1;
    if (g.res === 'in flight' || g.res === 'waiting' || g.res === 'retrying') g.cls = 'go';
    else if (g.res === 'shared' || g.res === 'cached') g.cls = g.tries.length ? 're' : '';   // after a 503: answered after a retry
    else if (g.res === 'cancelled') g.cls = '';
    else if (g.res === 'gave up' || g.res === 'error' || g.res === 'no answer' || !st || st >= 500) g.cls = 'bad';
    else g.cls = retried ? 're' : 'ok';
    g.label = g.res === 'gave up' && st ? st + ', gave up' : g.res === '200' ? 'OK' : g.res;
    if (retried && g.cls !== 'go') g.label += ' (' + g.tries.length + ')';
    g.wait = g.tries.reduce(function (n, x) { return n + (x.w || 0); }, 0);
  });
  return groups;
}
// how many went to MusicBrainz and how many to other hosts
function stGateSplit(groups) {
  var mb = 0, ext = 0;
  groups.forEach(function (g) { if (g.sys) return; if (g.h) ext++; else mb++; });
  return mb && ext ? ' (' + mb + ' MusicBrainz, ' + ext + ' external)' : ext ? ' (all external)' : '';
}
function stGateCount(groups) {
  var c = { n: 0, ok: 0, re: 0, bad: 0, go: 0 };
  groups.forEach(function (g) { if (g.sys) return; c.n++; if (c[g.cls] != null) c[g.cls]++; });
  return c;
}
// the totals line: every request kept, and those of the last span
function stGateSumHtml(groups, now) {
  var all = stGateCount(groups), recent = groups.filter(function (g) { return now - g.t <= ST_GATE_SPAN; }), c = stGateCount(recent);
  var starts = recent.filter(function (g) { return !g.sys && g.tries.length; }).map(function (g) { return g.tries[0].t; }).sort(function (a, b) { return a - b; });
  var gap = starts.length > 1 ? (starts[starts.length - 1] - starts[0]) / (starts.length - 1) : 0;
  var tabs = {}; recent.forEach(function (g) { tabs[g.tab] = 1; });
  var n = Object.keys(tabs).length;
  return '<b>' + all.n + '</b> request' + (all.n === 1 ? '' : 's') + ' in the log · last ' + stGateSpanTxt() + ': <b>' + c.n + '</b>'
    + (gap ? ' (one every ' + stGateSec(gap) + ')' : '') + stGateSplit(recent).replace(/^ \((.*)\)$/, ' · $1').replace(/(\d+)/g, '<b>$1</b>') + ' · <b>' + c.ok + '</b> ok · <span class="re"><b>' + c.re + '</b> retried</span>'
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
// the span: one lane per tab, a bar per try (its wait weak, its flight in its result's colour),
// and a band across every lane for each hold MusicBrainz asked for
// a script's icon, from its @icon or its launcher; String Theory's for an unknown one
function stGateIconSrc(name) {
  name = String(name || '').replace(/[^\w)]+$/, '');
  var m = (typeof stMembers !== 'undefined' ? stMembers : []).filter(function (x) { return x[1] === name || x[0] === name; })[0];
  if (m && m[3]) return m[3];
  var k = (typeof mbuShared === 'function' && mbuShared('dockKnown')) || {}, h = k[name], src = h && /src="([^"]+)"/.exec(h);
  return src ? src[1].replace(/&amp;/g, '&') : ST_ICON;
}
// a timeline mark carries its request's id, so a click on it opens that row
function stGateTag(html, id) { return id == null ? html : html.replace(/^<(\w+)/, '<$1 data-id="' + stEsc(String(id)) + '"'); }
function stGateIcon(name, cls, tip, left) {
  return '<img class="st-gl-ic' + (cls ? ' ' + cls : '') + '" alt=""' + (tip ? ' data-tip="' + stEsc(tip) + '"' : '') + (left != null ? ' style="left:' + left.toFixed(2) + '%"' : '') + ' src="' + stEsc(stGateIconSrc(name)) + '">';
}
// requests shorter than ST_GATE_SHORT ms are drawn as an icon; icons closer than ST_GATE_NEAR overlap
var ST_GATE_SHORT = 1500, ST_GATE_NEAR = 2.2, stGateZoom = {};
// the zoomed view of a cluster: its own time line and one line per request
// the cluster's count as a pill: MusicBrainz requests in one half, other sites in the other; an empty half is left out
function stGatePill(gs) {
  var x = gs.filter(function (g) { return g.h; }).length, m = gs.length - x;
  return '<b>' + (m ? '<i class="m">' + m + '</i>' : '') + (x ? '<i class="x">' + x + '</i>' : '') + '</b>';
}
// a site with no icon of its own: the first letter of its name on a tile, in a color taken from the name
function stGateLetter(h) {
  var p = String(h).replace(/^https?:\/\//, '').split('/')[0].split(':')[0].split('.').filter(function (x) { return x !== 'www' && x !== 'api'; });
  var n = p.length > 1 ? p[p.length - 2] : (p[0] || '?'), c = 0;
  for (var i = 0; i < n.length; i++) c = (c * 31 + n.charCodeAt(i)) % 360;
  return '<b class="st-gl-lt" style="background:hsl(' + c + ',55%,42%)">' + stEsc(n.charAt(0).toUpperCase()) + '</b>';
}
function stGateZoomIcon(x, left) {
  stGateIcons();
  var k = x.g.h ? stGateHostKey(x.g.h) : '';
  if (!x.g.h) return stGateIcon(x.g.s, 'at ' + x.cls, '', left);
  return '<span class="st-gl-pi" style="left:' + left.toFixed(2) + '%">' + (k ? stIcon(k, 24) : stGateLetter(x.g.h)) + stGateIcon(x.g.s, '', '') + '</span>';
}
function stGateZoomHtml(items, now) {
  var a = Math.min.apply(null, items.map(function (x) { return x.a; })), b = Math.max.apply(null, items.map(function (x) { return x.b; }));
  var span = Math.max(b - a, 200), pad = span * 0.08; a -= pad; span += pad * 2;
  var pct = function (t) { return (t - a) / span * 100; };
  return '<div class="st-gl-zh">' + items.length + ' requests in ' + stGateSec(b - a - pad * 2) + stGateSplit(items.map(function (x) { return x.g; })) + '</div>' + items.map(function (x) {
    var w = Math.max(pct(x.b) - pct(x.a), 1.5);
    return stGateTag('<div class="st-gl-zr">', x.g.id) + '<span class="st-gl-zn">' + (x.g.h ? '<span class="h">' + stEsc(x.g.h.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '')) + '</span>' : '') + stGateLabelHtml(x.g) + '</span>'
      + '<span class="st-gl-zl"><i class="st-gl-f ' + x.cls + '" style="left:' + pct(x.a).toFixed(2) + '%;width:' + w.toFixed(2) + '%"></i>' + stGateZoomIcon(x, pct(x.a)) + '</span>'
      + '<span class="st-gl-zt">' + stGateSec(x.b - x.a) + '</span></div>';
  }).join('');
}
function stGateLanesHtml(groups, all, now, me) {
  stGateZoomWire();
  var t0 = now - ST_GATE_SPAN, pct = function (t) { return Math.max(0, Math.min(100, (t - t0) / ST_GATE_SPAN * 100)); };
  var bar = function (cls, a, b, tip) { return '<i class="' + cls + '"' + (tip ? ' data-tip="' + stEsc(tip) + '"' : '') + ' style="left:' + pct(a).toFixed(2) + '%;width:' + (pct(b) - pct(a)).toFixed(2) + '%"></i>'; };
  var lanes = {}, order = [];
  stGateZoom = {};
  groups.forEach(function (g) {
    if (g.sys || (g.cls !== 'go' && g.end < t0)) return;
    if (!lanes[g.tab]) { lanes[g.tab] = { s: {}, bars: [] }; order.push(g.tab); }
    var L = lanes[g.tab], from = g.t;
    if (g.s) L.s[g.s] = 1;
    var last = g.tries.length ? g.tries[g.tries.length - 1] : null, gEnd = g.res === 'waiting' ? now : Math.max(g.end || g.t, last ? last.end || now : g.t);
    var item = { g: g, a: g.t, b: gEnd, cls: last ? stGateTryCls(last.st) : 'off' };
    if (gEnd - g.t < ST_GATE_SHORT && g.cls !== 'go') { (L.short = L.short || []).push(item); return; }
    item.head = 1; (L.short = L.short || []).push(item);   // a long bar's start icon; overlapping ones become one icon with a count
    var who = (g.s ? g.s + '\n' : '') + stGateAlias(g.l);
    g.tries.forEach(function (x) {
      var end = x.end || now;
      if (x.t > from) L.bars.push(stGateTag(bar('st-gl-w', from, x.t, who + '\nWaits in the gate'), g.id));
      L.bars.push(stGateTag(bar('st-gl-f ' + stGateTryCls(x.st), x.t, end, who + '\n' + stGateTryTip(x.st) + ' · ' + stGateSec(end - x.t)), g.id));
      from = end;
    });
    if (g.res === 'waiting') L.bars.push(stGateTag(bar('st-gl-w', from, now, who + '\nWaits in the gate'), g.id));
  });
  if (me && !lanes[me]) { lanes[me] = { s: {}, bars: [] }; order.push(me); }
  order.sort(function (a, b) { return (b === me) - (a === me); });   // this tab first
  var bands = all.filter(function (ev) { return ev.e === 'answer' && ev.hold && ev.t + ev.hold > t0; }).map(function (ev) {
    return bar('st-gl-band', ev.t, ev.t + ev.hold);
  }).join('');
  var zid = 0;
  order.forEach(function (tab) {
    var sh = (lanes[tab].short || []).sort(function (x, y) { return x.a - y.a; }), run = [];
    var one = function (x) { return stGateTag(stGateIcon(x.g.s, 'at ' + x.cls, (x.g.s ? x.g.s + '\n' : '') + stGateAlias(x.g.l), pct(x.a)), x.g.id); };
    var flush = function () {
      if (!run.length) return;
      var at = pct(run[0].a);
      if (run.length === 1) {
        var x = run[0];
        if (x.head) lanes[tab].bars.push(one(x)); else lanes[tab].bars.push(stGateTag(stGateIcon(x.g.s, 'one ' + x.cls, (x.g.s ? x.g.s + '\n' : '') + stGateAlias(x.g.l) + '\n' + stGateTryTip(x.g.tries.length ? x.g.tries[x.g.tries.length - 1].st : '') + ' · ' + stGateSec(x.b - x.a), at), x.g.id));
      } else {
        var id = 'z' + (zid++);
        stGateZoom[id] = stGateZoomHtml(run, now);
        var bad = run.some(function (x) { return x.cls === 'bad'; });
        lanes[tab].bars.push('<span class="st-gl-cl' + (bad ? ' bad' : '') + '" data-z="' + id + '" data-ids="' + stEsc(JSON.stringify(run.map(function (x) { return x.g.id; }))) + '" style="left:' + at.toFixed(2) + '%">' + stGateIcon(run.every(function (x) { return stGateIconSrc(x.g.s) === stGateIconSrc(run[0].g.s); }) ? run[0].g.s : 'String Theory', '', '') + stGatePill(run.map(function (x) { return x.g; })) + '</span>');
      }
      run = [];
    };
    sh.forEach(function (x) { if (run.length && pct(x.a) - pct(run[run.length - 1].a) > ST_GATE_NEAR) flush(); run.push(x); });
    flush();
  });
  var rows = order.map(function (tab) {
    var s = Object.keys(lanes[tab].s).join(', ');
    return '<div class="st-gl-lane' + (tab === me ? ' me' : '') + '"><span class="st-gl-name" data-tip="' + stEsc('Tab ' + tab + (tab === me ? ' (this tab)' : '') + (s ? '\n' + s : '')) + '"><b>'
      + stEsc(tab === me ? 'This tab' : tab.slice(0, 8)) + '</b>' + (s ? ' ' + stEsc(s) : '') + '</span>' + lanes[tab].bars.join('') + '</div>';
  }).join('') || '<div class="st-gl-lane"><span class="st-gl-none">No requests in the last ' + stGateSpanTxt() + '</span></div>';
  return '<div class="st-gl-bands">' + bands + '</div>' + rows
    + '<div class="st-gl-ax">' + [0, 25, 50, 75].map(function (p) { return '<span style="left:' + p + '%">−' + stGateSpanTxt(ST_GATE_SPAN * (100 - p) / 100).replace(/\.\d+/, function (d) { return d.length > 2 ? d.slice(0, 2) : d; }) + '</span>'; }).join('') + '<span style="left:100%">now</span></div>';
}
function stGateZoomWire() {
  if (stGateZoomWire.on) return; stGateZoomWire.on = 1;
  var pop = null, bye = 0;
  // the popup stays a moment after the mouse leaves, so it can cross the gap and click a row in it
  document.addEventListener('mouseover', function (e) {
    var c = e.target.closest && e.target.closest('.st-gl-cl');
    if (!c) {
      if (!pop) return;
      if (e.target.closest && e.target.closest('.st-gl-zoom')) { clearTimeout(bye); return; }
      clearTimeout(bye); bye = setTimeout(function () { if (pop) pop.remove(), pop = null; }, 400);
      return;
    }
    clearTimeout(bye);
    if (pop && pop.dataset.z === c.dataset.z) return;
    if (pop) pop.remove();
    pop = document.createElement('div'); pop.className = 'st-gl-zoom'; pop.dataset.z = c.dataset.z;
    pop.innerHTML = stGateZoom[c.dataset.z] || '';
    document.body.appendChild(pop);
    var r = c.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, r.left + r.width / 2 - w / 2)) + 'px';
    pop.style.top = (r.top - h - 6 >= 4 ? r.top - h - 6 : r.bottom + 6) + 'px';
  });
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
function stGateBytes(n) { return n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 102.4) / 10 + ' KB' : Math.round(n / 104857.6) / 10 + ' MB'; }
// a column filter's value for one request: a field, or what a column shows, put in a few kinds
function stGateCfVal(g, k) {
  if (k === 'r') return String(g.r || '');
  if (k === 'e') { var en = stGateEntity(g); return en ? en.replace(/_/g, ' ') : g.h ? stGateHostKey(g.h) || g.h : ''; }
  if (k === 'rq') return String(stGateAlias(g.l) || '').replace(RegExp('[0-9a-f]{8}-[0-9a-f-]{27}|[0-9]+', 'g'), '…');
  if (k === 'n') return g.sys ? '' : String(g.tries.length);
  if (k === 'res') return g.label || '';
  if (k === 'wt') { var w = (g.wait || 0) / 1000; return w < 1 ? 'under 1 s' : w < 5 ? '1 to 5 s' : w < 30 ? '5 to 30 s' : '30 s or more'; }
  if (k === 'rl') return g.ans && g.ans.who ? String(g.ans.who) : '';
  return String(g[k] || '');
}
var stGateUrlAll = {};   // the rows whose whole URL shows, not only its first line
var stGateSel = {};   // the rows last picked on the time line
function stGateRowHtml(g, me, isOpen, now) {
  var tab = '<td class="tab">' + stEsc(g.tab === me ? 'this tab' : String(g.tab).slice(0, 8)) + '</td>';
  if (g.sys) {
    return '<tr class="sys' + (/^lead/.test(g.evs[0].e) ? ' lead' : '') + (g.tab === me ? ' me' : '') + '"><td class="t">' + stGateTime(g.t) + '</td>' + tab + '<td class="s">' + stEsc(g.s || '') + '</td>'
      + '<td class="v"></td><td></td><td></td><td class="l">' + stEsc(stGateWhat(g.evs[0])) + '</td><td></td><td><span class="st-gate-pill ' + g.cls + '">' + stEsc(g.label) + '</span></td><td></td><td></td><td></td></tr>';
  }
  var tries = g.tries.map(function (x) { return '<i class="' + stGateTryCls(x.st) + '" data-tip="' + stGateTryTip(x.st) + '"></i>'; }).join('');
  var a = g.ans, meter = '';
  if (a && a.lim && a.rem != null) {
    var share = Math.max(0, Math.min(1, a.rem / a.lim));
    meter = '<span class="st-gate-meter' + (a.rem <= 0 ? ' out' : share < 0.25 ? ' low' : '') + '" data-tip="' + stEsc('Rate limit' + (a.who ? ' (' + a.who + ')' : '') + ': ' + a.rem + ' of ' + a.lim + ' left' + (a.rst ? '\nReset in ' + a.rst + ' s' : '')) + '"><span><i style="width:' + Math.round(share * 100) + '%"></i></span>' + a.rem + '/' + a.lim + '</span>';
  }
  var flight = g.tries.reduce(function (n, x) { return n + (x.end ? x.end - x.t : 0); }, 0);
  var row = '<tr class="rq' + (g.m && g.m !== 'GET' ? ' wr' : '') + (g.tab === me ? ' me' : '') + (isOpen ? ' open' : '') + (stGateSel[g.id] ? ' sel' : '') + '" data-id="' + stEsc(g.id) + '"><td class="t">' + stGateTime(g.t) + '</td>' + tab
    + '<td class="s">' + stEsc(g.s || '') + (g.b === 0 ? ' <span class="i" data-tip="Interactive: a click or a search\nIt goes ahead of background work">(i)</span>' : '') + '</td>'
    + '<td class="v">' + stEsc(g.m || '') + '</td><td class="r">' + stEsc(g.r || '') + '</td><td class="e">' + stGateEntHtml(g) + '</td><td class="l"' + (g.u || g.h ? ' data-tip="' + stEsc((g.h ? g.h : '') + (g.u || '')) + '"' : '') + '>' + (g.h ? '<span class="i">' + stEsc(g.h) + '</span> ' : '') + stGateLabelHtml(g) + '</td><td><span class="st-gate-tries">' + tries + '</span></td>'
    + '<td><span class="st-gate-pill ' + g.cls + '">' + stEsc(g.label) + '</span></td>'
    + '<td class="w" data-tip="Waited in the gate + on the way">' + stGateSec(g.wait) + (flight ? ' + ' + stGateSec(flight) : '') + '</td><td>' + meter + '</td><td></td></tr>';
  if (!isOpen) return row;
  var full = (g.h || '') + (g.u || (stGateAlias(g.l) !== g.l ? g.l : ''));
  var qs = String(g.u || g.l || ''), qi = qs.indexOf('?'), nq = qi < 0 ? 0 : qs.slice(qi + 1).split('&').filter(Boolean).length;
  var facts = [nq + (nq === 1 ? ' query parameter' : ' query parameters')];
  // a ws/2 inc= asks for several parts at once: count them
  var incs, inc = /[?&]inc=([^&#]*)/.exec(qs), incs = inc ? decodeURIComponent(inc[1].replace(/\+/g, ' ')).split(/\s+/).filter(Boolean) : [], ni = incs.length;
  if (ni) {
    // grouped: the relationships (…-rels) apart from the rest
    var rels = incs.filter(function (x) { return /-rels$/.test(x); }).map(function (x) { return x.replace(/-rels$/, ''); });
    var other = incs.filter(function (x) { return !/-rels$/.test(x); });
    facts.push(ni + (ni === 1 ? ' inc component' : ' inc components'));
    if (other.length) facts.push('<b class="st-gate-k">data:</b> ' + stEsc(other.join(', ')));
    if (rels.length) facts.push('<b class="st-gate-k">relationships:</b> ' + stEsc(rels.join(', ')));
  }
  var lim = /[?&]limit=(\d+)/.exec(qs), off = /[?&]offset=(\d+)/.exec(qs);
  if (lim) facts.push('<b class="st-gate-k">limit:</b> ' + lim[1] + (off ? ', offset ' + off[1] : ''));
  if (g.bs != null) facts.push('body ' + stGateBytes(g.bs)); else if (g.m && g.m !== 'GET') facts.push('body size unknown');
  return row + '<tr class="steps"><td colspan="12">' + (full ? '<div class="st-gate-url' + (stGateUrlAll[g.id] ? ' all' : '') + '" data-tip="Click to show the whole URL or only its first line">' + stEsc(full) + '</div>' : '') + '<div class="st-gate-facts">' + facts.join(' · ') + '</div>' + stGateReqLaneHtml(g, now || Date.now()) + '<ol>' + g.evs.map(function (ev) {
    return '<li' + (stGateBad(ev) ? ' class="bad"' : '') + '><span class="t">' + stGateTime(ev.t) + '</span><span class="e">' + stEsc(ev.e) + '</span><span>' + stEsc(stGateWhat(ev)) + '</span></li>';
  }).join('') + '</ol></td></tr>';
}
// a short name for a raw URL or path: "ws/2 url lookup (24)", "ws/2 release by release-group"
function stGateAlias(l) {
  l = String(l || '');
  if (!/^(https?:|\/|ws\/)/.test(l) && l.indexOf('?') < 0) return l;
  var q = l.indexOf('?'), path = (q < 0 ? l : l.slice(0, q)).replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '');
  var qs = q < 0 ? '' : l.slice(q + 1).split('#')[0];
  // a collection tick (Event Horizon) adds or removes an entity, despite the "collaborator" in its path
  var cc = path.match(RegExp("^collection.[0-9a-f-]{36}.collection_collaborator.(add|remove)$"));
  if (cc) {
    var ce = qs.match(/^([a-z_-]+)=([0-9a-f]{0,8})/);
    return (cc[1] === 'add' ? 'add to collection' : 'remove from collection') + (ce ? ': ' + ce[1].replace(/_/g, ' ') + ' ' + ce[2] + '…' : '');
  }
  var p = path.replace(/ /g, '/').split('/').filter(Boolean), keys = {};
  qs.split('&').forEach(function (kv) { var k = decodeURIComponent(kv.split('=')[0] || ''); if (k) keys[k] = (keys[k] || 0) + 1; });
  var mbid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
  var head = p[0] === 'ws' && p[1] ? 'ws/' + p[1] : p[0] || '/';
  var ent = p[0] === 'ws' ? p[2] : p[1], id = p[0] === 'ws' ? p[3] : p[2];
  var out = head + (ent ? ' ' + ent : '');
  if (id) out += mbid.test(id) ? ' lookup' : ' ' + id;
  else if (keys.query) out += ' search';
  else if (keys.resource) out += ' lookup' + (keys.resource > 1 ? ' (' + keys.resource + ')' : '');
  else {
    var by = Object.keys(keys).filter(function (k) { return !/^(inc|fmt|limit|offset|type|status)$/.test(k); });
    if (by.length) out += ' by ' + by.join(', ');
  }
  return out;
}
// the MusicBrainz entity a request is about, from its path: "/ws/2/release-group?…", "/recording/<mbid>"
var ST_GATE_ENTS = ['area', 'artist', 'event', 'genre', 'instrument', 'label', 'place', 'recording', 'release', 'release_group', 'series', 'url', 'work'];
function stGateEntity(g) {
  if (g.en) return String(g.en).replace(/-/g, '_');
  if (g.h) return '';
  var p = String(g.u || g.l || '').split('?')[0].replace(/^https?:\/\/[^/]+/, '').replace(/ /g, '/').split('/').filter(Boolean);
  if (p[0] === 'ws') p = p.slice(2);
  var e = (p[0] || '').replace(/-/g, '_');
  return ST_GATE_ENTS.indexOf(e) >= 0 ? e : '';
}
// a row starts with its entity's icon (MBU-ENT-ICONS), or for another site with that site's platform icon (ST-ICONS)
var ST_GATE_HOSTS = { itunes: 'apple', music: 'apple', 'youtu': 'youtube', '7digital': 'sevendigital' };
function stGateHostKey(h) {
  var p = String(h || '').replace(/^https?:\/\//, '').split('/')[0].split(':')[0].split('.').filter(function (x) { return x !== 'www' && x !== 'api'; });
  for (var i = 0; i < p.length - 1; i++) { var k = ST_GATE_HOSTS[p[i]] || p[i]; if (typeof ST_ICONS !== 'undefined' && ST_ICONS[k] && k !== 'globe') return k; }
  return '';
}
// the icons live in the bundle's shared factories (#786), outside this window's scope: take them once
var ST_ICONS, stIcon, MBU_ENT_ICONS, stGateIconsOk;
function stGateIcons() {
  if (stGateIconsOk) return;
  stGateIconsOk = true;
  try { var i = __st_ICONS(GM_info); ST_ICONS = i.ST_ICONS; stIcon = i.stIcon; } catch (e) {}
  try { MBU_ENT_ICONS = __st_UI(GM_info).MBU_ENT_ICONS; } catch (e) {}
}
// the Entity cell: the entity's icon (MBU-ENT-ICONS) or another site's platform icon (ST-ICONS), with its name
function stGateEntHtml(g) {
  stGateIcons();
  var e = stGateEntity(g), ic = '';
  if (e && typeof MBU_ENT_ICONS !== 'undefined' && MBU_ENT_ICONS[e.replace('_', '-')]) ic = '<svg class="st-gate-ent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + MBU_ENT_ICONS[e.replace('_', '-')] + '</svg>';
  else if (g.h) { var k = stGateHostKey(g.h); if (k) ic = stIcon(k, 14).replace('<svg', '<svg class="st-gate-ent" aria-hidden="true"'); }
  return ic ? ic + stEsc(e ? e.replace(/_/g, ' ') : stGateHostKey(g.h) || '') : '';
}
// the Request cell: the entity column names the entity, so the label drops its leading entity word
function stGateLabelHtml(g) {
  var t = stEsc(stGateAlias(g.l)), e = stGateEntity(g);
  return e ? t.replace(new RegExp('^' + e.replace(/[_-]/g, '[ _-]') + 's?\\s+', 'i'), '') : t;
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
      + ' | ' + cell((ev.m ? ev.m + ' ' : '') + (ev.h ? ev.h + ' ' : '') + ev.l) + (ev.u ? ' (' + cell(ev.u) + ')' : '') + ' | ' + cell(stGateWhat(ev)) + ' |');
  });
  return out.join('\n');
}

// the window's remembered state: open, min, full, left, top, w, h, mode, mine
function stGateWinState() { try { return JSON.parse(GM_getValue(ST_GATE_WIN, '{}') || '{}') || {}; } catch (e) { return {}; } }
// a column filter: a funnel in the header opens a list of the column's values, narrowed by typing
function stGateCfBtn(k) { return '<button type="button" class="st-gate-cf" data-cf="' + k + '" aria-label="Filter this column, right click clears the filter"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18l-7 8v7l-4 2v-9z"/></svg></button>'; }
function stGateRemember(patch) { try { GM_setValue(ST_GATE_WIN, JSON.stringify(Object.assign(stGateWinState(), patch))); } catch (e) { /* no storage: it just forgets */ } }
// at start: the window comes back if it was left open (top frame only)
function stGateReopen() {
  var w;
  try { if (window.top !== window) return; w = stGateWinState(); if (!w.open && !w.hud) return; } catch (e) { return; }
  var go = function () {
    try { if (w.hud) stGateHud(true); } catch (e) { /* no HUD */ }
    try { if (w.open) stGateOpen(true); } catch (e) { /* no window */ }
  };
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go, { once: true });
}
function stGateCss() {
  if (document.getElementById('st-gate-css')) return;
  var css = document.createElement('style'); css.id = 'st-gate-css';
  css.textContent = stTokens().MBU_TOKENS + stUI().MBU_UI_CSS + ST_GATE_CSS;
  (document.head || document.documentElement).appendChild(css);
}
// the HUD: the lanes in a small strip at the bottom right, on screen without the window
var stGateHudEl = null;
function stGateHud(on) {
  if (stGateHudEl) { clearInterval(stGateHudEl.timer); stGateHudEl.remove(); stGateHudEl = null; }
  stGateRemember({ hud: !!on });
  if (!on) return;
  stGateCss();
  var el = document.createElement('div');
  el.id = 'st-gate-hud-box'; el.className = 'mbu-ui';
  el.innerHTML = '<div class="st-gate-hud-h"><span>Network</span><span class="st-gate-n"></span><button type="button" class="mbu-ov-x" aria-label="Close the HUD">✕</button></div><div class="st-gate-hud-l"></div>';
  document.documentElement.appendChild(el);
  var held = false, lanes = el.querySelector('.st-gate-hud-l');
  lanes.addEventListener('mouseenter', function () { held = true; });
  lanes.addEventListener('mouseleave', function () { held = false; });
  el.querySelector('.mbu-ov-x').onclick = function () {
    stGateHud(false);
    var b = document.getElementById('st-gate-hud'); if (b) b.setAttribute('aria-pressed', 'false');
  };
  var moved = false, pos = stGateWinState().hudPos;
  if (pos) Object.assign(el.style, { left: pos.left, top: pos.top, right: 'auto', bottom: 'auto' });
  el.querySelector('.st-gate-hud-h span').onclick = function () { if (!moved) stGateOpen(); };
  // dragged by its header, kept on screen
  el.querySelector('.st-gate-hud-h').addEventListener('mousedown', function (e) {
    if (e.button !== 0 || e.target.closest('button')) return;
    e.preventDefault(); moved = false;
    var r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    var mv = function (ev) {
      moved = true;
      Object.assign(el.style, { right: 'auto', bottom: 'auto',
        left: Math.max(0, Math.min(window.innerWidth - el.offsetWidth, ev.clientX - ox)) + 'px',
        top: Math.max(0, Math.min(window.innerHeight - el.offsetHeight, ev.clientY - oy)) + 'px' });
    };
    var up = function () {
      document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
      if (moved) stGateRemember({ hudPos: { left: el.style.left, top: el.style.top } });
      setTimeout(function () { moved = false; }, 0);
    };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });
  var draw = function () {
    if (!el.isConnected) { clearInterval(el.timer); return; }
    try {
      var all = stGateEvents(), now = Date.now(), groups = stGateGroups(all, now), c = stGateCount(groups.filter(function (g) { return now - g.t <= ST_GATE_SPAN; }));
      el.querySelector('.st-gate-n').innerHTML = c.n + ' in ' + stGateSpanTxt() + (c.bad ? ' · <span class="bad">' + c.bad + ' failed</span>' : '') + (c.go ? ' · ' + c.go + ' on the way' : '');
      if (!held) lanes.innerHTML = stGateLanesHtml(groups, all, now, stGateTab());
    } catch (e) { /* a bad event: the next tick tries again */ }
  };
  el.timer = setInterval(draw, 1000);
  stGateHudEl = el;
  draw();
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
    try { console.error('String Theory: the Network log failed to open', e); } catch (x) { /* no console */ }
    if (stGateWin) { try { stGateWin.off(); } catch (x) { /* gone */ } stGateWin = null; }
    var left = document.getElementById('st-gate');
    if (left) left.remove();
    try { GM_setValue(ST_GATE_WIN, '{}'); } catch (x) { /* no storage */ }
    stGateBuild();
  }
}

function stGateBuild() {
  var U = stUI();
  stGateCss();
  stGateRemember({ open: true });
  var st = stGateWinState();
  if (ST_GATE_SPANS.indexOf(st.span) >= 0) ST_GATE_SPAN = st.span;
  var mine = !!st.mine, mode = st.mode || 'all', src = st.src || 'all', hide = st.hide || [], q = '', sig = '', opened = {}, cf = {}, lastGroups = [];
  var pop = document.createElement('div');
  pop.id = 'st-gate'; pop.className = 'mbu-ui'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Network log');
  pop.innerHTML = '<div class="mbu-logpop-h"><b>Network log</b> <span class="st-gate-n"></span><span class="mbu-logpop-sp"></span>'
    + '<select id="st-gate-span" aria-label="Time line span" data-tip="How far back the time line goes">' + ST_GATE_SPANS.map(function (ms) { return '<option value="' + ms + '"' + (ms === ST_GATE_SPAN ? ' selected' : '') + '>' + stGateSpanTxt(ms) + '</option>'; }).join('') + '</select>'
    + '<button type="button" id="st-gate-hud" data-tip="The time line in a small strip\nIt stays on screen when this window is closed">HUD</button>'
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
    + '<button type="button" id="st-gate-mine" data-tip="Show only the requests of this tab">This tab only</button>'
    + '<span class="st-gate-seg st-gate-src" role="group" aria-label="Source"><button type="button" data-v="all" data-tip="Requests to every host">All hosts</button>'
    + '<button type="button" data-v="mb" data-tip="Only the requests to MusicBrainz">MusicBrainz</button>'
    + '<button type="button" data-v="other" data-tip="Only the requests to other hosts\nThe gate logs them but does not pace them">Other</button></span>'
    + '<span class="st-gate-seg st-gate-cols" role="group" aria-label="Columns">' + ST_GATE_COLS.map(function (c) { return '<button type="button" data-c="' + c[0] + '" data-tip="Show or hide this column">' + c[1] + '</button>'; }).join('') + '</span></div>'
    + '<div id="st-gate-body"><table><thead><tr><th>Time</th><th>Tab' + stGateCfBtn('tab') + '</th><th>Script' + stGateCfBtn('s') + '</th><th>Verb' + stGateCfBtn('m') + '</th><th>Reason' + stGateCfBtn('r') + '</th><th>Entity' + stGateCfBtn('e') + '</th><th>Request' + stGateCfBtn('rq') + '</th><th>Tries' + stGateCfBtn('n') + '</th><th>Result' + stGateCfBtn('res') + '</th><th>Wait' + stGateCfBtn('wt') + '</th><th>Rate limit' + stGateCfBtn('rl') + '</th><th class="st-gate-mh"><button type="button" id="st-gate-menu" aria-haspopup="true" aria-expanded="false" data-tip="Filters and columns">☰</button></th></tr></thead><tbody></tbody></table></div>'
    + '<div class="mbu-logpop-grip" data-tip="Resize"></div>';
  document.documentElement.appendChild(pop);   // outside the body, which Event Horizon swaps
  var $ = function (s) { return pop.querySelector(s); };
  var body = $('tbody'), qEl = $('#st-gate-q'), mineBtn = $('#st-gate-mine'), scroller = $('#st-gate-body');
  var seg = function () { Array.prototype.forEach.call(pop.querySelectorAll('.st-gate-seg button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.m === mode)); }); };
  seg(); mineBtn.setAttribute('aria-pressed', String(mine));
  var srcSeg = function () { Array.prototype.forEach.call(pop.querySelectorAll('.st-gate-src button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === src)); }); };
  var colSeg = function () {
    ST_GATE_COLS.forEach(function (c) { pop.classList.toggle('hc' + c[0], hide.indexOf(c[0]) >= 0); });
    Array.prototype.forEach.call(pop.querySelectorAll('.st-gate-cols button'), function (b) { b.setAttribute('aria-pressed', String(hide.indexOf(+b.dataset.c) < 0)); });
  };
  var bar = $('#st-gate-bar'), menuBtn = $('#st-gate-menu');
  var menu = function (on) {
    bar.classList.toggle('open', on); menuBtn.setAttribute('aria-expanded', String(on));
    if (!on) return;
    var r = menuBtn.getBoundingClientRect(), p = pop.getBoundingClientRect();
    bar.style.top = (r.bottom - p.top + 2) + 'px'; bar.style.right = Math.max(4, p.right - r.right) + 'px';
    qEl.focus();
  };
  menuBtn.onclick = function (e) { e.stopPropagation(); menu(!bar.classList.contains('open')); };
  pop.addEventListener('mousedown', function (e) { if (bar.classList.contains('open') && !bar.contains(e.target) && e.target !== menuBtn) menu(false); });
  bar.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); menu(false); menuBtn.focus(); } });
  $('#st-gate-span').addEventListener('change', function () { ST_GATE_SPAN = +this.value; stGateRemember({ span: ST_GATE_SPAN }); sig = ''; draw(); });
  var hudBtn = $('#st-gate-hud'), hudSeg = function () { hudBtn.setAttribute('aria-pressed', String(!!stGateHudEl)); };
  srcSeg(); colSeg(); hudSeg();
  pop.querySelector('.st-gate-src').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; src = b.dataset.v; srcSeg(); stGateRemember({ src: src }); draw(); });
  pop.querySelector('.st-gate-cols').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var c = +b.dataset.c, i = hide.indexOf(c);
    if (i >= 0) hide.splice(i, 1); else hide.push(c);
    colSeg(); stGateRemember({ hide: hide });
  });
  hudBtn.onclick = function () { stGateHud(!stGateHudEl); hudSeg(); };
  var drawFailed = '', lanesHeld = false, shownIds = [];
  var draw = function () {
    try { drawNow(); } catch (e) {
      var msg = String(e && e.message || e);
      if (msg !== drawFailed) { drawFailed = msg; try { console.error('String Theory: the Network log could not show its events', e); } catch (x) { /* no console */ } }
      sig = '';
      try { body.innerHTML = '<tr><td class="none" colspan="12">The gate log could not show its events (' + msg.replace(/[<&]/g, '') + '). Clear it to start again.</td></tr>'; } catch (x) { /* no body */ }
    }
  };
  var drawNow = function () {
    var me = stGateTab(), all = stGateEvents(), now = Date.now(), groups = stGateGroups(all, now), n = stGateCount(groups).n;
    $('.st-gate-n').textContent = n + ' request' + (n === 1 ? '' : 's');
    if (pop.classList.contains('min')) return;
    $('#st-gate-state').innerHTML = stGateStateHtml(stGateState(), me);
    $('#st-gate-sum').innerHTML = stGateSumHtml(groups, now);
    if (!lanesHeld) $('#st-gate-lanes').innerHTML = stGateLanesHtml(groups, all, now, me);   // held still under the mouse, so a tip stays put
    lastGroups = groups;
    var shown = groups.filter(function (g) {
      if (mine && g.tab !== me) return false;
      for (var ck in cf) if (stGateCfVal(g, ck) !== cf[ck]) return false;
      if (src === 'mb' && g.h) return false;
      if (src === 'other' && !g.h) return false;
      if (mode === 'bad' && g.cls !== 'bad') return false;
      if (mode === 're' && (g.sys || g.tries.length < 2)) return false;
      return !q || ((g.m || '') + ' ' + (g.h || '') + ' ' + (g.l || '') + ' ' + (g.u || '') + ' ' + (g.s || '') + ' ' + g.tab + ' ' + (g.label || '')).toLowerCase().indexOf(q) >= 0;
    });
    shownIds = shown.filter(function (g) { return !g.sys; }).map(function (g) { return g.id; });
    if (shownIds.length < n) {   // a filter hides some: say how many are left, and which filter
      var why = [mine && 'this tab only', src === 'mb' && 'MusicBrainz', src === 'other' && 'other hosts', mode === 'bad' && 'failed', mode === 're' && 'retried', q && 'text'].concat(Object.keys(cf).map(function (k) { return { tab: 'tab', s: 'script', m: 'verb', rq: 'request', n: 'tries', res: 'result', wt: 'wait', rl: 'rate limit' }[k] || k; })).filter(Boolean).join(', ');
      $('.st-gate-n').textContent = shownIds.length + ' of ' + n + ' requests shown' + (why ? ' (' + why + ')' : '');
    }
    // the funnel of every column that filters stands out
    pop.querySelectorAll('.st-gate-cf').forEach(function (b) { b.classList.toggle('on', cf[b.dataset.cf] != null); });
    var key = shown.map(function (g) { return g.id + ':' + g.evs.length + ':' + g.label; }).join('|') + '#' + Object.keys(opened).join('|') + '#' + me;
    if (key === sig) return;
    sig = key;
    // #1095: newest rows come in at the top; scrolled down, the row in view stays put, so the
    // entries being read don't slide away under each new one
    var top = scroller.scrollTop, anchor = null, at = 0, sTop = scroller.getBoundingClientRect().top;
    if (top > 0) {
      var rows = body.querySelectorAll('tr.rq');
      for (var i = 0; i < rows.length; i++) { var r = rows[i].getBoundingClientRect(); if (r.bottom > sTop) { anchor = rows[i].getAttribute('data-id'); at = r.top - sTop; break; } }
    }
    body.innerHTML = shown.length ? shown.slice().reverse().map(function (g) { return stGateRowHtml(g, me, !!opened[g.id], now); }).join('')
      : '<tr><td class="none" colspan="12">' + (all.length ? 'No request matches.' : 'No requests went through the gate yet. Open or reload a MusicBrainz page that uses a script, then look again.') + '</td></tr>';
    scroller.scrollTop = top;
    if (anchor != null) {
      var same = body.querySelectorAll('tr.rq');
      for (var j = 0; j < same.length; j++) if (same[j].getAttribute('data-id') === anchor) { scroller.scrollTop = top + same[j].getBoundingClientRect().top - scroller.getBoundingClientRect().top - at; break; }
    }
  };
  body.addEventListener('click', function (e) {
    var tr = e.target.closest('tr.rq');
    // a click in an open row's details selects that row and brings its header row into view
    var st = !tr && e.target.closest('tr.steps');
    // a click on the URL shows all of it or only its first line
    var u = st && e.target.closest('.st-gate-url');
    if (u && !String(getSelection())) {
      var uid = st.previousElementSibling && st.previousElementSibling.dataset.id;
      if (uid) stGateUrlAll[uid] = !stGateUrlAll[uid];
      u.classList.toggle('all', !!stGateUrlAll[uid]);
      return;
    }
    if (st) {
      if (e.target.closest('a, button, input, select') || String(getSelection())) return;
      var hd = st.previousElementSibling;
      if (!hd || !hd.dataset.id) return;
      stGateSel = {}; stGateSel[hd.dataset.id] = 1; sig = '';
      draw();
      var nh = body.querySelector('tr.rq.sel');
      if (nh) nh.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    if (!tr) return;
    var id = tr.dataset.id;
    if (opened[id]) delete opened[id]; else opened[id] = 1;
    stGateSel = {}; stGateSel[id] = 1;
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
  // a right click on a funnel clears that column's filter
  pop.addEventListener('contextmenu', function (e) {
    var b = e.target.closest && e.target.closest('.st-gate-cf');
    if (!b) return;
    e.preventDefault();
    delete cf[b.dataset.cf];
    b.classList.remove('on');
    cfClose(); draw();
  });
  var cfPop = null, cfClose = function () { if (cfPop) cfPop.remove(), cfPop = null; };
  var cfName = function (k, v) { return k === 'tab' ? (v === stGateTab() ? 'this tab' : v.slice(0, 8)) : v || '(none)'; };
  pop.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.st-gate-cf');
    if (!b) return;
    e.stopPropagation();
    var k = b.dataset.cf;
    if (cfPop && cfPop.dataset.k === k) return cfClose();
    cfClose();
    var cnt = {};
    lastGroups.forEach(function (g) { if (!g.sys) { var v = stGateCfVal(g, k); cnt[v] = (cnt[v] || 0) + 1; } });
    var vals = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a] || (a < b ? -1 : 1); });
    cfPop = document.createElement('div'); cfPop.className = 'st-gate-cfp'; cfPop.dataset.k = k;
    cfPop.innerHTML = '<input type="text" placeholder="Filter" aria-label="Filter the values"><ul></ul>';
    var inp = cfPop.querySelector('input'), ul = cfPop.querySelector('ul');
    var fill = function () {
      var t = inp.value.trim().toLowerCase();
      ul.innerHTML = (t ? '' : '<li data-v="" class="' + (cf[k] == null ? 'on' : '') + '"><span>All</span></li>') + vals.filter(function (v) { return !t || cfName(k, v).toLowerCase().indexOf(t) >= 0; }).map(function (v) {
        return '<li data-v="' + stEsc(v) + '" data-set="1" class="' + (cf[k] === v ? 'on' : '') + '"><span>' + stEsc(cfName(k, v)) + '</span><b>' + cnt[v] + '</b></li>';
      }).join('');
      var first = ul.querySelector('li'); if (first) first.classList.add('act');
    };
    var pick = function (li) {
      if (!li) return;
      if (li.dataset.set) cf[k] = li.dataset.v; else delete cf[k];
      b.classList.toggle('on', cf[k] != null);
      cfClose(); draw();
    };
    inp.addEventListener('input', fill);
    inp.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') cfClose();
      else if (ev.key === 'Enter') pick(ul.querySelector('li.act'));
      else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        var li = [].slice.call(ul.children), i = li.findIndex(function (x) { return x.classList.contains('act'); });
        if (!li.length) return;
        if (i >= 0) li[i].classList.remove('act');
        i = Math.max(0, Math.min(li.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)));
        li[i].classList.add('act'); li[i].scrollIntoView({ block: 'nearest' });
      }
    });
    ul.addEventListener('click', function (ev) { pick(ev.target.closest('li')); });
    fill();
    document.body.appendChild(cfPop);
    var r = b.getBoundingClientRect();
    cfPop.style.left = Math.max(4, Math.min(window.innerWidth - cfPop.offsetWidth - 4, r.left)) + 'px';
    cfPop.style.top = (r.bottom + 4) + 'px';
    inp.focus();
  });
  document.addEventListener('mousedown', function (e) { if (cfPop && !cfPop.contains(e.target) && !(e.target.closest && e.target.closest('.st-gate-cf'))) cfClose(); });
  // a click on a timeline mark, or on a row of a cluster's tip, opens that request's row and scrolls to it
  var openFromLanes = function (e) {
    var m = e.target.closest && e.target.closest('#st-gate-lanes [data-id], .st-gl-zoom [data-id], #st-gate-lanes [data-ids]');
    if (!m) return;
    var ids = m.dataset.ids ? JSON.parse(m.dataset.ids) : [m.dataset.id], id = ids[0];
    stGateSel = {};
    ids.forEach(function (x) { opened[x] = 1; stGateSel[x] = 1; });
    lanesHeld = false; sig = ''; draw();   // a selection alone leaves the signature as it was
    var tr = body.querySelector('tr.rq.sel');   // the topmost selected row, whatever order the table sorts in
    if (tr) tr.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  document.addEventListener('click', openFromLanes);
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
    stCopy(stGateMarkdown(stGateEvents(), stGateTab()), function (ok) { try { U.mbuToast(ok ? 'Network log copied' : 'Could not copy the network log'); } catch (e) { /* no toast */ } });
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
