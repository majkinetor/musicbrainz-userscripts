// Falcon icons, round 5: variations on three round-3 picks — 09 Emblem (e1..e7), 19 Plate (p1..p7) and 14 Speedo (s1..s6).
// Writes icon-r5-*.svg and preview-round5.html (128, 48, 28, 16 px on white and black), each pick shown first beside its variations.
//   node dev/mockups/falcon_icons/gen-round5.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const place = (inner, x, y, s, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s}) translate(-64 -64)">${inner}</g>`;
const f1 = v => v.toFixed(1);
const C = { navy: '#1b2a4a', slate: '#4a5a78', cream: '#f6efe2', gold: '#f5c518', orange: '#ff6a00', chrome: '#d9dde4', steel: '#6c7480', tyre: '#16181d', red: '#b5122b', teal: '#1f6f8b' };
// shapes from earlier rounds: the bird from below, the stoop, the head in profile, the sedan and coupe side views
const RH = 'M64 26 C67 26 70 30 70 36 C72 40 74 42 76 44 C92 42 108 36 124 34 C112 44 96 54 78 62 C76 68 74 74 74 80 L80 100 C74 104 68 104 64 104 Z';
const bird = c => `<path d="${RH}" fill="${c}"/><path d="${RH}" fill="${c}" transform="translate(128 0) scale(-1 1)"/>`;
const STOOP = 'M0 44 C8 30 13 0 17 -40 L6 -22 L4 -48 L-4 -48 L-6 -22 L-17 -40 C-13 0 -8 30 0 44 Z';
const HEAD = 'M34 118 C26 86 28 54 46 37 C60 24 82 22 96 31 C100 34 102 38 103 41 C111 42 118 50 118 61 L113 66 C112 61 108 58 103 59 C100 66 94 73 86 77 C79 83 75 98 79 118 Z';
const BODY = {
  coupe: 'M8 82 L10 70 C12 66 18 64 28 63 L46 62 L60 48 C62 46 65 45 69 45 L86 45 C90 45 93 47 95 50 L104 61 L116 63 C120 64 121 68 121 72 L121 82 C121 85 119 86 116 86 L108 86 A12 12 0 0 0 84 86 L46 86 A12 12 0 0 0 22 86 L12 86 C9 86 8 84 8 82Z',
  sedan: 'M8 82 L9 70 C10 66 14 65 24 64 L38 63 L50 47 C51 46 52 46 54 46 L90 46 C92 46 93 46 94 47 L104 63 L116 64 C120 65 121 68 121 72 L121 82 C121 85 119 86 116 86 L108 86 A12 12 0 0 0 84 86 L46 86 A12 12 0 0 0 22 86 L12 86 C9 86 8 84 8 82Z' };
const GLASS = { coupe: 'M48 61 L61 50 C63 49 65 49 68 49 L84 49 C87 49 89 50 91 52 L100 61Z', sedan: 'M41 62 L52 50 H91 L100 62Z' };
// a one-colour car silhouette with the glass and wheel hubs cut out in the ground colour
const carMark = (shape, c, ground) => `<path d="${BODY[shape]}" fill="${c}"/><path d="${GLASS[shape]}" fill="${ground}"/><circle cx="34" cy="86" r="10" fill="${c}"/><circle cx="96" cy="86" r="10" fill="${c}"/><circle cx="34" cy="86" r="4" fill="${ground}"/><circle cx="96" cy="86" r="4" fill="${ground}"/>`;
// wings for the emblem: a left wing drawn, the right one mirrored
const WING = { classic: 'M40 64 C28 52 14 50 2 52 C14 58 22 62 28 68 C18 68 10 70 4 74 C16 76 28 76 40 72Z',
  swept: 'M42 60 C30 44 16 38 0 38 C12 46 20 52 26 58 C16 56 8 58 2 62 C12 64 20 66 28 68 C20 70 12 74 8 78 C22 80 34 76 42 72Z' };
const wings = (d, fill, stroke = C.steel) => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round"/><path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" transform="translate(128 0) scale(-1 1)"/>`;
const feathers = (fill, edge) => { const one = Array.from({ length: 4 }, (_, i) => `<path d="M44 ${62 + i * 3} C${30 - i * 2} ${50 + i * 6} ${16 - i * 3} ${46 + i * 8} ${2 + i * 3} ${46 + i * 9} C${16 - i * 2} ${56 + i * 6} ${28 - i} ${64 + i * 4} 44 ${72 + i * 2}Z" fill="${fill[i % fill.length]}" stroke="${edge}" stroke-width="1"/>`).reverse().join('');
  return `<g>${one}</g><g transform="translate(128 0) scale(-1 1)">${one}</g>`; };
// dial helpers for the speedo
const pt = (cx, cy, r, deg) => { const a = deg * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
const arc = (cx, cy, r, d0, d1) => { const [x0, y0] = pt(cx, cy, r, d0), [x1, y1] = pt(cx, cy, r, d1); return `M${f1(x0)} ${f1(y0)} A${r} ${r} 0 ${d1 - d0 > 180 ? 1 : 0} 1 ${f1(x1)} ${f1(y1)}`; };
const ticks = (cx, cy, r, n, d0, d1, long = 2) => Array.from({ length: n }, (_, i) => { const d = d0 + i * (d1 - d0) / (n - 1), [a, b] = pt(cx, cy, r, d), [c, e] = pt(cx, cy, r - (i % long ? 5 : 10), d); return `<path d="M${f1(a)} ${f1(b)} L${f1(c)} ${f1(e)}"/>`; }).join('');
const I = [];

// ---- 09 Emblem
I.push(['e0', '09 Emblem (round 3)', `${wings(WING.classic, C.chrome)}<circle cx="64" cy="66" r="28" fill="${C.red}" stroke="${C.chrome}" stroke-width="5"/>${place(carMark('sedan', C.cream, C.red), 64, 68, .36)}`]);
I.push(['e1', 'Gold on navy', `${wings(WING.swept, C.gold, '#a8860f')}<circle cx="64" cy="64" r="29" fill="${C.navy}" stroke="${C.gold}" stroke-width="5"/>${place(carMark('coupe', C.cream, C.navy), 64, 66, .38)}`]);
I.push(['e2', 'Shield', `${wings(WING.swept, C.chrome)}<path d="M38 36 H90 V66 C90 86 78 98 64 106 C50 98 38 86 38 66Z" fill="${C.red}" stroke="${C.chrome}" stroke-width="5" stroke-linejoin="round"/>${place(carMark('sedan', C.cream, C.red), 64, 64, .32)}`]);
I.push(['e3', 'Feathered', `${feathers(['#e9edf2', '#c9cfd8', '#aab2bf', '#8c95a4'], C.steel)}<circle cx="64" cy="66" r="27" fill="${C.teal}" stroke="${C.chrome}" stroke-width="5"/>${place(carMark('coupe', C.cream, C.teal), 64, 68, .34)}`]);
I.push(['e4', 'Lettered ring', `<defs><path id="$arc" d="M33.5 68 A30.5 30.5 0 0 1 94.5 68"/></defs>${wings(WING.classic, C.chrome)}<circle cx="64" cy="66" r="36" fill="${C.navy}" stroke="${C.chrome}" stroke-width="4"/><circle cx="64" cy="66" r="25" fill="${C.red}"/>
<text font-family="Arial Black,Helvetica,sans-serif" font-weight="900" font-size="8" letter-spacing="2" fill="${C.cream}" dominant-baseline="middle"><textPath href="#$arc" startOffset="50%" text-anchor="middle">FALCON</textPath></text>${place(carMark('sedan', C.cream, C.red), 64, 70, .3)}`]);
I.push(['e5', 'Flat', `<path d="M38 62 L4 46 L16 62 L2 70 L38 74Z M90 62 L124 46 L112 62 L126 70 L90 74Z" fill="${C.navy}"/><circle cx="64" cy="66" r="28" fill="${C.orange}"/>${place(carMark('coupe', '#fff', C.orange), 64, 68, .36)}`]);
I.push(['e6', 'Oval', `${wings(WING.swept, C.gold, '#a8860f')}<ellipse cx="64" cy="66" rx="36" ry="24" fill="${C.teal}" stroke="${C.gold}" stroke-width="4"/>${place(carMark('sedan', C.cream, C.teal), 64, 67, .44)}`]);
I.push(['e7', 'Bird inside', `${wings(WING.classic, C.chrome)}<circle cx="64" cy="66" r="28" fill="${C.red}" stroke="${C.chrome}" stroke-width="5"/>${place(bird(C.cream), 64, 68, .36)}`]);

// ---- 19 Plate
const plate = (bg, fg, opts = {}) => { const k = { x: 4, y: 34, w: 120, h: 60, text: 'FALCON', size: 30, top: null, ...opts };
  return `<rect x="${k.x}" y="${k.y}" width="${k.w}" height="${k.h}" rx="8" fill="${bg}" stroke="${fg}" stroke-width="4"/><rect x="${k.x + 7}" y="${k.y + 7}" width="${k.w - 14}" height="${k.h - 14}" rx="4" fill="none" stroke="${fg}" stroke-width="1.5"/><circle cx="${k.x + 14}" cy="${k.y + 14}" r="2.5" fill="${fg}"/><circle cx="${k.x + k.w - 14}" cy="${k.y + 14}" r="2.5" fill="${fg}"/>
${k.top ? `<text x="64" y="${k.y + 16}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="6.5" letter-spacing="2" fill="${fg}">${k.top}</text>` : ''}<text x="64" y="${k.y + k.h / 2 + k.size * .36 + (k.top ? 3 : 0)}" text-anchor="middle" font-family="Arial Narrow,Arial,Helvetica,sans-serif" font-weight="700" font-size="${k.size}" letter-spacing="1" fill="${fg}">${k.text}</text>`; };
I.push(['p0', '19 Plate (round 3)', plate(C.gold, C.tyre, { top: 'BATCH EDITS' })]);
I.push(['p1', 'Black plate', plate(C.tyre, '#f2f2f2')]);
I.push(['p2', 'Blue plate', plate('#1d4fa8', '#fff', { top: 'BULK EDITS' })]);
I.push(['p3', 'Embossed', `${plate('#f6f6f2', C.red)}<rect x="96" y="40" width="20" height="12" rx="2" fill="${C.orange}"/><text x="106" y="49" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="7" fill="#fff">26</text>`]);
I.push(['p4', 'Bird band', `<rect x="4" y="34" width="120" height="60" rx="8" fill="#fff" stroke="${C.tyre}" stroke-width="4"/><path d="M6 36 H28 V92 H6Z" fill="${C.navy}"/>${place(bird(C.gold), 17, 60, .17)}<text x="22" y="86" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="8" fill="#fff" dx="-5">MB</text>
<text x="76" y="76" text-anchor="middle" font-family="Arial Narrow,Arial,Helvetica,sans-serif" font-weight="700" font-size="28" fill="${C.tyre}">FALCON</text>`]);
I.push(['p5', 'Square', plate(C.gold, C.tyre, { x: 14, y: 14, w: 100, h: 100, text: '', size: 0 }) + `<text x="64" y="60" text-anchor="middle" font-family="Arial Narrow,Arial,Helvetica,sans-serif" font-weight="700" font-size="36" fill="${C.tyre}">FAL</text><text x="64" y="100" text-anchor="middle" font-family="Arial Narrow,Arial,Helvetica,sans-serif" font-weight="700" font-size="36" fill="${C.tyre}">CON</text>`]);
I.push(['p6', 'Bent vintage', `<g transform="rotate(-8 64 64)">${plate('#e9d9a6', '#3a2a1a', { top: 'EST 2024' })}<path d="M4 70 Q30 64 50 74" stroke="#a88a4a" stroke-width="2" fill="none" opacity=".6"/><circle cx="104" cy="82" r="5" fill="#a0522d" opacity=".55"/><circle cx="20" cy="84" r="3.5" fill="#a0522d" opacity=".45"/></g>`]);
I.push(['p7', 'FLCN', plate(C.gold, C.tyre, { text: 'FLCN', size: 42 })]);

// ---- 14 Speedo
const speedo0 = `<circle cx="64" cy="70" r="58" fill="#16181d" stroke="${C.chrome}" stroke-width="5"/><path d="${arc(64, 70, 50, 330, 390)}" stroke="#e63946" stroke-width="6" fill="none"/><g stroke="${C.cream}" stroke-width="3" stroke-linecap="round">${ticks(64, 70, 50, 11, 150, 390)}</g>
<g transform="translate(64 70) rotate(40)"><path d="M0 -46 C4 -36 6 -20 6 0 L-6 0 C-6 -20 -4 -36 0 -46Z" fill="${C.orange}"/></g>${place(bird(C.cream), 64, 70, .2)}<circle cx="64" cy="70" r="5" fill="${C.orange}"/>`;
I.push(['s0', '14 Speedo (round 3)', speedo0]);
I.push(['s1', 'Cream dial', `<circle cx="64" cy="66" r="58" fill="${C.cream}" stroke="${C.navy}" stroke-width="6"/><path d="${arc(64, 66, 48, 330, 390)}" stroke="#d62828" stroke-width="7" fill="none"/><g stroke="${C.navy}" stroke-width="3" stroke-linecap="round">${ticks(64, 66, 50, 11, 150, 390)}</g>
<g transform="translate(64 66) rotate(50)"><path d="M0 -46 L4 0 L-4 0Z" fill="${C.navy}"/></g><circle cx="64" cy="66" r="7" fill="${C.navy}"/>${place(bird(C.slate), 64, 96, .16)}`]);
I.push(['s2', 'Stoop needle', `<circle cx="64" cy="70" r="58" fill="${C.navy}" stroke="${C.chrome}" stroke-width="5"/><path d="${arc(64, 70, 50, 330, 390)}" stroke="${C.orange}" stroke-width="6" fill="none"/><g stroke="${C.cream}" stroke-width="3" stroke-linecap="round">${ticks(64, 70, 50, 11, 150, 390)}</g>
<g transform="translate(64 70) rotate(-130) translate(0 -2) scale(.7)"><path d="${STOOP}" fill="${C.gold}" transform="translate(0 -6)"/></g><circle cx="64" cy="70" r="5" fill="${C.gold}"/>`]);
I.push(['s3', 'Neon', `<defs><filter id="$g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect x="4" y="4" width="120" height="120" rx="26" fill="#120a1f"/>
<g filter="url(#$g)" fill="none" stroke-linecap="round"><path d="${arc(64, 72, 46, 150, 330)}" stroke="#39d0ff" stroke-width="4"/><path d="${arc(64, 72, 46, 330, 390)}" stroke="#ff4fd8" stroke-width="4"/><g transform="translate(64 72) rotate(45)"><path d="M0 -40 V0" stroke="#ffd24a" stroke-width="4"/></g></g><circle cx="64" cy="72" r="5" fill="#ffd24a"/>`]);
I.push(['s4', 'Half gauge', `<path d="M8 92 A56 56 0 0 1 120 92Z" fill="${C.navy}"/><path d="${arc(64, 92, 48, 180, 300)}" stroke="${C.slate}" stroke-width="9" fill="none"/><path d="${arc(64, 92, 48, 300, 360)}" stroke="${C.orange}" stroke-width="9" fill="none"/>
<g transform="translate(64 92) rotate(55)"><path d="M0 -44 L4 0 L-4 0Z" fill="${C.cream}"/></g><circle cx="64" cy="92" r="9" fill="${C.cream}"/>${place(bird(C.navy), 64, 92, .1)}<rect x="8" y="92" width="112" height="6" rx="3" fill="${C.navy}"/>`]);
I.push(['s5', 'Digital', `<circle cx="64" cy="66" r="58" fill="#0e1117"/>${Array.from({ length: 16 }, (_, i) => { const d0 = 150 + i * 15, on = i < 12; return `<path d="${arc(64, 66, 46, d0 + 2, d0 + 12)}" stroke="${on ? (i > 9 ? C.orange : '#39d0ff') : '#2a2f38'}" stroke-width="10" fill="none"/>`; }).join('')}
<text x="64" y="76" text-anchor="middle" font-family="Consolas,Courier New,monospace" font-weight="700" font-size="28" fill="#fff">240</text><text x="64" y="92" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="9" fill="#8b93a1">KM/H</text>`]);
I.push(['s6', 'Winged dial', `${wings(WING.swept, C.chrome)}<circle cx="64" cy="66" r="34" fill="#16181d" stroke="${C.chrome}" stroke-width="4"/><path d="${arc(64, 66, 28, 330, 390)}" stroke="#e63946" stroke-width="5" fill="none"/><g stroke="${C.cream}" stroke-width="2.4" stroke-linecap="round">${ticks(64, 66, 29, 9, 150, 390)}</g>
<g transform="translate(64 66) rotate(40)"><path d="M0 -26 L3 0 L-3 0Z" fill="${C.orange}"/></g><circle cx="64" cy="66" r="4" fill="${C.orange}"/>`]);

const cards = I.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r5-${n}.svg`), svg(`fa5${n}-`, `Falcon — ${t}`, b)); return { n, t }; });
const fig = c => `<figure${c.n.endsWith('0') ? ' class="pick"' : ''}>${[128, 48, 28, 16].map(z => `<img src="icon-r5-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = cls => ['e', 'p', 's'].map(g => `<section class="${cls}">${cards.filter(c => c.n[0] === g).map(fig).join('')}</section>`).join('');
writeFileSync(join(dir, 'preview-round5.html'), `<!doctype html><meta charset="utf-8"><title>Falcon icons, round 5</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:14px 18px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}.pick figcaption{font-weight:700}</style>
${sec('light')}${sec('dark')}\n`);
console.log('wrote ' + cards.length);
