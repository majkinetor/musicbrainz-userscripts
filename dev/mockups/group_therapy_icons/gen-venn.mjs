// Group Therapy icons: variants on round 1's 07, the Venn of three — groups that overlap.
// Writes venn-01..20.svg and preview-venn.html (96, 48, 28, 16 px on white and black).
//   node dev/mockups/group_therapy_icons/gen-venn.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const INK = '#22223b', P = '#7a57e8', PL = '#b9a8ec', PD = '#4b2e83', OR = '#f3722c', GOLD = '#ffc94a', GR = '#2ea44f', GRL = '#7fd39a', GRD = '#1d7a39', SKY = '#3fb6f0', PINK = '#f15bb5';
const HALO = '<filter id="$h" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="d"/><feFlood flood-color="#fff" flood-opacity=".7"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n<defs>${HALO}</defs><g filter="url(#$h)">${b}</g>`.replaceAll('$', id) + '\n</svg>\n';
const f1 = v => +v.toFixed(1);
// three circle centres round 64,64: d = distance from the middle, r = radius, rot = where the first one sits (degrees)
const trio = (d = 22, rot = -90, n = 3) => Array.from({ length: n }, (_, i) => { const a = (rot + i * 360 / n) * Math.PI / 180; return [f1(64 + d * Math.cos(a)), f1(64 + d * Math.sin(a))]; });
// the Venn: cs colours, op fill opacity, w outline; mid = a fill for the part all three share; blend = mix-blend-mode
const venn = (o = {}) => { const k = { cs: [OR, GR, SKY], op: .75, w: 4, r: 32, d: 22, rot: -90, n: 3, mid: null, line: INK, blend: null, ...o };
  const ps = trio(k.d, k.rot, k.n), C = ([x, y]) => `<circle cx="${x}" cy="${y}" r="${k.r}"/>`;
  const fills = ps.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${k.r}" fill="${k.cs[i % k.cs.length]}" fill-opacity="${k.op}"${k.blend ? ` style="mix-blend-mode:${k.blend}"` : ''}/>`).join('');
  // the shared middle: each circle clips the next
  const mid = k.mid ? `<defs>${ps.map((p, i) => `<clipPath id="$c${i}"${i ? ` clip-path="url(#$c${i - 1})"` : ''}>${C(p)}</clipPath>`).join('')}</defs><rect width="128" height="128" fill="${k.mid}" clip-path="url(#$c${ps.length - 1})"/>` : '';
  const lines = k.w ? ps.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${k.r}" fill="none" stroke="${k.line}" stroke-width="${k.w}"/>`).join('') : '';
  return `<g style="isolation:isolate">${fills}</g>${mid}${lines}${k.extra || ''}`; };
const I = [];
I.push(['07 as it is', venn()]);
I.push(['solid, no see-through', venn({ op: 1 })]);
I.push(['outlines only', venn({ op: 0, w: 6 })]);
I.push(['the middle in gold', venn({ mid: GOLD })]);
I.push(['outlines, gold middle', venn({ op: 0, w: 6, mid: GOLD })]);
I.push(['greens, Group Therapy\'s own colour', venn({ cs: [GR, GRL, GRD] })]);
I.push(['greens, gold middle', venn({ cs: [GR, GRL, GRD], mid: GOLD })]);
I.push(['bundle colours, purple, gold, orange', venn({ cs: [P, GOLD, OR] })]);
I.push(['colours mixed like light', venn({ cs: [OR, GR, SKY], op: .9, blend: 'multiply' })]);
I.push(['pinker set', venn({ cs: [PINK, GOLD, SKY], blend: 'multiply', op: .9 })]);
I.push(['closer, more overlap', venn({ d: 16, r: 34 })]);
I.push(['further, less overlap', venn({ d: 28, r: 30 })]);
I.push(['upside down', venn({ rot: 90 })]);
I.push(['two circles', venn({ n: 2, rot: 0, d: 18, r: 38, cs: [OR, SKY] })]);
I.push(['two circles, gold middle', venn({ n: 2, rot: 0, d: 18, r: 38, cs: [OR, SKY], mid: GOLD })]);
I.push(['four circles', venn({ n: 4, rot: -45, d: 20, r: 28, cs: [OR, GR, SKY, P] })]);
I.push(['thick outline, light fills', venn({ op: .45, w: 6 })]);
I.push(['no outline', venn({ w: 0, op: .85, blend: 'multiply' })]);
I.push(['white middle with a check', venn({ mid: '#fff', extra: `<path d="M56 64 L62 70 L73 58" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` })]);
I.push(['purple middle', venn({ cs: [GR, GOLD, SKY], mid: P })]);

const cards = I.map(([t, b], i) => { const n = String(i + 1).padStart(2, '0'); writeFileSync(join(dir, `venn-${n}.svg`), svg(`gtv${n}-`, `Group Therapy — ${t}`, b)); return { n, t }; });
const fig = c => `<figure>${[96, 48, 28, 16].map(z => `<img src="venn-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-venn.html'), `<!doctype html><meta charset="utf-8"><title>Group Therapy Venn icons</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
.light{background:#fff;color:#222}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}</style>
${sec('light', 'White')}${sec('dark', 'Black')}\n`);
console.log('wrote ' + cards.length);
