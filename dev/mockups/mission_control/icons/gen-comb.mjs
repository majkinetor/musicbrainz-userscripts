// Mission Control icons: variants on round 6's 08, the honeycomb (one cell in charge of the rest).
// Writes comb-01..16.svg and preview-comb.html (96, 48, 28, 16 px on white and black).
//   node dev/mockups/mission_control/icons/gen-comb.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const INK = '#22223b', P = '#7a57e8', PL = '#b9a8ec', PD = '#4b2e83', OR = '#f3722c', GOLD = '#ffc94a', GR = '#2ea44f', SKY = '#3fb6f0', HONEY = '#f7a823';
const HALO = '<filter id="$h" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="d"/><feFlood flood-color="#fff" flood-opacity=".7"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n<defs>${HALO}</defs><g filter="url(#$h)">${b}</g>`.replaceAll('$', id) + '\n</svg>\n';
const f1 = v => +v.toFixed(1);
const pol = (cx, cy, r, deg) => [f1(cx + r * Math.cos(deg * Math.PI / 180)), f1(cy + r * Math.sin(deg * Math.PI / 180))];
const S = (w = 4) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
// a hexagon; rot 0 = flat top, 30 = pointy top
const hx = (cx, cy, r, fill, rot = 0, w = 4) => `<path d="M${Array.from({ length: 6 }, (_, i) => pol(cx, cy, r, i * 60 + rot).join(' ')).join(' L')}Z" fill="${fill}" ${S(w)}/>`;
// the comb: a centre cell and six round it; fills = [centre, ...six] or a function of index
const comb = (o = {}) => { const k = { r: 18, gap: 34.6, rot: 0, fills: i => i ? GOLD : P, cx: 64, cy: 64, skip: [], w: 4, ...o };
  const ring = [30, 90, 150, 210, 270, 330].map(a => pol(0, 0, k.gap, a + k.rot));
  return [[0, 0], ...ring].map(([x, y], i) => k.skip.includes(i) ? '' : hx(k.cx + x, k.cy + y, k.r, typeof k.fills === 'function' ? k.fills(i) : k.fills[i], k.rot, k.w)).join(''); };
const NOTE = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-4 6 V-9 L7 -12 V3" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><ellipse cx="-7" cy="6" rx="4.5" ry="3.5" fill="#fff" transform="rotate(-20 -7 6)"/><ellipse cx="4" cy="3" rx="4.5" ry="3.5" fill="#fff" transform="rotate(-20 4 3)"/></g>`;
const CHECK = (x, y, s = 1) => `<path d="M${x - 8 * s} ${y} L${x - 2 * s} ${y + 6 * s} L${x + 9 * s} ${y - 7 * s}" fill="none" stroke="#fff" stroke-width="${5 * s}" stroke-linecap="round" stroke-linejoin="round"/>`;
const CROWN = (x, y, s = 1) => `<path d="M${x - 10 * s} ${y + 6 * s} L${x - 11 * s} ${y - 6 * s} L${x - 5 * s} ${y} L${x} ${y - 9 * s} L${x + 5 * s} ${y} L${x + 11 * s} ${y - 6 * s} L${x + 10 * s} ${y + 6 * s}Z" fill="${GOLD}" ${S(2.5)}/>`;
const FOUR6 = [OR, GR, GOLD, SKY, PL, OR];
const I = [];
I.push(['08 as it is', comb()]);
I.push(['pointy top', comb({ rot: 30 })]);
I.push(['the cells in script colours', comb({ fills: [P, OR, GR, GOLD, SKY, PL, '#f15bb5'] })]);
I.push(['a note in the centre cell', comb() + NOTE(64, 64)]);
I.push(['a check in the centre cell', comb() + CHECK(64, 64)]);
I.push(['a crown on the centre cell', comb({ fills: i => i ? GOLD : PD }) + CROWN(64, 64, 1.1)]);
I.push(['empty cells round a full one', comb({ fills: i => i ? '#fff' : P })]);
I.push(['honey in some cells', comb({ fills: [P, HONEY, '#fff', HONEY, HONEY, '#fff', HONEY] })]);
I.push(['purple comb, gold centre', comb({ fills: i => i ? P : GOLD })]);
I.push(['three cells', hx(64, 46, 22, P) + hx(45, 79, 22, GOLD) + hx(83, 79, 22, GOLD)]);
I.push(['four cells, a cluster', comb({ r: 22, gap: 42.3, skip: [1, 2, 3], fills: i => i ? GOLD : P, cy: 74, cx: 70 })]);
I.push(['centre cell bigger', comb({ fills: i => i ? GOLD : P, skip: [0] }) + hx(64, 64, 24, P, 0, 5)]);
I.push(['centre cell glowing', `<circle cx="64" cy="64" r="30" fill="${P}" opacity=".3"/>` + comb({ fills: i => i ? GOLD : P }) + `<circle cx="64" cy="64" r="6" fill="#fff"/>`]);
I.push(['a bee on the centre cell', comb() + `<g transform="translate(64 64)"><ellipse cx="-6" cy="-9" rx="7" ry="5" fill="#fff" ${S(2.5)}/><ellipse cx="6" cy="-9" rx="7" ry="5" fill="#fff" ${S(2.5)}/><ellipse cx="0" cy="2" rx="9" ry="11" fill="${GOLD}" ${S(3)}/><path d="M-8 0 H8 M-7 6 H7" stroke="${INK}" stroke-width="3"/></g>`]);
I.push(['open comb, gaps', comb({ r: 15, w: 4 })]);
I.push(['thick outline, flat', comb({ w: 6, fills: i => i ? GOLD : P })]);

const cards = I.map(([t, b], i) => { const n = String(i + 1).padStart(2, '0'); writeFileSync(join(dir, `comb-${n}.svg`), svg(`mcc${n}-`, `Mission Control — ${t}`, b)); return { n, t }; });
const fig = c => `<figure>${[96, 48, 28, 16].map(z => `<img src="comb-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-comb.html'), `<!doctype html><meta charset="utf-8"><title>Mission Control honeycomb icons</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.light{background:#fff;color:#222}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}</style>
${sec('light', 'White')}${sec('dark', 'Black')}\n`);
console.log('wrote ' + cards.length);
