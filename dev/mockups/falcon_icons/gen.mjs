// Falcon icons, round 1: twenty takes on the falcon itself (the bird, not the rocket).
// Peregrine head, stoop dive, underwing, falconry hood and glove, a flock of workers, Horus, feathers, heraldry and more.
// Writes icon-r1-01..20.svg and preview-round1.html (128, 48, 28, 16 px on white and black).
//   node dev/mockups/falcon_icons/gen.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const dots = (pts, c = '#fff') => `<g fill="${c}">${pts.map(([x, y, r = 1.3]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
const tile = (fill, rx = 26) => `<rect x="4" y="4" width="120" height="120" rx="${rx}" fill="${fill}"/>`;
const C = { hood: '#1b2a4a', slate: '#4a5a78', cream: '#f6efe2', gold: '#f5c518', beak: '#5b6b80', orange: '#ff6a00' };

// A peregrine's head in profile, facing right: dark hood, the malar "tear" stripe between a pale cheek and throat, yellow eye ring and cere, hooked beak.
const HEAD = 'M34 118 C26 86 28 54 46 37 C60 24 82 22 96 31 C100 34 102 38 103 41 C111 42 118 50 118 61 L113 66 C112 61 108 58 103 59 C100 66 94 73 86 77 C79 83 75 98 79 118 Z';
const BEAK = 'M101 40 C111 41 118 50 118 61 L113 66 C112 61 108 58 102 59 Z';
const head = (o = {}) => { const k = { hood: C.hood, light: C.cream, beak: C.beak, cere: C.gold, ring: C.gold, eye: '#0d0d0d', ...o };
  return `<path d="${HEAD}" fill="${k.hood}"/><path d="M101 61 C98 68 93 73 86 77 C79 83 75 98 79 118 L60 118 C58 100 62 88 70 80 C78 72 86 66 92 62 Z" fill="${k.light}"/><ellipse cx="50" cy="84" rx="10" ry="15" fill="${k.light}" transform="rotate(-12 50 84)"/>
<path d="${BEAK}" fill="${k.beak}"/><path d="M98 37 C103 37 106 41 105 46 C103 50 99 50 97 46Z" fill="${k.cere}"/><circle cx="82" cy="47" r="8.5" fill="${k.ring}"/><circle cx="82" cy="47" r="5.8" fill="${k.eye}"/><circle cx="84.2" cy="44.8" r="1.8" fill="#fff"/>`; };
// The falcon seen from below, wings spread: pointed wings, long tail. Right half drawn, left half mirrored.
const RH = 'M64 26 C67 26 70 30 70 36 C72 40 74 42 76 44 C92 42 108 36 124 34 C112 44 96 54 78 62 C76 68 74 74 74 80 L80 100 C74 104 68 104 64 104 Z';
const fly = (c, extra = '') => `<path d="${RH}" fill="${c}"/><path d="${RH}" fill="${c}" transform="translate(128 0) scale(-1 1)"/>${extra}`;
const place = (inner, x, y, s, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s}) translate(-64 -64)">${inner}</g>`;
// The falcon in a stoop: wings swept back into an arrowhead, head first (local coords, nose pointing down).
const STOOP = 'M0 44 C8 30 13 0 17 -40 L6 -22 L4 -48 L-4 -48 L-6 -22 L-17 -40 C-13 0 -8 30 0 44 Z';
const I = [];

// 01 Peregrine: the head, plain on nothing
I.push(['01', 'Peregrine', head()]);
// 02 Stoop: the dive, fastest animal alive, with speed lines
I.push(['02', 'Stoop', `<defs>${lg('$s', ['#8ec5ff', '#e8f3ff'])}</defs>${tile('url(#$s)')}<g stroke="#fff" stroke-width="4" stroke-linecap="round"><path d="M20 22 L44 50 M36 14 L56 38 M14 44 L30 62"/></g>
<g transform="translate(72 70) rotate(-40)"><path d="${STOOP}" fill="${C.slate}"/><path d="M0 44 C4 36 6 28 6 22 L-6 22 C-6 28 -4 36 0 44Z" fill="${C.hood}"/><path d="M-3 30 L3 30 L0 44Z" fill="${C.gold}"/></g>`]);
// 03 Underwing: spread wings from below, barred
{ const bars = Array.from({ length: 7 }, (_, i) => `<path d="M${74 + i * 7} ${46 + i * .2} L${70 + i * 7} ${58 - i * 1.6}" />`).join('');
  I.push(['03', 'Underwing', `<defs><clipPath id="$w">${fly('#000')}</clipPath></defs>${fly(C.cream)}<g clip-path="url(#$w)" stroke="${C.slate}" stroke-width="2.4" stroke-linecap="round">${bars}<g transform="translate(128 0) scale(-1 1)">${bars}</g>
<path d="M58 66 H70 M58 74 H70 M60 82 H68 M60 90 H68"/></g><path d="M64 26 C67 26 70 30 70 36 L58 36 C58 30 61 26 64 26Z" fill="${C.hood}"/>${fly('none')}<g fill="none" stroke="${C.hood}" stroke-width="2.5" stroke-linejoin="round"><path d="${RH}"/><path d="${RH}" transform="translate(128 0) scale(-1 1)"/></g>`]); }
// 04 Hood: the falconer's leather hood, plume on top
I.push(['04', 'Hood', `<path d="M64 30 C58 18 50 12 44 12 C52 18 56 24 58 30Z M64 30 C64 16 68 8 74 4 C72 14 70 22 68 30Z M66 30 C72 20 80 16 88 16 C80 22 74 26 70 31Z" fill="${C.orange}"/>
<path d="M26 104 C20 64 36 32 64 30 C92 30 108 54 104 78 L114 96 C104 100 92 98 86 92 L84 104 Z" fill="#8a4b22"/><path d="M26 104 C22 80 26 60 36 48 C40 62 44 80 44 104Z" fill="#6b3818"/>
<path d="M30 92 C50 86 70 86 86 92" fill="none" stroke="${C.gold}" stroke-width="5"/><circle cx="64" cy="31" r="5" fill="${C.gold}"/><g stroke="#c98a5a" stroke-width="2" stroke-dasharray="3 3" fill="none"><path d="M52 40 C70 36 88 46 96 66"/></g><ellipse cx="80" cy="58" rx="9" ry="6" fill="#6b3818"/>`]);
// 05 Geometric: circles and triangles only
I.push(['05', 'Geometric', `<circle cx="58" cy="62" r="46" fill="${C.hood}"/><path d="M58 62 A46 46 0 0 1 22 90 L58 108Z" fill="${C.cream}"/><path d="M70 108 L104 72 L104 108Z" fill="${C.cream}"/><path d="M100 40 L124 58 L104 70Z" fill="${C.gold}"/><path d="M110 56 L124 58 L116 68Z" fill="${C.beak}"/><circle cx="78" cy="46" r="10" fill="${C.gold}"/><circle cx="78" cy="46" r="6" fill="#0d0d0d"/>`]);
// 06 Monoline: the head as one line
I.push(['06', 'Monoline', `<g fill="none" stroke="${C.hood}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="${HEAD}"/><path d="M101 61 C98 68 93 73 86 77"/><path d="M72 80 C64 88 60 100 62 118"/><path d="M103 59 L118 61"/></g><circle cx="82" cy="47" r="7" fill="none" stroke="${C.orange}" stroke-width="5"/><circle cx="82" cy="47" r="2" fill="${C.hood}"/>`]);
// 07 On the glove: perched on the falconer's fist
I.push(['07', 'On the glove', `${tile('#eef3f8')}<path d="M4 104 C30 96 60 94 92 100 L124 108 V124 H4Z" fill="#8a4b22"/><path d="M76 98 L72 122 L86 122 L88 98Z" fill="${C.slate}"/>
<path d="M54 44 C80 40 94 62 90 86 L84 104 L64 104 C52 98 46 84 46 68 C46 56 48 48 54 44Z" fill="${C.slate}"/><path d="M60 58 C54 66 54 84 62 98 L72 98 C64 86 62 70 66 58Z" fill="${C.cream}"/><g stroke="${C.slate}" stroke-width="2" stroke-linecap="round"><path d="M58 70 h4 M60 78 h4 M58 86 h4 M62 92 h4"/></g>
<circle cx="60" cy="38" r="16" fill="${C.hood}"/><path d="M50 46 C52 52 58 54 62 52 L60 44Z" fill="${C.cream}"/><path d="M44 34 C38 34 34 40 36 46 L42 42Z" fill="${C.beak}"/><circle cx="52" cy="34" r="4.5" fill="${C.gold}"/><circle cx="52" cy="34" r="2.6" fill="#0d0d0d"/>
<path d="M60 104 l-3 6 M68 104 l0 6" stroke="${C.gold}" stroke-width="3" stroke-linecap="round"/>`]);
// 08 Formation: a flock in a V, the pool of workers
I.push(['08', 'Formation', `${tile('#1b2a4a')}${place(fly(C.gold), 64, 40, .42)}${place(fly('#b8c4da'), 34, 74, .32)}${place(fly('#b8c4da'), 94, 74, .32)}${place(fly('#7d8cab'), 16, 104, .24)}${place(fly('#7d8cab'), 112, 104, .24)}`]);
// 09 Eye: close up on the eye and the tear stripe
I.push(['09', 'Eye', `<defs><clipPath id="$c"><rect x="4" y="4" width="120" height="120" rx="26"/></clipPath></defs><g clip-path="url(#$c)"><rect width="128" height="128" fill="${C.hood}"/><path d="M60 128 C62 104 70 90 84 80 C96 72 112 70 128 72 V128Z" fill="${C.cream}"/><path d="M0 128 V96 C14 92 28 98 34 128Z" fill="${C.cream}"/>
<circle cx="60" cy="48" r="28" fill="${C.gold}"/><circle cx="60" cy="48" r="19" fill="#0d0d0d"/><circle cx="67" cy="40" r="6" fill="#fff"/></g>`]);
// 10 Crest: heraldic, a falcon displayed on a shield
I.push(['10', 'Crest', `<path d="M14 10 H114 V60 C114 92 92 110 64 122 C36 110 14 92 14 60Z" fill="#b5122b" stroke="${C.gold}" stroke-width="5"/>${place(fly(C.gold), 64, 64, .72)}`]);
// 11 Courier: the falcon carrying a record in its talons
I.push(['11', 'Courier', `${place(fly(C.slate, `<path d="M64 26 C67 26 70 30 70 36 L58 36 C58 30 61 26 64 26Z" fill="${C.hood}"/>`), 64, 46, .9)}<path d="M58 88 L56 96 M70 88 L72 96" stroke="${C.gold}" stroke-width="3.5" stroke-linecap="round"/><circle cx="64" cy="108" r="16" fill="#17121f"/><circle cx="64" cy="108" r="11" fill="none" stroke="#3a3346" stroke-width="1.4"/><circle cx="64" cy="108" r="5.5" fill="${C.orange}"/><circle cx="64" cy="108" r="1.6" fill="#fff"/>`]);
// 12 Horus: the falcon god's eye; its markings are the peregrine's tear stripe
I.push(['12', 'Horus', `${tile('#1d3b8a')}<g fill="none" stroke="${C.gold}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 34 C40 26 80 26 112 32"/><path d="M14 56 C34 40 76 40 106 54 L118 54"/><path d="M14 56 C34 70 76 72 106 54"/><path d="M58 70 V104"/><path d="M76 70 C80 86 92 98 102 96 C110 94 110 84 102 82 C96 82 94 88 98 92"/></g><circle cx="60" cy="54" r="11" fill="${C.gold}"/>`]);
// 13 Pixel: the head in 16 by 16
{ const map = ['................', '....KKKKKK......', '..KKKKKKKKKK....', '.KKKKKKKKKKKK...', '.KKKKKKKYYKKKSS.', '.KKKKKKYEEYKSSSS', '.KKWWKKKYYKKSS.S', '.KKWWWKKKKKWW...',
    '.KKWWWWKKKWWW...', '..KWWWWKKWWWW...', '..KKWWWKKWWWW...', '...KKWWKKWWWWW..', '...KKKWKKWWWWW..', '....KKKKKWWWWW..', '....KKKKKWWWWW..', '....KKKKKWWWWW..'];
  const col = { K: C.hood, W: C.cream, Y: C.gold, E: '#0d0d0d', S: C.beak };
  I.push(['13', 'Pixel', `<g shape-rendering="crispEdges">${map.flatMap((r, y) => [...r].map((ch, x) => col[ch] ? `<rect x="${x * 8}" y="${y * 8}" width="8" height="8" fill="${col[ch]}"/>` : '')).join('')}</g>`]); }
// 14 Chevrons: wings as stacked speed chevrons, a head on top
I.push(['14', 'Chevrons', `<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="11"><path d="M10 66 L64 40 L118 66" stroke="${C.hood}"/><path d="M24 90 L64 70 L104 90" stroke="${C.slate}"/><path d="M40 112 L64 100 L88 112" stroke="${C.orange}"/></g><circle cx="64" cy="24" r="12" fill="${C.hood}"/><path d="M70 20 L82 26 L70 30Z" fill="${C.gold}"/>`]);
// 15 Sunset badge: the head in silhouette against a low sun
I.push(['15', 'Sunset badge', `<defs>${lg('$s', ['#ffcf6b', '#ff6a00', '#b5122b'])}<clipPath id="$c"><circle cx="64" cy="64" r="58"/></clipPath></defs><circle cx="64" cy="64" r="58" fill="url(#$s)"/><g clip-path="url(#$c)">${place(`<path d="${HEAD}" fill="${C.hood}"/><circle cx="82" cy="47" r="6" fill="#ffcf6b"/>`, 60, 76, 1.05)}</g>`]);
// 16 Origami: a folded paper falcon in flight
I.push(['16', 'Origami', `<path d="M64 60 L6 36 L44 76Z" fill="#7d9cd0"/><path d="M64 60 L122 36 L84 76Z" fill="#4a6aa8"/><path d="M54 64 L64 48 L74 64 L64 104Z" fill="#a9c0e6"/><path d="M64 48 L74 64 L64 104Z" fill="#8aa6d8"/><path d="M58 98 L64 122 L70 98Z" fill="${C.slate}"/>
<path d="M58 50 L64 34 L70 50Z" fill="${C.hood}"/><path d="M64 34 L72 38 L66 42Z" fill="${C.gold}"/>`]);
// 17 Bolt: the falcon over a lightning strike
I.push(['17', 'Bolt', `${tile('#120c2c')}<path d="M70 6 L40 64 H62 L48 122 L92 50 H68 L84 6Z" fill="${C.gold}"/>${place(fly(C.cream, `<path d="M64 26 C67 26 70 30 70 36 L58 36 C58 30 61 26 64 26Z" fill="${C.hood}"/>`), 64, 60, .8)}`]);
// 18 Quill: a barred falcon feather cut into a pen
I.push(['18', 'Quill', `<defs><clipPath id="$v"><path d="M108 8 C80 14 50 40 34 86 L44 92 C66 60 92 36 108 8Z"/></clipPath></defs><path d="M108 8 C80 14 50 40 34 86 L44 92 C66 60 92 36 108 8Z" fill="${C.cream}" stroke="${C.slate}" stroke-width="2"/>
<g clip-path="url(#$v)" stroke="${C.slate}" stroke-width="5">${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${40 + i * 12} ${100 - i * 15} l20 6"/>`).join('')}</g><path d="M108 8 C86 30 60 60 38 96 L24 120" stroke="${C.hood}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M28 112 L20 124 L32 116Z" fill="${C.hood}"/><circle cx="16" cy="120" r="4" fill="${C.orange}"/>`]);
// 19 F head: the letter F, its top bar ending in a hooked beak
I.push(['19', 'F head', `<path d="M28 16 H92 C104 16 112 24 112 36 L104 44 C102 38 98 36 92 36 H50 V56 H82 V74 H50 V116 H28Z" fill="${C.hood}"/><path d="M92 16 C104 16 112 24 112 36 L104 44 C102 38 98 36 92 36Z" fill="${C.beak}"/><circle cx="76" cy="26" r="5.5" fill="${C.gold}"/><circle cx="76" cy="26" r="3" fill="#0d0d0d"/>`]);
// 20 Wing fan: one wing, its primaries spread like a fan
{ const f = Array.from({ length: 7 }, (_, i) => { const a = -95 + i * 13; return `<ellipse cx="0" cy="-44" rx="8" ry="44" fill="${['#1b2a4a', '#2c3d60', '#3b4c72', '#4a5a78', '#5c6d8c', '#7384a2', '#8d9cb8'][i]}" transform="rotate(${a + 90})"/>`; }).join('');
  I.push(['20', 'Wing fan', `<g transform="translate(22 106)">${f}<g stroke="${C.cream}" stroke-width="2" opacity=".7">${Array.from({ length: 7 }, (_, i) => `<path d="M0 -20 V-80" transform="rotate(${-5 + i * 13})"/>`).join('')}</g></g><circle cx="22" cy="106" r="12" fill="${C.orange}"/>`]); }

const cards = I.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r1-${n}.svg`), svg(`fa${n}-`, `Falcon — ${t}`, b)); return { n, t }; });
const fig = (src, cap) => `<figure>${[128, 48, 28, 16].map(z => `<img src="${src}" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${cap}</figcaption></figure>`;
const row = () => cards.map(c => fig(`icon-r1-${c.n}.svg`, `${c.n} · ${c.t}`)).join('');
writeFileSync(join(dir, 'preview-round1.html'), `<!doctype html><meta charset="utf-8"><title>Falcon icons, round 1</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}</style>
<section class="light">${row()}</section><section class="dark">${row()}</section>\n`);
console.log('wrote ' + cards.length);
