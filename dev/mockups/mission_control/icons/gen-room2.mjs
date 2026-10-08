// Mission Control icons, round 4: variants on round 3's 03 (the night window), 15 (every script on its own screen)
// and 19 (the big board). Writes room2-01..30.svg and preview-room2.html (96, 48, 28, 16 px on white and black).
//   node dev/mockups/mission_control/icons/gen-room2.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const NAVY = '#1b2559', DESK = '#2b3a8f', SCR = '#24479e', GLOW = '#5ec8ff', P = '#7a57e8', PD = '#4b2e83', PL = '#b9a8ec', GOLD = '#ffc94a', OR = '#f3722c', GR = '#2ea44f', RED = '#e63946', SKYN = '#101a4a', EARTH = '#2d7be0';
const HALO = '<filter id="$h" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="d"/><feFlood flood-color="#fff" flood-opacity=".7"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n<defs>${HALO}</defs><g filter="url(#$h)">${b}</g>`.replaceAll('$', id) + '\n</svg>\n';
const at = (x, y, s, inner) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;
const f1 = v => +v.toFixed(1);
const hexPts = (r, rot = -90) => Array.from({ length: 6 }, (_, i) => { const a = (i * 60 + rot) * Math.PI / 180; return `${f1(r * Math.cos(a))} ${f1(r * Math.sin(a))}`; }).join(' L');

// the bundle's emblem: a purple hexagon with a pair of beamed notes, radius 20 at scale 1, centred on 0,0
const NOTE = `<path d="M-5 6 V-11 L8 -15 V2" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/><path d="M-5 -11 L8 -15 V-10 L-5 -6Z" fill="#fff"/><ellipse cx="-9" cy="6" rx="5" ry="4" fill="#fff" transform="rotate(-20 -9 6)"/><ellipse cx="4" cy="2" rx="5" ry="4" fill="#fff" transform="rotate(-20 4 2)"/>`;
const hex = (x, y, s = 1, glow = false) => at(x, y, s, `${glow ? `<circle r="30" fill="${GLOW}" opacity=".25"/>` : ''}<path d="M${hexPts(20)}Z" fill="${P}" stroke="${PD}" stroke-width="3" stroke-linejoin="round"/><path d="M${hexPts(20)}Z" fill="none"/><path d="M0 -20 L17.3 -10 L17.3 10 L0 20Z" fill="${PD}" opacity=".35"/>${NOTE}`);
// a screen: dark-blue glass with glowing lines; kind = text | bars | wave
const screenBody = (w, h, kind) => { const L = `stroke="${GLOW}" stroke-width="2.4" stroke-linecap="round" fill="none"`;
  const c = kind === 'bars' ? [.2, .35, .5, .65, .8].map((p, i) => `<path d="M${f1(w * p)} ${f1(h * .8)} V${f1(h * (.75 - [.3, .5, .2, .45, .35][i]))}" ${L}/>`).join('')
    : kind === 'wave' ? `<path d="M${f1(w * .15)} ${f1(h * .55)} L${f1(w * .35)} ${f1(h * .35)} L${f1(w * .5)} ${f1(h * .65)} L${f1(w * .7)} ${f1(h * .3)} L${f1(w * .85)} ${f1(h * .45)}" ${L}/>`
    : `<path d="M${f1(w * .18)} ${f1(h * .3)} H${f1(w * .75)} M${f1(w * .18)} ${f1(h * .52)} H${f1(w * .6)} M${f1(w * .18)} ${f1(h * .74)} H${f1(w * .68)}" ${L}/>`;
  return `<rect width="${w}" height="${h}" rx="3" fill="${SCR}" stroke="${NAVY}" stroke-width="3"/>${c}`; };
const screen = (x, y, w, h, kind = 'text') => `<g transform="translate(${x} ${y})">${screenBody(w, h, kind)}</g>`;
// the console: desk 100 wide centred on 0, its top edge at 0; three screens above it unless told otherwise
const console_ = (o = {}) => { const k = { screens: true, lamps: true, mid: 'bars', ...o };
  return `${k.screens ? `${screen(-50, -30, 30, 24, 'text')}${screen(-17, -34, 34, 28, k.mid)}${screen(20, -30, 30, 24, 'text')}` : ''}
<path d="M-56 0 H56 L48 22 H-48Z" fill="${NAVY}"/><rect x="-56" y="-4" width="112" height="7" rx="3" fill="${DESK}"/>${k.lamps ? `<g><circle cx="-36" cy="11" r="3" fill="${GOLD}"/><circle cx="-26" cy="11" r="3" fill="${GR}"/><circle cx="26" cy="11" r="3" fill="${PL}"/><circle cx="36" cy="11" r="3" fill="${OR}"/></g>` : ''}`; };
// the operator from behind, in the chair: bottom at 0, centred on 0
const OP = `<circle cx="0" cy="-36" r="10" fill="#3a3f8f"/><path d="M-19 0 V-16 Q-19 -26 0 -26 Q19 -26 19 -16 V0Z" fill="${PD}"/><rect x="-17" y="-16" width="34" height="18" rx="7" fill="#3b3f9a"/>`;
const OPSET = `<circle cx="0" cy="-36" r="10" fill="#3a3f8f"/><path d="M-11 -38 A11 11 0 0 1 11 -38" fill="none" stroke="${GOLD}" stroke-width="3"/><circle cx="-11" cy="-36" r="3.5" fill="${GOLD}"/><circle cx="11" cy="-36" r="3.5" fill="${GOLD}"/><path d="M-19 0 V-16 Q-19 -26 0 -26 Q19 -26 19 -16 V0Z" fill="${PD}"/><rect x="-17" y="-16" width="34" height="18" rx="7" fill="#3b3f9a"/>`;
// drawn big enough that the head stands against the bright screens, not the dark desk
const op = (x, y, s = 1, set = false) => at(x, y, s < 1.5 ? s * 1.3 : s, set ? OPSET : OP);
// lines from the emblem out to the scripts, each script a coloured node
const node = (x, y, c, r = 6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${NAVY}" stroke-width="2.5"/>`;
const spokes = (x0, y0, pts) => `<g stroke="${GOLD}" stroke-width="3.5" stroke-linecap="round">${pts.map(([x, y]) => `<path d="M${x0} ${y0} L${x} ${y}"/>`).join('')}</g>${pts.map(([x, y, c]) => node(x, y, c)).join('')}`;
const stars = (pts, c = '#fff') => pts.map(([x, y, r = 2]) => `<path d="M${x} ${y - r * 2} L${x + r * .5} ${y - r * .5} L${x + r * 2} ${y} L${x + r * .5} ${y + r * .5} L${x} ${y + r * 2} L${x - r * .5} ${y + r * .5} L${x - r * 2} ${y} L${x - r * .5} ${y - r * .5}Z" fill="${c}"/>`).join('');
const disc = (r = 60, fill = SKYN) => `<circle cx="64" cy="64" r="${r}" fill="${fill}" stroke="${P}" stroke-width="5"/>`;
const clipDisc = (id, r = 58) => `<clipPath id="$${id}"><circle cx="64" cy="64" r="${r}"/></clipPath>`;
const hexBadge = `<path d="M64 4 L116 34 L116 94 L64 124 L12 94 L12 34Z" fill="${SKYN}" stroke="${P}" stroke-width="6" stroke-linejoin="round"/>`;
// a script's screen: lit in its colour, a white glyph on it
const GLYPH = { check: '<path d="M-6 0 L-2 4 L6 -5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>', wave: '<path d="M-7 0 L-3 -5 L1 4 L7 -3" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>', bars: '<path d="M-5 5 V0 M0 5 V-5 M5 5 V-2" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/>', lines: '<path d="M-6 -3 H6 M-6 3 H3" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>' };
const tileS = (x, y, w, h, c, g) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${c}" stroke="${NAVY}" stroke-width="3"/>${g ? `<g transform="translate(${x + w / 2} ${y + h / 2}) scale(${Math.min(w, h) / 22})">${GLYPH[g]}</g>` : ''}`;
const FOUR = [OR, GR, GOLD, P], G4 = ['check', 'wave', 'bars', 'lines'];
const lines4 = (x0, y0, pts, dash = false) => `<g stroke="${GOLD}" stroke-width="3" stroke-linecap="round"${dash ? ' stroke-dasharray="3 4"' : ''}>${pts.map(([x, y]) => `<path d="M${x0} ${y0} L${x} ${y}"/>`).join('')}</g>`;
const board = (x, y, w, h, s = .95, frame = NAVY) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${SCR}" stroke="${frame}" stroke-width="4"/>${hex(x + w / 2, y + h / 2, s)}`;
const desk = (y = 96) => at(64, y, 1, console_({ screens: false }));
// round 3's 03: a round window on the night over the Earth's rim; o tweaks it
const night = (o = {}) => { const k = { frame: P, sky: SKYN, rim: 92, hexY: 34, hexS: .85, glow: false, land: false, screens: false, set: false, operator: true, extra: '', ...o };
  return `<defs>${clipDisc('c')}</defs>${disc(60, k.sky).replace(`stroke="${P}"`, `stroke="${k.frame}"`)}<g clip-path="url(#$c)">${stars([[24, 40], [100, 36, 2.5], [34, 70, 1.5], [96, 64, 1.5]])}${k.extra}${hex(64, k.hexY, k.hexS, k.glow)}
<path d="M-10 ${k.rim} Q64 ${k.rim - 32} 138 ${k.rim} V140 H-10Z" fill="${EARTH}"/>${k.land ? `<path d="M20 ${k.rim - 12} Q36 ${k.rim - 22} 50 ${k.rim - 16} Q58 ${k.rim - 8} 46 ${k.rim}Z M84 ${k.rim - 18} Q98 ${k.rim - 18} 108 ${k.rim - 8} L96 ${k.rim}Z" fill="${GR}"/>` : ''}<path d="M-10 ${k.rim} Q64 ${k.rim - 32} 138 ${k.rim}" fill="none" stroke="${GLOW}" stroke-width="3"/>
${at(64, 100, .9, console_({ screens: k.screens }))}${k.operator ? op(64, 126, .9, k.set) : ''}</g>`; };
const I = [];

// 03 and its variants: the night window
I.push(['03 as it is', night()]);
I.push(['03, bigger emblem', night({ hexY: 38, hexS: 1.15 })]);
I.push(['03, emblem glowing', night({ glow: true, hexS: 1 })]);
I.push(['03, land on the Earth', night({ land: true })]);
I.push(['03, gold rim', night({ frame: GOLD })]);
I.push(['03, purple sky', night({ sky: PD })]);
I.push(['03, screens on the desk', night({ screens: true, hexY: 28, hexS: .75 })]);
I.push(['03, scripts as coloured stars', night({ extra: `${lines4(64, 34, [[22, 58], [42, 64], [86, 64], [106, 58]])}${[[22, 58], [42, 64], [86, 64], [106, 58]].map(([x, y], i) => node(x, y, FOUR[i], 5)).join('')}` })]);
I.push(['03, with headset', night({ set: true })]);
I.push(['03, no one at the desk', night({ operator: false, hexY: 40, hexS: 1.1 })]);

// 15 and its variants: every script on its own screen
I.push(['15 as it is', `${hex(64, 22, .85)}${FOUR.map((c, i) => tileS(9 + i * 30, 48, 22, 22, c)).join('')}${lines4(64, 40, [[20, 48], [50, 48], [78, 48], [108, 48]])}${desk(82)}${op(64, 124, 1.1)}`]);
I.push(['15, a glyph per script', `${hex(64, 22, .85)}${FOUR.map((c, i) => tileS(9 + i * 30, 48, 22, 22, c, G4[i])).join('')}${lines4(64, 40, [[20, 48], [50, 48], [78, 48], [108, 48]])}${desk(82)}${op(64, 124, 1.1)}`]);
I.push(['15, bigger screens, no lines', `${hex(64, 20, .8)}${FOUR.map((c, i) => tileS(4 + i * 31, 40, 27, 30, c, G4[i])).join('')}${desk(84)}${op(64, 124, 1.1)}`]);
I.push(['15, screens in an arc', `${hex(64, 22, .85)}${[[6, 58, -14], [34, 46, -5], [66, 46, 5], [94, 58, 14]].map(([x, y, r], i) => `<g transform="rotate(${r} ${x + 14} ${y + 12})">${tileS(x, y, 28, 24, FOUR[i], G4[i])}</g>`).join('')}${desk(92)}${op(64, 126, 1)}`]);
I.push(['15, emblem on the middle screen', `${tileS(4, 36, 24, 26, OR, 'check')}${tileS(100, 36, 24, 26, GOLD, 'bars')}${tileS(30, 30, 18, 32, GR, 'wave')}${tileS(80, 30, 18, 32, P, 'lines')}${board(50, 16, 28, 46, .62)}${desk(84)}${op(64, 124, 1.1)}`]);
I.push(['15, three scripts', `${hex(64, 20, .8)}${[OR, GR, GOLD].map((c, i) => tileS(8 + i * 39, 42, 34, 30, c, G4[i])).join('')}${lines4(64, 36, [[25, 42], [64, 42], [103, 42]])}${desk(86)}${op(64, 124, 1.1)}`]);
I.push(['15, dashed links', `${hex(64, 22, .85)}${FOUR.map((c, i) => tileS(9 + i * 30, 50, 22, 22, c, G4[i])).join('')}${lines4(64, 40, [[20, 50], [50, 50], [78, 50], [108, 50]], true)}${desk(84)}${op(64, 124, 1.1)}`]);
I.push(['15, dark screens, coloured lamps', `${hex(64, 22, .85)}${FOUR.map((c, i) => `${screen(8 + i * 30, 46, 24, 26, 'text')}<circle cx="${20 + i * 30}" cy="44" r="5" fill="${c}" stroke="${NAVY}" stroke-width="2.5"/>`).join('')}${desk(84)}${op(64, 124, 1.1)}`]);
I.push(['15, no one at the desk', `${hex(64, 22, 1)}${FOUR.map((c, i) => tileS(6 + i * 30, 56, 26, 28, c, G4[i])).join('')}${lines4(64, 44, [[19, 56], [49, 56], [79, 56], [109, 56]])}${desk(98)}`]);
I.push(['15, 2 × 2 wall', `${hex(64, 18, .75)}${tileS(26, 34, 36, 24, OR, 'check')}${tileS(66, 34, 36, 24, GR, 'wave')}${tileS(26, 61, 36, 24, GOLD, 'bars')}${tileS(66, 61, 36, 24, P, 'lines')}${desk(96)}${op(64, 126, 1)}`]);

// 19 and its variants: the big board
I.push(['19 as it is', `${screen(4, 24, 28, 36, 'text')}${screen(96, 24, 28, 36, 'wave')}${board(34, 10, 60, 56)}${desk()}${op(64, 124, 1)}`]);
I.push(['19, script-coloured side screens', `${tileS(4, 24, 28, 36, OR, 'check')}${tileS(96, 24, 28, 36, GR, 'wave')}${board(34, 10, 60, 56)}${desk()}${op(64, 124, 1)}`]);
I.push(['19, four side screens', `${tileS(4, 12, 26, 26, OR, 'check')}${tileS(4, 42, 26, 26, GR, 'wave')}${tileS(98, 12, 26, 26, GOLD, 'bars')}${tileS(98, 42, 26, 26, P, 'lines')}${board(34, 10, 60, 58)}${desk()}${op(64, 124, 1)}`]);
I.push(['19, bigger board', `${screen(2, 30, 22, 30, 'text')}${screen(104, 30, 22, 30, 'wave')}${board(26, 6, 76, 64, 1.2)}${desk(98)}${op(64, 126, 1)}`]);
I.push(['19, gold frame', `${screen(4, 24, 28, 36, 'text')}${screen(96, 24, 28, 36, 'wave')}${board(34, 10, 60, 56, .95, GOLD)}${desk()}${op(64, 124, 1)}`]);
I.push(['19, with headset', `${screen(4, 24, 28, 36, 'text')}${screen(96, 24, 28, 36, 'wave')}${board(34, 10, 60, 56)}${desk()}${op(64, 124, 1, true)}`]);
I.push(['19, angled side screens', `<path d="M2 18 L32 26 V60 L2 66Z" fill="${SCR}" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/><path d="M126 18 L96 26 V60 L126 66Z" fill="${SCR}" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/><path d="M8 34 L24 37 M8 44 L22 46 M120 34 L104 37 M120 44 L106 46" stroke="${GLOW}" stroke-width="2.4" stroke-linecap="round"/>${board(34, 10, 60, 56)}${desk()}${op(64, 124, 1)}`]);
I.push(['19, script lamps under the emblem', `${board(18, 6, 92, 66, 1)}${FOUR.map((c, i) => `<circle cx="${37 + i * 18}" cy="64" r="4.5" fill="${c}"/>`).join('')}${desk(98)}${op(64, 126, 1)}`]);
I.push(['19, links out to the side screens', `${tileS(4, 30, 24, 30, OR, 'check')}${tileS(100, 30, 24, 30, GR, 'wave')}<g stroke="${GOLD}" stroke-width="3" stroke-linecap="round"><path d="M28 45 H38 M90 45 H100"/></g>${board(38, 10, 52, 56, .9)}${desk()}${op(64, 124, 1)}`]);
I.push(['19, no one at the desk', `${screen(4, 28, 28, 36, 'text')}${screen(96, 28, 28, 36, 'wave')}${board(34, 12, 60, 60, 1.05)}${desk(104)}`]);

const cards = I.map(([t, b], i) => { const n = String(i + 1).padStart(2, '0'); writeFileSync(join(dir, `room2-${n}.svg`), svg(`mcq${n}-`, `Mission Control — ${t}`, b)); return { n, t }; });
const fig = c => `<figure>${[96, 48, 28, 16].map(z => `<img src="room2-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-room2.html'), `<!doctype html><meta charset="utf-8"><title>Mission Control icons, round 4</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
.light{background:#fff;color:#222}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}</style>
${sec('light', 'White')}${sec('dark', 'Black')}\n`);
console.log('wrote ' + cards.length);
