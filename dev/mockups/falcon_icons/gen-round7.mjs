// Falcon icons, round 7: round 6's 08 Flat out with the falcon in the middle of the dial, at different sizes,
// under or over the needle, in navy, slate or orange.
// Writes icon-r7-00..16.svg and preview-round7.html (128, 48, 28, 16 px on white and black); 00 is the pick.
//   node dev/mockups/falcon_icons/gen-round7.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const place = (inner, x, y, s, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s}) translate(-64 -64)">${inner}</g>`;
const f1 = v => v.toFixed(1);
const C = { navy: '#1b2a4a', slate: '#4a5a78', cream: '#f6efe2', gold: '#f5c518', orange: '#ff6a00', chrome: '#d9dde4', steel: '#6c7480', red: '#d62828' };
const RH = 'M64 26 C67 26 70 30 70 36 C72 40 74 42 76 44 C92 42 108 36 124 34 C112 44 96 54 78 62 C76 68 74 74 74 80 L80 100 C74 104 68 104 64 104 Z';
const bird = c => `<path d="${RH}" fill="${c}"/><path d="${RH}" fill="${c}" transform="translate(128 0) scale(-1 1)"/>`;
const STOOP = 'M0 44 C8 30 13 0 17 -40 L6 -22 L4 -48 L-4 -48 L-6 -22 L-17 -40 C-13 0 -8 30 0 44 Z';
const pt = (r, deg, cx = 64, cy = 64) => { const a = deg * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
const arc = (r, d0, d1, cx = 64, cy = 64) => { const [x0, y0] = pt(r, d0, cx, cy), [x1, y1] = pt(r, d1, cx, cy); return `M${f1(x0)} ${f1(y0)} A${r} ${r} 0 ${d1 - d0 > 180 ? 1 : 0} 1 ${f1(x1)} ${f1(y1)}`; };

// One parametric dial. Sweep is 150°..390° (240°), clockwise from lower left.
const dial = (o = {}) => { const k = { face: C.cream, bezel: C.navy, bezelW: 6, ink: C.navy, zone: C.red, zoneFrom: 330, zoneW: 7, ticks: 11, minor: 0, tickW: 3, needle: C.navy, angle: 50, needleStyle: 'spike', hub: C.navy, bird: 'below', birdC: C.slate, birdS: .3, birdLayer: 'under', hubR: 7, numerals: false, glare: false, cy: 64, ...o };
  const cy = k.cy, r = 58;
  const tk = (n, len, w) => Array.from({ length: n }, (_, i) => { const d = 150 + i * 240 / (n - 1), [a, b] = pt(50, d, 64, cy), [c, e] = pt(50 - len, d, 64, cy); return `<path d="M${f1(a)} ${f1(b)} L${f1(c)} ${f1(e)}" stroke-width="${w}"/>`; }).join('');
  const nums = k.numerals ? [0, 2, 4, 6, 8].map((n, i) => { const [x, y] = pt(33, 150 + i * 60, 64, cy); return `<text x="${f1(x)}" y="${f1(y + 3.5)}" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="10" fill="${k.ink}">${n}</text>`; }).join('') : '';
  const needle = { spike: `<path d="M0 -46 L4 0 L-4 0Z" fill="${k.needle}"/>`, line: `<path d="M0 -46 V10" stroke="${k.needle}" stroke-width="4" stroke-linecap="round"/>`,
    tail: `<path d="M0 -46 L3.5 0 L2 14 H-2 L-3.5 0Z" fill="${k.needle}"/>`, stoop: `<g transform="translate(0 -22) scale(.6) rotate(180)"><path d="${STOOP}" fill="${k.needle}"/></g>` }[k.needleStyle];
  const birdEl = { below: place(bird(k.birdC), 64, cy + 30, .16), hub: place(bird(k.birdC), 64, cy + 2, k.birdS), mid: place(bird(k.birdC), 64, cy + 2, k.birdS), none: '', top: place(bird(k.birdC), 64, cy - 26, .16) }[k.bird];
  return `<circle cx="64" cy="${cy}" r="${r}" fill="${k.face}" stroke="${k.bezel}" stroke-width="${k.bezelW}"/>${k.zone ? `<path d="${arc(48, k.zoneFrom, 390, 64, cy)}" stroke="${k.zone}" stroke-width="${k.zoneW}" fill="none"/>` : ''}
<g stroke="${k.ink}" stroke-linecap="round">${tk(k.ticks, 10, k.tickW)}${k.minor ? tk(k.minor, 5, 1.6) : ''}</g>${nums}${k.bird === 'hub' || (k.bird === 'mid' && k.birdLayer === 'over') ? '' : birdEl}<g transform="translate(64 ${cy}) rotate(${k.angle})">${needle}</g>
${k.bird === 'hub' ? `<circle cx="64" cy="${cy}" r="12" fill="${k.hub}"/>${birdEl}` : k.hubR ? `<circle cx="64" cy="${cy}" r="${k.hubR}" fill="${k.hub}"/>` : ''}${k.bird === 'mid' && k.birdLayer === 'over' ? birdEl : ''}${k.glare ? `<path d="M22 44 A46 46 0 0 1 60 14" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>` : ''}`; };

const F = { angle: 112, bird: 'mid' };
const V = [
  ['00', 'Flat out (round 6)', { angle: 112 }],
  ...[.18, .24, .3, .36, .42, .5, .58, .66].map((s, i) => [String(i + 1).padStart(2, '0'), `Under the needle, ${Math.round(s * 100)}%`, { ...F, birdS: s, birdC: C.slate }]),
  ...[.3, .4, .5, .6].map((s, i) => [String(i + 9).padStart(2, '0'), `Over the needle, ${Math.round(s * 100)}%`, { ...F, birdS: s, birdC: C.navy, birdLayer: 'over', hubR: 0 }]),
  ...[.3, .4, .5, .6].map((s, i) => [String(i + 13).padStart(2, '0'), `Orange, ${Math.round(s * 100)}%`, { ...F, birdS: s, birdC: C.orange, needle: C.navy, hubR: 5 }]),
];
const cards = V.map(([n, t, o]) => { writeFileSync(join(dir, `icon-r7-${n}.svg`), svg(`fa7${n}-`, `Falcon — ${t}`, dial(o))); return { n, t }; });
const fig = c => `<figure${c.n === '00' ? ' class="pick"' : ''}>${[128, 48, 28, 16].map(z => `<img src="icon-r7-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
writeFileSync(join(dir, 'preview-round7.html'), `<!doctype html><meta charset="utf-8"><title>Falcon icons, round 7</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}.pick figcaption{font-weight:700}</style>
<section class="light">${cards.map(fig).join('')}</section><section class="dark">${cards.map(fig).join('')}</section>\n`);
console.log('wrote ' + cards.length);
