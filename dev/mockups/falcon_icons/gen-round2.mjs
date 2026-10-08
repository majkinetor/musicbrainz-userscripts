// Falcon icons, round 2: the same bird in twenty different art styles.
// Writes icon-r2-01..20.svg and preview-round2.html (128, 48, 28, 16 px on white and black).
//   node dev/mockups/falcon_icons/gen-round2.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const tile = (fill, rx = 26) => `<rect x="4" y="4" width="120" height="120" rx="${rx}" fill="${fill}"/>`;
const clipTile = (id, rx = 26) => `<clipPath id="${id}"><rect x="4" y="4" width="120" height="120" rx="${rx}"/></clipPath>`;
const C = { hood: '#1b2a4a', slate: '#4a5a78', cream: '#f6efe2', gold: '#f5c518', beak: '#5b6b80', orange: '#ff6a00' };
// Shapes from round 1: the head in profile (facing right), the throat and cheek, the beak; the bird from below; the stoop.
const HEAD = 'M34 118 C26 86 28 54 46 37 C60 24 82 22 96 31 C100 34 102 38 103 41 C111 42 118 50 118 61 L113 66 C112 61 108 58 103 59 C100 66 94 73 86 77 C79 83 75 98 79 118 Z';
const THROAT = 'M101 61 C98 68 93 73 86 77 C79 83 75 98 79 118 L60 118 C58 100 62 88 70 80 C78 72 86 66 92 62 Z';
const CHEEK = '<ellipse cx="50" cy="84" rx="10" ry="15" transform="rotate(-12 50 84)"/>';
const BEAK = 'M101 40 C111 41 118 50 118 61 L113 66 C112 61 108 58 102 59 Z';
const RH = 'M64 26 C67 26 70 30 70 36 C72 40 74 42 76 44 C92 42 108 36 124 34 C112 44 96 54 78 62 C76 68 74 74 74 80 L80 100 C74 104 68 104 64 104 Z';
const fly = (attrs) => `<path d="${RH}" ${attrs}/><path d="${RH}" ${attrs} transform="translate(128 0) scale(-1 1)"/>`;
const place = (inner, x, y, s, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s}) translate(-64 -64)">${inner}</g>`;
const STOOP = 'M0 44 C8 30 13 0 17 -40 L6 -22 L4 -48 L-4 -48 L-6 -22 L-17 -40 C-13 0 -8 30 0 44 Z';
const eye = (r = 8.5, ring = C.gold, pupil = '#0d0d0d') => `<circle cx="82" cy="47" r="${r}" fill="${ring}"/><circle cx="82" cy="47" r="${r * .68}" fill="${pupil}"/><circle cx="84.2" cy="44.8" r="${r * .2}" fill="#fff"/>`;
// a deterministic pseudo-random, so the files don't change between runs
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const I = [];

// 01 Neon: the head in glowing tube
I.push(['01', 'Neon', `<defs><filter id="$g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${tile('#120a1f')}
<g transform="translate(10 8) scale(.84)" fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#$g)"><path d="${HEAD}" stroke="#39d0ff"/><path d="M101 61 C98 68 93 73 86 77 C76 84 72 98 74 118" stroke="#ff4fd8"/><circle cx="82" cy="47" r="7" stroke="#ffd24a"/></g>`]);
// 02 Stamp: a perforated postage stamp, the falcon in flight
{ const perf = []; for (let i = 0; i <= 10; i++) { const p = 12 + i * 10.4; perf.push([p, 6], [p, 122], [6, p], [122, p]); }
  I.push(['02', 'Stamp', `<defs><mask id="$m"><rect width="128" height="128" fill="#fff"/>${perf.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#000"/>`).join('')}</mask></defs><rect x="6" y="6" width="116" height="116" fill="#fff8ea" stroke="#d9cdb4" stroke-width="1" mask="url(#$m)"/>
<rect x="16" y="16" width="96" height="96" fill="#8ec1d6"/><circle cx="88" cy="40" r="12" fill="#ffe08a"/>${place(fly(`fill="${C.hood}"`), 58, 64, .62)}<text x="104" y="106" text-anchor="end" font-family="Georgia,serif" font-weight="700" font-size="16" fill="#b5122b">50</text>`]); }
// 03 Ukiyo-e: a red sun, curling waves, the falcon crossing
{ const wave = (y, c) => `<path d="M4 ${y} q10 -12 20 0 q4 -8 10 -2 q10 -12 20 0 q4 -8 10 -2 q10 -12 20 0 q4 -8 10 -2 q10 -12 20 0 q4 -8 10 -2 V124 H4Z" fill="${c}"/>`;
  I.push(['03', 'Ukiyo-e', `<defs>${clipTile('$c', 20)}</defs><g clip-path="url(#$c)">${tile('#f2e6c9', 20)}<circle cx="80" cy="50" r="30" fill="#d7352b"/>${wave(96, '#2f5d8a')}${wave(108, '#1b3a5c')}<path d="M4 96 q10 -12 20 0 q10 -12 20 0 q10 -12 20 0 q10 -12 20 0 q10 -12 20 0 q10 -12 20 0" fill="none" stroke="#f2e6c9" stroke-width="2"/>
${place(fly(`fill="#1a1410"`), 50, 44, .5, -12)}</g>`]); }
// 04 Pop art: halftone dots, thick black line
I.push(['04', 'Pop art', `<defs><pattern id="$d" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="2" fill="#ff4fa3"/></pattern><clipPath id="$h"><path d="${HEAD}"/></clipPath></defs>${tile('#ffe14d', 8)}${tile('url(#$d)', 8)}
<path d="${HEAD}" fill="#2b6fff" stroke="#000" stroke-width="5" stroke-linejoin="round"/><g clip-path="url(#$h)" fill="#fff" stroke="#000" stroke-width="4"><path d="${THROAT}"/><g>${CHEEK}</g></g><path d="${BEAK}" fill="#ffe14d" stroke="#000" stroke-width="4" stroke-linejoin="round"/><circle cx="82" cy="47" r="9" fill="#fff" stroke="#000" stroke-width="4"/><circle cx="83" cy="47" r="4" fill="#000"/>`]);
// 05 Stained glass: the head in leaded panes
I.push(['05', 'Stained glass', `<defs><clipPath id="$h"><path d="${HEAD}"/></clipPath></defs><g clip-path="url(#$h)" stroke="#111" stroke-width="3.5"><rect width="128" height="128" fill="#2f4a8a"/><path d="M20 20 L70 40 L40 70Z" fill="#3c64b8"/><path d="M70 40 L110 30 L96 64Z" fill="#24407e"/><path d="M40 70 L70 40 L72 80 L50 118Z" fill="#1d3570"/>
<path d="${THROAT}" fill="#f1d27a"/><g fill="#fbe8b0">${CHEEK}</g><path d="M60 118 L72 92 L80 118" fill="#e9b949"/></g><path d="${HEAD}" fill="none" stroke="#111" stroke-width="5" stroke-linejoin="round"/><path d="${BEAK}" fill="#8a9bb3" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>${eye(8.5, '#ff8c1a', '#111')}`]);
// 06 Art deco: a symmetric gold falcon of parallel lines, on black
{ const lines = Array.from({ length: 6 }, (_, i) => `<path d="M64 ${52 + i * 5} L${118 - i * 9} ${36 + i * 6}" />`).join('');
  I.push(['06', 'Art deco', `${tile('#111', 16)}<rect x="9" y="9" width="110" height="110" rx="12" fill="none" stroke="#d4af37" stroke-width="2"/><g stroke="#d4af37" stroke-width="3" stroke-linecap="round">${lines}<g transform="translate(128 0) scale(-1 1)">${lines}</g></g>
<path d="M56 50 L64 30 L72 50 L70 84 L76 104 H52 L58 84Z" fill="#d4af37"/><path d="M64 30 L70 36 L64 40Z" fill="#111"/><path d="M58 90 H70 M58 96 H70" stroke="#111" stroke-width="2"/>`]); }
// 07 Low poly: the head cut into facets
{ const tris = []; const g = 14; for (let y = 0; y < 128; y += g) for (let x = 0; x < 128; x += g) { const sh = ['#1b2a4a', '#22345a', '#2a3d66', '#31466f', '#1f2f52'];
    tris.push(`<path d="M${x} ${y} L${x + g} ${y} L${x} ${y + g}Z" fill="${sh[Math.floor(rnd() * 5)]}"/><path d="M${x + g} ${y} L${x + g} ${y + g} L${x} ${y + g}Z" fill="${sh[Math.floor(rnd() * 5)]}"/>`); }
  I.push(['07', 'Low poly', `<defs><clipPath id="$h"><path d="${HEAD}"/></clipPath><clipPath id="$t"><path d="${THROAT}"/></clipPath></defs><g clip-path="url(#$h)">${tris.join('')}</g>
<g clip-path="url(#$t)"><path d="M56 70 L104 56 L84 96Z" fill="#f6efe2"/><path d="M56 70 L84 96 L56 128Z" fill="#e6dccb"/><path d="M84 96 L56 128 L90 128Z" fill="#d8ccb6"/></g><path d="M40 72 L58 80 L48 100Z" fill="#f6efe2"/><path d="M101 40 L118 61 L102 59Z" fill="#6c7d96"/><path d="M118 61 L113 66 L102 59Z" fill="#4b5a70"/>${eye()}`]); }
// 08 Watercolour: washes that bleed past the silhouette
I.push(['08', 'Watercolour', `<defs><filter id="$w" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="4"/><feDisplacementMap in="SourceGraphic" scale="9"/><feGaussianBlur stdDeviation=".9"/></filter></defs>
<g filter="url(#$w)" opacity=".85"><circle cx="70" cy="58" r="44" fill="#bfe0f2"/>${place(fly(`fill="#3b6ea8"`), 64, 64, .95)}<path d="M64 26 C67 26 70 30 70 36 L58 36 C58 30 61 26 64 26Z" fill="#1b2a4a"/></g>`]);
// 09 Patch: an embroidered badge, satin stitch border
I.push(['09', 'Patch', `<circle cx="64" cy="64" r="60" fill="#2c4a3e"/><circle cx="64" cy="64" r="60" fill="none" stroke="#e9b949" stroke-width="6"/><circle cx="64" cy="64" r="53" fill="none" stroke="#e9b949" stroke-width="1.6" stroke-dasharray="3 2.5"/>
<g transform="translate(16 12) scale(.72)"><path d="${HEAD}" fill="${C.slate}" stroke="#f6efe2" stroke-width="3" stroke-dasharray="4 2"/><path d="${THROAT}" fill="${C.cream}"/><g fill="${C.cream}">${CHEEK}</g><path d="${BEAK}" fill="#9aa8bf"/>${eye(9, C.gold)}</g>`]);
// 10 Seventies: rainbow stripes behind the falcon in flight
I.push(['10', 'Seventies', `${['#7a3b10', '#d9541e', '#f08a24', '#f5c518'].map((c, i) => `<path d="M4 ${112 - i * 0} A${60 - i * 12} ${60 - i * 12} 0 0 1 ${124 - i * 24} 112" fill="none" stroke="${c}" stroke-width="12" transform="translate(${i * 12} 0)"/>`).join('')}
${place(fly(`fill="#3a2a1f"`), 64, 54, .78)}`]);
// 11 Blueprint: the underwing drawn up, with dimensions
I.push(['11', 'Blueprint', `<defs><pattern id="$p" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0 H0 V8" fill="none" stroke="#3d78c4" stroke-width=".6"/></pattern></defs>${tile('#1f5aa6', 12)}${tile('url(#$p)', 12)}
${place(fly('fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"'), 64, 60, .82)}<g stroke="#cfe3ff" stroke-width="1.2"><path d="M14 104 H114 M14 100 V108 M114 100 V108 M60 62 H68"/></g><text x="64" y="117" text-anchor="middle" font-family="monospace" font-size="9" fill="#cfe3ff">WINGSPAN 1.1 m</text>`]);
// 12 Clay: soft 3D, rounded and shaded
I.push(['12', 'Clay', `<defs><radialGradient id="$a" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#5a72a8"/><stop offset="1" stop-color="#1b2a4a"/></radialGradient><radialGradient id="$b" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#d8ccb6"/></radialGradient>
<filter id="$s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity=".35"/></filter></defs><g filter="url(#$s)" transform="translate(8 2) scale(.88)"><path d="${HEAD}" fill="url(#$a)"/><path d="${THROAT}" fill="url(#$b)"/><g fill="url(#$b)">${CHEEK}</g><path d="${BEAK}" fill="#7d8ca4"/>${eye(9.5)}</g>`]);
// 13 Poster: a stoop across a red disc, two colours on cream
I.push(['13', 'Poster', `${tile('#f2ead8', 6)}<circle cx="74" cy="56" r="36" fill="#d7352b"/><g transform="translate(58 68) rotate(-40) scale(1.25)"><path d="${STOOP}" fill="#14213d"/></g><path d="M14 112 H70" stroke="#14213d" stroke-width="6"/>`]);
// 14 Linocut: black ink, white gouges
{ const gouge = Array.from({ length: 9 }, (_, i) => `<path d="M${30 + i * 4} ${118 - i * 2} C${34 + i * 6} ${84 - i * 4} ${50 + i * 4} ${52 - i * 2} ${80 + i * 2} ${36 + i}" />`).join('');
  I.push(['14', 'Linocut', `<defs><clipPath id="$h"><path d="${HEAD}"/></clipPath></defs>${tile('#f3eee2', 8)}<path d="${HEAD}" fill="#111"/><g clip-path="url(#$h)" fill="none" stroke="#f3eee2" stroke-width="1.6" stroke-linecap="round" opacity=".9">${gouge}</g>
<path d="${THROAT}" fill="#f3eee2"/><g fill="#f3eee2">${CHEEK}</g><g stroke="#111" stroke-width="2" stroke-linecap="round"><path d="M70 92 l6 -3 M68 102 l7 -3 M66 112 l7 -3 M82 86 l6 -3"/></g><path d="${BEAK}" fill="#111"/><circle cx="82" cy="47" r="8.5" fill="#f3eee2"/><circle cx="82" cy="47" r="5" fill="#111"/>`]); }
// 15 Glass: a frosted tile over colour, a white falcon
I.push(['15', 'Glass', `<defs><filter id="$b"><feGaussianBlur stdDeviation="9"/></filter>${clipTile('$c', 28)}</defs><g clip-path="url(#$c)">${tile('#1b2a4a', 28)}<g filter="url(#$b)"><circle cx="28" cy="96" r="34" fill="${C.orange}"/><circle cx="104" cy="30" r="32" fill="#39b5ff"/><circle cx="96" cy="104" r="20" fill="#9b5cff"/></g>
<rect x="16" y="16" width="96" height="96" rx="22" fill="#fff" opacity=".14" stroke="#fff" stroke-opacity=".5" stroke-width="2"/></g>${place(fly('fill="#fff"'), 64, 62, .66)}`]);
// 16 Chalk: chalk on a slate board
I.push(['16', 'Chalk', `<defs><filter id="$r"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="2"/><feDisplacementMap in="SourceGraphic" scale="2.6"/></filter></defs>${tile('#2e3b33', 14)}<rect x="4" y="4" width="120" height="120" rx="14" fill="none" stroke="#8a5a32" stroke-width="5"/>
<g transform="translate(14 10) scale(.8)" fill="none" stroke="#f1f1e8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#$r)" opacity=".92"><path d="${HEAD}"/><path d="M101 61 C98 68 93 73 86 77 C76 84 72 98 74 118"/><ellipse cx="50" cy="84" rx="10" ry="15" transform="rotate(-12 50 84)"/><circle cx="82" cy="47" r="7"/><path d="M102 59 L118 61"/></g>`]);
// 17 Totem: stepped, symmetric, Pacific Northwest-ish blocks
I.push(['17', 'Totem', `<g fill="#b5482a"><path d="M56 22 H72 V34 H80 V44 H96 V40 H120 V52 H108 V58 H88 V66 H76 V96 H84 V108 H44 V96 H52 V66 H40 V58 H20 V52 H8 V40 H32 V44 H48 V34 H56Z"/></g>
<g fill="#1fa39a"><path d="M24 44 H32 V52 H24Z M96 44 H104 V52 H96Z M58 70 H70 V90 H58Z"/></g><rect x="58" y="26" width="12" height="6" fill="#111"/><path d="M60 34 H68 L64 40Z" fill="#f5c518"/><g fill="#111"><rect x="54" y="98" width="4" height="6"/><rect x="62" y="98" width="4" height="6"/><rect x="70" y="98" width="4" height="6"/></g>`]);
// 18 Extruded: the falcon in flight, given depth
I.push(['18', 'Extruded', `${[6, 5, 4, 3, 2, 1].map(d => place(fly(`fill="${d > 3 ? '#0d1526' : '#14213d'}"`), 64 + d * 1.2, 62 + d * 1.6, .86)).join('')}${place(fly(`fill="#5b7bb8"`), 64, 62, .86)}<path d="M64 41 C66 41 68 44 68 47 L60 47 C60 44 62 41 64 41Z" fill="${C.gold}"/>`]);
// 19 Gradient tile: a modern app icon, the head cut out in white
I.push(['19', 'Gradient tile', `<defs>${lg('$g', ['#6a3df0', '#d63c8a', '#ff8a3d'], 1, 1)}</defs>${tile('url(#$g)', 28)}<g transform="translate(14 12) scale(.8)"><path d="${HEAD}" fill="#fff"/><path d="${THROAT}" fill="#fff" opacity=".0"/><path d="M101 61 C98 68 93 73 86 77 C79 83 75 98 79 118" fill="none" stroke="#d63c8a" stroke-width="4"/><circle cx="82" cy="47" r="7" fill="#6a3df0"/></g>`]);
// 20 Constellation: the falcon mapped in stars
{ const pts = [[64, 26], [70, 38], [76, 44], [100, 40], [124, 34], [96, 54], [78, 62], [74, 80], [80, 100], [64, 104]]; const all = [...pts, ...pts.slice(1, -1).reverse().map(([x, y]) => [128 - x, y])];
  I.push(['20', 'Constellation', `${tile('#0b1238')}<g transform="translate(64 66) scale(.86) translate(-64 -64)"><path d="M${all.join(' L')}Z" fill="none" stroke="#7f8ccf" stroke-width="1.6"/><path d="M76 44 L78 62 M52 44 L50 62" stroke="#7f8ccf" stroke-width="1.2" stroke-dasharray="2 3"/>
${all.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i ? 3 : 4.5}" fill="${i ? '#fff' : '#ffe680'}"/>`).join('')}</g>`]); }

const cards = I.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r2-${n}.svg`), svg(`fa2${n}-`, `Falcon — ${t}`, b)); return { n, t }; });
const fig = (src, cap) => `<figure>${[128, 48, 28, 16].map(z => `<img src="${src}" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${cap}</figcaption></figure>`;
const row = () => cards.map(c => fig(`icon-r2-${c.n}.svg`, `${c.n} · ${c.t}`)).join('');
writeFileSync(join(dir, 'preview-round2.html'), `<!doctype html><meta charset="utf-8"><title>Falcon icons, round 2</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}</style>
<section class="light">${row()}</section><section class="dark">${row()}</section>\n`);
console.log('wrote ' + cards.length);
