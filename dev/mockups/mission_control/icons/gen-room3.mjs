// Mission Control icons, round 5: variants on round 4's 28 (the big board with a lamp per script under the emblem),
// moving the lamps clear of the operator's head. Writes room3-01..15.svg and preview-room3.html (96, 48, 28, 16 px on white and black).
//   node dev/mockups/mission_control/icons/gen-room3.mjs
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
// round 4's 28: the big board, the emblem on it, a lamp per script; o tweaks it
const lamp = (x, y, c, r = 4.5, glow = false) => `${glow ? `<circle cx="${x}" cy="${y}" r="${r + 3}" fill="${c}" opacity=".35"/>` : ''}<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const ROW = [37, 55, 73, 91].map((x, i) => [x, 64, FOUR[i]]);
const SIDES = [[32, 28, OR], [32, 50, GR], [96, 28, GOLD], [96, 50, P]];
const CORNERS = [[28, 16, OR], [100, 16, GR], [28, 62, GOLD], [100, 62, P]];
const big = (o = {}) => { const k = { lamps: ROW, r: 4.5, glow: false, frame: NAVY, hexS: 1, links: false, set: false, operator: true, extra: '', bx: 18, by: 6, bw: 92, bh: 66, deskY: 98, opY: 126, ...o };
  const cx = k.bx + k.bw / 2, cy = k.by + k.bh / 2;
  return `${board(k.bx, k.by, k.bw, k.bh, k.hexS, k.frame)}${k.links ? `<g stroke="${GOLD}" stroke-width="2.5" stroke-linecap="round">${k.lamps.map(([x, y]) => `<path d="M${cx} ${cy} L${x} ${y}"/>`).join('')}</g>${hex(cx, cy, k.hexS)}` : ''}${k.lamps.map(([x, y, c]) => lamp(x, y, c, k.r, k.glow)).join('')}${k.extra}${desk(k.deskY)}${k.operator ? op(64, k.opY, 1, k.set) : ''}`; };
const I = [];
I.push(['28 as it is', big()]);
I.push(['lamps spread clear of the head', big({ lamps: [[28, 64, OR], [42, 64, GR], [86, 64, GOLD], [100, 64, P]] })]);
I.push(['lamps along the top', big({ lamps: [[37, 16, OR], [55, 16, GR], [73, 16, GOLD], [91, 16, P]].map(([x, y, c]) => [x, y - 1, c]), by: 4, bh: 68, extra: '' })]);
I.push(['lamps either side of the emblem', big({ lamps: SIDES })]);
I.push(['bigger lamps either side', big({ lamps: SIDES.map(([x, y, c]) => [x - 2, y, c]), r: 6.5 })]);
I.push(['lamps in the corners', big({ lamps: CORNERS })]);
I.push(['lamps glowing', big({ lamps: SIDES, glow: true })]);
I.push(['lamps linked to the emblem', big({ lamps: SIDES.map(([x, y, c]) => [x < 64 ? 28 : 100, y, c]), links: true, r: 5.5 })]);
I.push(['lamps round the emblem', big({ lamps: [[38, 18, OR], [90, 18, GR], [38, 60, GOLD], [90, 60, P]], links: true, r: 5.5 })]);
I.push(['lamps either side, with headset', big({ lamps: SIDES, set: true })]);
I.push(['lamps either side, gold frame', big({ lamps: SIDES, frame: GOLD })]);
I.push(['lamps either side, bigger emblem', big({ lamps: [[28, 24, OR], [28, 54, GR], [100, 24, GOLD], [100, 54, P]], hexS: 1.25, r: 5.5 })]);
I.push(['lamps either side, no one at the desk', big({ lamps: [[30, 30, OR], [30, 54, GR], [98, 30, GOLD], [98, 54, P]], operator: false, by: 10, bh: 72, hexS: 1.2, r: 5.5, deskY: 104 })]);
I.push(['row of lamps, operator lower', big({ opY: 132, lamps: ROW.map(([x, y, c]) => [x, 62, c]) })]);
I.push(['lamps as script bars', big({ lamps: [], extra: [[26, OR], [36, GR], [84, GOLD], [94, P]].map(([x, c], i) => `<rect x="${x}" y="${[30, 22, 26, 34][i]}" width="7" height="${[30, 38, 34, 26][i]}" rx="3" fill="${c}"/>`).join('') })]);

const cards = I.map(([t, b], i) => { const n = String(i + 1).padStart(2, '0'); writeFileSync(join(dir, `room3-${n}.svg`), svg(`mcr${n}-`, `Mission Control — ${t}`, b)); return { n, t }; });
const fig = c => `<figure>${[96, 48, 28, 16].map(z => `<img src="room3-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-room3.html'), `<!doctype html><meta charset="utf-8"><title>Mission Control icons, round 5</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
.light{background:#fff;color:#222}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}</style>
${sec('light', 'White')}${sec('dark', 'Black')}\n`);
console.log('wrote ' + cards.length);
