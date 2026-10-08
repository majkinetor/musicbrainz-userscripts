// Falcon icons, round 3: the Falcon as a car — a classic 60s/70s sedan and coupe, and the bird where a car would wear it.
// Generic cars, no maker's badges or names.
// Writes icon-r3-01..20.svg and preview-round3.html (128, 48, 28, 16 px on white and black).
//   node dev/mockups/falcon_icons/gen-round3.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const tile = (fill, rx = 26) => `<rect x="4" y="4" width="120" height="120" rx="${rx}" fill="${fill}"/>`;
const clipTile = (id, rx = 26) => `<clipPath id="${id}"><rect x="4" y="4" width="120" height="120" rx="${rx}"/></clipPath>`;
const place = (inner, x, y, s, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s}) translate(-64 -64)">${inner}</g>`;
const C = { hood: '#1b2a4a', slate: '#4a5a78', cream: '#f6efe2', gold: '#f5c518', orange: '#ff6a00', chrome: '#d9dde4', tyre: '#16181d' };
// the falcon from below, wings spread (from round 1)
const RH = 'M64 26 C67 26 70 30 70 36 C72 40 74 42 76 44 C92 42 108 36 124 34 C112 44 96 54 78 62 C76 68 74 74 74 80 L80 100 C74 104 68 104 64 104 Z';
const bird = c => `<path d="${RH}" fill="${c}"/><path d="${RH}" fill="${c}" transform="translate(128 0) scale(-1 1)"/>`;

// Side view, facing right. Fastback coupe or square-roofed sedan; wheels at x 34 and 96.
const BODY = {
  coupe: 'M8 82 L10 70 C12 66 18 64 28 63 L46 62 L60 48 C62 46 65 45 69 45 L86 45 C90 45 93 47 95 50 L104 61 L116 63 C120 64 121 68 121 72 L121 82 C121 85 119 86 116 86 L108 86 A12 12 0 0 0 84 86 L46 86 A12 12 0 0 0 22 86 L12 86 C9 86 8 84 8 82Z',
  sedan: 'M8 82 L9 70 C10 66 14 65 24 64 L38 63 L50 47 C51 46 52 46 54 46 L90 46 C92 46 93 46 94 47 L104 63 L116 64 C120 65 121 68 121 72 L121 82 C121 85 119 86 116 86 L108 86 A12 12 0 0 0 84 86 L46 86 A12 12 0 0 0 22 86 L12 86 C9 86 8 84 8 82Z' };
const GLASS = { coupe: 'M48 61 L61 50 C63 49 65 49 68 49 L84 49 C87 49 89 50 91 52 L100 61Z', sedan: 'M41 62 L52 50 H91 L100 62Z' };
const ROOF = { coupe: 'M60 48 C62 46 65 45 69 45 L86 45 C90 45 93 47 95 50 L91 52 C89 50 87 49 84 49 L68 49 C65 49 63 49 61 50Z', sedan: 'M50 47 L94 47 L91 50 H52Z' };
const wheel = (x, o) => `<circle cx="${x}" cy="86" r="11" fill="${o.tyre}"/><circle cx="${x}" cy="86" r="6" fill="${o.rim}"/><circle cx="${x}" cy="86" r="2" fill="${o.tyre}"/>`;
const car = (o = {}) => { const k = { shape: 'coupe', body: '#1f6f8b', roof: null, glass: '#bfe3f2', pillar: true, tyre: C.tyre, rim: C.chrome, stripe: null, scoop: false, bumper: C.chrome, light: '#ffe9a3', tail: '#e63946', ...k0(o) };
  return `<path d="${BODY[k.shape]}" fill="${k.body}"/>${k.roof ? `<path d="${ROOF[k.shape]}" fill="${k.roof}"/>` : ''}<path d="${GLASS[k.shape]}" fill="${k.glass}"/>${k.pillar ? `<path d="M${k.shape === 'coupe' ? 78 : 72} 49 V62" stroke="${k.body}" stroke-width="3"/>` : ''}
${k.stripe ? `<path d="M10 72 H121" stroke="${k.stripe}" stroke-width="3.5"/>` : ''}${k.scoop ? `<path d="M104 61 L108 57 H116 L117 63Z" fill="${C.tyre}"/>` : ''}<rect x="113" y="66" width="8" height="5" rx="1.5" fill="${k.light}"/><rect x="8" y="68" width="5" height="5" rx="1.5" fill="${k.tail}"/>
<path d="M6 80 H16 M114 80 H123" stroke="${k.bumper}" stroke-width="3.5" stroke-linecap="round"/>${wheel(34, k)}${wheel(96, k)}`; };
const k0 = o => o;
const I = [];

// 01 Sixties sedan: two-tone, white roof, chrome
I.push(['01', 'Sixties sedan', place(car({ shape: 'sedan', body: '#2a9d8f', roof: '#f6efe2', stripe: C.chrome }), 64, 66, .98)]);
// 02 Muscle coupe: black, a red stripe, scoop through the bonnet
I.push(['02', 'Muscle coupe', place(car({ body: '#16181d', glass: '#5d6b7a', stripe: '#d62828', scoop: true, rim: '#8b939e', light: '#fff' }), 64, 66, .98)]);
// 03 Grille: head on, quad lights and a chrome grille
{ const bars = [0, 1, 2, 3].map(i => `<path d="M30 ${70 + i * 4} H98" stroke="#9aa3ae" stroke-width="1.6"/>`).join('');
  I.push(['03', 'Grille', `<path d="M30 56 L42 30 C43 28 45 27 47 27 H81 C83 27 85 28 86 30 L98 56Z" fill="#1f6f8b"/><path d="M36 54 L46 33 H82 L92 54Z" fill="#bfe3f2"/><rect x="12" y="54" width="104" height="38" rx="8" fill="#1f6f8b"/>
<rect x="28" y="66" width="72" height="18" rx="3" fill="#2a2f38"/>${bars}<circle cx="21" cy="68" r="5.5" fill="#ffe9a3" stroke="${C.chrome}" stroke-width="2"/><circle cx="21" cy="81" r="4.5" fill="#ffe9a3" stroke="${C.chrome}" stroke-width="2"/><circle cx="107" cy="68" r="5.5" fill="#ffe9a3" stroke="${C.chrome}" stroke-width="2"/><circle cx="107" cy="81" r="4.5" fill="#ffe9a3" stroke="${C.chrome}" stroke-width="2"/>
<rect x="8" y="90" width="112" height="8" rx="4" fill="${C.chrome}"/><rect x="16" y="98" width="18" height="14" rx="3" fill="${C.tyre}"/><rect x="94" y="98" width="18" height="14" rx="3" fill="${C.tyre}"/>${place(bird(C.gold), 64, 60, .16)}`]); }
// 04 Hood ornament: a chrome falcon on the bonnet's nose
I.push(['04', 'Hood ornament', `<defs>${lg('$c', ['#ffffff', '#9aa3ae', '#e9edf2', '#6c7480'], 1, 1)}${lg('$h', ['#2a9d8f', '#145c54'])}</defs><path d="M0 128 V96 C30 84 98 84 128 96 V128Z" fill="url(#$h)"/><path d="M8 94 C40 84 88 84 120 94" stroke="#7fd1c6" stroke-width="2" fill="none"/>
<path d="M58 92 L64 80 L70 92Z" fill="url(#$c)"/>${place(bird('url(#$c)'), 64, 56, .82, -8)}${place(`<path d="${RH}" fill="none" stroke="#5c6470" stroke-width="2"/><path d="${RH}" fill="none" stroke="#5c6470" stroke-width="2" transform="translate(128 0) scale(-1 1)"/>`, 64, 56, .82, -8)}`]);
// 05 Winged coupe: the car sprouts falcon wings
I.push(['05', 'Winged coupe', `${place(`<path d="M74 48 C62 26 42 10 14 2 C30 20 46 36 58 52Z" fill="${C.hood}"/><path d="M80 47 C74 26 62 10 42 0 C52 18 60 34 64 50Z" fill="#7d8cab"/>` + car({ body: '#4a5a78', stripe: C.gold }), 64, 70, .9, -6)}<g stroke="#b8c4da" stroke-width="3" stroke-linecap="round"><path d="M6 104 H24 M10 112 H34"/></g>`]);
// 06 Racer: a roundel, stripes and speed lines
I.push(['06', 'Racer', `<g stroke="#ff6a00" stroke-width="4" stroke-linecap="round"><path d="M2 58 H14 M0 68 H10 M4 78 H16"/></g>${place(car({ body: '#f6efe2', stripe: null, glass: '#2a2f38', rim: '#ff6a00', bumper: '#16181d' }) + '<path d="M10 66 H121" stroke="#ff6a00" stroke-width="5"/><path d="M10 73 H121" stroke="#1b2a4a" stroke-width="3"/><circle cx="66" cy="72" r="9" fill="#fff" stroke="#16181d" stroke-width="2"/><text x="66" y="76.5" text-anchor="middle" font-family="Arial Black,Helvetica,sans-serif" font-weight="900" font-size="12" fill="#16181d">1</text>', 66, 66, .96)}`]);
// 07 Beak nose: the coupe's nose is a falcon's head
I.push(['07', 'Beak nose', place(`<path d="${BODY.coupe}" fill="${C.hood}"/><path d="${GLASS.coupe}" fill="#bfe3f2"/><path d="M104 61 L116 63 C121 64 126 70 126 78 L120 82 C119 77 116 74 112 74 L104 74Z" fill="#5b6b80"/><path d="M100 61 C104 61 106 64 106 68 L100 70Z" fill="${C.gold}"/>
<path d="M96 66 C92 72 90 80 92 86 H84 C84 78 86 70 92 64Z" fill="${C.cream}"/><circle cx="98" cy="57" r="4.5" fill="${C.gold}"/><circle cx="98" cy="57" r="2.6" fill="#0d0d0d"/>${wheel(34, { tyre: C.tyre, rim: C.chrome })}${wheel(96, { tyre: C.tyre, rim: C.chrome })}`, 62, 66, .98)]);
// 08 Into the sunset: the rear of the car on an empty road
I.push(['08', 'Into the sunset', `<defs>${clipTile('$c')}${lg('$s', ['#2a1a52', '#c2448f', '#ff8c3b'])}</defs><g clip-path="url(#$c)"><rect width="128" height="128" fill="url(#$s)"/><circle cx="64" cy="70" r="24" fill="#ffd24a"/><rect x="0" y="70" width="128" height="58" fill="#2b2238"/><path d="M58 70 L10 128 H118 L70 70Z" fill="#3d3450"/><path d="M64 74 V82 M64 90 V102 M64 110 V128" stroke="#ffd24a" stroke-width="3"/>
<path d="M36 112 V96 C36 92 38 90 42 90 L46 80 H82 L86 90 C90 90 92 92 92 96 V112Z" fill="#16181d"/><path d="M48 82 H80 L83 89 H45Z" fill="#5d6b7a"/><circle cx="44" cy="99" r="4" fill="#ff3b3b"/><circle cx="84" cy="99" r="4" fill="#ff3b3b"/><rect x="54" y="102" width="20" height="5" fill="#f6efe2"/><rect x="36" y="112" width="10" height="8" fill="#0b0c0f"/><rect x="82" y="112" width="10" height="8" fill="#0b0c0f"/></g>`]);
// 09 Emblem: a winged roundel with a car inside, like an old boot badge
I.push(['09', 'Emblem', `<path d="M40 64 C28 52 14 50 2 52 C14 58 22 62 28 68 C18 68 10 70 4 74 C16 76 28 76 40 72Z" fill="${C.chrome}" stroke="#6c7480" stroke-width="1.5"/><path d="M88 64 C100 52 114 50 126 52 C114 58 106 62 100 68 C110 68 118 70 124 74 C112 76 100 76 88 72Z" fill="${C.chrome}" stroke="#6c7480" stroke-width="1.5"/>
<circle cx="64" cy="66" r="28" fill="#b5122b" stroke="${C.chrome}" stroke-width="5"/>${place(car({ shape: 'sedan', body: '#f6efe2', glass: '#b5122b', pillar: false, rim: '#f6efe2', tyre: '#f6efe2', bumper: '#f6efe2', light: '#f6efe2', tail: '#f6efe2' }), 64, 68, .36)}`]);
// 10 Pixel: an 8-bit coupe
{ const map = ['................', '................', '................', '......KKKKK.....', '.....KGGKGGK....', '....KGGGKGGGK...', '.RRRRRRRRRRRRRR.', 'YRRRRRRRRRRRRRRW', '.RRRRRRRRRRRRRR.', '.RRKKKRRRRRKKKR.', '...KSK.....KSK..', '....K.......K...', '................', '................', '................', '................'];
  const col = { K: C.tyre, G: '#bfe3f2', R: '#d62828', Y: '#ffd24a', W: '#ffffff', S: C.chrome };
  I.push(['10', 'Pixel', `${tile('#1b2a4a', 16)}<g shape-rendering="crispEdges" transform="translate(0 16)">${map.flatMap((r, y) => [...r].map((ch, x) => col[ch] ? `<rect x="${x * 8}" y="${y * 8}" width="8" height="8" fill="${col[ch]}"/>` : '')).join('')}</g><g fill="#fff"><rect x="16" y="16" width="4" height="4"/><rect x="100" y="24" width="4" height="4"/><rect x="60" y="12" width="4" height="4"/></g>`]); }
// 11 Blueprint: the coupe drawn up, with its wheelbase
I.push(['11', 'Blueprint', `<defs><pattern id="$p" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0 H0 V8" fill="none" stroke="#3d78c4" stroke-width=".6"/></pattern></defs>${tile('#1f5aa6', 12)}${tile('url(#$p)', 12)}
${place(`<path d="${BODY.coupe}" fill="none" stroke="#fff" stroke-width="2"/><path d="${GLASS.coupe}" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="34" cy="86" r="11" fill="none" stroke="#fff" stroke-width="2"/><circle cx="96" cy="86" r="11" fill="none" stroke="#fff" stroke-width="2"/><path d="M34 74 V98 M96 74 V98" stroke="#cfe3ff" stroke-width="1" stroke-dasharray="2 2"/>`, 64, 58, .9)}
<g stroke="#cfe3ff" stroke-width="1.2"><path d="M33 100 H93 M33 96 V104 M93 96 V104"/></g><text x="63" y="114" text-anchor="middle" font-family="monospace" font-size="9" fill="#cfe3ff">2794 mm</text>`]);
// 12 Toy: round and squat, big wheels
I.push(['12', 'Toy', `<path d="M14 88 C10 70 20 62 36 60 L44 42 C46 38 50 36 56 36 H76 C82 36 86 38 88 42 L96 60 C112 62 120 70 114 88Z" fill="#ff6a00"/><path d="M48 58 L54 44 H64 V58Z M70 44 H76 C79 44 81 46 82 48 L86 58 H70Z" fill="#bfe3f2"/><circle cx="104" cy="72" r="5" fill="#ffe9a3"/>
<circle cx="38" cy="90" r="17" fill="${C.tyre}"/><circle cx="38" cy="90" r="8" fill="${C.chrome}"/><circle cx="92" cy="90" r="17" fill="${C.tyre}"/><circle cx="92" cy="90" r="8" fill="${C.chrome}"/><path d="M44 30 C50 22 60 20 66 24" stroke="#ff6a00" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/>`]);
// 13 Round tail-lights: the back of the car, twin round lamps each side
I.push(['13', 'Round tail-lights', `<path d="M28 52 L38 30 H90 L100 52Z" fill="#1f6f8b"/><path d="M34 50 L42 34 H86 L94 50Z" fill="#5d8fa3"/><rect x="10" y="50" width="108" height="42" rx="8" fill="#1f6f8b"/><rect x="10" y="62" width="108" height="18" fill="#17556b"/>
${[22, 40, 88, 106].map(x => `<circle cx="${x}" cy="71" r="7.5" fill="#e63946" stroke="${C.chrome}" stroke-width="2.5"/><circle cx="${x}" cy="71" r="2.5" fill="#ffb3b8"/>`).join('')}<rect x="54" y="64" width="20" height="13" rx="2" fill="#f6efe2"/><rect x="6" y="90" width="116" height="8" rx="4" fill="${C.chrome}"/><rect x="14" y="98" width="18" height="14" rx="3" fill="${C.tyre}"/><rect x="96" y="98" width="18" height="14" rx="3" fill="${C.tyre}"/>`]);
// 14 Speedo: a speedometer whose needle is a diving falcon
{ const ticks = Array.from({ length: 11 }, (_, i) => { const a = (150 + i * 24) * Math.PI / 180; const r1 = i % 2 ? 44 : 40; return `<path d="M${(64 + 50 * Math.cos(a)).toFixed(1)} ${(70 + 50 * Math.sin(a)).toFixed(1)} L${(64 + r1 * Math.cos(a)).toFixed(1)} ${(70 + r1 * Math.sin(a)).toFixed(1)}"/>`; }).join('');
  I.push(['14', 'Speedo', `<circle cx="64" cy="70" r="58" fill="#16181d" stroke="${C.chrome}" stroke-width="5"/><path d="M${(64 + 50 * Math.cos(5.76)).toFixed(1)} ${(70 + 50 * Math.sin(5.76)).toFixed(1)} A50 50 0 0 1 ${(64 + 50 * Math.cos(0.52)).toFixed(1)} ${(70 + 50 * Math.sin(0.52)).toFixed(1)}" stroke="#e63946" stroke-width="6" fill="none"/>
<g stroke="#f6efe2" stroke-width="3" stroke-linecap="round">${ticks}</g><g transform="translate(64 70) rotate(40)"><path d="M0 -46 C4 -36 6 -20 6 0 L-6 0 C-6 -20 -4 -36 0 -46Z" fill="${C.orange}"/></g>${place(bird('#f6efe2'), 64, 70, .2)}<circle cx="64" cy="70" r="5" fill="${C.orange}"/>`]); }
// 15 Monoline: the coupe as one line
I.push(['15', 'Monoline', place(`<g fill="none" stroke="${C.hood}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"><path d="${BODY.coupe}"/><path d="${GLASS.coupe}"/><circle cx="34" cy="86" r="7"/><circle cx="96" cy="86" r="7"/></g><path d="M10 72 H121" stroke="${C.orange}" stroke-width="4"/>`, 64, 66, .98)]);
// 16 Top down: the car from above, twin stripes over the roof
I.push(['16', 'Top down', `${tile('#3a3f47', 20)}<path d="M64 4 V124" stroke="#f6efe2" stroke-width="3" stroke-dasharray="10 8"/><g transform="translate(36 0)"><rect x="-18" y="18" width="36" height="92" rx="12" fill="#d62828"/><rect x="-21" y="28" width="4" height="16" rx="2" fill="${C.tyre}"/><rect x="17" y="28" width="4" height="16" rx="2" fill="${C.tyre}"/><rect x="-21" y="84" width="4" height="16" rx="2" fill="${C.tyre}"/><rect x="17" y="84" width="4" height="16" rx="2" fill="${C.tyre}"/>
<path d="M-14 46 H14 L11 56 H-11Z" fill="#2a2f38"/><path d="M-12 82 H12 L10 76 H-10Z" fill="#2a2f38"/><rect x="-6" y="18" width="4" height="92" fill="#f6efe2"/><rect x="2" y="18" width="4" height="92" fill="#f6efe2"/><rect x="-14" y="18" width="7" height="4" fill="#ffe9a3"/><rect x="7" y="18" width="7" height="4" fill="#ffe9a3"/></g>
<g transform="translate(94 40)"><rect x="-12" y="0" width="24" height="60" rx="8" fill="#5d6b7a" opacity=".55"/></g>`]);
// 17 Convoy: a fleet of coupes in staggered lanes, the pool of workers
I.push(['17', 'Convoy', `${tile('#eef3f8')}${[[0, 30, '#1f6f8b'], [1, 64, '#ff6a00'], [2, 98, '#4a5a78']].map(([i, y, c]) => `<path d="M8 ${y + 12} H120" stroke="#cfd8e3" stroke-width="2" stroke-dasharray="6 5"/>${place(car({ body: c, rim: C.chrome }), [72, 50, 84][i], y, .42)}`).join('')}`]);
// 18 Synthwave: a neon coupe on a grid under a striped sun
{ let grid = 'M4 84 H124'; for (let t = .15; t < 1; t += .22) grid += ` M4 ${(84 + 40 * t * t * 1.4).toFixed(1)} H124`; for (let i = -4; i <= 4; i++) grid += ` M${64 + i * 6} 84 L${64 + i * 30} 128`;
  I.push(['18', 'Synthwave', `<defs>${clipTile('$c')}${lg('$sun', ['#ffe14d', '#ff4fa3'])}</defs><g clip-path="url(#$c)"><rect width="128" height="128" fill="#1a0b33"/><circle cx="64" cy="60" r="30" fill="url(#$sun)"/>${[64, 70, 76, 81].map((y, i) => `<rect x="30" y="${y}" width="68" height="${1.5 + i}" fill="#1a0b33"/>`).join('')}<rect x="0" y="84" width="128" height="44" fill="#1a0b33"/><path d="${grid}" stroke="#ff4fd8" stroke-width="1.2" fill="none"/>
${place(`<path d="${BODY.coupe}" fill="#1a0b33" stroke="#39d0ff" stroke-width="3"/><path d="${GLASS.coupe}" fill="#2a1450" stroke="#39d0ff" stroke-width="2"/><circle cx="34" cy="86" r="9" fill="#1a0b33" stroke="#ff4fd8" stroke-width="3"/><circle cx="96" cy="86" r="9" fill="#1a0b33" stroke="#ff4fd8" stroke-width="3"/>`, 64, 86, .72)}</g>`]); }
// 19 Plate: a vintage number plate
I.push(['19', 'Plate', `<rect x="4" y="34" width="120" height="60" rx="8" fill="#f5c518" stroke="#16181d" stroke-width="4"/><rect x="11" y="41" width="106" height="46" rx="4" fill="none" stroke="#16181d" stroke-width="1.5"/><circle cx="18" cy="48" r="2.5" fill="#16181d"/><circle cx="110" cy="48" r="2.5" fill="#16181d"/>
<text x="64" y="78" text-anchor="middle" font-family="Arial Narrow,Arial,Helvetica,sans-serif" font-weight="700" font-size="30" letter-spacing="1" fill="#16181d">FALCON</text><text x="64" y="50" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="6.5" letter-spacing="2" fill="#16181d">BATCH EDITS</text>`]);
// 20 Wheel: a three-spoke steering wheel, the falcon on the horn
I.push(['20', 'Wheel', `<circle cx="64" cy="64" r="54" fill="none" stroke="#16181d" stroke-width="11"/><circle cx="64" cy="64" r="54" fill="none" stroke="#3a3f47" stroke-width="2"/><path d="M14 58 C34 54 48 56 52 62 M114 58 C94 54 80 56 76 62 M64 80 V116" stroke="${C.chrome}" stroke-width="9" stroke-linecap="round" fill="none"/>
<circle cx="64" cy="66" r="20" fill="#16181d" stroke="${C.chrome}" stroke-width="3"/>${place(bird(C.gold), 64, 66, .27)}`]);

const cards = I.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r3-${n}.svg`), svg(`fa3${n}-`, `Falcon — ${t}`, b)); return { n, t }; });
const fig = (src, cap) => `<figure>${[128, 48, 28, 16].map(z => `<img src="${src}" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${cap}</figcaption></figure>`;
const row = () => cards.map(c => fig(`icon-r3-${c.n}.svg`, `${c.n} · ${c.t}`)).join('');
writeFileSync(join(dir, 'preview-round3.html'), `<!doctype html><meta charset="utf-8"><title>Falcon icons, round 3</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}</style>
<section class="light">${row()}</section><section class="dark">${row()}</section>\n`);
console.log('wrote ' + cards.length);
