// Round 3 (#680): variants of the header's provider badges, with each provider's progress.
// Builds badges.html with the script's own provider icons:  node dev/mockups/mission_control/round3/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(HERE, '../../../../userscripts/mission_control/mission_control.user.js'), 'utf8');
const ICON = JSON.parse(src.match(/const PROVIDER_ICONS = (\{[\s\S]*?\n\});/)[1].replace(/,\s*\}$/, '}'));

// two moments: mid-probe (IS working, AS stuck 41 s) and after it
const MID = [
  { id: 'pc', s: 'PC', name: 'Platform Check', st: 'done', n: 0, what: 'nothing new', unit: 'links' },
  { id: 'is', s: 'IS', name: 'ISRC Scout', st: 'busy', step: 'links: Bandcamp', sec: 8, done: 2, of: 3 },
  { id: 'as', s: 'AS', name: 'Art Station', st: 'stalled', step: 'finding the best cover', sec: 41 },
  { id: 'fusion', s: 'Fusion', name: 'Fusion', st: 'done', n: 0, what: 'no duplicates' },
  { id: 'ch', s: 'CH', name: 'Credit Hoarder', st: 'wait', what: 'waits for Fetch' },
];
const END = [
  { id: 'pc', s: 'PC', name: 'Platform Check', st: 'done', n: 0, what: 'nothing new' },
  { id: 'is', s: 'IS', name: 'ISRC Scout', st: 'add', n: 3, what: '3 ISRCs to add' },
  { id: 'as', s: 'AS', name: 'Art Station', st: 'add', n: 2, what: '2 covers to add' },
  { id: 'fusion', s: 'Fusion', name: 'Fusion', st: 'done', n: 0, what: 'no duplicates' },
  { id: 'ch', s: 'CH', name: 'Credit Hoarder', st: 'info', n: 0, what: '0 credits found' },
];
const img = p => `<img alt="" src="${ICON[p.id]}">`;
const line = p => p.st === 'busy' ? `${p.step} · ${p.sec} s` : p.st === 'stalled' ? `no word for ${p.sec} s · ${p.step}` : p.what;

// A: two-line pills — name, and what it's doing or found
const A = ps => `<div class="a">${ps.map(p => `<span class="a-b ${p.st}">${img(p)}<span><b>${p.s}</b><i>${p.st === 'busy' || p.st === 'stalled' ? (p.st === 'stalled' ? '⚠ ' : '⟳ ') : ''}${line(p)}</i></span></span>`).join('')}</div>`;
// B: one-line pills with words, a progress bar under each; the active steps spelled out below
const bWord = p => p.st === 'add' ? `${p.n} new` : p.st === 'done' ? '✓' : p.st === 'info' ? `${p.n}` : p.st === 'wait' ? 'Fetch' : p.st === 'stalled' ? `${p.sec} s ⚠` : p.of ? `${p.done}/${p.of}` : '…';
const B = ps => `<div class="b"><div class="b-row">${ps.map(p => `<span class="b-b ${p.st}">${img(p)}<b>${p.s}</b><em>${bWord(p)}</em><span class="bar"><span style="width:${p.st === 'busy' ? (p.of ? Math.round(100 * p.done / p.of) : 40) : p.st === 'stalled' ? 50 : p.st === 'wait' ? 0 : 100}%"></span></span></span>`).join('')}</div>`
  + `<div class="b-now">${ps.filter(p => p.st === 'busy' || p.st === 'stalled').map(p => `<span class="${p.st}">${img(p)}<b>${p.name}</b> ${line(p)}</span>`).join('') || '<span class="quiet">All answered</span>'}</div></div>`;
// C: the execution order as a stepper — ring per provider, state under it
const ring = p => `<span class="c-ring ${p.st}">${img(p)}${p.st === 'add' ? `<sup>${p.n}</sup>` : p.st === 'done' ? '<sup class="ok">✓</sup>' : p.st === 'stalled' ? '<sup class="warn">!</sup>' : ''}</span>`;
const cNode = p => `<span class="c-n ${p.st}">${ring(p)}<b>${p.s}</b><i>${line(p)}</i></span>`;
const C = ps => { const [pc, is, as, fu, ch] = ps; return `<div class="c">${cNode(pc)}<span class="c-ar">→</span><span class="c-par">${cNode(is)}${cNode(as)}</span><span class="c-ar">→</span>${cNode(fu)}<span class="c-ar">→</span>${cNode(ch)}</div>`; };
// D: compact rings and one status line naming who is being waited on
const D = ps => { const act = ps.filter(p => p.st === 'busy' || p.st === 'stalled').sort((x, y) => y.sec - x.sec);
  const say = act.length ? act.map(p => `<span class="${p.st}"><b>${p.s}</b> ${line(p)}</span>`).join('<span class="sep">·</span>') : `<span class="quiet">All answered: <b>${ps.filter(p => p.st === 'add').reduce((n, p) => n + p.n, 0)} changes</b> to review</span>`;
  return `<div class="d"><span class="d-rings">${ps.map(p => `<span class="d-r ${p.st}" title="${p.name}: ${line(p)}">${ring(p)}</span>`).join('')}</span><span class="d-say">${act.length ? 'Waiting on ' : ''}${say}</span></div>`; };

const V = [
  ['A', 'Two-line pills', 'Each badge says in words what it found, or the step it is on and for how long. A stalled one turns amber. Widest of the four.', A],
  ['B', 'Pills with progress bars', 'One-line pills ("3 new" in place of "+3") with a bar under each: moving while busy, amber when stalled, full when answered. The steps in progress are spelled out on a line below the header.', B],
  ['C', 'Pipeline stepper', 'The execution order itself (PC → IS ∥ AS → Fusion → CH) with a ring per provider and its state under it. Shows order and progress at once; it could replace the order strip.', C],
  ['D', 'Rings and a status line', 'Icons in rings (spinning while busy, amber when stalled, a count when there is something to add), and one sentence naming who is being waited on, slowest first. The most compact.', D],
];
const html = `<!doctype html><html><head><meta charset="utf-8"><title>MC badges — round 3</title><style>
:root{--bg:#fff;--sunk:#f4f2f9;--text:#222;--dim:#555;--weak:#999;--border:#cfc6e6;--strong:#9a8ccb;--acc:#5f3ec0;--acc-soft:#ece4ff;--ok:#1f8a5e;--ok-bg:#eef7f1;--ok-b:#9bd3b6;--warn:#a05a00;--warn-bg:#fff7e6;--warn-b:#f0c877;--info:#2f7fbf;--info-bg:#eef4fb}
body{margin:0;padding:24px 28px;font:14px -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:var(--text);background:#f7f6fb}
h1{font-size:18px;margin:0 0 4px}.sub{color:var(--dim);margin:0 0 20px}
.v{background:var(--bg);border:1px solid var(--border);border-radius:10px;margin:0 0 18px;overflow:hidden}
.v h2{font-size:15px;margin:0;padding:10px 14px 2px}.v p{margin:0;padding:0 14px 10px;color:var(--dim);font-size:13px}
.m{display:flex;align-items:center;gap:14px;padding:10px 14px;border-top:1px solid #eee}.m>.k{width:92px;flex:none;color:var(--weak);font-size:12px}
img{width:16px;height:16px;object-fit:contain;display:block}
.a{display:flex;gap:6px;flex-wrap:wrap}.a-b{display:inline-flex;align-items:center;gap:7px;padding:4px 11px 4px 8px;border-radius:12px;border:1px solid var(--border);background:var(--sunk);min-width:112px}
.a-b>span{display:flex;flex-direction:column;line-height:1.2}.a-b b{font-size:13px}.a-b i{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap}
.a-b.done,.a-b.info{background:var(--ok-bg);border-color:var(--ok-b)}.a-b.done b,.a-b.info b{color:var(--ok)}
.a-b.add{background:var(--acc-soft);border-color:var(--strong)}.a-b.add b,.a-b.add i{color:var(--acc)}.a-b.add i{font-weight:600}
.a-b.busy{background:var(--info-bg);border-color:#a9c8e6;border-style:dashed}.a-b.busy i{color:var(--info)}
.a-b.stalled{background:var(--warn-bg);border-color:var(--warn-b)}.a-b.stalled i,.a-b.stalled b{color:var(--warn)}.a-b.wait{border-style:dashed}.a-b.wait b{color:var(--weak)}
.b{display:flex;flex-direction:column;gap:6px}.b-row{display:flex;gap:6px}
.b-b{position:relative;display:inline-flex;align-items:center;gap:6px;padding:4px 10px 6px;border-radius:8px;border:1px solid var(--border);background:var(--sunk);font-size:13px;overflow:hidden}
.b-b em{font-style:normal;font-weight:700}.b-b .bar{position:absolute;left:0;right:0;bottom:0;height:3px;background:#0000000d}.b-b .bar span{display:block;height:100%}
.b-b.done em,.b-b.info em{color:var(--ok)}.b-b.done .bar span,.b-b.info .bar span{background:var(--ok)}
.b-b.add{background:var(--acc-soft);border-color:var(--strong)}.b-b.add em{color:var(--acc)}.b-b.add .bar span{background:var(--acc)}
.b-b.busy em{color:var(--info)}.b-b.busy .bar span{background:repeating-linear-gradient(90deg,var(--info) 0 8px,#9cc3e6 8px 16px)}
.b-b.stalled{background:var(--warn-bg);border-color:var(--warn-b)}.b-b.stalled em{color:var(--warn)}.b-b.stalled .bar span{background:var(--warn)}.b-b.wait em{color:var(--weak);font-weight:600}
.b-now{display:flex;gap:16px;font-size:12.5px;color:var(--dim)}.b-now span{display:inline-flex;align-items:center;gap:5px}.b-now img{width:14px;height:14px}.b-now .stalled{color:var(--warn)}.b-now .busy{color:var(--info)}
.quiet{color:var(--weak)}
.c-ring{position:relative;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:2.5px solid var(--border);background:var(--bg);box-sizing:border-box}
.c-ring sup{position:absolute;right:-7px;top:-6px;min-width:15px;height:15px;padding:0 3px;box-sizing:border-box;border-radius:8px;background:var(--acc);color:#fff;font-size:10px;font-weight:700;line-height:15px;text-align:center}
.c-ring sup.ok{background:var(--ok)}.c-ring sup.warn{background:var(--warn)}
.c-ring.done,.c-ring.info{border-color:var(--ok)}.c-ring.add{border-color:var(--acc)}.c-ring.busy{border-color:var(--info) #d6e6f5 #d6e6f5 var(--info)}.c-ring.stalled{border-color:var(--warn);background:var(--warn-bg)}.c-ring.wait{border-style:dashed}
.c{display:flex;align-items:flex-start;gap:8px}.c-n{display:flex;flex-direction:column;align-items:center;gap:2px;width:118px;text-align:center}.c-n b{font-size:13px}.c-n i{font-style:normal;font-size:11.5px;color:var(--dim);line-height:1.25}
.c-n.add i{color:var(--acc);font-weight:600}.c-n.busy i{color:var(--info)}.c-n.stalled i,.c-n.stalled b{color:var(--warn)}
.c-ar{color:var(--weak);padding-top:6px}.c-par{display:flex;gap:2px;padding:4px 4px 6px;border:1px dashed var(--border);border-radius:10px}
.d{display:flex;align-items:center;gap:14px}.d-rings{display:flex;gap:9px}.d-say{font-size:13px;color:var(--dim)}.d-say b{color:var(--text)}.d-say .stalled,.d-say .stalled b{color:var(--warn)}.d-say .busy b{color:var(--info)}.d-say .sep{margin:0 6px;color:var(--weak)}
</style></head><body>
<h1>Mission Control: provider badges, round 3</h1>
<p class="sub">#680. Each variant is shown twice: mid-probe (IS is busy, AS has sent nothing for 41 s) and after the probe. Busy is blue and moving, stalled (no word for 20 s) is amber. "+3" becomes words.</p>
${V.map(([k, t, d, f]) => `<section class="v"><h2>${k} · ${t}</h2><p>${d}</p><div class="m"><span class="k">mid-probe</span>${f(MID)}</div><div class="m"><span class="k">after</span>${f(END)}</div></section>`).join('\n')}
</body></html>`;
writeFileSync(resolve(HERE, 'badges.html'), html);
console.log('badges.html');
