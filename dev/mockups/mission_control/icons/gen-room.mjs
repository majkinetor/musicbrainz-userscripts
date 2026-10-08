// Mission Control icons, round 3: the control room. One central place, overseen by somebody: an operator, seen from
// behind, at a console of screens, the bundle's purple hexagon with its note overhead, lines out to the scripts.
// After majkinetor's reference sketches. Bundle style: flat, bold, light halo on the ink for dark pages.
// Writes room-01..20.svg and preview-room.html (96, 48, 28, 16 px on white and black).
//   node dev/mockups/mission_control/icons/gen-room.mjs
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
const I = [];

// 01 The desk: the operator at the console, the emblem overhead (sketch 4)
I.push(['The desk', `${hex(64, 26, 1)}<path d="M64 46 V58" stroke="${GOLD}" stroke-width="4"/>${at(64, 90, 1, console_())}${op(64, 124, .95)}`]);
// 02 Halo arc: a gold arc spans the room, the emblem at its top (sketch 1)
I.push(['Halo arc', `<path d="M12 92 A52 64 0 0 1 116 92" fill="none" stroke="${GOLD}" stroke-width="5" stroke-linecap="round"/>${hex(64, 30, 1)}${at(64, 92, 1, console_())}${op(64, 124, .95)}`]);
// 03 Night window: a round window on the night, the Earth's rim, the operator at the desk (sketch 2)
I.push(['Night window', `<defs>${clipDisc('c')}</defs>${disc()}<g clip-path="url(#$c)"><path d="M-10 92 Q64 60 138 92 V140 H-10Z" fill="${EARTH}"/><path d="M-10 92 Q64 60 138 92" fill="none" stroke="${GLOW}" stroke-width="3"/>${stars([[24, 40], [100, 36, 2.5], [34, 70, 1.5], [96, 64, 1.5]])}${hex(64, 34, .85)}${at(64, 100, .9, console_({ screens: false }))}${op(64, 126, .9)}</g>`]);
// 04 Hex badge: the room inside a hexagon, a gold arc behind the operator (sketch 3)
I.push(['Hex badge', `${hexBadge}${stars([[34, 32], [96, 30, 1.6], [26, 60, 1.4]])}<path d="M28 92 A36 46 0 0 1 100 92" fill="none" stroke="${GOLD}" stroke-width="3.5"/>${hex(64, 34, .75)}${at(64, 96, .8, console_({ lamps: false }))}${op(64, 120, .85)}`]);
// 05 Hub: the emblem with lines to every script, the console below (the big sketch)
I.push(['Hub', `<defs>${clipDisc('c')}</defs>${disc()}<g clip-path="url(#$c)">${spokes(64, 30, [[22, 52, OR], [44, 62, GR], [84, 62, GOLD], [106, 52, GLOW]])}${hex(64, 28, .8, true)}${at(64, 104, .9, console_({ screens: true, lamps: false }))}${op(64, 132, .9)}</g>`]);
// 06 Wall of screens: no emblem, the operator before a wall of six screens
I.push(['Wall of screens', `${screen(8, 10, 34, 26, 'text')}${screen(47, 6, 34, 30, 'bars')}${screen(86, 10, 34, 26, 'wave')}${screen(8, 42, 34, 26, 'wave')}${screen(47, 40, 34, 28, 'text')}${screen(86, 42, 34, 26, 'bars')}${at(64, 96, 1, console_({ screens: false }))}${op(64, 124, 1)}`]);
// 07 Hub over desk: the emblem's lines fan down to the screens themselves, no operator
I.push(['Hub over desk', `<g stroke="${GOLD}" stroke-width="4" stroke-linecap="round"><path d="M64 40 L29 74 M64 40 V68 M64 40 L99 74"/></g>${hex(64, 28, 1)}${at(64, 106, 1, console_())}`]);
// 08 The big screen: the emblem fills the main screen, the operator watching it
I.push(['The big screen', `<rect x="10" y="8" width="108" height="72" rx="8" fill="${SCR}" stroke="${NAVY}" stroke-width="5"/>${hex(64, 44, 1.3)}<g fill="${GLOW}"><rect x="18" y="16" width="16" height="4" rx="2"/><rect x="94" y="16" width="16" height="4" rx="2"/><rect x="18" y="68" width="22" height="4" rx="2"/></g>${at(64, 102, 1, console_({ screens: false }))}${op(64, 126, 1)}`]);
// 09 Wraparound: a curved console all round the operator, the emblem on the middle screen
I.push(['Wraparound', `<path d="M6 60 Q64 34 122 60 L118 82 Q64 60 10 82Z" fill="${SCR}" stroke="${NAVY}" stroke-width="4" stroke-linejoin="round"/><g stroke="${GLOW}" stroke-width="2.4" stroke-linecap="round"><path d="M16 64 L32 60 M18 72 L30 69 M98 60 L112 64 M98 69 L110 72"/></g>${hex(64, 30, .9)}
<path d="M4 86 Q64 62 124 86 L120 106 Q64 84 8 106Z" fill="${NAVY}"/><g fill="${GOLD}"><circle cx="30" cy="88" r="3"/><circle cx="98" cy="88" r="3"/></g>${op(64, 124, 1)}`]);
// 10 Purple porthole: the room in a purple disc, stars over the desk
I.push(['Purple porthole', `<defs>${clipDisc('c')}</defs><circle cx="64" cy="64" r="60" fill="${PD}" stroke="${P}" stroke-width="5"/><g clip-path="url(#$c)">${stars([[26, 34], [102, 30, 2.5], [86, 50, 1.5], [40, 56, 1.4]])}${hex(64, 34, .85)}${at(64, 100, .95, console_())}${op(64, 128, .95)}</g>`]);
// 11 Arched window: a tall window on space, the emblem as the moon in it
I.push(['Arched window', `<path d="M14 94 V50 A50 44 0 0 1 114 50 V94Z" fill="${SKYN}" stroke="${P}" stroke-width="5"/><path d="M64 8 V94 M14 56 H114" stroke="${P}" stroke-width="3"/>${stars([[32, 38], [96, 34, 2.5], [28, 74, 1.4], [104, 74, 1.6]])}${hex(64, 46, .9)}${at(64, 98, 1, console_({ screens: false }))}${op(64, 126, 1)}`]);
// 12 Orbiting scripts: the scripts circle the emblem, the desk below
I.push(['Orbiting scripts', `<ellipse cx="64" cy="34" rx="52" ry="18" fill="none" stroke="${GOLD}" stroke-width="3.5"/>${hex(64, 34, .9)}${node(14, 36, OR)}${node(40, 50, GR)}${node(96, 47, GLOW)}${node(110, 24, PL)}${at(64, 98, 1, console_())}${op(64, 126, 1)}`]);
// 13 Fan of screens: just the operator and three screens fanned above, no desk
I.push(['Fan of screens', `<g transform="rotate(-18 64 110)">${screen(18, 22, 30, 36, 'text')}</g>${screen(48, 12, 32, 40, 'bars')}<g transform="rotate(18 64 110)">${screen(80, 22, 30, 36, 'wave')}</g>${op(64, 120, 1.6)}`]);
// 14 On the headset: the operator wears a headset, the emblem overhead
I.push(['On the headset', `${hex(64, 26, 1)}<g stroke="${GOLD}" stroke-width="3" stroke-dasharray="4 4"><path d="M44 30 L20 50 M84 30 L108 50"/></g>${at(64, 90, 1, console_())}${op(64, 124, 1, true)}`]);
// 15 Every script on screen: each screen a script's colour
I.push(['Every script on screen', `${hex(64, 22, .85)}${[[8, OR], [38, GR], [68, GOLD], [98, P]].map(([x, c]) => `<rect x="${x + 1}" y="48" width="22" height="22" rx="4" fill="${c}" stroke="${NAVY}" stroke-width="3"/>`).join('')}<g stroke="${GOLD}" stroke-width="3" stroke-linecap="round"><path d="M64 40 L20 48 M64 40 L50 48 M64 40 L78 48 M64 40 L108 48"/></g>${at(64, 82, 1, console_({ screens: false }))}${op(64, 124, 1.1)}`]);
// 16 Moonrise: the emblem rising like a moon over the Earth's rim, the desk in front
I.push(['Moonrise', `<defs>${clipDisc('c')}</defs>${disc()}<g clip-path="url(#$c)">${stars([[22, 38], [106, 30, 2.5], [92, 56, 1.4]])}${hex(64, 50, 1.05, true)}<path d="M-10 80 Q64 56 138 80 V140 H-10Z" fill="${EARTH}"/><path d="M-10 80 Q64 56 138 80" fill="none" stroke="${GLOW}" stroke-width="3"/>${at(64, 104, .9, console_({ screens: false }))}${op(64, 130, .9)}</g>`]);
// 17 Hex badge, hub: the hexagon badge, lines from the emblem to four scripts
I.push(['Hex badge, hub', `${hexBadge}${spokes(64, 34, [[28, 48, OR], [46, 62, GR], [82, 62, GOLD], [100, 48, GLOW]])}${hex(64, 32, .75)}${at(64, 98, .8, console_({ screens: false }))}${op(64, 120, .85)}`]);
// 18 Cockpit: the operator under a wide window, the emblem in the sky
I.push(['Cockpit', `<path d="M4 72 L18 14 H110 L124 72Z" fill="${SKYN}" stroke="${P}" stroke-width="5" stroke-linejoin="round"/><path d="M44 14 L38 72 M84 14 L90 72" stroke="${P}" stroke-width="4"/>${stars([[26, 30, 1.6], [104, 28, 2], [104, 56, 1.4]])}${hex(64, 42, .9)}${at(64, 94, 1, console_({ screens: false }))}${op(64, 124, 1)}`]);
// 19 The big board: one big central screen showing the emblem, two side screens
I.push(['The big board', `${screen(4, 24, 28, 36, 'text')}${screen(96, 24, 28, 36, 'wave')}<rect x="34" y="10" width="60" height="56" rx="6" fill="${SCR}" stroke="${NAVY}" stroke-width="4"/>${hex(64, 38, .95)}${at(64, 96, 1, console_({ screens: false }))}${op(64, 124, 1)}`]);
// 20 Network board: the big screen shows the hub of scripts
I.push(['Network board', `<rect x="8" y="6" width="112" height="72" rx="8" fill="${SKYN}" stroke="${P}" stroke-width="5"/>${spokes(64, 40, [[24, 22, OR], [26, 60, GR], [104, 22, GOLD], [102, 60, GLOW], [64, 66, RED]])}${hex(64, 40, .85)}${at(64, 100, 1, console_({ screens: false }))}${op(64, 126, 1)}`]);

const cards = I.map(([t, b], i) => { const n = String(i + 1).padStart(2, '0'); writeFileSync(join(dir, `room-${n}.svg`), svg(`mcr${n}-`, `Mission Control — ${t}`, b)); return { n, t }; });
const fig = c => `<figure>${[96, 48, 28, 16].map(z => `<img src="room-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-room.html'), `<!doctype html><meta charset="utf-8"><title>Mission Control icons, round 3: the control room</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
.light{background:#fff;color:#222}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}</style>
${sec('light', 'White')}${sec('dark', 'Black')}\n`);
console.log('wrote ' + cards.length);
