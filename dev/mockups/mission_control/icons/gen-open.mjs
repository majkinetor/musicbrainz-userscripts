// Mission Control icons: the open comb's look (tiles apart, gold with one purple) in shapes that aren't a ring, so it
// stops echoing Platform Check's centre-and-six layout. Writes open-01..16.svg and preview-open.html (96, 48, 28, 16 px on
// white and black, Platform Check's icon first for comparison).
//   node dev/mockups/mission_control/icons/gen-open.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const INK = '#22223b', P = '#7a57e8', GOLD = '#ffc94a';
const HALO = '<filter id="$h" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="d"/><feFlood flood-color="#fff" flood-opacity=".7"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n<defs>${HALO}</defs><g filter="url(#$h)">${b}</g>`.replaceAll('$', id) + '\n</svg>\n';
const f1 = v => +v.toFixed(1);
const R3 = Math.sqrt(3);
// axial hex coordinates to x,y in units of the hex radius; pointy = rows run straight across, flat = columns run straight down
const ax = (pointy, q, r) => pointy ? [R3 * q + R3 / 2 * r, 1.5 * r] : [1.5 * q, R3 / 2 * q + R3 * r];
// cells: [q, r, lead?, dx?, dy?] (dx/dy nudge a tile, in hex radii); scaled and centred to fill a 112 box
const tiles = (pointy, cells, o = {}) => { const k = { box: 112, fill: .9, spread: 1, ...o };
  const pts = cells.map(([q, r, lead, dx = 0, dy = 0]) => { const [x, y] = ax(pointy, q, r); return { x: x * k.spread + dx, y: y * k.spread + dy, lead }; });
  const ex = pointy ? R3 / 2 : 1, ey = pointy ? 1 : R3 / 2; // a tile's half-extent across and down
  const x0 = Math.min(...pts.map(p => p.x)) - ex, x1 = Math.max(...pts.map(p => p.x)) + ex, y0 = Math.min(...pts.map(p => p.y)) - ey, y1 = Math.max(...pts.map(p => p.y)) + ey;
  const s = Math.min(k.box / (x1 - x0), k.box / (y1 - y0)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rot = pointy ? 30 : 0;
  return pts.map(p => { const X = 64 + (p.x - cx) * s, Y = 64 + (p.y - cy) * s, r = s * k.fill;
    const d = 'M' + Array.from({ length: 6 }, (_, i) => { const a = (i * 60 + rot) * Math.PI / 180; return `${f1(X + r * Math.cos(a))} ${f1(Y + r * Math.sin(a))}`; }).join(' L') + 'Z';
    return `<path d="${d}" fill="${p.lead ? P : GOLD}" stroke="${INK}" stroke-width="${f1(Math.max(3.5, s * .2))}" stroke-linejoin="round"/>`; }).join(''); };
const T = true, F = false, I = [];
const O = { fill: .75 }; // the open comb's gaps: tiles drawn at 3/4 of their spacing
I.push(['Pyramid of six, purple on top', tiles(T, [[0, 0, T], [-1, 1], [0, 1], [-2, 2], [-1, 2], [0, 2]], O)]);
I.push(['Pyramid of six, purple at the heart', tiles(T, [[0, 0], [-1, 1, T], [0, 1], [-2, 2], [-1, 2], [0, 2]], O)]);
I.push(['Upturned pyramid', tiles(T, [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 2, T]], O)]);
I.push(['Pyramid of three', tiles(T, [[0, 0, T], [-1, 1], [0, 1]], O)]);
I.push(['Rhombus of four', tiles(F, [[0, 0, T], [1, 0], [0, 1], [1, 1]], O)]);
I.push(['Rhombus lying down', tiles(T, [[0, 0, T], [1, 0], [-1, 1], [0, 1]], O)]);
I.push(['Two rows, three and two', tiles(T, [[0, 0], [1, 0], [2, 0, T], [0, 1], [1, 1]], O)]);
I.push(['Two rows, three and three', tiles(T, [[0, 0, T], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1]], O)]);
I.push(['Three rows, a slab', tiles(T, [[0, 0], [1, 0, T], [-1, 1], [0, 1], [1, 1], [-1, 2], [0, 2]], { ...O, fill: .75 }).replace(/x/, 'x')]);
I.push(['Arch of five', tiles(F, [[0, 0], [1, -1], [2, -1, T], [3, -1], [4, -1]].map(([q, r, l], i) => [q, r + [0, 0, -0, 0, 1][i], l]), O)]);
I.push(['Comb fragment', tiles(F, [[0, 0, T], [1, 0], [0, 1], [1, 1], [2, 0], [-1, 1]], O)]);
I.push(['Comb fragment, purple at the edge', tiles(F, [[0, 0], [1, 0], [0, 1], [1, 1], [2, 0, T], [-1, 1]], O)]);
I.push(['One tile lifting off the pyramid', tiles(T, [[0, 0, T, 0, -.6], [-1, 1], [0, 1], [-2, 2], [-1, 2], [0, 2]], O)]);
I.push(['One tile lifting out of the row', tiles(T, [[-1, 1], [0, 1], [1, 1], [0, 0, T, 0, -.5]], O)]);
I.push(['Diagonal cluster', tiles(F, [[0, 0, T], [1, 0], [1, 1], [2, 1], [2, 2]], O)]);
I.push(['Propeller', tiles(F, [[0, 0, T], [1, 0], [-1, 1], [0, -1]], O)]);

const cards = I.map(([t, b], i) => { const n = String(i + 1).padStart(2, '0'); writeFileSync(join(dir, `open-${n}.svg`), svg(`mco${n}-`, `Mission Control — ${t}`, b)); return { n, t }; });
const imgs = src => [96, 48, 28, 16].map(z => `<img src="${src}" width="${z}" height="${z}" alt="">`).join('');
const fig = c => `<figure>${imgs(`open-${c.n}.svg`)}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const ref = `<figure class="ref">${imgs('../../all_icons/norm/platform_check.svg')}<figcaption>Platform Check, for comparison</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${ref}${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-open.html'), `<!doctype html><meta charset="utf-8"><title>Mission Control open tile icons</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
.light{background:#fff;color:#222}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}.ref figcaption{font-style:italic;opacity:.7}</style>
${sec('light', 'White')}${sec('dark', 'Black')}\n`);
console.log('wrote ' + cards.length);
