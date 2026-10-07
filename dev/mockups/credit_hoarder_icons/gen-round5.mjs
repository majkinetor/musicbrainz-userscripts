// Credit Hoarder icons, round 5: twenty more styles and no music notes. A credit here is a
// person's card, tag or badge; the hoarders keep stacks of them.
// Writes icon-r5-01..20.svg and preview-round5.html (128, 48, 16 px on white and black).
//   node dev/mockups/credit_hoarder_icons/gen-round5.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const rg = (id, stops, cx = .35, cy = .3, r = .8) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</radialGradient>`;
// a person card: a head-and-shoulders avatar and two lines
const card = (x, y, w, h, bg, fg, rot = 0, extra = '') => `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h * .14}" fill="${bg}" ${extra}/><circle cx="${x + h * .32}" cy="${y + h * .38}" r="${h * .15}" fill="${fg}"/><path d="M${x + h * .1} ${y + h * .82} C${x + h * .12} ${y + h * .58} ${x + h * .52} ${y + h * .58} ${x + h * .54} ${y + h * .82}Z" fill="${fg}"/><path d="M${x + h * .7} ${y + h * .38} H${x + w - h * .16} M${x + h * .7} ${y + h * .64} H${x + w * .72}" stroke="${fg}" stroke-width="${h * .1}" stroke-linecap="round"/></g>`;
const I = [];

// 01 Material: a rolodex of person cards
I.push(['01', 'Material rolodex', `<defs><filter id="$s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-opacity=".25"/></filter></defs>
<rect x="18" y="98" width="92" height="14" rx="4" fill="#37474f"/><path d="M28 98 L38 70 M100 98 L90 70" stroke="#546e7a" stroke-width="6" stroke-linecap="round"/>
${[0, 1, 2].map(i => `<g filter="url(#$s)">${card(22 + i * 4, 30 + i * 14, 84 - i * 8, 44, ['#ffca28', '#26a69a', '#ef5350'][i], '#fff')}</g>`).join('')}<circle cx="64" cy="76" r="5" fill="#263238"/>`]);
// 02 Risograph: a raccoon with a loot sack, two inks misregistered
{ const shape = c => `<path d="M30 104 C22 80 30 54 52 50 C50 40 56 30 66 30 C78 30 84 40 82 50 C102 54 108 80 100 104Z" fill="${c}"/><path d="M50 48 C56 56 76 56 82 48 C80 60 52 60 50 48Z" fill="#1d1d1d" opacity=".0"/>`;
  I.push(['02', 'Risograph raccoon', `<rect x="4" y="4" width="120" height="120" rx="8" fill="#f7f0e3"/><g style="mix-blend-mode:multiply"><g transform="translate(-3 -2)" opacity=".9">${shape('#ff48b0')}<circle cx="94" cy="88" r="22" fill="#ff48b0"/></g>
<g transform="translate(2 2)" opacity=".85"><path d="M48 40 C54 34 78 34 84 40 L88 52 C78 46 54 46 44 52Z" fill="#0078bf"/><path d="M44 52 C56 58 76 58 88 52 L86 62 C76 66 56 66 46 62Z" fill="#0078bf"/><circle cx="56" cy="56" r="4" fill="#f7f0e3"/><circle cx="76" cy="56" r="4" fill="#f7f0e3"/><path d="M50 36 L46 22 L58 32 M82 36 L86 22 L74 32" fill="#0078bf"/>
<path d="M84 72 C82 64 106 64 104 72 C116 80 116 106 94 108 C74 108 72 82 84 72Z" fill="#0078bf"/><path d="M88 70 L100 70" stroke="#f7f0e3" stroke-width="3"/></g></g>`]); }
// 03 Memphis: a card-catalogue drawer, squiggles and confetti
I.push(['03', 'Memphis catalogue', `<rect x="4" y="4" width="120" height="120" rx="10" fill="#fdf0d5"/><path d="M14 22 q6 -8 12 0 t12 0 t12 0" stroke="#ff006e" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="104" cy="22" r="7" fill="#3a86ff"/><path d="M98 104 l10 -14 l10 14z" fill="#ffbe0b"/>
<rect x="22" y="36" width="84" height="76" rx="4" fill="#3a86ff" stroke="#111" stroke-width="4"/>${[0, 1].map(r => [0, 1].map(c => `<rect x="${30 + c * 38}" y="${44 + r * 34}" width="30" height="26" rx="3" fill="#fdf0d5" stroke="#111" stroke-width="3"/><rect x="${39 + c * 38}" y="${58 + r * 34}" width="12" height="5" rx="2.5" fill="#111"/><rect x="${38 + c * 38}" y="${49 + r * 34}" width="14" height="6" fill="#ff006e"/>`).join('')).join('')}
<rect x="30" y="14" width="30" height="26" rx="3" fill="#ffbe0b" stroke="#111" stroke-width="3" transform="rotate(-12 45 27)"/>`]);
// 04 Neumorphism: a soft vault door
I.push(['04', 'Soft vault', `<defs><filter id="$n" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="-5" dy="-5" stdDeviation="4" flood-color="#ffffff"/><feDropShadow dx="5" dy="5" stdDeviation="4" flood-color="#a3b1c6"/></filter>${lg('$d', ['#e3e9f2', '#c7d1df'], 1, 1)}</defs>
<rect x="4" y="4" width="120" height="120" rx="28" fill="#e0e5ec"/><circle cx="64" cy="64" r="42" fill="#e0e5ec" filter="url(#$n)"/><circle cx="64" cy="64" r="30" fill="url(#$d)"/>
${[0, 1, 2, 3, 4, 5].map(i => { const a = i * Math.PI / 3; return `<path d="M64 64 L${(64 + Math.cos(a) * 22).toFixed(1)} ${(64 + Math.sin(a) * 22).toFixed(1)}" stroke="#7d8ba3" stroke-width="5" stroke-linecap="round"/>`; }).join('')}<circle cx="64" cy="64" r="8" fill="#7d8ba3"/><circle cx="64" cy="64" r="4" fill="#4a6cf7"/>`]);
// 05 Gradient line: a honeycomb whose cells are packed
{ const hex = (cx, cy, r) => `M${[0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 6 + i * Math.PI / 3; return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(' L')}Z`;
  const cells = [[64, 64], [64, 34], [64, 94], [38, 49], [90, 49], [38, 79], [90, 79]];
  I.push(['05', 'Gradient-line honeycomb', `<defs>${lg('$g', ['#f9a826', '#f3722c', '#d00070'], 1, 1)}</defs>${cells.map(([x, y], i) => `<path d="${hex(x, y, 16)}" fill="${i % 3 === 0 ? 'url(#$g)' : 'none'}" fill-opacity=".9" stroke="url(#$g)" stroke-width="4.5" stroke-linejoin="round"/>`).join('')}`]); }
// 06 Folk art: an octopus holding a card in every arm
I.push(['06', 'Folk octopus', `<rect x="4" y="4" width="120" height="120" rx="60" fill="#1d3557"/>${[[-50, 0], [-28, 1], [-8, 2], [12, 0], [32, 1], [52, 2]].map(([dx, k]) => `<path d="M${64 + dx * .3} 66 C${64 + dx * .5} 86 ${64 + dx} 90 ${64 + dx * .9} 104" stroke="#e63946" stroke-width="8" fill="none" stroke-linecap="round"/><rect x="${64 + dx * .9 - 7}" y="98" width="14" height="18" rx="2" fill="${['#f1faee', '#a8dadc', '#ffd166'][k]}"/>`).join('')}
<ellipse cx="64" cy="50" rx="30" ry="28" fill="#e63946"/><circle cx="54" cy="52" r="6" fill="#f1faee"/><circle cx="74" cy="52" r="6" fill="#f1faee"/><circle cx="55" cy="53" r="3" fill="#1d3557"/><circle cx="75" cy="53" r="3" fill="#1d3557"/>
<g fill="#f1faee">${[[50, 34], [64, 30], [78, 34]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5"/>`).join('')}</g><path d="M40 44 q6 -4 8 2 M88 44 q-6 -4 -8 2" stroke="#ffd166" stroke-width="2.5" fill="none"/>`]);
// 07 Pop art: a fanned hand of person cards over Ben-Day dots
{ let d = ''; for (let y = 6; y < 124; y += 8) for (let x = 6 + (y / 8 % 2) * 4; x < 124; x += 8) d += `<circle cx="${x}" cy="${y}" r="2.4"/>`;
  I.push(['07', 'Pop art cards', `<rect x="4" y="4" width="120" height="120" rx="8" fill="#ffe600"/><g fill="#ff3d7f" opacity=".6">${d}</g>
${[-22, -8, 6, 20].map((r, i) => `<g transform="rotate(${r} 64 112)"><rect x="44" y="30" width="40" height="58" rx="5" fill="#fff" stroke="#111" stroke-width="3.5"/><circle cx="64" cy="50" r="8" fill="${['#111', '#2962ff', '#ff1744', '#111'][i]}"/><path d="M52 74 C52 62 76 62 76 74Z" fill="${['#111', '#2962ff', '#ff1744', '#111'][i]}"/></g>`).join('')}`]); }
// 08 Cel-shaded: a squirrel's tree hollow, stuffed with tags
I.push(['08', 'Cel-shaded tree hollow', `<rect x="22" y="4" width="84" height="124" fill="#8d5a3b"/><rect x="22" y="4" width="22" height="124" fill="#6e4329"/><path d="M84 4 V128" stroke="#a9744f" stroke-width="5"/>
<ellipse cx="64" cy="64" rx="28" ry="34" fill="#2a1a10"/><ellipse cx="64" cy="64" rx="28" ry="34" fill="none" stroke="#4a2c1a" stroke-width="5"/>
${[[46, 52, -18, '#ffd166'], [58, 70, 10, '#ef476f'], [50, 82, -6, '#06d6a0'], [64, 48, 14, '#118ab2']].map(([x, y, r, c]) => `<g transform="rotate(${r} ${x + 14} ${y + 7})"><path d="M${x + 6} ${y} H${x + 30} V${y + 14} H${x + 6} L${x} ${y + 7}Z" fill="${c}" stroke="#1a0f08" stroke-width="2.5"/><path d="M${x + 6} ${y + 9} H${x + 30} V${y + 14} H${x + 6}Z" fill="#000" opacity=".2"/></g>`).join('')}`]);
// 09 1-bit Mac: a stack of ID badges in black-and-white pixels
{ const px = ['..##########....', '..#........#....', '.###########....', '.#.........#....', '############....', '#..........#....', '#.##...###.#....', '#.##.......#....', '#.....####.#....', '#..........#....', '############....'];
  let r = ''; px.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') r += `<rect x="${18 + x * 7 + 14}" y="${24 + y * 7}" width="7.2" height="7.2" fill="#000"/>`; }));
  I.push(['09', '1-bit badges', `<rect x="4" y="4" width="120" height="120" rx="4" fill="#fff" stroke="#000" stroke-width="4"/>${r}`]); }
// 10 Felt plush: a stitched hamster with a bulging cheek pouch
I.push(['10', 'Felt plush', `<defs><filter id="$f"><feTurbulence baseFrequency=".9" numOctaves="2" seed="5" result="t"/><feColorMatrix in="t" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .25 0" result="g"/><feComposite in="g" in2="SourceGraphic" operator="in" result="n"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="n"/></feMerge></filter></defs>
<g filter="url(#$f)"><ellipse cx="64" cy="72" rx="48" ry="44" fill="#d4a373"/><circle cx="34" cy="34" r="12" fill="#d4a373"/><circle cx="94" cy="34" r="12" fill="#d4a373"/><circle cx="34" cy="34" r="6" fill="#e5989b"/><circle cx="94" cy="34" r="6" fill="#e5989b"/><ellipse cx="96" cy="84" rx="22" ry="20" fill="#e9c46a"/><ellipse cx="40" cy="84" rx="14" ry="12" fill="#faedcd"/></g>
<g fill="none" stroke="#5e3b1e" stroke-width="2" stroke-dasharray="3 3"><ellipse cx="64" cy="72" rx="44" ry="40"/><ellipse cx="96" cy="84" rx="18" ry="16"/></g><path d="M44 58 l8 8 m0 -8 l-8 8 M72 58 l8 8 m0 -8 l-8 8" stroke="#3d2614" stroke-width="3" stroke-linecap="round"/><path d="M60 74 q4 4 8 0" stroke="#3d2614" stroke-width="2.5" fill="none"/>`]);
// 11 Voxel: an isometric block chest overflowing with cubes
{ const vox = (x, y, c) => { const p = (dx, dy) => `${x + dx} ${y + dy}`; return `<path d="M${p(0, 0)} L${p(8, -4.6)} L${p(16, 0)} L${p(8, 4.6)}Z" fill="${c[0]}"/><path d="M${p(0, 0)} L${p(8, 4.6)} V${y + 13.6} L${x} ${y + 9}Z" fill="${c[1]}"/><path d="M${p(16, 0)} L${p(8, 4.6)} V${y + 13.6} L${x + 16} ${y + 9}Z" fill="${c[2]}"/>`; };
  const W = ['#c08552', '#8c5a2b', '#5e3c1d'], G = ['#ffe066', '#f5b700', '#c99400'], B = ['#9bf6ff', '#4cc9f0', '#3a86c8'], R = ['#ffadad', '#ff6b6b', '#d64545']; let v = '';
  for (let k = 0; k < 3; k++) for (let j = 2; j >= 0; j--) for (let i = 0; i < 4; i++) v += vox(28 + i * 8 + j * 8 + 0, 70 - i * 4.6 + j * 4.6 - k * 9, W);
  [[0, 0, G], [1, 1, B], [2, 0, R], [1, 0, G], [3, 1, G], [2, 2, B]].forEach(([i, j, c]) => { v += vox(28 + i * 8 + j * 8, 70 - i * 4.6 + j * 4.6 - 27, c); });
  v += vox(52, 34, G) + vox(44, 30, R);
  I.push(['11', 'Voxel chest', v]); }
// 12 Constructivist: a red wedge driving into a stack of cards
I.push(['12', 'Constructivist', `<rect x="4" y="4" width="120" height="120" fill="#f0e6d2"/><path d="M4 100 L84 52 L84 76Z" fill="#d62828"/>${[0, 1, 2, 3].map(i => `<rect x="${78 + i * 3}" y="${28 + i * 16}" width="38" height="12" fill="#111" transform="rotate(${-8 + i * 5} ${97} ${34 + i * 16})"/>`).join('')}<circle cx="34" cy="34" r="18" fill="#111"/><path d="M4 116 H124" stroke="#d62828" stroke-width="6"/>`]);
// 13 Heraldry: a shield with crossed keys and a crown
I.push(['13', 'Heraldic crest', `<path d="M24 22 H104 V64 C104 92 84 110 64 120 C44 110 24 92 24 64Z" fill="#1d3a8a" stroke="#d4a017" stroke-width="5"/><path d="M64 22 V120" stroke="#d4a017" stroke-width="0"/>
<g stroke="#f1d27a" stroke-width="6" stroke-linecap="round"><path d="M42 94 L86 46 M86 94 L42 46"/></g><g fill="none" stroke="#f1d27a" stroke-width="5"><circle cx="88" cy="42" r="8"/><circle cx="40" cy="42" r="8"/></g><path d="M38 96 l-6 -2 m10 -2 l-6 -4 M90 96 l6 -2 m-10 -2 l6 -4" stroke="#f1d27a" stroke-width="4" stroke-linecap="round"/>
<path d="M46 16 L52 4 L58 12 L64 2 L70 12 L76 4 L82 16Z" fill="#d4a017"/>`]);
// 14 Stamp album: a page of perforated portrait stamps
{ const stamp = (x, y, c, f) => { let p = ''; for (let i = 0; i <= 6; i++) p += `<circle cx="${x + i * 5.33}" cy="${y}" r="1.8" fill="#f5efe0"/><circle cx="${x + i * 5.33}" cy="${y + 40}" r="1.8" fill="#f5efe0"/>`; for (let i = 0; i <= 7; i++) p += `<circle cx="${x}" cy="${y + i * 5.7}" r="1.8" fill="#f5efe0"/><circle cx="${x + 32}" cy="${y + i * 5.7}" r="1.8" fill="#f5efe0"/>`;
    return `<rect x="${x}" y="${y}" width="32" height="40" fill="#fff"/><rect x="${x + 4}" y="${y + 4}" width="24" height="32" fill="${c}"/><circle cx="${x + 16}" cy="${y + 16}" r="6" fill="${f}"/><path d="M${x + 6} ${y + 34} C${x + 6} ${y + 24} ${x + 26} ${y + 24} ${x + 26} ${y + 34}Z" fill="${f}"/>${p}`; };
  I.push(['14', 'Stamp album', `<rect x="4" y="4" width="120" height="120" rx="6" fill="#f5efe0" stroke="#9c7a4a" stroke-width="3"/>${stamp(14, 14, '#e76f51', '#3d1f12')}${stamp(50, 14, '#2a9d8f', '#0e2f2b')}${stamp(86, 14, '#e9c46a', '#4a3a10')}${stamp(14, 70, '#264653', '#e9f5f2')}${stamp(50, 70, '#f4a261', '#4a2510')}<rect x="86" y="70" width="32" height="40" fill="none" stroke="#c9b48a" stroke-width="2" stroke-dasharray="4 3"/>`]); }
// 15 Bricks: a stack of toy bricks
{ const brick = (x, y, w, c, d) => `<rect x="${x}" y="${y}" width="${w}" height="18" rx="2" fill="${c}"/>${Array.from({ length: w / 16 }, (_, i) => `<rect x="${x + 4 + i * 16}" y="${y - 5}" width="9" height="6" rx="1.5" fill="${c}"/><rect x="${x + 4 + i * 16}" y="${y - 2}" width="9" height="3" fill="${d}"/>`).join('')}<rect x="${x}" y="${y + 14}" width="${w}" height="4" fill="${d}"/>`;
  I.push(['15', 'Toy bricks', `${brick(16, 96, 96, '#e3000b', '#a30008')}${brick(32, 72, 64, '#0055bf', '#003a85')}${brick(16, 48, 48, '#ffcd03', '#c9a100')}${brick(64, 48, 48, '#00852b', '#005c1e')}${brick(40, 24, 48, '#ff7e14', '#c25d08')}`]); }
// 16 Holographic: an iridescent foil person card
I.push(['16', 'Holographic card', `<defs>${lg('$h', ['#ff9de2', '#b0f3f1', '#fff5b7', '#c8a8ff', '#9ef0c3'], 1, 1)}${lg('$sh', ['rgba(255,255,255,0)', 'rgba(255,255,255,.8)', 'rgba(255,255,255,0)'], 1, 0)}</defs>
<g transform="rotate(-8 64 64)"><rect x="18" y="26" width="92" height="66" rx="10" fill="url(#$h)" stroke="#5b4b8a" stroke-width="3"/><rect x="18" y="26" width="92" height="66" rx="10" fill="url(#$sh)" opacity=".7"/>
<circle cx="44" cy="52" r="10" fill="#5b4b8a"/><path d="M28 82 C28 66 60 66 60 82Z" fill="#5b4b8a"/><path d="M68 50 H98 M68 62 H90 M68 74 H96" stroke="#5b4b8a" stroke-width="5" stroke-linecap="round"/><path d="M88 34 l4 -6 l4 6 l-4 6z" fill="#fff"/></g>`]);
// 17 Doodle: a sketchy loot sack, wobbly double strokes
I.push(['17', 'Doodle sack', `<defs><filter id="$d"><feTurbulence baseFrequency=".05" numOctaves="2" seed="9"/><feDisplacementMap in="SourceGraphic" scale="4"/></filter></defs><rect x="4" y="4" width="120" height="120" rx="12" fill="#fffef6"/>
<g filter="url(#$d)" fill="none" stroke="#222" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M44 40 C30 56 22 76 26 94 C30 112 98 112 102 94 C106 76 98 56 84 40"/><path d="M45 42 C31 58 24 78 28 95 M83 42 C97 58 104 78 100 95"/><path d="M44 40 C54 46 74 46 84 40 M48 32 L44 40 M80 32 L84 40 M50 34 C58 30 70 30 78 34"/>
<rect x="46" y="16" width="20" height="14" rx="2" transform="rotate(-14 56 23)"/><rect x="64" y="12" width="20" height="14" rx="2" transform="rotate(10 74 19)"/><path d="M56 70 l8 8 l12 -14"/></g><path d="M50 24 h8 M68 18 h8" stroke="#e63946" stroke-width="3"/>`]);
// 18 Flat ant: an ant carrying a tag bigger than itself
I.push(['18', 'Ant with a tag', `<rect x="4" y="4" width="120" height="120" rx="24" fill="#c7f9cc"/><path d="M4 100 H124" stroke="#57cc99" stroke-width="5"/>
<g fill="#22223b"><ellipse cx="30" cy="80" rx="14" ry="10"/><circle cx="50" cy="76" r="8"/><circle cx="66" cy="70" r="10"/></g><g stroke="#22223b" stroke-width="3.5" stroke-linecap="round" fill="none"><path d="M26 86 l-6 12 M34 88 l2 12 M46 82 l-4 16 M52 84 l8 14 M72 62 C78 52 86 48 92 48 M70 62 C72 52 70 44 64 40"/></g>
<g transform="rotate(-18 92 40)"><path d="M84 22 H120 V48 H84 L74 35Z" fill="#ff6b35" stroke="#22223b" stroke-width="3"/><circle cx="82" cy="35" r="3" fill="#22223b"/><path d="M90 30 H114 M90 40 H106" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></g>`]);
// 19 Name badges: overlapping "hello" stickers with portrait dots, no words
I.push(['19', 'Name badges', `${[[10, 14, -12, '#e63946'], [30, 40, 6, '#457b9d'], [16, 68, -4, '#2a9d8f']].map(([x, y, r, c]) => `<g transform="rotate(${r} ${x + 44} ${y + 26})"><rect x="${x}" y="${y}" width="88" height="54" rx="8" fill="${c}" stroke="#1d1d1d" stroke-width="3"/><rect x="${x + 6}" y="${y + 18}" width="76" height="30" rx="3" fill="#fff"/><path d="M${x + 14} ${y + 10} H${x + 40}" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M${x + 16} ${y + 34} c8 -10 14 6 22 -2 s14 -6 22 2" stroke="#1d1d1d" stroke-width="3" fill="none" stroke-linecap="round"/></g>`).join('')}`]);
// 20 Retro magnet: a horseshoe magnet pulling cards in
I.push(['20', 'Magnet', `<rect x="4" y="4" width="120" height="120" rx="20" fill="#fef3c7"/><path d="M24 24 V58 C24 82 64 82 64 58 V24" fill="none" stroke="#dc2626" stroke-width="16"/><path d="M24 24 V34 M64 24 V34" stroke="#d1d5db" stroke-width="16"/>
<g stroke="#f59e0b" stroke-width="3" stroke-linecap="round" fill="none"><path d="M72 50 q6 -4 12 0 M72 62 q8 -4 16 0"/></g>${card(80, 30, 40, 26, '#2563eb', '#fff', 16)}${card(84, 62, 36, 24, '#059669', '#fff', -10)}${card(70, 92, 40, 26, '#7c3aed', '#fff', 6)}`]);

const cards = I.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r5-${n}.svg`), svg(`f${n}`, `Credit Hoarder — ${t}`, b)); return { n, t }; });
const row = () => cards.map(c => `<figure>${[128, 48, 16].map(z => `<img src="icon-r5-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`).join('');
writeFileSync(join(dir, 'preview-round5.html'), `<!doctype html><meta charset="utf-8"><title>Credit Hoarder icons, round 5</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}</style>
<section class="light">${row()}</section><section class="dark">${row()}</section>\n`);
console.log('wrote ' + cards.length);
