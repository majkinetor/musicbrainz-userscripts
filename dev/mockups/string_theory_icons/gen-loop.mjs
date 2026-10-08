// String Theory icons: variants on round 1's 15, the closed string — the physicist's loop, vibrating.
// Writes loop-01..20.svg and preview-loop.html (96, 48, 28, 16 px on white and black).
//   node dev/mockups/string_theory_icons/gen-loop.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const INK = '#22223b', P = '#7a57e8', PL = '#b9a8ec', PD = '#4b2e83', OR = '#f3722c', GOLD = '#ffc94a', GR = '#2ea44f', SKY = '#3fb6f0', PINK = '#f15bb5';
const HALO = '<filter id="$h" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="d"/><feFlood flood-color="#fff" flood-opacity=".7"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n<defs>${HALO}</defs><g filter="url(#$h)">${b}</g>`.replaceAll('$', id) + '\n</svg>\n';
const f1 = v => +v.toFixed(1);
// the loop: n lobes, radius r, amplitude a, phase ph (in lobes), rotation rot (degrees)
const loop = ({ n = 5, r = 42, a = 9, ph = 0, rot = -90, cx = 64, cy = 64 } = {}) => 'M' + Array.from({ length: 144 }, (_, i) => { const t = i * 2.5 * Math.PI / 180, R = r - a * Math.cos(n * t + ph * Math.PI); return `${f1(cx + R * Math.cos(t + rot * Math.PI / 180))} ${f1(cy + R * Math.sin(t + rot * Math.PI / 180))}`; }).join(' L') + 'Z';
const str = (d, c = P, w = 7, ink = 4) => `${ink ? `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + ink}" stroke-linejoin="round"/>` : ''}<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round"/>`;
const ghost = (d, c = PL, w = 5, extra = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round"${extra}/>`;
// 15 as it was: the loop and its other phase behind it
const base = (o = {}, g = {}) => { const k = { ghost: PL, gw: 5, w: 7, c: P, ...g }; return `${k.ghost ? ghost(loop({ ...o, ph: (o.ph || 0) + 1 }), k.ghost, k.gw) : ''}${str(loop(o), k.c, k.w)}`; };
const I = [];
I.push(['15 as it is', base()]);
I.push(['three lobes', base({ n: 3, a: 12 })]);
I.push(['four lobes', base({ n: 4, a: 11 })]);
I.push(['six lobes', base({ n: 6, a: 8 })]);
I.push(['seven lobes', base({ n: 7, a: 7 })]);
I.push(['gentler wave', base({ a: 5, r: 44 })]);
I.push(['deeper wave', base({ a: 14, r: 40 })]);
I.push(['no ghost', base({}, { ghost: null })]);
I.push(['no ghost, thicker', base({ a: 10 }, { ghost: null, w: 11 })]);
I.push(['gold ghost', base({}, { ghost: GOLD })]);
I.push(['orange string, purple ghost', base({}, { c: OR, ghost: PL })]);
I.push(['two strings, purple and gold', `${str(loop({ ph: 1 }), GOLD, 6)}${str(loop(), P, 6)}`]);
I.push(['three phases fading', `${ghost(loop({ ph: 1 }), PL, 4, ' opacity=".5"')}${ghost(loop({ ph: .5 }), PL, 5)}${str(loop(), P, 7)}`]);
I.push(['filled', `${ghost(loop({ ph: 1 }), PL, 5)}<path d="${loop()}" fill="${P}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`]);
I.push(['filled, light inside', `${ghost(loop({ ph: 1 }), PL, 5)}<path d="${loop()}" fill="${PL}" stroke="${INK}" stroke-width="11" stroke-linejoin="round"/><path d="${loop()}" fill="none" stroke="${P}" stroke-width="7" stroke-linejoin="round"/>`]);
I.push(['ghost dashed', `<path d="${loop({ ph: 1 })}" fill="none" stroke="${PL}" stroke-width="5" stroke-dasharray="6 6" stroke-linecap="round"/>${str(loop(), P, 7)}`]);
I.push(['a bead on the string', `${base()}<circle cx="64" cy="22" r="9" fill="${GOLD}" stroke="${INK}" stroke-width="4"/>`]);
I.push(['script colours round the loop', (() => { const d = loop(); const cs = [OR, GOLD, GR, SKY, PINK]; return `${ghost(loop({ ph: 1 }), PL, 5)}<path d="${d}" fill="none" stroke="${INK}" stroke-width="11" stroke-linejoin="round"/>${cs.map((c, i) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="7" stroke-linejoin="round" pathLength="100" stroke-dasharray="20 80" stroke-dashoffset="${-i * 20}"/>`).join('')}`; })()]);
I.push(['tilted, bigger', base({ r: 46, a: 10, rot: -72 })]);
I.push(['dark ghost', base({}, { ghost: PD, gw: 6 })]);

const cards = I.map(([t, b], i) => { const n = String(i + 1).padStart(2, '0'); writeFileSync(join(dir, `loop-${n}.svg`), svg(`stl${n}-`, `String Theory — ${t}`, b)); return { n, t }; });
const fig = c => `<figure>${[96, 48, 28, 16].map(z => `<img src="loop-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-loop.html'), `<!doctype html><meta charset="utf-8"><title>String Theory loop icons</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
.light{background:#fff;color:#222}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}</style>
${sec('light', 'White')}${sec('dark', 'Black')}\n`);
console.log('wrote ' + cards.length);
