// Platform Check icons, round 2: variations on round 1's 10 (tick grid), 12 (barcode scan) and 13 (constellation).
// Writes icon-r2-{t,b,c}1..6.svg and preview-round2.html (128, 48, 28, 16 px on white and black).
//   node dev/mockups/platform_check_icons/gen-round2.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const ck = (x, y, s = 1, c = '#fff', w = 5) => `<path d="M${x - 11 * s} ${y} L${x - 3 * s} ${y + 8 * s} L${x + 12 * s} ${y - 8 * s}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const xx = (x, y, s = 1, c = '#fff', w = 5) => `<path d="M${x - 7 * s} ${y - 7 * s} L${x + 7 * s} ${y + 7 * s} M${x + 7 * s} ${y - 7 * s} L${x - 7 * s} ${y + 7 * s}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
const PAS = ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff', '#ffadad'];
const BOLD = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#b983ff', '#ff9f43', '#2ed1c4', '#f368e0', '#ff6b6b'];
const CARD = '<rect x="4" y="4" width="120" height="120" rx="24" fill="#fff3e6"/>';
const INK = '#22223b';
const I = [];

// ── tick grid ──
// a grid of n×n tiles; skip marks the tile left open, bad the one crossed
const grid = (n, cols, { round = false, skip = -1, bad = -1, ink = INK, gap = 6, pad = 14 } = {}) => {
  const z = (128 - 2 * pad - (n - 1) * gap) / n; let r = '';
  for (let i = 0; i < n * n; i++) { const x = pad + (i % n) * (z + gap), y = pad + Math.floor(i / n) * (z + gap), cx = x + z / 2, cy = y + z / 2, s = z / 46;
    r += round ? `<circle cx="${cx}" cy="${cy}" r="${z / 2}" fill="${cols[i]}"/>` : `<rect x="${x}" y="${y}" width="${z}" height="${z}" rx="${z * .28}" fill="${cols[i]}"/>`;
    r += i === skip ? `<circle cx="${cx}" cy="${cy}" r="${z * .12}" fill="${ink}" opacity=".35"/>` : i === bad ? xx(cx, cy, s * 1.1, ink, z * .13) : ck(cx, cy - z * .03, s * 1.1, ink, z * .13); }
  return r; };
I.push(['t1', 'Tick grid 2×2', CARD + grid(2, [PAS[0], PAS[3], PAS[5], PAS[6]], { pad: 16, gap: 8 })]);
I.push(['t2', 'Tick grid 2×2, one open', CARD + grid(2, [PAS[0], PAS[3], PAS[5], PAS[6]], { pad: 16, gap: 8, skip: 3 })]);
I.push(['t3', 'Tick grid, dots', CARD + grid(3, PAS, { round: true, skip: 7 })]);
I.push(['t4', 'Tick grid, dark', `<rect x="4" y="4" width="120" height="120" rx="24" fill="${INK}"/>` + grid(3, BOLD, { skip: 7, ink: '#fff', pad: 16 })]);
I.push(['t5', 'Tick grid, one crossed', CARD + grid(3, PAS, { bad: 7 })]);
I.push(['t6', 'Tick grid, no card', grid(3, BOLD, { skip: 7, ink: '#fff', pad: 6, gap: 6 })]);

// ── barcode scan ──
const bars = (x0, y, h, k = 1.6, col = () => INK) => [3, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1].reduce((a, w, i) => { if (a.on) a.s += `<rect x="${a.x.toFixed(1)}" y="${y}" width="${(w * k).toFixed(1)}" height="${h}" fill="${col(a.x)}"/>`; a.x += w * k + 1.2 * k / 1.6; a.on = !a.on; return a; }, { x: x0, on: true, s: '' }).s;
const laser = (y, c = '#ff2e63') => `<rect x="4" y="${y - 6.5}" width="120" height="13" rx="6" fill="${c}" opacity=".25"/><rect x="4" y="${y - 2.5}" width="120" height="5" rx="2.5" fill="${c}"/>`;
const badge = (x, y, r = 20, c = '#08d9d6') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${INK}" stroke-width="4"/>${ck(x, y, r / 28, INK, 4.5)}`;
I.push(['b1', 'Barcode, pastel card', CARD + bars(22, 26, 60, 1.75) + laser(56) + badge(100, 100, 19, '#caffbf')]);
I.push(['b2', 'Barcode, tick laser', `<rect x="10" y="20" width="108" height="88" rx="10" fill="#fff" stroke="${INK}" stroke-width="4"/>` + bars(22, 30, 68, 1.7) + `<rect x="4" y="54" width="120" height="20" rx="10" fill="#08d9d6" stroke="${INK}" stroke-width="3"/>` + ck(64, 63, .6, INK, 4) + ck(36, 63, .6, INK, 4) + ck(92, 63, .6, INK, 4)]);
I.push(['b3', 'Barcode, round badge', `<circle cx="64" cy="64" r="58" fill="#fff3e6" stroke="${INK}" stroke-width="4"/>` + bars(32, 34, 50, 1.3) + laser(58) + `<path d="M40 98 H88" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>` + badge(98, 98, 17, '#08d9d6')]);
I.push(['b4', 'Barcode in lanes', CARD + bars(22, 24, 62, 1.75, x => x < 52 ? '#2a9d8f' : x < 80 ? '#e9c46a' : '#e76f51') + laser(55, INK) + badge(100, 100, 19, '#fff')]);
I.push(['b5', 'Scanner gun', `<rect x="4" y="4" width="120" height="120" rx="24" fill="#e0f2fe"/>` + `<rect x="12" y="62" width="68" height="52" rx="6" fill="#fff" stroke="${INK}" stroke-width="3"/>` + bars(20, 70, 36, 1.2) + `<path d="M64 26 L22 86 H70Z" fill="#ff2e63" opacity=".22"/><path d="M22 86 H70" stroke="#ff2e63" stroke-width="3.5" stroke-linecap="round"/>
<path d="M60 14 H108 C114 14 118 18 118 24 V34 C118 40 114 42 108 42 H92 L100 70 C101 74 98 76 94 76 H86 C83 76 81 74 80 71 L72 42 H60 C56 42 52 38 52 34 V22 C52 18 56 14 60 14Z" fill="#fbbf24" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><circle cx="104" cy="28" r="5" fill="#22c55e"/>`]);
I.push(['b6', 'Barcode, dark', `<rect x="4" y="4" width="120" height="120" rx="24" fill="${INK}"/>` + bars(22, 22, 58, 1.75, () => '#f2e9e4') + laser(51, '#ff5ea8') + `<text x="20" y="105" font-family="Menlo,Consolas,monospace" font-size="15" fill="#f2e9e4">509996</text>` + `<circle cx="102" cy="100" r="15" fill="#4ade80"/>` + ck(102, 100, .55, INK, 4)]);

// ── constellation ──
const hub = (nodes, { bg = '', line = '#64748b', lw = 2.5, cols, r = 7, hubR = 20, hubFill = '#fff', tick = '#0f172a', shape = 'c', ring = false } = {}) =>
  bg + (ring ? `<path d="M${nodes.map(([x, y]) => `${x} ${y}`).join(' L')}Z" fill="none" stroke="${line}" stroke-width="${lw}" stroke-dasharray="3 5" stroke-linecap="round"/>` : '')
  + `<g stroke="${line}" stroke-width="${lw}" stroke-linecap="round">${nodes.map(([x, y]) => `<path d="M64 64 L${x} ${y}"/>`).join('')}</g>`
  + nodes.map(([x, y], i) => shape === 's' ? `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" rx="${r * .45}" fill="${cols[i % cols.length]}"/>` : `<circle cx="${x}" cy="${y}" r="${r}" fill="${cols[i % cols.length]}"/>`).join('')
  + `<circle cx="64" cy="64" r="${hubR}" fill="${hubFill}"/>${ck(64, 64, hubR / 27, tick, hubR / 4)}`;
const ringN = (n, R, a0 = -90) => Array.from({ length: n }, (_, i) => { const a = (a0 + i * 360 / n) * Math.PI / 180; return [+(64 + R * Math.cos(a)).toFixed(1), +(64 + R * Math.sin(a)).toFixed(1)]; });
const NIGHT = '<rect x="4" y="4" width="120" height="120" rx="26" fill="#0f172a"/>';
const NEON = ['#f472b6', '#facc15', '#4ade80', '#38bdf8', '#a78bfa', '#fb923c'];
I.push(['c1', 'Constellation, pastel card', hub(ringN(6, 44, -60), { bg: CARD, line: INK, lw: 3, cols: ['#ffadad', '#ffd6a5', '#caffbf', '#9bf6ff', '#bdb2ff', '#ffc6ff'], r: 9, hubFill: INK, tick: '#fff' })]);
I.push(['c2', 'Constellation, five big', hub(ringN(5, 42), { bg: NIGHT, cols: NEON, r: 11, hubR: 22, lw: 3.5 })]);
I.push(['c3', 'Constellation, ring', hub(ringN(8, 44, -67.5), { bg: NIGHT, cols: NEON, r: 7, ring: true })]);
I.push(['c4', 'Constellation, app tiles', hub(ringN(6, 42, -60), { bg: NIGHT, cols: NEON, r: 10, shape: 's', lw: 3 })]);
I.push(['c5', 'Constellation, sunset', `<defs>${lg('$g', ['#f9a826', '#f3722c', '#d00070'], 1, 1)}</defs>` + hub(ringN(6, 44, -60), { bg: '<rect x="4" y="4" width="120" height="120" rx="26" fill="url(#$g)"/>', line: '#fff', lw: 3, cols: ['#fff'], r: 8, hubFill: '#fff', tick: '#d00070' })]);
I.push(['c6', 'Constellation, no card', hub(ringN(6, 48, -60), { line: '#94a3b8', lw: 4, cols: NEON, r: 12, hubR: 24, hubFill: '#0f172a', tick: '#fff' })]);

const cards = I.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r2-${n}.svg`), svg(`pc${n}-`, `Platform Check — ${t}`, b)); return { n, t }; });
const fig = (src, cap) => `<figure>${[128, 48, 28, 16].map(z => `<img src="${src}" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${cap}</figcaption></figure>`;
const row = () => [['icon-r1-10.svg', 'r1 10 · Tick grid'], ...cards.slice(0, 6).map(c => [`icon-r2-${c.n}.svg`, `${c.n} · ${c.t}`]), ['icon-r1-12.svg', 'r1 12 · Barcode scan'], ...cards.slice(6, 12).map(c => [`icon-r2-${c.n}.svg`, `${c.n} · ${c.t}`]), ['icon-r1-13.svg', 'r1 13 · Constellation'], ...cards.slice(12).map(c => [`icon-r2-${c.n}.svg`, `${c.n} · ${c.t}`])].map(([s, c]) => fig(s, c)).join('');
writeFileSync(join(dir, 'preview-round2.html'), `<!doctype html><meta charset="utf-8"><title>Platform Check icons, round 2</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:18px;display:grid;grid-template-columns:repeat(7,1fr);gap:18px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figure img:first-child{width:96px;height:96px}figcaption{width:100%}</style>
<section class="light">${row()}</section><section class="dark">${row()}</section>\n`);
console.log('wrote ' + cards.length);
