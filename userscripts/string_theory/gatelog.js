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
  + 'html:has(#st-gate.full){overflow:hidden!important}#st-gate.full .mbu-logpop-h{cursor:default}#st-gate.full .mbu-logpop-grip{display:none}'
  // the gate's state, as chips
  + '#st-gate-state{display:flex;flex-wrap:wrap;gap:6px;padding:8px 13px 0}'
  + '#st-gate-state>span{white-space:nowrap;padding:2px 9px;border-radius:999px;background:var(--mbu-bg-hover);font-size:12px}'
  + '#st-gate-state .k{color:var(--mbu-text-weak)}#st-gate-state b{font-weight:600}'
  + '#st-gate-state .hot{background:var(--mbu-error-bg);color:var(--mbu-error)}'
  // the totals and the lanes
  + '#st-gate-sum{padding:8px 13px 2px;color:var(--mbu-text-weak);font-size:12px}#st-gate-sum b{color:var(--mbu-text);font-weight:600}'
  + '#st-gate-sum .bad b{color:var(--mbu-error)}#st-gate-sum .re b{color:var(--mbu-warn)}'
  + '#st-gate-lanes{position:relative;flex:0 1 auto;min-height:60px;max-height:40vh;overflow-x:hidden;overflow-y:auto;scrollbar-gutter:stable;scrollbar-width:thin;scrollbar-color:var(--mbu-border) transparent;margin:4px 13px 8px;padding-left:180px}'
  + '.st-gl-bands{position:absolute;top:0;bottom:16px;left:180px;right:0}'
  + '.st-gl-band{position:absolute;top:0;bottom:0;background:var(--mbu-error-bg)}'
  + '.st-gl-lane{position:relative;height:calc(var(--r,1)*var(--sh,30px));border-top:1px solid var(--mbu-divider)}'
  + '.st-gl-ic{position:absolute;top:50%;width:21px;height:21px;margin:-10px 0 0 -10px;z-index:1;object-fit:contain}'
  + '.st-gl-ic.at{margin:-10px 0 0 -23px}#st-gate-hud-box .st-gl-name{display:none}'
  + '.st-gl-cl{position:absolute;top:50%;height:21px;margin:-10px 0 0 -10px;z-index:2;display:flex;align-items:center;cursor:default}.st-gl-cl b{position:absolute;right:-6px;top:-5px;min-width:11px;height:11px;padding:0 2px;box-sizing:border-box;border-radius:6px;background:var(--mbu-accent);color:#fff;font-size:8px;line-height:11px;text-align:center}.st-gl-cl b{display:flex;padding:0;overflow:hidden;background:none}.st-gl-cl b i{font-style:normal;padding:0 3px;min-width:6px;background:color-mix(in srgb,var(--mbu-accent) 14%,transparent);color:var(--mbu-accent-text);font-weight:normal}.st-gl-cl b i.x{background:rgba(47,127,214,.14);color:#2f7fd6}.st-gl-cl b{z-index:3;top:auto;right:auto;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:-2px;height:13px;border-radius:7px;font-size:10px;line-height:13px}.st-gl-cl.bad b i.x{color:var(--mbu-error)}'
  + '.st-gl-pi{position:absolute;top:3px;display:flex;height:14px;margin-left:-35px;z-index:1}.st-gl-pi svg{width:14px;height:14px;display:block}.st-gl-zx{color:var(--mbu-accent);display:inline-block;width:34px;text-align:right;margin-right:6px;flex:none}.st-gl-lt{display:block;width:14px;height:14px;border-radius:3px;color:#fff;font:700 9px/14px system-ui,sans-serif;text-align:center}.st-gl-pi .st-gl-ic{position:static;width:14px;height:14px;margin:0 3px 0 0;flex:none}'
  + '.st-gl-cl .st-gl-ic{position:static;margin:0;flex:none;width:21px!important;height:21px!important;max-width:none}'
  + '.st-gate-tbar{display:flex;justify-content:flex-end;gap:6px;padding:6px 16px 0}#st-gate[data-max=lanes] .st-gate-tbar{display:none}#st-gate-tabs{display:flex;flex-wrap:wrap;gap:2px;border-bottom:1px solid var(--mbu-border);margin-top:6px}#st-gate-tabs:empty{display:none}#st-gate-tabs>span{all:unset;font-size:12px;padding:6px 12px;color:var(--mbu-text-muted,#888);border-bottom:2px solid transparent;display:flex;gap:6px;align-items:center;cursor:pointer;margin-bottom:-1px}#st-gate-tabs>span.on{color:var(--mbu-text);border-bottom-color:var(--mbu-accent)}#st-gate-tabs>span:hover{color:var(--mbu-text)}#st-gate-tabs .x{font-size:15px;line-height:1;padding:0 2px;border-radius:3px}#st-gate-tabs .x:hover{background:color-mix(in srgb,var(--mbu-text) 12%,transparent)}.st-gl-lane[data-lane]{cursor:pointer}'
  + '#st-gate-split{flex:0 0 auto;height:6px;margin:-4px 0 -2px;cursor:row-resize;position:relative;z-index:2}#st-gate-split::after{content:"";position:absolute;left:0;right:0;top:2px;height:2px;background:transparent}#st-gate-split:hover::after,#st-gate-split.on::after{background:var(--mbu-accent)}#st-gate-hud-box #st-gate-split{display:none}'
  + '.st-gate-pane{position:relative;display:flex;flex-direction:column;min-height:0}.st-gate-pane[data-pane=lanes]{flex:0 0 auto}.st-gate-pane[data-pane=body]{flex:1 1 auto}'
  + '.st-gate-sumrow{display:flex;align-items:flex-start;gap:8px}.st-gate-sumrow>#st-gate-sum{flex:1 1 auto;min-width:0}.st-gate-sumrow>.st-gate-mx{flex:0 0 auto;margin:5px 13px 0 0}.st-gate-sumrow>.st-gate-zm,.st-gate-sumrow>.st-gate-wm,.st-gate-sumrow>.st-gate-ps{flex:0 0 auto;margin:5px 0 0 0}.st-gate-zm:not(.on),.st-gate-wm:not(.on),.st-gate-ps:not(.on){opacity:.45}.st-gate-zm svg,.st-gate-wm svg,.st-gate-ps svg{width:14px;height:14px;display:block}.st-gate-mx,.st-gate-zm,.st-gate-wm,.st-gate-ps,.st-gate-fit{font-size:12px;line-height:normal;color:var(--mbu-accent-text);background:var(--mbu-bg-hover);border:1px solid var(--mbu-border);border-radius:5px;padding:2px 9px;cursor:pointer;font-family:inherit}.st-gate-pane .st-gate-mx{position:absolute;right:16px;top:3px;z-index:4}.st-gate-pane .st-gate-fit{position:absolute;right:52px;top:3px;z-index:4}.st-gate-mx:hover,.st-gate-zm:hover,.st-gate-wm:hover,.st-gate-fit:hover{background:var(--mbu-accent-soft)}#st-gate[data-max=body] .st-gate-sumrow>.st-gate-mx{display:none}.st-gate-mx.on{color:var(--mbu-accent)}'
  + '#st-gate[data-max=lanes] .st-gate-pane[data-pane=lanes]{flex:1 1 auto}#st-gate[data-max=lanes] #st-gate-lanes{max-height:none!important;height:auto!important;flex:1 1 auto}#st-gate[data-max=lanes] #st-gate-tabs,#st-gate[data-max=lanes] .st-gate-pane[data-pane=body],#st-gate[data-max] #st-gate-split,#st-gate[data-max=body] .st-gate-pane[data-pane=lanes]{display:none}'
  + '.st-gl-sub{position:absolute;left:0;right:0;top:calc(var(--i)*var(--sh,30px));height:var(--sh,30px)}#st-gate.lbl #st-gate-lanes,#st-gate-hud-box.lbl .st-gate-hud-l{--sh:54px}#st-gate.lbl .st-gl-sub>.st-gl-ic,#st-gate.lbl .st-gl-sub>.st-gl-cl,#st-gate-hud-box.lbl .st-gl-sub>.st-gl-ic,#st-gate-hud-box.lbl .st-gl-sub>.st-gl-cl{top:15px}.st-gl-lb{position:absolute;top:27px;max-width:140px;transform:translateX(-50%);font-size:10px;line-height:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--mbu-text-weak);opacity:.75;cursor:pointer}.st-gl-lb>span{display:block;overflow:hidden;text-overflow:ellipsis;text-align:center}.st-gl-lb.cl>span{text-align:left}.st-gl-lb.at{margin-left:-12px}.st-gl-lb.cl{transform:none;margin-left:-10px;max-width:240px}.st-gl-cl .st-gl-ic+.st-gl-ic{margin-left:1px}.st-gl-ic.small{scale:.8}.st-gl-cl .st-gl-ic.small{scale:none;width:17px!important;height:17px!important;margin:0 2px}'
  + '.st-gl-cb{flex:1 0 auto;min-width:fit-content;height:14px;margin-left:2px;border-radius:7px;display:flex;align-items:center;gap:4px;padding:0 6px;box-sizing:border-box;background:color-mix(in srgb,var(--mbu-ok) 25%,transparent);font:600 10px/1 sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap}'
  + '.st-gl-cl.bad .st-gl-cb{background:color-mix(in srgb,var(--mbu-error) 16%,transparent)}.st-gl-cb .m{color:var(--mbu-accent-text)}.st-gl-cb .x{color:#2f7fd6}.st-gl-cb .b{color:var(--mbu-error)}.st-gl-cb .t{margin-left:auto;padding-left:2px;font-weight:400;color:var(--mbu-text-weak)}'
  + '.st-gl-zoom{position:fixed;z-index:2147483647;width:450px;padding:8px 10px;background:var(--mbu-bg);color:var(--mbu-text);border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);font-size:12px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none}.st-gl-zoom::-webkit-scrollbar{display:none}'
  + '.st-gl-zh{color:var(--mbu-text-weak);margin-bottom:4px}.st-gl-zr{display:flex;align-items:center;gap:6px;height:26px;cursor:pointer;border-radius:var(--mbu-radius)}.st-gl-zr:hover{background:var(--mbu-bg-hover)}.st-gl-zr .st-gl-ic{position:static;margin:0}'
  + '.st-gl-zn{flex:0 0 220px;}.st-gl-zrs{flex:0 0 110px;color:var(--mbu-text-weak);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.st-gl-zn .h{color:var(--mbu-text-weak)}.st-gl-zn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.st-gl-zl{position:relative;flex:1;height:20px;margin-left:20px}.st-gl-zr .st-gl-ic.at{position:absolute;top:2px;margin:0 0 0 -19px}.st-gl-zl .st-gl-f{top:0;height:20px}.st-gl-zt{flex:0 0 44px;text-align:right;color:var(--mbu-text-weak)}'
  + '.st-gl-name{position:absolute;left:-180px;width:172px;top:0;line-height:30px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--mbu-text-weak)}'
  + '.st-gl-name .st-gl-ic.nm{position:static;width:16px;height:16px;margin:0 0 0 3px;vertical-align:middle}.st-gl-name b{color:var(--mbu-text);font-weight:600}.st-gl-lane.me .st-gl-name b{color:var(--mbu-accent-text)}'
  + '.st-gl-w,.st-gl-f{position:absolute;top:8px;height:14px;min-width:5px;border-radius:7px;box-shadow:inset 1px 0 0 var(--mbu-bg)}.st-gl-w,.st-gl-f{opacity:.6}.st-gl-w:hover,.st-gl-f:hover{opacity:1}'
  + '.st-gl-w{background:var(--mbu-border)}.st-gl-f{background:var(--mbu-ok)}.st-gl-f.bad{background:var(--mbu-error)}.st-gl-f.re{background:var(--mbu-warn)}.st-gl-f.go{background:var(--mbu-info)}.st-gl-f.off{background:var(--mbu-border)}'
  + '.st-gl-ax{position:relative;height:16px;border-top:1px solid var(--mbu-border-soft);font-size:11px;color:var(--mbu-text-weak)}'
  + '.st-gl-ax span{position:absolute;top:1px;transform:translateX(-50%);white-space:nowrap}.st-gl-ax span:first-child{transform:none}.st-gl-ax span:last-child{transform:translateX(-100%)}'
  + '.st-gl-none{line-height:30px;font-size:12px;color:var(--mbu-text-weak)}'
  // the filter row
  + '.st-gate-ent{display:inline-block;width:14px;height:14px;vertical-align:-2px;margin-right:5px;flex:none}'
  + '#st-gate .st-gate-facts{font-size:12px;color:var(--mbu-text-weak);padding:0 0 6px}#st-gate .st-gate-k{font-weight:600;color:var(--mbu-accent,var(--mbu-text))}#st-gate .st-gate-url{width:0;min-width:100%;box-sizing:border-box;font:12px/1.4 monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;user-select:text;padding:4px 0 6px;color:var(--mbu-text)}#st-gate tr.steps.all .st-gate-url{white-space:normal;word-break:break-all}#st-gate .st-gate-full,#st-gate tr.steps.all .st-gate-short{display:none}#st-gate tr.steps.all .st-gate-full{display:inline}#st-gate .st-gate-qp{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:2px 10px;margin:0 0 8px;font:12px/1.4 monospace}#st-gate .st-gate-qp dt{color:var(--mbu-text-weak);margin:0}#st-gate .st-gate-qp dd{margin:0;color:var(--mbu-text);word-break:break-all;user-select:text}#st-gate .st-gate-qp i{color:var(--mbu-text-weak)}#st-gate .st-gate-bth{font-size:12px;font-weight:600;color:var(--mbu-text-weak);margin:0 0 2px}#st-gate .st-gate-bt{font:12px/1.4 monospace;color:var(--mbu-text);word-break:break-all;white-space:pre-wrap;user-select:text;margin:0 0 8px}#st-gate .st-gate-n{color:var(--mbu-text-weak)}#st-gate .st-gate-less{cursor:pointer}#st-gate .st-gate-more,#st-gate tr.steps.all .st-gate-less{display:none}#st-gate tr.steps.all .st-gate-more{display:block}'
  + '#st-gate td.l{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:56ch}#st-gate .st-gate-dt{color:var(--mbu-text-weak)}'
  + '#st-gate .st-gate-hosts{margin-right:12px}#st-gate .st-gate-hosts button{display:inline-flex;align-items:center;padding:0 8px}#st-gate .st-gate-hosts button[aria-pressed=false] svg{opacity:.35;filter:grayscale(1)}'
  + '.st-gate-cfp label{display:flex;gap:6px;align-items:center;padding:4px 6px;cursor:pointer;border-radius:var(--mbu-radius);white-space:nowrap}.st-gate-cfp label:hover{background:var(--mbu-bg-hover)}.st-gate-cfp input[type=checkbox]{width:auto;margin:0;padding:0;accent-color:var(--mbu-accent)}'
  + '#st-gate-hud,#st-gate-lbl{display:inline-flex;align-items:center;padding:4px;margin-right:4px;border:0;background:none;color:var(--mbu-text-weak);cursor:pointer;border-radius:var(--mbu-radius)}#st-gate-hud:hover,#st-gate-lbl:hover{background:var(--mbu-bg-hover);color:var(--mbu-accent-text)}#st-gate-lbl[aria-pressed=true]{color:var(--mbu-accent-text)}#st-gate .st-gate-hosts{margin-right:8px}#st-gate .mbu-logpop-h .st-gate-n{flex:0 0 24em;width:24em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#st-gate .st-gate-hosts{border:0}#st-gate .st-gate-hosts button,#st-gate .st-gate-hosts button:hover,#st-gate .st-gate-hosts button[aria-pressed=true]{background:none;border:0;padding:0 5px;opacity:.35}#st-gate .st-gate-hosts button[aria-pressed=true]{opacity:1}#st-gate .st-gate-hosts button:hover{opacity:.8}'
  + '.st-gate-seg{display:inline-flex;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);overflow:hidden}'
  + '.st-gate-seg button{min-height:30px;padding:0 11px;border:0;background:none;color:var(--mbu-accent-text);font:inherit;font-size:12px;cursor:pointer}'
  + '.st-gate-seg button+button{border-left:1px solid var(--mbu-border)}'
  + '.st-gate-seg button:hover{background:var(--mbu-bg-hover)}'
  + '.st-gate-seg button[aria-pressed=true]{background:var(--mbu-accent-soft)}'
  // the requests
  + '#st-gate-body{flex:1 1 auto;min-height:0;overflow:auto;scrollbar-gutter:stable;scrollbar-width:thin;scrollbar-color:var(--mbu-border) transparent;border-top:1px solid var(--mbu-border-soft)}'
  + '#st-gate table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}'
  + '#st-gate .st-gate-cf{border:0;background:none;color:var(--mbu-text-weak);padding:2px 4px;margin-left:2px;cursor:pointer;border-radius:var(--mbu-radius);vertical-align:-1px}#st-gate .st-gate-cf:hover{background:var(--mbu-bg-hover)}#st-gate .st-gate-cf.on{color:var(--mbu-info);background:color-mix(in srgb,var(--mbu-info) 22%,transparent)}#st-gate .st-gate-cf.on svg{fill:currentColor}'
  + '.st-gate-cfp{position:fixed;z-index:2147483647;min-width:160px;max-width:260px;background:var(--mbu-bg);color:var(--mbu-text);border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);padding:4px;font-size:12px}'
  + '.st-gate-cfp input[type=text]{width:100%;box-sizing:border-box;margin-bottom:4px;padding:4px 6px;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);background:var(--mbu-bg);color:var(--mbu-text);font:inherit}'
  + '.st-gate-cfp ul{list-style:none;margin:0;padding:0;max-height:220px;overflow:auto;scrollbar-width:thin;scrollbar-color:var(--mbu-border) transparent}.st-gate-cfp li{display:flex;gap:8px;padding:4px 6px;cursor:pointer;border-radius:var(--mbu-radius);white-space:nowrap}.st-gate-cfp li span{flex:1;overflow:hidden;text-overflow:ellipsis}.st-gate-cfp li b{font-weight:400;color:var(--mbu-text-weak)}.st-gate-cfp li:hover,.st-gate-cfp li.act{background:var(--mbu-bg-hover)}.st-gate-cfp li.on{color:var(--mbu-accent);font-weight:600}'
  + '#st-gate-span{margin-right:6px;padding:2px 4px;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);background:var(--mbu-bg);color:var(--mbu-text);font:inherit;font-size:12px}'
  + '#st-gate th{position:sticky;top:0;z-index:1;background:var(--mbu-bg);text-align:left;font-weight:600;font-size:12px;padding:5px 8px;border-bottom:1px solid var(--mbu-border)}'
  + '#st-gate td{padding:4px 8px;border-bottom:1px solid var(--mbu-divider);vertical-align:middle}'
  + '#st-gate tr.rq{cursor:pointer}#st-gate tr.rq.in td{background:color-mix(in srgb,var(--mbu-bg-hover) 50%,transparent)}#st-gate tr.rq.in td:first-child{box-shadow:inset 3px 0 var(--mbu-border)}.st-gl-gx{display:inline-block;width:1em;color:var(--mbu-text-weak);font-size:20px;line-height:1;vertical-align:middle;text-align:center}#st-gate tr.rq:hover td,#st-gate tr.rq.open td{background:var(--mbu-bg-hover)}'
  + '#st-gate tr.rq.sel td,#st-gate tr.rq.sel+tr.steps td{background:color-mix(in srgb,var(--mbu-info) 24%,transparent)}#st-gate tr.rq.sel td:first-child,#st-gate tr.rq.sel+tr.steps td{box-shadow:inset 3px 0 var(--mbu-info)}'
  + '#st-gate tr.sys td{color:var(--mbu-text-weak)}'
  + '#st-gate tr.sys.lead td{background:color-mix(in srgb,var(--mbu-info) 8%,transparent)}'
  + '#st-gate tr.rq.wr td{background:color-mix(in srgb,var(--mbu-warn) 8%,transparent)}'
  + '#st-gate td.t,#st-gate td.tab,#st-gate td.w{white-space:nowrap;color:var(--mbu-text-weak)}#st-gate tr.me td.tab{color:var(--mbu-accent-text)}'
  + '#st-gate td.s{white-space:nowrap}#st-gate td.l{overflow-wrap:anywhere;font-family:var(--mbu-font-mono);font-size:12px}'
  + '#st-gate .i{color:var(--mbu-text-weak);font-size:11px}#st-gate td.v{font-family:var(--mbu-font-mono);font-size:11px;color:var(--mbu-text-weak)}'
  + '#st-gate th{overflow:visible}#st-gate .st-gate-rz{position:absolute;top:0;right:-4px;width:8px;height:100%;cursor:col-resize;z-index:2}'
  + '#st-gate .st-gate-rz::after{content:"";position:absolute;left:3px;top:20%;height:60%;width:1px;background:var(--mbu-border)}#st-gate .st-gate-rz:hover::after,#st-gate .st-gate-rz.on::after{top:0;height:100%;background:var(--mbu-accent)}'
  + '#st-gate tr>:last-child>.st-gate-rz{display:none}'
  + '#st-gate table{table-layout:fixed}#st-gate table.st-gate-measure{table-layout:auto;width:max-content}#st-gate table.st-gate-measure th{width:auto!important}#st-gate table.st-gate-measure td{white-space:nowrap;max-width:none!important}#st-gate table.st-gate-measure tbody tr:not(.rq):not(.sys){display:none}#st-gate td{overflow:hidden;text-overflow:ellipsis}#st-gate th:nth-child(1){width:96px}#st-gate th:nth-child(2){width:64px}#st-gate th:nth-child(3){width:140px}#st-gate th:nth-child(4){width:64px}#st-gate th:nth-child(5){width:130px}#st-gate th:nth-child(6){width:120px}#st-gate th:nth-child(7){width:56px}#st-gate th:nth-child(9){width:70px}#st-gate th:nth-child(10){width:120px}#st-gate th:nth-child(11){width:72px}#st-gate th:nth-child(12){width:124px}'
  + [2, 3, 4, 5, 6, 7, 9, 11, 12].map(function (n) { return '#st-gate.hc' + n + ' tr>:nth-child(' + n + ')'; }).join(',') + '{display:none}'
  + '#st-gate-hud-box{position:fixed;right:14px;bottom:14px;width:520px;max-width:calc(100vw - 28px);z-index:var(--mbu-z-modal);background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:6px;padding:4px 8px;font-size:12px;opacity:.92}'
  + '#st-gate-hud-box .st-gate-hud-h{cursor:move;user-select:none;display:flex;gap:8px;align-items:center;height:22px}#st-gate-hud-box .st-gate-hud-h>span:first-child{font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px}'
  + '#st-gate-hud-box .st-gate-hud-rz{position:absolute;top:0;bottom:0;width:6px;cursor:ew-resize}#st-gate-hud-box .st-gate-hud-rz.l{left:-3px}#st-gate-hud-box .st-gate-hud-rz.r{right:-3px}#st-gate-hud-box .st-gate-hud-rz:hover{background:var(--mbu-accent);opacity:.5}'
  + '#st-gate-hud-box .st-gate-hud-ghost{display:inline-flex;align-items:center;padding:2px;border:0;background:none;color:var(--mbu-text-weak);cursor:pointer;border-radius:var(--mbu-radius)}#st-gate-hud-box .st-gate-hud-ghost:hover{background:var(--mbu-bg-hover);color:var(--mbu-accent-text)}#st-gate-hud-box .st-gate-hud-ghost[aria-pressed=true]{color:var(--mbu-accent-text)}#st-gate-hud-box.ghost{opacity:.15;transition:opacity .2s}#st-gate-hud-box.ghost:hover{opacity:.92}'
  + '#st-gate-hud-box .st-gate-n{flex:1;color:var(--mbu-text-weak)}#st-gate-hud-box .bad{color:var(--mbu-error)}'
  + '#st-gate-hud-box .st-gate-hud-l{position:relative}#st-gate-hud-box .st-gl-bands{left:0}#st-gate-hud-box .st-gl-name{left:-180px;width:172px}'
  + '.st-gate-tries{display:inline-flex;gap:3px;vertical-align:middle}.st-gate-tries i{--c:var(--mbu-border);width:9px;height:9px;box-sizing:border-box;border-radius:2px;border:1px solid color-mix(in srgb,var(--c) 75%,transparent);background:color-mix(in srgb,var(--c) 30%,transparent)}'
  + '.st-gate-tries i.ok{--c:var(--mbu-ok)}.st-gate-tries i.re{--c:var(--mbu-warn)}.st-gate-tries i.bad{--c:var(--mbu-error)}.st-gate-tries i.go{--c:var(--mbu-info)}'
  + '.st-gl-gc{display:inline-block;min-width:18px;padding:0 5px;margin-right:6px;border-radius:8px;background:var(--mbu-accent);color:var(--mbu-bg);font-size:11px;line-height:16px;text-align:center}.st-gate-pill{display:inline-block;padding:0 8px;border-radius:999px;font-size:12px;white-space:nowrap;background:var(--mbu-bg-hover)}'
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
  out.sort(function (a, b) { return a.t - b.t; });
  // #1112: a booking says how many other requests wait at that moment, in every tab, counted from
  // the events: the gate's own count was the queue's length in 125 ms slots ("13 queued" for 1.6 s)
  var waiting = {};
  out.forEach(function (ev) {
    if (!ev.l) return;
    var key = ev.tab + '|' + (ev.s || '') + '|' + (ev.id ? '#' + ev.id : ev.l + '|' + ev.b);
    if (ev.e === 'book') {
      var n = 0;
      Object.keys(waiting).forEach(function (k) { if (ev.t - waiting[k] > 120000) delete waiting[k]; else if (k !== key) n++; });   // a tab closed mid-wait
      ev.n = n; waiting[key] = ev.t;
    } else if (ev.e !== 'moved' && ev.e !== 'hidden' && ev.e !== 'lead') delete waiting[key];
  });
  return out;
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
    case 'book': x.push('waits ' + stGateSec(ev.w) + (ev.why === 'hold' ? ' (MusicBrainz hold)' : ' (pacing)')); if (ev.n != null) x.push(ev.n ? ev.n + (ev.n === 1 ? ' other request waits' : ' other requests wait') : 'no other request waits'); if (ev.re) x.push('booked again after a hold'); break;
    case 'moved': x.push('a new MusicBrainz hold moved it ' + stGateSec(ev.w) + ' later' + (ev.to != null ? ', now waits ' + stGateSec(ev.to) : '')); break;
    case 'start': if (ev.w) x.push('after ' + stGateSec(ev.w)); break;
    case 'hidden': x.push('waits for the queue to be free, now ' + stGateSec(ev.w) + (ev.cap ? ', at most ' + stGateSec(ev.cap) : '') + ' (this tab is hidden)'); break;
    case 'lead': x.push('waits up to ' + stGateSec(ev.w) + ' for a page being drawn (' + (ev.by || '?') + ')'); break;
    case 'lead+': x.push('takes the lead for ' + stGateSec(ev.w) + ' (' + (ev.by || '?') + ')'); break;
    case 'lead-': x.push((ev.why === 'lapsed' ? 'the lead lapsed' : 'ends the lead') + (ev.d != null ? ' after ' + stGateSec(ev.d) : '') + ' (' + (ev.by || '?') + ')'); break;
    case 'giveup': x.push('gives up after ' + (ev.n || 1) + (ev.n > 1 ? ' tries' : ' try') + (ev.st ? ' (HTTP ' + ev.st + ')' : '')); break;
    case 'cancel': x.push('cancelled after ' + stGateSec(ev.w)); break;
    case 'join': x.push('a request that covers this one is already on its way' + (ev.with ? ' (' + ev.with + ')' : '') + ': shares its answer'); break;
    case 'merge': x.push('asks together with a waiting request' + (ev.with ? ' (' + ev.with + ')' : '') + (ev.add ? ', which adds ' + ev.add : '') + ': one answer for both'); break;
    case 'cache': x.push('answered from the cache (' + (ev.w || 0) + 's old): no request'); break;
    case 'error': x.push(ev.err || 'network error'); break;
    case 'check': x.push('browser check ' + (ev.ok ? 'passed' : 'failed') + ' in ' + stGateSec(ev.w)); break;
    case 'answer':
      x.push('HTTP ' + ev.st);
      if (ev.rs != null) x.push(stGateBytes(ev.rs));
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
var ST_GATE_COLS = [[2, 'Tab'], [3, 'Script'], [4, 'Verb'], [5, 'Reason'], [6, 'Entity'], [7, 'Site'], [9, 'Tries'], [11, 'Wait'], [12, 'Rate limit']];
function stGateGroups(all, now) {
  var groups = [], open = {};
  var done = function (g, res) { g.res = res; delete open[g.key]; };
  all.forEach(function (ev) {
    // the page left: its tab's open requests end there, their answers never come back to it
    if (ev.e === 'left') {
      Object.keys(open).forEach(function (k) {
        var o = open[k]; if (o.tab !== ev.tab) return;
        // only a request still waiting for an answer is cut off. One that got its 429 and whose script
        // retried as a new request, ended at that 429 (it shows "429, gave up")
        var waits = o.tries.some(function (y) { return y.st == null; });
        if (!waits && o.pend) { done(o, 'gave up'); return; }
        o.tries.forEach(function (y) { if (y.st == null) { y.st = -2; y.end = ev.t; } });
        o.end = Math.max(o.end, ev.t); o.pend = 0; done(o, 'page left');
      });
      return;
    }
    if (!ev.l) { groups.push({ sys: true, id: 'y' + ev.tab + ev.t + ev.e, tab: ev.tab, s: ev.s, t: ev.t, end: ev.t, evs: [ev], tries: [] }); return; }
    var key = ev.tab + '|' + (ev.s || '') + '|' + (ev.id ? '#' + ev.id : ev.l + '|' + ev.b), g = open[key];
    if (g && g.pend && ev.t - g.pend > ST_GATE_RETRY) { done(g, 'gave up'); g = null; }
    // a request that waited, then found a twin's answer just before it left (or before a retry), ends there
    // a merge waits for the request it joined and shares its answer, as a join does: no try of its own
    var shared = ev.e === 'join' || ev.e === 'merge';
    if ((shared || ev.e === 'cache') && g) { g.evs.push(ev); g.end = ev.t; g.pend = 0; done(g, shared ? 'shared' : 'cached'); return; }
    if (shared || ev.e === 'cache') { groups.push({ id: (shared ? 'j' : 'c') + key + ev.t, key: key, tab: ev.tab, s: ev.s, r: ev.r, en: ev.en, l: ev.l, m: ev.m, u: ev.u, h: ev.h, b: ev.b, t: ev.t, end: ev.t, evs: [ev], tries: [], res: shared ? 'shared' : 'cached' }); return; }
    if (!g) { g = open[key] = { id: 'r' + key + ev.t, key: key, tab: ev.tab, s: ev.s, r: ev.r, en: ev.en, l: ev.l, m: ev.m, u: ev.u, h: ev.h, b: ev.b, t: ev.t, end: ev.t, evs: [], tries: [] }; groups.push(g); }
    g.evs.push(ev); g.end = ev.t;
    if (ev.e !== 'answer') g.pend = 0;
    var last = g.tries[g.tries.length - 1];
    // without an id, two requests with the same label overlap in one run: an answer goes to the
    // oldest open try (first in, first out) and the run stays open while another try waits
    var open1 = function () { for (var i = 0; i < g.tries.length; i++) if (g.tries[i].st == null) return g.tries[i]; return null; };
    if (ev.e === 'start') { g.tries.push({ t: ev.t, w: ev.w || 0 }); if (ev.bs != null) g.bs = ev.bs; if (ev.bt != null) g.bt = ev.bt; }
    else if (ev.e === 'answer') {
      var x = ev.id ? (last && last.st == null ? last : null) : open1();
      if (x) { x.st = ev.st || 0; x.end = ev.t; } else g.tries.push({ t: ev.t, w: 0, st: ev.st || 0, end: ev.t });
      g.ans = ev;
      if (ev.rs != null) g.rs = ev.rs;
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
    else if (g.res === 'cancelled' || g.res === 'page left') g.cls = '';
    else if (g.res === 'gave up' || g.res === 'error' || g.res === 'no answer' || !st || st >= 500) g.cls = 'bad';
    else g.cls = retried ? 're' : 'ok';
    g.label = g.res === 'gave up' && st ? st + ', gave up' : g.res === '200' ? 'OK' : g.res;
    if (retried && g.cls !== 'go') g.label += ' ↻' + g.tries.length;
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
  return '<img class="st-gl-ic' + (cls ? ' ' + cls : '') + (/^Falcon/.test(String(name || '')) ? ' small' : '') + '" alt=""' + (tip ? ' data-tip="' + stEsc(tip) + '"' : '') + (left != null ? ' style="left:' + left.toFixed(2) + '%"' : '') + ' src="' + stEsc(stGateIconSrc(name)) + '">';
}
// requests shorter than ST_GATE_SHORT ms are drawn as an icon; icons closer than ST_GATE_NEAR overlap
function stGateWheelPan() { return !!stGateWinState().wheelPan; }   // the wheel button: true when the wheel moves the time line
var stGatePausedAt = 0;   // the window's time line stands still at this time while its pause button is on, 0 when it runs
var stGateVw = null, stGateHudVw = null;   // the zoomed view of the window's and the HUD's time line: { t0, s }, or null for the whole span
// the mouse wheel zooms a time line around the pointer and Shift and the wheel move it, or the other way round when the
// wheel button is on (stGateWheelPan); a right click shows the whole span again
function stGateZoomOn(box, span, get, set, redraw, nowFn) {
  box.addEventListener('wheel', function (e) {
    var ln = box.querySelector('.st-gl-lane'); if (!ln) return;
    e.preventDefault();
    var now = nowFn ? nowFn() : Date.now(), SP = span(), r = ln.getBoundingClientRect(), lw = r.width || 600, insL = 26 / lw * 100, insR = 120 / lw * 100;
    var p = Math.max(0, Math.min(1, ((e.clientX - r.left) / lw * 100 - insL) / (100 - insL - insR)));
    var v = get() || { t0: now - SP, s: SP }, d = e.deltaY || e.deltaX, s = v.s, t0 = v.t0;
    if (!!e.shiftKey !== stGateWheelPan() || (!e.deltaY && e.deltaX)) t0 += (d > 0 ? 1 : -1) * s * 0.15;
    else { var at = t0 + s * p; s = Math.max(2000, Math.min(SP, s * (d > 0 ? 1.25 : 0.8))); t0 = at - s * p; }
    t0 = Math.max(now - SP, Math.min(t0, now - s));
    set(s >= SP ? null : { t0: t0, s: s }); redraw();
  }, { passive: false });
  box.addEventListener('contextmenu', function (e) { if (!get()) return; e.preventDefault(); set(null); redraw(); });
  // a drag with the left button moves a zoomed time line left or right; the click that ends a drag opens nothing
  box.addEventListener('mousedown', function (e) {
    if (e.button !== 0 || !get()) return;
    var ln = box.querySelector('.st-gl-lane'); if (!ln) return;
    var r = ln.getBoundingClientRect(), lw = r.width || 600, inner = lw - 26 - 120, x0 = e.clientX, v0 = get(), moved = false;
    if (inner <= 0) return;
    var move = function (m) {
      var dx = m.clientX - x0;
      if (!moved && Math.abs(dx) < 4) return;
      if (!moved) { moved = true; document.documentElement.style.cursor = 'grabbing'; }
      m.preventDefault();
      var now = nowFn ? nowFn() : Date.now(), SP = span(), s = v0.s, t0 = v0.t0 - dx / inner * s;
      t0 = Math.max(now - SP, Math.min(t0, now - s));
      set({ t0: t0, s: s }); redraw();
    };
    var up = function () {
      document.removeEventListener('mousemove', move, true); document.removeEventListener('mouseup', up, true);
      if (!moved) return;
      document.documentElement.style.cursor = '';
      var eat = function (c) { c.stopPropagation(); c.preventDefault(); };
      document.addEventListener('click', eat, true);
      setTimeout(function () { document.removeEventListener('click', eat, true); }, 0);
    };
    document.addEventListener('mousemove', move, true); document.addEventListener('mouseup', up, true);
    e.preventDefault();   // no text selection while dragging
  });
}
var ST_GATE_SHORT = 1500, ST_GATE_NEAR = 2.2, stGateZoom = {}, ST_GATE_SUBS = 3;   // every lane has 3 fixed sub-rows
// the zoomed view of a cluster: its own time line and one line per request
// the cluster's count as a pill: MusicBrainz requests in one half, other sites in the other; an empty half is left out
function stGateBurst(run) {
  var gs = run.map(function (x) { return x.g; }), bad = run.filter(function (x) { return x.cls === 'bad'; }).length;
  var x = gs.filter(function (g) { return g.h; }).length, m = gs.length - x;
  var a = Math.min.apply(null, run.map(function (r) { return r.a; })), b = Math.max.apply(null, run.map(function (r) { return r.b; }));
  return '<span class="st-gl-cb">'
    + (m ? '<span class="m">' + m + '</span>' : '') + (x ? '<span class="x">' + x + '</span>' : '') + (bad ? '<span class="b">' + bad + '</span>' : '')
    + (b - a >= 300 ? '<span class="t">' + stGateSec(b - a) + '</span>' : '') + '</span>';
}
function stGatePill(gs) {
  var x = gs.filter(function (g) { return g.h; }).length, m = gs.length - x;
  return '<b title="' + (m ? m + ' MusicBrainz' : '') + (m && x ? ', ' : '') + (x ? x + ' other' : '') + '">' + gs.length + '</b>';
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
  return '<span class="st-gl-pi" style="left:' + left.toFixed(2) + '%">' + stGateIcon(x.g.s, '', '') + (k ? stIcon(k, 14) : stGateLetter(x.g.h)) + '</span>';
}
// many requests of one kind to one site (cover art for 100 releases) become one line with a count;
// the line's bar runs from the first start to the last end, and it is red when any of them failed
// the kind is the label without its last word: "v1 catalog gy" and "v1 catalog hk" are one kind
function stGateKind(g) { var w = stGateAlias(g.l).split(' '); return w.length > 1 ? w.slice(0, -1).join(' ') : w[0]; }
function stGateGroupResult(run) {
  var by = {}, order = [];
  run.forEach(function (g) { var k = g.cls + '|' + g.label; if (!by[k]) { by[k] = { g: g, n: 0 }; order.push(k); } by[k].n++; });
  order.sort(function (a, b) { return by[b].n - by[a].n; });
  return order.map(function (k) { var x = by[k]; return '<span class="st-gate-pill ' + x.g.cls + '">' + stEsc(x.g.label) + (order.length > 1 || x.n > 1 ? ' ×' + x.n : '') + '</span>'; }).join(' ');
}
function stGateKindKey(g) { return g.h && !g.sys ? g.tab + '|' + String(g.h).split('//').pop().split('/')[0] + '|' + (g.s || '') + '|' + (g.r || '') + '|' + (stGateEntity(g) || '') + '|' + (g.r ? '' : stGateKind(g)) : ''; }
// the table: 2 or more rows of one kind, site, entity and reason become one row with a count, which a click opens;
// the group stands where its newest row would be, and other rows between its members do not split it
function stGateTableHtml(list, me, opened, now) {
  var out = [], by = {};
  list.forEach(function (g) { var k = stGateKindKey(g); if (k) (by[k] = by[k] || []).push(g); });
  list.forEach(function (g) {
    var k = stGateKindKey(g), run = k ? by[k] : [g];
    if (run.length < 2) { out.push(stGateRowHtml(g, me, !!opened[g.id], now)); return; }
    if (run[0] !== g) return;
    var gid = 'grp:' + run[run.length - 1].id, open = opened[gid] || run.some(function (g) { return opened[g.id] || stGateSel[g.id]; });
    var g0 = run[0], bad = run.filter(function (g) { return g.cls === 'bad'; }).length, wait = run.reduce(function (n, g) { return n + (g.wait || 0); }, 0);
    var host = String(g0.h).split('//').pop().split('/')[0];
    out.push('<tr class="rq grp' + (open ? ' open' : '') + (g0.tab === me ? ' me' : '') + (stGateSel[gid] ? ' sel' : '') + '" data-id="' + stEsc(gid) + '" data-ids="' + stEsc(run.map(function (g) { return g.id; }).join(' ')) + '"><td class="t">' + stGateTime(g0.t) + '</td>'
      + '<td class="tab">' + stEsc(g0.tab === me ? 'this tab' : String(g0.tab).slice(0, 8)) + '</td><td class="s">' + stEsc(g0.s || '') + '</td><td class="v">' + stEsc(g0.m || '') + '</td><td class="r">' + stEsc(g0.r || '') + '</td><td class="e">' + stGateEntHtml(g0) + '</td>'
      + '<td class="i">' + stEsc(stGateSite(g0)) + '</td><td class="l"><b class="st-gl-gc">' + run.length + '</b><span class="st-gl-gx">' + (open ? '▾' : '▸') + '</span> ' + stEsc(stGateKind(g0)) + '</td><td></td>'
      + '<td>' + stGateGroupResult(run) + '</td><td class="w">' + stGateSec(wait) + '</td><td></td><td></td></tr>');
    if (open) run.forEach(function (g) { out.push(stGateRowHtml(g, me, !!opened[g.id], now).replace('<tr class="rq', '<tr class="rq in')); });
  });
  return out.join('');
}
function stGateZoomMerge(items) {
  var by = {}, out = [];
  items.forEach(function (x) {
    if (!x.g.h) { out.push(x); return; }
    var kind = stGateKind(x.g), key = stGateKindKey(x.g);
    if (!by[key]) { by[key] = { first: x, all: [], kind: kind }; out.push(by[key]); }
    by[key].all.push(x);
  });
  return out.map(function (m) {
    if (!m.all) return m;
    if (m.all.length < 2) return m.all;
    var bad = m.all.filter(function (x) { return x.cls !== m.first.cls; })[0];
    return { g: m.first.g, cls: bad ? bad.cls : m.first.cls, kind: m.kind, n: m.all.length,
      a: Math.min.apply(null, m.all.map(function (x) { return x.a; })), b: Math.max.apply(null, m.all.map(function (x) { return x.b; })) };
  }).reduce(function (r, x) { return r.concat(x); }, []);
}
function stGateZoomHtml(items, now) {
  var a = Math.min.apply(null, items.map(function (x) { return x.a; })), b = Math.max.apply(null, items.map(function (x) { return x.b; }));
  var span = Math.max(b - a, 200), pad = span * 0.08; a -= pad; span += pad * 2;
  var pct = function (t) { return (t - a) / span * 100; };
  return '<div class="st-gl-zh">' + stGateTime(a + pad) + ' · ' + items.length + ' requests in ' + stGateSec(span - pad * 2) + stGateSplit(items.map(function (x) { return x.g; })) + '</div>' + stGateZoomMerge(items).map(function (x) {
    var w = Math.max(pct(x.b) - pct(x.a), 1.5);
    return stGateTag('<div class="st-gl-zr">', x.g.id) + '<span class="st-gl-zn">' + '<b class="st-gl-zx">' + (x.n ? '×' + x.n : '') + '</b>' + '<span' + (x.g.h ? ' class="h"' : '') + '>' + (x.n ? stEsc(x.kind) : stGateLabelHtml(x.g)) + '</span></span>'
      + '<span class="st-gl-zrs">' + stEsc(x.g.r || '') + '</span>'
      + '<span class="st-gl-zl"><i class="st-gl-f ' + x.cls + '" style="left:' + pct(x.a).toFixed(2) + '%;width:' + w.toFixed(2) + '%"></i>' + stGateZoomIcon(x, pct(x.a)) + '</span>'
      + '<span class="st-gl-zt">' + stGateSec(x.b - x.a) + '</span></div>';
  }).join('');
}
function stGateLanesHtml(groups, all, now, me, box) {
  stGateZoomWire();
  // the time line keeps a margin at each end, so an icon or a cluster's pill does not go past the edge
  var lw = (((box || document).querySelector('.st-gl-lane') || {}).clientWidth || (box ? box.clientWidth : 0) || 600), insL = 26 / lw * 100, insR = 120 / lw * 100;
  var at = function (p) { return insL + p * (100 - insL - insR) / 100; };
  var vw = box ? stGateHudVw : stGateVw, SP = vw ? vw.s : ST_GATE_SPAN, t0 = vw ? vw.t0 : now - ST_GATE_SPAN, t1 = t0 + SP;
  var pct = function (t) { return at(Math.max(0, Math.min(100, (t - t0) / SP * 100))); };
  var bar = function (cls, a, b, tip) { return '<i class="' + cls + '"' + (tip ? ' data-tip="' + stEsc(tip) + '"' : '') + ' style="left:' + pct(a).toFixed(2) + '%;width:' + (pct(b) - pct(a)).toFixed(2) + '%"></i>'; };
  var lanes = {}, order = [];
  stGateZoom = {};
  groups.forEach(function (g) {
    if (g.sys || (g.cls !== 'go' && g.end < t0) || (vw && g.t > t1)) return;
    if (!lanes[g.tab]) { lanes[g.tab] = { s: {}, bars: [] }; order.push(g.tab); }
    var L = lanes[g.tab], from = g.t;
    if (g.s) L.s[g.s] = 1;
    var last = g.tries.length ? g.tries[g.tries.length - 1] : null, gEnd = g.res === 'waiting' ? now : Math.max(g.end || g.t, last ? last.end || now : g.t);
    var item = { g: g, a: g.t, b: gEnd, cls: last ? stGateTryCls(last.st) : 'off' };
    if ((gEnd - g.t < ST_GATE_SHORT || pct(gEnd) - pct(g.t) < 0.6) && g.cls !== 'go') { (L.short = L.short || []).push(item); return; }
    item.head = 1; item.bars = []; (L.long = L.long || []).push(item);   // a long request: its start icon and its bars, as one mark
    var who = (g.s ? g.s + '\n' : '') + stGateAlias(g.l);
    g.tries.forEach(function (x) {
      var end = x.end || now;
      if (x.t > from) item.bars.push(stGateTag(bar('st-gl-w', from, x.t, who + '\nWaits in the gate'), g.id));
      item.bars.push(stGateTag(bar('st-gl-f ' + stGateTryCls(x.st), x.t, end, who + '\n' + stGateTryTip(x.st) + ' · ' + stGateSec(end - x.t)), g.id));
      from = end;
    });
    if (g.res === 'waiting') item.bars.push(stGateTag(bar('st-gl-w', from, now, who + '\nWaits in the gate'), g.id));
  });
  if (me && !lanes[me]) { lanes[me] = { s: {}, bars: [] }; order.push(me); }
  order.sort(function (a, b) { return (b === me) - (a === me); });   // this tab first
  var bands = all.filter(function (ev) { return ev.e === 'answer' && ev.hold && ev.t + ev.hold > t0; }).map(function (ev) {
    return bar('st-gl-band', ev.t, ev.t + ev.hold);
  }).join('');
  var zid = 0, laneW = ((document.querySelector('.st-gl-lane') || {}).clientWidth || 600), pxp = function (n) { return n / laneW * 100; };
  // with the title bar's labels button on, a request's name goes under its icon, in the window and the HUD
  var lbl = !!stGateWinState().labels;
  // two lines: the reason, then the request's name
  var lbT = function (r, n) { return '<span>' + stEsc(r || '') + '&#8203;</span><span>' + stEsc(n) + '</span>'; };
  var lbW = function (x) { return lbl ? Math.min(140, Math.max(stGateAlias(x.g.l).length, (x.g.r || '').length) * 5.5) / 2 : 0; };
  var lbH = function (x, at, cls) { return lbl ? stGateTag('<span class="st-gl-lb' + (cls ? ' ' + cls : '') + '" style="left:' + at.toFixed(2) + '%">' + lbT(x.g.r, stGateAlias(x.g.l)) + '</span>', x.g.id) : ''; };
  order.forEach(function (tab) {
    var one = function (x) { return stGateTag(stGateIcon(x.g.s, 'at ' + x.cls, (x.g.s ? x.g.s + '\n' : '') + stGateAlias(x.g.l), pct(x.a)), x.g.id); };
    var sh = (lanes[tab].short || []).sort(function (x, y) { return x.a - y.a; }), run = [], marks = [];
    (lanes[tab].long || []).forEach(function (x) { marks.push({ a: pct(x.a) - pxp(Math.max(23, 12 + lbW(x))), b: Math.max(pct(x.b), pct(x.a) + pxp(lbW(x) - 12)), h: one(x) + lbH(x, pct(x.a), 'at') + x.bars.join('') }); });
    var flush = function () {
      if (!run.length) return;
      var at = pct(run[0].a);
      if (run.length === 1) {
        var x = run[0];
        marks.push({ a: at - pxp(Math.max(10, lbW(x))), b: at + pxp(Math.max(11, lbW(x))), h: lbH(x, at) + stGateTag(stGateIcon(x.g.s, 'one ' + x.cls, (x.g.s ? x.g.s + '\n' : '') + stGateAlias(x.g.l) + '\n' + stGateTryTip(x.g.tries.length ? x.g.tries[x.g.tries.length - 1].st : '') + ' · ' + stGateSec(x.b - x.a), at), x.g.id) });
      } else {
        var id = 'z' + (zid++);
        stGateZoom[id] = stGateZoomHtml(run, now);
        var bad = run.some(function (x) { return x.cls === 'bad'; });
        var end = pct(Math.max.apply(null, run.map(function (x) { return x.b; }))), ni = Math.min(3, run.reduce(function (a, x) { a[stGateIconSrc(x.g.s)] = 1; return a; }, {}) && Object.keys(run.reduce(function (a, x) { a[stGateIconSrc(x.g.s)] = 1; return a; }, {})).length);
        var minW = pxp(21 + (ni - 1) * 13 + 2 + 50 + (run.length > 1 ? 30 : 0));
        // a cluster's label, left-aligned under its icons: its reasons and its requests' names, each once, the first 3 and a count of the rest
        var few = function (f) { var u = run.reduce(function (a, x) { var t = f(x.g) || ''; if (t && a.indexOf(t) < 0) a.push(t); return a; }, []); return u.slice(0, 3).join(' · ') + (u.length > 3 ? ' +' + (u.length - 3) : ''); };
        var cn = few(function (g) { return stGateAlias(g.l); }), cr = few(function (g) { return g.r; });
        var cw = lbl ? Math.min(240, Math.max(cn.length, cr.length) * 5.5) : 0;
        marks.push({ a: at - pxp(10), b: Math.max(end, at - pxp(10) + minW, at - pxp(10) + pxp(cw)), h: (lbl ? '<span class="st-gl-lb cl" data-ids="' + stEsc(JSON.stringify(run.map(function (x) { return x.g.id; }))) + '" style="left:' + at.toFixed(2) + '%">' + lbT(cr, cn) + '</span>' : '') + '<span class="st-gl-cl' + (bad ? ' bad' : '') + '" data-z="' + id + '" data-ids="' + stEsc(JSON.stringify(run.map(function (x) { return x.g.id; }))) + '" style="left:' + at.toFixed(2) + '%;width:calc(' + Math.max(0, end - at).toFixed(2) + '% + 10px)">' + run.reduce(function (a, x) { var k = stGateIconSrc(x.g.s); if (!a.k[k]) { a.k[k] = 1; a.l.push(x.g.s); } return a; }, { k: {}, l: [] }).l.slice(0, 3).map(function (n) { return stGateIcon(n, '', ''); }).join('') + stGateBurst(run) + '</span>' });
      }
      run = [];
    };
    sh.forEach(function (x) { if (run.length && pct(x.a) - pct(run[run.length - 1].a) > ST_GATE_NEAR) flush(); run.push(x); });
    flush();
    // greedy packing: a mark goes on the first sub-row whose last mark ends before it starts
    var ends = [], subs = [];
    marks.sort(function (x, y) { return x.a - y.a; }).forEach(function (k) {
      // the first free sub-row; when all 4 are busy, the one that frees up first
      var i = 0, best = 0;
      for (; i < ST_GATE_SUBS; i++) { if (ends[i] == null || ends[i] < k.a - pxp(3)) break; if (ends[i] < ends[best]) best = i; }
      if (i === ST_GATE_SUBS) i = best;
      ends[i] = Math.max(ends[i] || -1e9, k.b); (subs[i] = subs[i] || []).push(k.h);
    });
    lanes[tab].rows = ST_GATE_SUBS;
    subs.forEach(function (h, i) { lanes[tab].bars.push('<div class="st-gl-sub" style="--i:' + i + '">' + h.join('') + '</div>'); });
  });
  var rows = order.map(function (tab) {
    var s = Object.keys(lanes[tab].s).join(', ');
    return '<div class="st-gl-lane' + (tab === me ? ' me' : '') + '" data-lane="' + stEsc(tab) + '" style="--r:' + (lanes[tab].rows || 1) + '"><span class="st-gl-name" data-tip="' + stEsc('Tab ' + tab + (tab === me ? ' (this tab)' : '') + (function () { try { var t = localStorage.getItem(ST_GATE_KEY + '-title:' + tab); return t ? '\n' + t : ''; } catch (e) { return ''; } })()) + '"><b>'
      + stEsc(tab === me ? 'This tab' : tab.slice(0, 8)) + '</b>' + (s ? ' ' + Object.keys(lanes[tab].s).map(function (n) { return stGateIcon(n, 'nm'); }).join('') : '') + '</span>' + lanes[tab].bars.join('') + '</div>';
  }).join('') || '<div class="st-gl-lane"><span class="st-gl-none">No requests in the last ' + stGateSpanTxt() + '</span></div>';
  return '<div class="st-gl-bands">' + bands + '</div>' + rows
    + '<div class="st-gl-ax">' + (vw ? [0, 25, 50, 75, 100] : [0, 25, 50, 75]).map(function (p) { return '<span style="left:' + at(p).toFixed(2) + '%">' + (vw ? stGateTime(t0 + SP * p / 100).slice(0, p ? 12 : 8) : '−' + stGateSpanTxt(ST_GATE_SPAN * (100 - p) / 100).replace(/\.\d+/, function (d) { return d.length > 2 ? d.slice(0, 2) : d; })) + '</span>'; }).join('') + (vw ? '' : '<span style="left:' + at(100).toFixed(2) + '%">now</span>') + '</div>';
}
function stGateZoomWire() {
  if (stGateZoomWire.on) return; stGateZoomWire.on = 1;
  var pop = null, bye = 0, watch = 0, mx = -1, my = -1;
  var close = function () { clearTimeout(bye); bye = 0; clearInterval(watch); watch = 0; if (pop) pop.remove(), pop = null; };
  // a click on a row opens that request in the table (openFromLanes), then the popup goes
  document.addEventListener('click', function (e) {
    if (pop && e.target.closest && e.target.closest('.st-gl-zoom [data-id]')) setTimeout(close, 0);
  });
  // no mouseover comes when the mouse leaves the window, or when the time line redraws under a still mouse:
  // a watchdog looks under the last mouse spot and closes the popup when neither it nor a cluster is there
  document.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; }, true);
  document.addEventListener('mouseout', function (e) { if (!e.relatedTarget) mx = my = -1; if (pop && !e.relatedTarget && !bye) bye = setTimeout(close, 400); });
  window.addEventListener('blur', function () { if (pop) close(); });
  var check = function () {
    if (!pop) return close();
    var el = mx < 0 ? null : document.elementFromPoint(mx, my);
    if (!el || !el.closest || !el.closest('.st-gl-cl, .st-gl-zoom')) { if (!bye) bye = setTimeout(close, 400); }
    else { clearTimeout(bye); bye = 0; }
  };
  // the popup stays a moment after the mouse leaves, so it can cross the gap and click a row in it
  document.addEventListener('mouseover', function (e) {
    var c = e.target.closest && e.target.closest('.st-gl-cl');
    if (!c) {
      if (!pop) return;
      if (e.target.closest && e.target.closest('.st-gl-zoom')) { clearTimeout(bye); bye = 0; return; }
      // a close already on its way is not restarted: moving the mouse, or the log scrolling under it, sends mouseover after mouseover
      if (!bye) bye = setTimeout(close, 400);
      return;
    }
    clearTimeout(bye); bye = 0;
    if (pop && pop.dataset.z === c.dataset.z) return;
    if (pop) pop.remove();
    if (!watch) watch = setInterval(check, 300);
    pop = document.createElement('div'); pop.className = 'st-gl-zoom'; pop.dataset.z = c.dataset.z;
    pop.innerHTML = stGateZoom[c.dataset.z] || '';
    document.body.appendChild(pop);
    var r = c.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, r.left + r.width / 2 - w / 2)) + 'px';
    // too tall for the window: it takes the side with more room and scrolls with the wheel, with no scrollbar
    var up = r.top - 10, down = window.innerHeight - r.bottom - 10;
    if (h > up && h > down) { pop.style.maxHeight = Math.max(up, down) + 'px'; h = pop.offsetHeight; }
    pop.style.top = (h <= up && (up >= down || h > down) ? r.top - h - 6 : r.bottom + 6) + 'px';
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
    + '<div class="st-gl-ax"><span style="left:0">0</span><span style="left:50%">' + stGateDur(span / 2) + '</span><span style="left:100%">' + stGateDur(span) + '</span></div></div>';
}
// a time span for the request's own scale: ms under a second, where "0s" would say nothing
function stGateDur(ms) { return ms < 1000 ? Math.round(ms) + ' ms' : stGateSec(ms);
}
// a URL part decoded; the gate keeps a URL cut to a length, so it can end inside an escape (%E2%80, %4):
// each run of escapes decodes its longest whole start, and a cut escape at the end is dropped
function stGateDec(x) {
  x = String(x).replace(/\+/g, ' ');
  try { return decodeURIComponent(x); } catch (e) { /* a cut or a stray % */ }
  return x.replace(/%[0-9a-f]?$/i, '').replace(/(%[0-9a-f]{2})+/gi, function (m) {
    for (var n = m.length; n > 0; n -= 3) { try { return decodeURIComponent(m.slice(0, n)); } catch (e) { /* shorter */ } }
    return m;
  });
}
// a URL's query as [{k, v: [values], raw: [k=v as sent]}], in order, a key that repeats in one entry
function stGateQuery(u) {
  var qi = u.indexOf('?'), out = [], at = {};
  if (qi < 0) return out;
  var dec = stGateDec;
  u.slice(qi + 1).split('#')[0].split('&').forEach(function (kv) {
    if (!kv) return;
    var e = kv.indexOf('='), k = dec(e < 0 ? kv : kv.slice(0, e)), v = e < 0 ? '' : dec(kv.slice(e + 1));
    var p = at[k] || (at[k] = out[out.push({ k: k, v: [], raw: [] }) - 1]);
    p.v.push(v); p.raw.push(kv);
  });
  return out;
}
// the query as key = value lines; a key sent many times shows its first values and a count, all of them once the row shows its whole URL
// a short request body (the gate keeps one of 300 characters or less, secrets hidden): a form as key = value lines, other text as it is
function stGateBodyHtml(bt) {
  if (bt == null || bt === '') return '';
  var form = !/^[{[]/.test(bt) && /^[^=&\s]+=\S*$/.test(bt);
  return '<div class="st-gate-bth">Body</div>' + (form ? stGateQueryHtml(stGateQuery('?' + bt)) : '<div class="st-gate-bt">' + stEsc(bt) + '</div>');
}
function stGateQueryHtml(qps) {
  if (!qps.length) return '';
  return '<dl class="st-gate-qp">' + qps.map(function (p) {
    var v;
    if (p.k === 'inc' && p.v.length === 1) {
      // a ws/2 inc= asks for several parts at once: the relationships (…-rels) apart from the rest
      var incs = p.v[0].split(/\s+/).filter(Boolean);
      var rels = incs.filter(function (x) { return /-rels$/.test(x); }).map(function (x) { return x.replace(/-rels$/, ''); });
      var other = incs.filter(function (x) { return !/-rels$/.test(x); });
      v = (other.length ? '<div><b class="st-gate-k">data:</b> ' + stEsc(other.join(', ')) + '</div>' : '') + (rels.length ? '<div><b class="st-gate-k">relationships:</b> ' + stEsc(rels.join(', ')) + '</div>' : '');
    } else if (p.v.length > 3) {
      v = p.v.map(function (x, i) { return '<div' + (i >= 2 ? ' class="st-gate-more"' : '') + '>' + stEsc(x) + '</div>'; }).join('')
        + '<div class="st-gate-less st-gate-n" data-tip="Click to show all of them">… ' + (p.v.length - 2) + ' more</div>';
    } else v = p.v.map(function (x) { return '<div>' + (x === '' ? '<i>empty</i>' : stEsc(x)) + '</div>'; }).join('');
    return '<dt>' + stEsc(p.k) + (p.v.length > 1 ? ' <span class="st-gate-n">×' + p.v.length + '</span>' : '') + '</dt><dd>' + v + '</dd>';
  }).join('') + '</dl>';
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
// the site of a request without the scheme and a leading www.; MusicBrainz's own requests have none
function stGateSite(g) { return g.h ? String(g.h).split('//').pop().split('/')[0].replace(/^www[.]/, '') : ''; }
function stGateRowHtml(g, me, isOpen, now) {
  var tab = '<td class="tab">' + stEsc(g.tab === me ? 'this tab' : String(g.tab).slice(0, 8)) + '</td>';
  if (g.sys) {
    return '<tr class="sys' + (/^lead/.test(g.evs[0].e) ? ' lead' : '') + (g.tab === me ? ' me' : '') + '"><td class="t">' + stGateTime(g.t) + '</td>' + tab + '<td class="s">' + stEsc(g.s || '') + '</td>'
      + '<td class="v"></td><td></td><td></td><td></td><td class="l">' + stEsc(stGateWhat(g.evs[0])) + '</td><td></td><td><span class="st-gate-pill ' + g.cls + '">' + stEsc(g.label) + '</span></td><td></td><td></td><td></td></tr>';
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
    + '<td class="v">' + stEsc(g.m || '') + '</td><td class="r">' + stEsc(g.r || '') + '</td><td class="e">' + stGateEntHtml(g) + '</td><td class="i">' + stEsc(stGateSite(g)) + '</td><td class="l"' + (g.u || g.h ? ' data-tip="' + stEsc((g.h ? g.h : '') + (g.u || '')) + '"' : '') + '>' + stGateLabelHtml(g) + '</td><td><span class="st-gate-tries">' + tries + '</span></td>'
    + '<td><span class="st-gate-pill ' + g.cls + '">' + stEsc(g.label) + '</span></td>'
    + '<td class="w" data-tip="Waited in the gate + on the way">' + stGateSec(g.wait) + (flight ? ' + ' + stGateSec(flight) : '') + '</td><td>' + meter + '</td><td></td></tr>';
  if (!isOpen) return row;
  var full = (g.h || '') + (g.u || (stGateAlias(g.l) !== g.l ? g.l : ''));
  var qs = String(g.u || g.l || ''), qps = stGateQuery(qs), facts = [];
  if (g.bs != null) facts.push('body ' + stGateBytes(g.bs)); else if (g.m && g.m !== 'GET') facts.push('body size unknown');
  if (g.rs != null) facts.push('response ' + stGateBytes(g.rs));
  var fi = full.indexOf('?'), short = fi < 0 || !qps.some(function (p) { return p.v.length > 2; }) ? '' : full.slice(0, fi + 1) + qps.map(function (p) {
    return p.v.length > 2 ? p.raw[0] + '&… ' + p.k + ' ×' + p.v.length : p.raw.join('&');
  }).join('&');
  var urlHtml = short ? '<span class="st-gate-short">' + stEsc(short) + '</span><span class="st-gate-full">' + stEsc(full) + '</span>' : stEsc(full);
  return row + '<tr class="steps' + (stGateUrlAll[g.id] ? ' all' : '') + '"><td colspan="13">' + (full ? '<div class="st-gate-url" data-tip="Click to show the whole URL or only its first line">' + urlHtml + '</div>' : '')
    + stGateQueryHtml(qps) + stGateBodyHtml(g.bt) + (facts.length ? '<div class="st-gate-facts">' + facts.join(' · ') + '</div>' : '') + stGateReqLaneHtml(g, now || Date.now()) + '<ol>' + g.evs.map(function (ev) {
    return '<li' + (stGateBad(ev) ? ' class="bad"' : '') + '><span class="t">' + stGateTime(ev.t) + '</span><span class="e">' + stEsc(ev.e) + '</span><span>' + stEsc(stGateWhat(ev)) + '</span></li>';
  }).join('') + '</ol></td></tr>';
}
// a short name for a raw URL or path: "ws/2 url lookup (24)", "ws/2 release by release-group"
function stGateAlias(l) {
  l = String(l || '').replace(/^(GET|POST|PUT|PATCH|DELETE|HEAD) +(?=\/|https?:)/, '');   // Fusion's labels start with the verb
  if (!/^(https?:|\/|ws\/)/.test(l) && l.indexOf('?') < 0) return l;
  var q = l.indexOf('?'), path = (q < 0 ? l : l.slice(0, q)).replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '');
  var qs = q < 0 ? '' : l.slice(q + 1).split('#')[0];
  // a collection tick (Event Horizon) adds or removes an entity, despite the "collaborator" in its path
  var cc = path.match(RegExp("^collection.[0-9a-f-]{36}.collection_collaborator.(add|remove)$"));
  if (cc) {
    var ce = qs.match(/^([a-z_-]+)=([0-9a-f]{0,8})/);
    return (cc[1] === 'add' ? 'add to collection' : 'remove from collection') + (ce ? ': ' + ce[1].replace(/_/g, ' ') + ' ' + ce[2] + '…' : '');
  }
  var p = path.replace(/ /g, '/').split('/').filter(Boolean).map(stGateDec), keys = {}, kvs = qs.split('&');
  if (l.length >= 120) kvs.pop();
  kvs.forEach(function (kv) { var k = stGateDec(kv.split('=')[0] || ''); if (k) keys[k] = (keys[k] || 0) + 1; });
  var mbid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
  var head = p[0] === 'ws' && p[1] ? 'ws/' + p[1] : p[0] || '/';
  var ent = p[0] === 'ws' ? p[2] : p[1], id = p[0] === 'ws' ? p[3] : p[2];
  var out = head + (ent ? ' ' + ent : '');
  if (id) out += mbid.test(id) ? ' lookup' : ' ' + id;
  else if (keys.query) out += ' search';
  else if (keys.resource) out += ' lookup' + (keys.resource > 1 ? ' (' + keys.resource + ')' : '');
  else {
    // a search's own term key (q, query) says nothing past "search": the detail shows its value
    var by = Object.keys(keys).filter(function (k) { return !ST_GATE_BYX.test(k) && !(/search/i.test(out) && /^(q|k|query|term)$/i.test(k)); });
    if (by.length) out += ' by ' + by.join(', ');
  }
  return out;
}
// query keys that say nothing about what a request asks for: paging, format, and sign-in (OAuth, app ids, keys)
var ST_GATE_BYX = /^(inc|fmt|format|limit|offset|page|per_page|type|status|lang|_|callback|oauth_.*|client_id|app_id|appid|api_?key|key|token|access_token|sig|signature|nonce|ts|timestamp)$/i;
// the MusicBrainz entity a request is about, from its path: "/ws/2/release-group?…", "/recording/<mbid>"
var ST_GATE_ENTS = ['area', 'artist', 'event', 'genre', 'instrument', 'label', 'place', 'recording', 'release', 'release_group', 'series', 'url', 'work'];
var ST_GATE_ENT_ALIAS = { cover_art_upload: 'release', event_art_upload: 'event' };
function stGateEntity(g) {
  if (g.en) return String(g.en).replace(/-/g, '_');
  if (g.h) return '';
  var p = String(g.u || g.l || '').split('?')[0].replace(/^https?:\/\/[^/]+/, '').replace(/ /g, '/').split('/').filter(Boolean);
  if (p[0] === 'ws') p = p.slice(2);
  var e = (p[0] || '').replace(/-/g, '_');
  // an art upload is about the release (Art Station, Falcon) or the event its mbid names
  e = ST_GATE_ENT_ALIAS[e] || e;
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
// the Request cell: the entity column names the entity, so the label drops its leading entity word,
// and the host in parentheses the Site column shows; then the values that tell it from its siblings
function stGateLabelHtml(g) {
  var t = stEsc(stGateAlias(g.l)), e = stGateEntity(g), d = stGateDetail(g);
  if (g.h) {
    var host = String(g.h).split('//').pop().split('/')[0];
    [host, stGateSite(g)].forEach(function (x) { if (x && t.slice(-x.length - 3) === ' (' + x + ')') t = t.slice(0, -x.length - 3); });
  }
  if (e) t = t.replace(new RegExp('^' + e.replace(/[_-]/g, '[ _-]') + 's?\\s+', 'i'), '');
  return t + (d ? ' <span class="st-gate-dt">' + stEsc(d) + '</span>' : '');
}
// what tells requests of one kind apart: what they search for (a UPC or an ISRC named as one), the country, the type.
// From the URL's query and a form body; a value the label already holds is left out
var ST_GATE_DQ = /^(q|k|query|resource|url|term|search|keywords?|title|isrc|upc|ean|gtin|barcode|filter\[(isrc|upc|barcode(id)?)\])$/i;
var ST_GATE_DC = /^(country|countrycode|cc|region|market|territory|store|storefront|locale)$/i;
var ST_GATE_DT = /^(type|types|entity|kind|media)$/i;
function stGateDetail(g) {
  if (g.sys) return '';
  var lab = stGateAlias(g.l), qps = stGateQuery(String(g.u || g.l || ''));
  if (g.bt && !/^[{[]/.test(g.bt) && /^[^=&\s]+=\S*$/.test(g.bt)) qps = qps.concat(stGateQuery('?' + g.bt));
  var out = [];
  [ST_GATE_DQ, ST_GATE_DC, ST_GATE_DT].forEach(function (re, n) {
    qps.forEach(function (p) {
      if (!re.test(p.k) || p.v.length !== 1) return;
      var v = p.v[0].trim().replace(/^https?:\/\/(www[.])?/i, '');
      if (!v || lab.indexOf(v) >= 0) return;
      if (n === 1) out.push(v.length === 2 ? v.toUpperCase() : v);
      else if (n === 2) out.push(v.length > 20 ? v.slice(0, 19) + '…' : v);
      else if (/^\d{12,14}$/.test(v)) out.push('UPC ' + v);
      else if (/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(v)) out.push('ISRC ' + v.toUpperCase());
      else out.push('"' + (v.length > 32 ? v.slice(0, 31) + '…' : v) + '"');
    });
  });
  return out.join(' · ');
}
function stGateMarkdown(all, me, only) {
  var s = stGateState(), now = Date.now(), groups = stGateGroups(all, now);
  // only: the ids of the requests picked with Ctrl, the rest is left out
  if (only) { groups = groups.filter(function (g) { return only[g.id]; }); var evIn = new Set(); groups.forEach(function (g) { g.evs.forEach(function (ev) { evIn.add(ev); }); }); all = all.filter(function (ev) { return evIn.has(ev); }); }
  var c = stGateCount(groups);
  var out = ['# String Theory Network Log', '', 'Copied ' + new Date().toISOString() + ', this tab ' + (me || '-'), '',
    'State: ' + JSON.stringify(s) + ' (now ' + now + ')', '',
    'Requests: ' + c.n + ' (' + c.ok + ' ok, ' + c.re + ' retried, ' + c.bad + ' failed, ' + c.go + ' on the way)', '',
    '## Requests', '',
    '| Time | Tab | Script | Verb | Reason | Entity | Site | Request | Tries | Result | Wait | Rate limit |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
  var cell = function (v) { return String(v == null ? '' : v).replace(/\|/g, '\\|').replace(/\n/g, ' '); };
  // one row per request, the same columns as the table
  groups.forEach(function (g) {
    var tab = cell(g.tab) + (g.tab === me ? ' (this)' : '');
    if (g.sys) { out.push('| ' + stGateTime(g.t) + ' | ' + tab + ' | ' + cell(g.s) + ' |  |  |  |  | ' + cell(stGateWhat(g.evs[0])) + ' |  | ' + cell(g.label) + ' |  |  |'); return; }
    var flight = (g.tries || []).reduce(function (n, x) { return n + (x.end ? x.end - x.t : 0); }, 0), a = g.ans;
    out.push('| ' + stGateTime(g.t) + ' | ' + tab + ' | ' + cell(g.s) + (g.b === 0 ? ' (i)' : '') + ' | ' + cell(g.m) + ' | ' + cell(g.r)
      + ' | ' + cell((stGateEntity(g) || '').replace(/_/g, ' ')) + ' | ' + cell(stGateSite(g)) + ' | ' + cell(stGateAlias(g.l)) + (stGateDetail(g) ? ' · ' + cell(stGateDetail(g)) : '') + ((g.h || g.u) ? ' (' + cell((g.h || '') + (g.u || '')) + ')' : '')
      + ' | ' + (g.tries || []).length + ' | ' + cell(g.label) + ' | ' + stGateSec(g.wait) + (flight ? ' + ' + stGateSec(flight) : '')
      + ' | ' + (a && a.lim && a.rem != null ? a.rem + '/' + a.lim + (a.who ? ' (' + cell(a.who) + ')' : '') : '') + ' |');
  });
  out.push('', '## Events', '', '| Time | Tab | Script | Event | Request | What |', '| --- | --- | --- | --- | --- | --- |');
  all.forEach(function (ev) {
    out.push('| ' + stGateTime(ev.t) + ' | ' + cell(ev.tab) + (ev.tab === me ? ' (this)' : '') + ' | ' + cell(ev.s) + ' | ' + cell(ev.e) + (ev.b === 0 ? ' (i)' : '')
      + ' | ' + cell((ev.m ? ev.m + ' ' : '') + (ev.h ? ev.h + ' ' : '') + (ev.l || '')) + (ev.u ? ' (' + cell(ev.u) + ')' : '') + ' | ' + cell(stGateWhat(ev)) + ' |');
  });
  return out.join('\n');
}

// the window's remembered state: open, min, full, left, top, w, h, mode, mine
function stGateWinState() { try { return JSON.parse(GM_getValue(ST_GATE_WIN, '{}') || '{}') || {}; } catch (e) { return {}; } }
// a column filter: a funnel in the header opens a list of the column's values, narrowed by typing
function stGateCfBtn(k) { return '<button type="button" class="st-gate-cf" data-cf="' + k + '" aria-label="Filter this column, right click clears the filter"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18l-7 8v7l-4 2v-9z"/></svg></button>'; }
function stGateRemember(patch) { try { GM_setValue(ST_GATE_WIN, JSON.stringify(Object.assign(stGateWinState(), patch))); } catch (e) { /* no storage: it just forgets */ } }
// the network log opens on MusicBrainz only, never on another site such as Discogs
function stGateHere() { return /(^|\.)musicbrainz\.(org|eu)$/.test(location.hostname); }
// at start: the window comes back if it was left open (top frame only)
function stGateReopen() {
  var w;
  try { if (window.top !== window || !stGateHere()) return; w = stGateWinState(); if (!w.open && !w.hud) return; } catch (e) { return; }
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
var stGateColW = {};   // the network log table's column widths a drag set, by column
function stGateHud(on) {
  if (on && !stGateHere()) return;
  if (stGateHudEl) { clearInterval(stGateHudEl.timer); stGateHudEl.remove(); stGateHudEl = null; }
  stGateRemember({ hud: !!on });
  if (!on) return;
  stGateCss();
  var el = document.createElement('div');
  el.id = 'st-gate-hud-box'; el.className = 'mbu-ui' + (stGateWinState().hudGhost ? ' ghost' : '');
  el.innerHTML = '<div class="st-gate-hud-h"><span data-tip="Open the network log\nA double click anywhere on the HUD does the same"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>Network</span><span class="st-gate-n"></span><button type="button" class="st-gate-hud-ghost" aria-label="See-through" data-tip="See-through\nThe HUD is nearly invisible until the mouse is on it"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 10h.01M15 10h.01M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/></svg></button><button type="button" class="mbu-ov-x" aria-label="Close the HUD">✕</button></div><div class="st-gate-hud-l"></div><div class="st-gate-hud-rz l"></div><div class="st-gate-hud-rz r"></div>';
  document.documentElement.appendChild(el);
  var w0 = stGateWinState().hudW; if (w0) el.style.width = w0 + 'px';
  // its left and right edges drag its width, which it remembers
  el.querySelectorAll('.st-gate-hud-rz').forEach(function (h) {
    h.addEventListener('dblclick', function (e) { e.stopPropagation(); });
    h.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      var left = h.classList.contains('l'), r = el.getBoundingClientRect(), x0 = e.clientX;
      Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', right: 'auto', bottom: 'auto' });
      var mv = function (ev) {
        var d = ev.clientX - x0, w = left ? r.width - d : r.width + d;
        w = Math.max(240, Math.min(w, left ? r.right : window.innerWidth - r.left));
        el.style.width = w + 'px';
        if (left) el.style.left = (r.right - w) + 'px';
      };
      var up = function () {
        document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
        stGateRemember({ hudW: Math.round(el.offsetWidth), hudPos: { left: el.style.left, top: el.style.top } });
      };
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
  });
  var held = false, hudSpan = 30000, lanes = el.querySelector('.st-gate-hud-l');
  lanes.addEventListener('mouseenter', function () { held = true; });
  lanes.addEventListener('mouseleave', function () { held = false; });
  var ghostBtn = el.querySelector('.st-gate-hud-ghost'), ghostSeg = function () { ghostBtn.setAttribute('aria-pressed', String(el.classList.contains('ghost'))); };
  ghostSeg();
  ghostBtn.onclick = function () { var on = !stGateWinState().hudGhost; stGateRemember({ hudGhost: on }); el.classList.toggle('ghost', on); ghostSeg(); };
  el.querySelector('.mbu-ov-x').onclick = function () {
    stGateHud(false);
    var b = document.getElementById('st-gate-hud'); if (b) b.setAttribute('aria-pressed', 'false');
  };
  var moved = false, pos = stGateWinState().hudPos;
  if (pos) Object.assign(el.style, { left: pos.left, top: pos.top, right: 'auto', bottom: 'auto' });
  el.querySelector('.st-gate-hud-h span').onclick = function () { if (!moved) stGateOpen(); };
  // a click on a mark, or on a row of a cluster's tip, opens the window at that request, as a click in the window does
  if (!stGateHud.wired) {
    stGateHud.wired = 1;
    document.addEventListener('click', function (e) {
      var m = e.target.closest && e.target.closest('#st-gate-hud-box [data-id], #st-gate-hud-box [data-ids], .st-gl-zoom [data-id]');
      // with the window open, its own handler takes a tip's row
      if (!m || (stGateWin && stGateWin.el.isConnected && !m.closest('#st-gate-hud-box'))) return;
      var bl = m.closest('.st-gl-lane[data-lane]');
      stGateOpen();
      if (stGateWin && stGateWin.focus) stGateWin.focus(m.dataset.ids ? JSON.parse(m.dataset.ids) : [m.dataset.id], bl ? bl.dataset.lane : stGateTab(), !!m.dataset.ids);
    });
  }
  // a double click anywhere on the HUD opens the big window and hides the HUD
  el.addEventListener('dblclick', function (e) {
    if (e.target.closest('button')) return;
    stGateOpen();
    stGateHud(false);
    var b = document.getElementById('st-gate-hud'); if (b) b.setAttribute('aria-pressed', 'false');
  });
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
      var hs = hudSpan = Math.max(30000, Math.round(ST_GATE_SPAN * (lanes.clientWidth || 500) / 1200 / 10000) * 10000);
      var all = stGateEvents(), now = Date.now(), st = stGateWinState();
      el.classList.toggle('lbl', !!st.labels);
      var hosts = st.hosts || { mb: st.src !== 'other', ext: st.src !== 'mb' };
      // the big window's site filter applies here too
      var groups = stGateGroups(all, now).filter(function (g) { return g.sys || (g.h ? hosts.ext : hosts.mb); }), c = stGateCount(groups.filter(function (g) { return now - g.t <= hs; }));
      el.querySelector('.st-gate-n').innerHTML = c.n + ' in ' + stGateSpanTxt(hs) + (c.bad ? ' · <span class="bad">' + c.bad + ' failed</span>' : '') + (c.go ? ' · ' + c.go + ' on the way' : '');
      if (!held) {
        // the same scale as the big window (its span over about 1200 px), so the HUD shows the last part of it
        var span0 = ST_GATE_SPAN; ST_GATE_SPAN = hs;
        try { lanes.innerHTML = stGateLanesHtml(groups, all, now, stGateTab(), lanes); } finally { ST_GATE_SPAN = span0; }
      }
    } catch (e) { /* a bad event: the next tick tries again */ }
  };
  el.timer = setInterval(draw, 1000);
  stGateZoomOn(lanes, function () { return hudSpan; }, function () { return stGateHudVw; }, function (v) { stGateHudVw = v; }, function () { held = false; draw(); held = true; });
  stGateHudEl = el;
  draw();
  // pinned by its top left corner: a change in height grows it downward, it does not move
  if (!pos) { var r0 = el.getBoundingClientRect(); Object.assign(el.style, { left: r0.left + 'px', top: r0.top + 'px', right: 'auto', bottom: 'auto' }); }
}
function stGateClose() {
  if (stGateWin) { stGateWin.off(); stGateWin.el.remove(); stGateWin = null; }
  stGateRemember({ open: false });
}

// asked for (the palette): it opens whole, a minimised one too. At start (again) it comes back as it was left
function stGateOpen(again) {
  if (!stGateHere()) return;
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
  var mode = st.mode || 'all', hosts = st.hosts || { mb: st.src !== 'other', ext: st.src !== 'mb' }, hide = st.hide || [], sig = '', opened = {}, cf = {}, cft = {}, lastGroups = [];
  var pop = document.createElement('div');
  pop.id = 'st-gate'; pop.className = 'mbu-ui'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Network log');
  pop.innerHTML = '<div class="mbu-logpop-h"><button type="button" id="st-gate-hud" aria-label="Minimize to the HUD" data-tip="Minimize to the HUD\nThe time line in a small strip that stays on screen\nA double click in the window does the same"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg></button><button type="button" id="st-gate-lbl" aria-label="Request names on the time line" data-tip="Request names on the time line\nEach request\'s name under its script\'s icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg></button><b>Network log</b> <span class="st-gate-n"></span><span class="mbu-logpop-sp"></span>'
    + '<span class="st-gate-seg st-gate-hosts" role="group" aria-label="Hosts"><button type="button" data-v="mb" data-tip="Requests to MusicBrainz">' + (stGateIcons(), stIcon ? stIcon('musicbrainz', 16) : 'MB') + '</button>'
    + '<button type="button" data-v="ext" data-tip="Requests to other sites\nThe gate logs them but does not pace them">' + (stIcon ? stIcon('globe', 16) : 'Other') + '</button></span>'
    + '<select id="st-gate-span" aria-label="Time line span" data-tip="How far back the time line goes">' + ST_GATE_SPANS.map(function (ms) { return '<option value="' + ms + '"' + (ms === ST_GATE_SPAN ? ' selected' : '') + '>' + stGateSpanTxt(ms) + '</option>'; }).join('') + '</select><span class="mbu-logpop-sp"></span>'
    + '<button type="button" class="mbu-logpop-copy" data-tip="Copy as Markdown\nThe state and every event, ready for a GitHub issue\nCtrl and a click on a row picks it without opening it\nCtrl, Shift and a click picks every row from the last picked one\nWith rows picked, only they are copied\nA click on a row without Ctrl ends the picking">⧉ Copy</button>'
    + '<button type="button" class="mbu-logpop-clear" data-tip="Clear the network log\nThe events of every tab are deleted">Clear</button>'
    + '<span style="width:16px;flex:none"></span><button type="button" class="mbu-logpop-full" data-tip="Full screen\nA double-click on the title bar does the same">⛶</button>'
    + '<button type="button" class="mbu-logpop-min" data-tip="Minimize">–</button>'
    + '<button type="button" class="mbu-logpop-x" data-tip="Close">✕</button></div>'
    + '<div id="st-gate-state"></div><div class="st-gate-sumrow"><div id="st-gate-sum"></div><button type="button" class="st-gate-zm" data-tip="Reset the zoom\nShows the whole time line again\nA right click on the time line resets the zoom too"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13L13 3M8.5 3H13V7.5M3 8.5V13H7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button type="button" class="st-gate-wm" data-tip="What the mouse wheel does on the time line\nOff: it zooms in and out\nOn: it moves the time line to the left or right\nWith Shift, the wheel does the other one"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8H14.5M5 4.5L1.5 8L5 11.5M11 4.5L14.5 8L11 11.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button type="button" class="st-gate-ps" data-tip="Pause the time line\nIt stands still at this moment, new requests still come in below\nA second click lets it run again"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3V13M11 3V13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button><button type="button" class="st-gate-mx" data-mx="lanes" data-tip="Maximize the time line\nA second click restores both panels">⛶</button></div><div class="st-gate-pane" data-pane="lanes"><div id="st-gate-lanes"></div></div><div id="st-gate-split" data-tip="Drag to resize\nA double click resets"></div><div class="st-gate-tbar"><button type="button" class="st-gate-fit" data-tip="Fit the columns\nEach column gets the width of its widest cell\nThe Request column takes the rest\nA right click fits the Request column too\nA double click on a column\'s edge fits that column only">↔</button><button type="button" class="st-gate-mx" data-mx="body" data-tip="Maximize the request table\nA second click restores both panels">⛶</button></div><div id="st-gate-tabs" role="tablist"></div>'
    + '<div class="st-gate-pane" data-pane="body"><div id="st-gate-body"><table><thead><tr><th>Time</th><th>Tab' + stGateCfBtn('tab') + '</th><th>Script' + stGateCfBtn('s') + '</th><th>Verb' + stGateCfBtn('m') + '</th><th>Reason' + stGateCfBtn('r') + '</th><th>Entity' + stGateCfBtn('e') + '</th><th>Site</th><th>Request' + stGateCfBtn('rq') + '</th><th>Tries' + stGateCfBtn('n') + '</th><th>Result' + stGateCfBtn('res') + '</th><th>Wait' + stGateCfBtn('wt') + '</th><th>Rate limit' + stGateCfBtn('rl') + '</th></tr></thead><tbody></tbody></table></div></div>'
    + '<div class="mbu-logpop-grip" data-tip="Resize"></div>';
  document.documentElement.appendChild(pop);   // outside the body, which Event Horizon swaps
  var $ = function (s) { return pop.querySelector(s); };
  var body = $('tbody'), scroller = $('#st-gate-body');
  var srcSeg = function () { Array.prototype.forEach.call(pop.querySelectorAll('.st-gate-hosts button'), function (b) { b.setAttribute('aria-pressed', String(!!hosts[b.dataset.v])); }); };
  var colSeg = function () {
    ST_GATE_COLS.forEach(function (c) { pop.classList.toggle('hc' + c[0], hide.indexOf(c[0]) >= 0); });
  };
  $('#st-gate-span').addEventListener('change', function () { ST_GATE_SPAN = +this.value; stGateVw = null; stGateRemember({ span: ST_GATE_SPAN }); sig = ''; draw(); });
  var hudBtn = $('#st-gate-hud'), hudSeg = function () { hudBtn.setAttribute('aria-pressed', String(!!stGateHudEl)); };
  srcSeg(); colSeg(); hudSeg();
  pop.querySelector('.st-gate-hosts').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; hosts[b.dataset.v] = !hosts[b.dataset.v]; srcSeg(); stGateRemember({ hosts: hosts }); draw(); });
  hudBtn.onclick = function () { if (!stGateHudEl) stGateHud(true); stGateClose(); };
  var lblBtn = $('#st-gate-lbl'), lblSeg = function () { var on = !!stGateWinState().labels; lblBtn.setAttribute('aria-pressed', String(on)); pop.classList.toggle('lbl', on); };
  lblSeg();
  lblBtn.onclick = function () { stGateRemember({ labels: !stGateWinState().labels }); lblSeg(); lanesHeld = false; sig = ''; draw(); };
  // a double click in the window (not on its title bar, which goes full screen, nor on a control) switches to the HUD
  var born = Date.now();
  pop.addEventListener('dblclick', function (e) {
    // the HUD's double click opens this window under the pointer: its own clicks must not switch straight back
    if (Date.now() - born < 800 || e.target.closest('.mbu-logpop-h,thead,button,select,input,textarea,a')) return;
    hudBtn.onclick();
  });
  // the width each column needs for its widest cell, measured with the table laid out at its natural size for a moment
  var colFit = function () {
    var tb = pop.querySelector('#st-gate-body table'); tb.classList.add('st-gate-measure');
    var ws = [].map.call(tb.querySelectorAll('thead th'), function (th) { return th.offsetWidth ? Math.max(32, Math.ceil(th.getBoundingClientRect().width) + 2) : 0; });
    tb.classList.remove('st-gate-measure'); return ws;
  };
  var fitBtn = pop.querySelector('.st-gate-fit');
  fitBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  fitBtn.addEventListener('dblclick', function (e) { e.stopPropagation(); });
  // a click leaves the Request column no width of its own: it takes the space the others leave;
  // a right click fits it too, and the table scrolls sideways when it is wider than the window
  var fitAll = function (req) {
    var ws = colFit();
    pop.querySelectorAll('#st-gate-body th').forEach(function (th, i) {
      if (i === 7 && !req) { delete stGateColW[i]; th.style.width = ''; }
      else if (ws[i]) { stGateColW[i] = ws[i]; th.style.width = ws[i] + 'px'; }
    });
  };
  fitBtn.addEventListener('click', function () { fitAll(false); });
  fitBtn.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); fitAll(true); });
  // a drag on the line between two headers resizes the column on its left; the widths last while the page is open
  pop.querySelectorAll('#st-gate-body th').forEach(function (th, i) {
    if (stGateColW[i]) th.style.width = stGateColW[i] + 'px';
    var rz = document.createElement('span'); rz.className = 'st-gate-rz'; th.appendChild(rz);
    rz.addEventListener('click', function (e) { e.stopPropagation(); });
    // a double click on the line fits the column to its widest cell
    rz.addEventListener('dblclick', function (e) {
      e.preventDefault(); e.stopPropagation();
      var w = colFit()[i]; if (!w) return;
      stGateColW[i] = w; th.style.width = w + 'px';
    });
    rz.addEventListener('mousedown', function (e) {
      e.preventDefault(); e.stopPropagation();
      var x0 = e.clientX, w0 = th.offsetWidth; rz.classList.add('on');
      var mv = function (ev) { stGateColW[i] = Math.max(32, w0 + ev.clientX - x0); th.style.width = stGateColW[i] + 'px'; };
      var up = function () { rz.classList.remove('on'); document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
  });
  var moOf = { n: 're', res: 'bad' }, cfOn = function (k) { return cf[k] != null || cft[k] != null || (mode !== 'all' && moOf[k] === mode); };
  var cfTip = function (b) {
    var k = b.dataset.cf, t = cft[k] != null ? 'Contains “' + cft[k] + '”' : cf[k] != null ? (cf[k] === '' ? '(empty)' : String(cf[k])) : moOf[k] === mode ? (k === 'n' ? 'Retried' : 'Failed') : '';
    b.classList.toggle('on', !!t);
    if (t) b.dataset.tip = 'Filter: ' + t + '\nRight click clears it'; else delete b.dataset.tip;
  };
  var multi = false, multiAnchor = '';   // rows picked with Ctrl: the copy takes only them
  var drawFailed = '', lanesHeld = false, shownIds = [], sels = [], act = -1;
  var tabsDraw = function (n, hostIds) {
    var el = $('#st-gate-tabs');
    el.innerHTML = sels.length ? '<span data-t="-1" class="' + (act < 0 ? 'on' : '') + '">All ' + n + '</span>' + sels.map(function (x, i) {
      return '<span data-t="' + i + '" class="' + (act === i ? 'on' : '') + '">' + stEsc(x.name) + ' · ' + x.ids.filter(function (id) { return !hostIds || hostIds[id]; }).length + '<span class="x" data-tip="Close this tab\nA right click closes every tab">×</span></span>';
    }).join('') : '';
  };
  var addSel = function (name, ids) {
    if (!ids.length) return;
    var key = ids.slice().sort().join(','), i = sels.findIndex(function (x) { return x.ids.slice().sort().join(',') === key; });
    if (i < 0) { sels.push({ name: name, ids: ids }); i = sels.length - 1; }
    act = i; sig = ''; draw();
  };
  var draw = function () {
    // the Copy button counts the picked rows, which are all it copies
    var cpN = multi ? Object.keys(stGateSel).length : 0, cpB = $('.mbu-logpop-copy');
    if (cpB) cpB.textContent = '⧉ Copy' + (cpN ? ' (' + cpN + ')' : '');
    try { drawNow(); } catch (e) {
      var msg = String(e && e.message || e);
      if (msg !== drawFailed) { drawFailed = msg; try { console.error('String Theory: the Network log could not show its events', e); } catch (x) { /* no console */ } }
      sig = '';
      try { body.innerHTML = '<tr><td class="none" colspan="13">The network log could not show its events (' + msg.replace(/[<&]/g, '') + '). Clear it to start again.</td></tr>'; } catch (x) { /* no body */ }
    }
  };
  var drawNow = function () {
    var me = stGateTab(), all = stGateEvents(), now = Date.now(), groups = stGateGroups(all, now);
    // the site filter: a hidden site's requests are left out of the counts too
    var inHost = groups.filter(function (g) { return g.sys || (g.h ? hosts.ext : hosts.mb); }), hostIds = {};
    inHost.forEach(function (g) { if (!g.sys) hostIds[g.id] = 1; });
    var n = stGateCount(inHost).n;
    $('.st-gate-n').textContent = n + ' request' + (n === 1 ? '' : 's');
    if (pop.classList.contains('min')) return;
    $('#st-gate-state').innerHTML = stGateStateHtml(stGateState(), me);
    $('#st-gate-sum').innerHTML = stGateSumHtml(inHost, now);
    if (!lanesHeld) $('#st-gate-lanes').innerHTML = stGateLanesHtml(inHost, all, stGatePausedAt || now, me);   // held still under the mouse, so a tip stays put
    lastGroups = groups;
    var shown = groups.filter(function (g) {
      for (var ck in cf) if (stGateCfVal(g, ck) !== cf[ck]) return false;
      for (var tk in cft) if (String(stGateCfVal(g, tk)).toLowerCase().indexOf(cft[tk]) < 0) return false;
      if (!g.sys && (g.h ? !hosts.ext : !hosts.mb)) return false;
      if (act >= 0 && sels[act].ids.indexOf(g.id) < 0) return false;
      if (mode === 'bad' && g.cls !== 'bad') return false;
      if (mode === 're' && (g.sys || g.tries.length < 2)) return false;
      return true;
    });
    tabsDraw(n, hostIds);
    shownIds = shown.filter(function (g) { return !g.sys; }).map(function (g) { return g.id; });
    if (shownIds.length < n) {   // a filter hides some: say how many are left, and which filter
      var why = [!hosts.mb && 'no MusicBrainz', !hosts.ext && 'no other sites', mode === 'bad' && 'failed', mode === 're' && 'retried'].concat(Object.keys(cf).concat(Object.keys(cft)).map(function (k) { return { tab: 'tab', s: 'script', m: 'verb', rq: 'request', n: 'tries', res: 'result', wt: 'wait', rl: 'rate limit' }[k] || k; })).filter(Boolean).join(', ');
      $('.st-gate-n').textContent = shownIds.length + ' of ' + n + ' requests shown' + (why ? ' (' + why + ')' : '');
    }
    // the funnel of every column that filters stands out
    pop.querySelectorAll('.st-gate-cf').forEach(cfTip);
    var key = shown.map(function (g) { return g.id + ':' + g.evs.length + ':' + g.label; }).join('|') + '#' + Object.keys(opened).join('|') + '#' + me + '#' + act;
    if (key === sig) return;
    sig = key;
    // #1095: newest rows come in at the top; scrolled down, the row in view stays put, so the
    // entries being read don't slide away under each new one
    var top = scroller.scrollTop, anchor = null, at = 0, sTop = scroller.getBoundingClientRect().top;
    if (top > 0) {
      var rows = body.querySelectorAll('tr.rq');
      for (var i = 0; i < rows.length; i++) { var r = rows[i].getBoundingClientRect(); if (r.bottom > sTop) { anchor = rows[i].getAttribute('data-id'); at = r.top - sTop; break; } }
    }
    body.innerHTML = shown.length ? stGateTableHtml(shown.slice().reverse(), me, opened, now)
      : '<tr><td class="none" colspan="13">' + (all.length ? 'No request matches.' : 'No requests went through the gate yet. Open or reload a MusicBrainz page that uses a script, then look again.') + '</td></tr>';
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
    var u = st && e.target.closest('.st-gate-url, .st-gate-less');
    if (u && !String(getSelection())) {
      var uid = st.previousElementSibling && st.previousElementSibling.dataset.id;
      if (uid) stGateUrlAll[uid] = !stGateUrlAll[uid];
      st.classList.toggle('all', !!stGateUrlAll[uid]);
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
    if (e.ctrlKey || e.metaKey) {
      var rows = Array.prototype.map.call(body.querySelectorAll('tr.rq'), function (r) { return r.dataset.id; });
      var a = rows.indexOf(multiAnchor), b = rows.indexOf(id);
      if (!multi) stGateSel = {};
      if (e.shiftKey && a >= 0 && b >= 0) { for (var k = Math.min(a, b); k <= Math.max(a, b); k++) stGateSel[rows[k]] = 1; }
      else if (stGateSel[id]) delete stGateSel[id]; else stGateSel[id] = 1;
      multi = true; multiAnchor = id; sig = '';
      draw(); return;
    }
    multi = false; multiAnchor = id;
    // an open group closes with its rows, an open or selected row in it included (it keeps the group open)
    if (tr.classList.contains('grp') && tr.classList.contains('open')) {
      delete opened[id];
      for (var n = tr.nextElementSibling; n && !(n.classList.contains('rq') && !n.classList.contains('in')); n = n.nextElementSibling)
        if (n.dataset.id) delete opened[n.dataset.id];
      stGateSel = {}; stGateSel[id] = 1; sig = '';
      draw();
      return;
    }
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
  // [ ] in each panel's upper right corner: one panel takes the whole window, a second click restores both
  pop.querySelectorAll('button.st-gate-mx').forEach(function (b) {
    b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    b.addEventListener('dblclick', function (e) { e.stopPropagation(); });
    b.addEventListener('click', function () {
      var v = pop.dataset.max === b.dataset.mx ? '' : b.dataset.mx;
      if (v) pop.dataset.max = v; else delete pop.dataset.max;
      pop.querySelectorAll('button.st-gate-mx').forEach(function (x) { x.classList.toggle('on', x.dataset.mx === v); x.textContent = x.dataset.mx === v ? '❐' : '⛶'; });
    });
  });
  // the separator between the lanes and the table: a drag sets the lanes' height, a double click resets it
  (function () {
    var sp = $('#st-gate-split'); if (!sp) return;
    var setH = function (h) { lanes.parentNode.style.flexShrink = h ? '0' : ''; if (h) { lanes.style.maxHeight = 'none'; lanes.style.height = h + 'px'; } else { lanes.style.maxHeight = ''; lanes.style.height = ''; } };
    try { setH(+localStorage.getItem('st-gate-lanes-h') || 0); } catch (e) {}
    sp.addEventListener('pointerdown', function (e) {
      e.preventDefault(); sp.setPointerCapture(e.pointerId); sp.classList.add('on');
      var y0 = e.clientY, h0 = lanes.getBoundingClientRect().height;
      var mv = function (ev) { setH(Math.max(40, Math.min(pop.getBoundingClientRect().height - 220, h0 + ev.clientY - y0))); };
      var up = function () { sp.classList.remove('on'); sp.removeEventListener('pointermove', mv); sp.removeEventListener('pointerup', up); try { localStorage.setItem('st-gate-lanes-h', parseInt(lanes.style.height) || ''); } catch (e) {} };
      sp.addEventListener('pointermove', mv); sp.addEventListener('pointerup', up);
    });
    sp.addEventListener('dblclick', function () { setH(0); try { localStorage.removeItem('st-gate-lanes-h'); } catch (e) {} });
  })();
  $('#st-gate-tabs').addEventListener('click', function (e) {
    var t = e.target.closest('[data-t]'); if (!t) return;
    var i = +t.dataset.t;
    if (e.target.closest('.x')) { sels.splice(i, 1); if (act === i) act = -1; else if (act > i) act--; }
    else act = i;
    sig = ''; draw();
  });
  $('#st-gate-tabs').addEventListener('contextmenu', function (e) {
    if (!e.target.closest('.x')) return;
    e.preventDefault(); sels = []; act = -1; sig = ''; draw();
  });
  // a right click on a funnel clears that column's filter
  pop.addEventListener('contextmenu', function (e) {
    var b = e.target.closest && e.target.closest('.st-gate-cf');
    if (!b) { if (e.target.closest && e.target.closest('thead')) { e.preventDefault(); colMenu(e); } return; }
    e.preventDefault();
    delete cf[b.dataset.cf]; delete cft[b.dataset.cf];
    if (moOf[b.dataset.cf] === mode) { mode = 'all'; stGateRemember({ mode: mode }); }
    b.classList.remove('on');
    cfClose(); draw();
  });
  var cfPop = null, cfClose = function () { if (cfPop) cfPop.remove(), cfPop = null; };
  // the columns to show, from a right click on the header
  var colMenu = function (e) {
    cfClose();
    cfPop = document.createElement('div'); cfPop.className = 'st-gate-cfp'; cfPop.dataset.k = '#cols';
    cfPop.innerHTML = ST_GATE_COLS.map(function (c) { return '<label><input type="checkbox" data-c="' + c[0] + '"' + (hide.indexOf(c[0]) < 0 ? ' checked' : '') + '>' + c[1] + '</label>'; }).join('');
    cfPop.addEventListener('change', function (ev) {
      var c = +ev.target.dataset.c, i = hide.indexOf(c);
      if (ev.target.checked) { if (i >= 0) hide.splice(i, 1); } else if (i < 0) hide.push(c);
      colSeg(); stGateRemember({ hide: hide });
    });
    cfPop.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') cfClose(); });
    document.body.appendChild(cfPop);
    cfPop.style.left = Math.max(4, Math.min(window.innerWidth - cfPop.offsetWidth - 4, e.clientX)) + 'px';
    cfPop.style.top = Math.max(4, Math.min(window.innerHeight - cfPop.offsetHeight - 4, e.clientY)) + 'px';
  };
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
    cfPop.innerHTML = '<input type="text" placeholder="Type to filter" aria-label="Filter the values"><ul></ul>';
    var inp = cfPop.querySelector('input'), ul = cfPop.querySelector('ul');
    if (cft[k]) inp.value = cft[k];
    var fill = function () {
      var t = inp.value.trim().toLowerCase();
      ul.innerHTML = (t ? '<li data-t="' + stEsc(t) + '"><span>Contains “' + stEsc(t) + '”</span></li>' : '<li data-v="" class="' + (cfOn(k) ? '' : 'on') + '"><span>All</span></li>' + (moOf[k] ? '<li data-mo="' + moOf[k] + '" class="' + (mode === moOf[k] ? 'on' : '') + '"><span>' + (k === 'n' ? 'Retried' : 'Failed') + '</span></li>' : '')) + vals.filter(function (v) { return !t || cfName(k, v).toLowerCase().indexOf(t) >= 0; }).map(function (v) {
        return '<li data-v="' + stEsc(v) + '" data-set="1" class="' + (cf[k] === v ? 'on' : '') + '"><span>' + stEsc(cfName(k, v)) + '</span><b>' + cnt[v] + '</b></li>';
      }).join('');
      var first = ul.querySelector('li'); if (first) first.classList.add('act');
    };
    var pick = function (li) {
      if (!li) return;
      delete cf[k]; delete cft[k];
      if (moOf[k]) { mode = li.dataset.mo || (mode === moOf[k] ? 'all' : mode); stGateRemember({ mode: mode }); }
      if (li.dataset.mo) { /* the mode alone */ } else if (li.dataset.t) cft[k] = li.dataset.t; else if (li.dataset.set) cf[k] = li.dataset.v;
      cfTip(b);
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
    var ln = !m && e.target.closest && e.target.closest('#st-gate-lanes .st-gl-lane[data-lane]');
    if (ln) {
      var tab = ln.dataset.lane, from = Date.now() - ST_GATE_SPAN, me0 = stGateTab();
      addSel(tab === me0 ? 'This tab' : tab.slice(0, 8), lastGroups.filter(function (g) { return !g.sys && g.tab === tab && g.t >= from; }).map(function (g) { return g.id; }));
      return;
    }
    if (!m) return;
    var bl = m.closest('.st-gl-lane[data-lane]');
    focusIds(m.dataset.ids ? JSON.parse(m.dataset.ids) : [m.dataset.id], bl ? bl.dataset.lane : '', !!m.dataset.ids);
  };
  // a cluster's requests go to a tab of their own; one request opens its row and scrolls to it
  var focusIds = function (ids, bt, many) {
    if (many) {
      var t0 = lastGroups.filter(function (g) { return g.id === ids[0]; })[0];
      addSel((bt === stGateTab() ? 'This tab' : String(bt).slice(0, 8)) + (t0 ? ' ' + stGateTime(t0.t).slice(0, 8) : ''), ids);
      return;
    }
    stGateSel = {};
    ids.forEach(function (x) { opened[x] = 1; stGateSel[x] = 1; });
    lanesHeld = false; sig = ''; draw();   // a selection alone leaves the signature as it was
    var tr = body.querySelector('tr.rq.sel');   // the topmost selected row, whatever order the table sorts in
    if (tr) tr.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  document.addEventListener('click', openFromLanes);
  lanes.addEventListener('mouseenter', function () { lanesHeld = true; });
  lanes.addEventListener('mouseleave', function () { lanesHeld = false; draw(); });
  var zmBtn = pop.querySelector('.st-gate-zm'), zmRedraw = function () { lanesHeld = false; sig = ''; draw(); lanesHeld = true; zmBtn.classList.toggle('on', !!stGateVw); };
  stGateZoomOn(lanes, function () { return ST_GATE_SPAN; }, function () { return stGateVw; }, function (v) { stGateVw = v; }, zmRedraw, function () { return stGatePausedAt || Date.now(); });
  // the zoom button resets the zoom; it is dim while the whole span shows
  zmBtn.onclick = function () { stGateVw = null; zmRedraw(); };
  zmBtn.classList.toggle('on', !!stGateVw);
  // the wheel button: on, the wheel moves the time line and Shift and the wheel zoom; it is remembered
  var wmBtn = pop.querySelector('.st-gate-wm');
  wmBtn.onclick = function () { stGateRemember({ wheelPan: !stGateWheelPan() }); wmBtn.classList.toggle('on', stGateWheelPan()); };
  wmBtn.classList.toggle('on', stGateWheelPan());
  // the pause button: on, the time line stands still where it is; off, it runs on to now, at the same zoom
  var psBtn = pop.querySelector('.st-gate-ps');
  psBtn.onclick = function () {
    var t = Date.now();
    if (stGatePausedAt) { if (stGateVw) stGateVw.t0 += t - stGatePausedAt; stGatePausedAt = 0; } else stGatePausedAt = t;
    psBtn.classList.toggle('on', !!stGatePausedAt); lanesHeld = false; sig = ''; draw();
  };
  psBtn.classList.toggle('on', !!stGatePausedAt);
  $('.mbu-logpop-copy').onclick = function () {
    var only = null;
    if (multi) Object.keys(stGateSel).forEach(function (id) {
      var r = body.querySelector('tr.rq[data-id="' + CSS.escape(id) + '"]'), ids = r && r.dataset.ids ? r.dataset.ids.split(' ') : [id];
      ids.forEach(function (x) { (only = only || {})[x] = 1; });
    });
    stCopy(stGateMarkdown(stGateEvents(), stGateTab(), only), function (ok) { try { U.mbuToast(ok ? (only ? 'The picked requests copied' : 'Network log copied') : 'Could not copy the network log'); } catch (e) { /* no toast */ } });
  };
  $('.mbu-logpop-clear').onclick = function () {
    try { for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (k && k.indexOf(ST_GATE_PRE) === 0) localStorage.removeItem(k); } } catch (e) { /* no storage */ }
    opened = {}; multi = false; sig = ''; draw();
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
    stGateClose();
  };
  window.addEventListener('keydown', onKey, true);
  var timer = setInterval(function () { if (!pop.isConnected) { clearInterval(timer); return; } draw(); }, 500);
  stGateWin = {
    el: pop,
    off: function () { clearInterval(timer); window.removeEventListener('keydown', onKey, true); document.removeEventListener('click', openFromLanes); },
    focus: focusIds,
    show: function () { if (pop.classList.contains('min')) minBtn.click(); try { pop.focus(); } catch (e) { /* no focus */ } }
  };
  draw();
}
