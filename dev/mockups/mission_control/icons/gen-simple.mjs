// Mission Control icons, round 6: one object each, no scene, no screens, desks, rockets or radar — as plain as the rest
// of the bundle (Fusion, Group Therapy, String Theory). Each says "one place keeps all the scripts going" its own way.
// Writes simple-01..20.svg and preview-simple.html (96, 48, 28, 16 px on white and black).
//   node dev/mockups/mission_control/icons/gen-simple.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const INK = '#22223b', P = '#7a57e8', PL = '#b9a8ec', PD = '#4b2e83', OR = '#f3722c', GOLD = '#ffc94a', GR = '#2ea44f', SKY = '#3fb6f0', RED = '#e63946', GREY = '#d9dce6', BROWN = '#9c5a2b';
const HALO = '<filter id="$h" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="d"/><feFlood flood-color="#fff" flood-opacity=".7"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n<defs>${HALO}</defs><g filter="url(#$h)">${b}</g>`.replaceAll('$', id) + '\n</svg>\n';
const FOUR = [OR, GR, GOLD, SKY];
const f1 = v => +v.toFixed(1);
const pol = (cx, cy, r, deg) => [f1(cx + r * Math.cos(deg * Math.PI / 180)), f1(cy + r * Math.sin(deg * Math.PI / 180))];
const hexPath = (cx, cy, r) => 'M' + Array.from({ length: 6 }, (_, i) => pol(cx, cy, r, i * 60).join(' ')).join(' L') + 'Z';
const S = (w = 4) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const I = [];

// 01 Marionette: the control bar, a string to every script
I.push(['Marionette bar', `<path d="M26 34 L22 100 M50 34 L48 92 M78 34 L80 92 M102 34 L106 100" ${S(3)} fill="none"/>
${[[22, 104], [48, 96], [80, 96], [106, 104]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="10" fill="${FOUR[i]}" ${S()}/>`).join('')}
<rect x="16" y="26" width="96" height="14" rx="7" fill="${P}" ${S()}/><rect x="57" y="8" width="14" height="50" rx="7" fill="${P}" ${S()}/>`]);
// 02 Balloons: every script on a string, all held in one knot
I.push(['Bunch of balloons', `<path d="M38 52 L64 112 M64 42 L64 112 M90 52 L64 112 M64 70 L64 112" ${S(3)} fill="none"/>
${[[38, 36], [90, 36], [64, 26], [64, 56]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="17" ry="20" fill="${FOUR[i]}" ${S()}/>`).join('')}
<path d="M56 106 L64 112 L72 106 L72 120 L64 114 L56 120Z" fill="${P}" ${S(3)}/>`]);
// 03 Keyring: every door on one ring
I.push(['Keyring', `<circle cx="64" cy="34" r="24" fill="none" stroke="${INK}" stroke-width="7"/>
${[-40, -13, 13, 40].map((r, i) => `<g transform="translate(64 56) rotate(${r})"><rect x="-4" y="16" width="8" height="40" rx="2" fill="${FOUR[i]}" ${S(3)}/><path d="M4 44 H12 M4 52 H10" ${S(4)}/><circle cx="0" cy="10" r="11" fill="${FOUR[i]}" ${S()}/><circle cx="0" cy="8" r="3.5" fill="#fff"/></g>`).join('')}`]);
// 04 Keystone: the one stone that holds the arch up
const arc = (a0, a1, r0, r1, cx = 64, cy = 104) => { const [x0, y0] = pol(cx, cy, r1, a0), [x1, y1] = pol(cx, cy, r1, a1), [x2, y2] = pol(cx, cy, r0, a1), [x3, y3] = pol(cx, cy, r0, a0); return `M${x0} ${y0} A${r1} ${r1} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`; };
I.push(['Keystone', `${[[180, 216], [216, 252], [288, 324], [324, 360]].map(([a, b]) => `<path d="${arc(a, b, 30, 56)}" fill="${PL}" ${S()}/>`).join('')}<path d="${arc(252, 288, 28, 62)}" fill="${GOLD}" ${S()}/>`]);
// 05 Lifeguard chair: high up, watching over everyone
I.push(['Lifeguard chair', `<path d="M36 118 L52 48 M92 118 L76 48 M42 92 H86 M46 72 H82" ${S(6)} fill="none"/>
<rect x="44" y="40" width="40" height="12" rx="3" fill="${RED}" ${S()}/><rect x="44" y="14" width="40" height="28" rx="4" fill="#fff" ${S()}/><path d="M48 24 H80 M48 32 H80" stroke="${RED}" stroke-width="5"/>`]);
// 06 Owl: wide awake, eyes on everything
I.push(['Owl', `<path d="M24 34 L36 22 L50 30 Q64 26 78 30 L92 22 L104 34 Q110 54 106 76 Q100 110 64 112 Q28 110 22 76 Q18 54 24 34Z" fill="${P}" ${S()}/>
<ellipse cx="64" cy="86" rx="22" ry="20" fill="${PL}"/><circle cx="46" cy="54" r="15" fill="#fff" ${S()}/><circle cx="82" cy="54" r="15" fill="#fff" ${S()}/><circle cx="48" cy="56" r="6" fill="${INK}"/><circle cx="80" cy="56" r="6" fill="${INK}"/>
<path d="M58 66 L70 66 L64 78Z" fill="${GOLD}" ${S(3)}/>`]);
// 07 Baton: the conductor, every player follows it
I.push(['Baton', `<path d="M86 24 Q108 30 108 52 M96 14 Q120 22 118 50" fill="none" stroke="${GOLD}" stroke-width="5" stroke-linecap="round"/>
<path d="M28 104 L94 30" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M28 104 L94 30" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M22 98 L38 112 L28 120 L14 108Z" fill="${OR}" ${S()}/>`]);
// 08 Queen cell: the comb, one cell in charge of the rest
I.push(['Honeycomb', `${[[0, 0], ...[30, 90, 150, 210, 270, 330].map(a => pol(0, 0, 34.6, a))].map(([x, y], i) => `<path d="${hexPath(64 + x, 64 + y, 18)}" fill="${i ? GOLD : P}" ${S()}/>`).join('')}`]);
// 09 Nest: where all the scripts live
I.push(['Nest', `${[[38, 64], [56, 56], [74, 56], [92, 64]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="12" ry="15" fill="${FOUR[i]}" ${S()}/>`).join('')}
<path d="M12 66 Q64 76 116 66 Q110 110 64 110 Q18 110 12 66Z" fill="${BROWN}" ${S()}/><path d="M26 82 Q60 90 100 80 M34 96 Q66 100 92 94" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`]);
// 10 Crook: the shepherd's staff, the flock following
I.push(['Crook', `<path d="M40 120 V34 Q40 12 60 12 Q80 12 80 32" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M40 120 V34 Q40 12 60 12 Q80 12 80 32" fill="none" stroke="${BROWN}" stroke-width="7" stroke-linecap="round"/>
${[[70, 108], [88, 96], [100, 76], [106, 54]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="9" fill="${FOUR[i]}" ${S()}/>`).join('')}`]);
// 11 Pinwheel: one pin, every vane turning
I.push(['Pinwheel', `<path d="M64 52 V120" ${S(7)}/>${[0, 90, 180, 270].map((r, i) => `<path d="M64 52 L64 8 L92 26Z" transform="rotate(${r} 64 52)" fill="${FOUR[i]}" ${S()}/>`).join('')}<circle cx="64" cy="52" r="6" fill="#fff" ${S(3)}/>`]);
// 12 Umbrella: everything under one cover
I.push(['Umbrella', `<path d="M64 62 V104 Q64 116 74 116 Q84 116 84 106" fill="none" ${S(6)}/>${[[180, 225], [225, 270], [270, 315], [315, 360]].map(([a, b], i) => { const [x0, y0] = pol(64, 64, 54, a), [x1, y1] = pol(64, 64, 54, b); return `<path d="M64 64 L${x0} ${y0} A54 54 0 0 1 ${x1} ${y1}Z" fill="${FOUR[i]}" ${S()}/>`; }).join('')}<path d="M64 10 V4" ${S(5)}/>`]);
// 13 Tower: the airport's control tower
I.push(['Control tower', `<path d="M54 120 L58 62 H70 L74 120Z" fill="${GREY}" ${S()}/><path d="M28 34 H100 L90 60 H38Z" fill="${SKY}" ${S()}/><path d="M48 36 L52 58 M64 36 V58 M80 36 L76 58" ${S(3)}/>
<rect x="34" y="24" width="60" height="12" rx="3" fill="${P}" ${S()}/><path d="M64 24 V10" ${S(4)}/><circle cx="64" cy="8" r="5" fill="${RED}" ${S(3)}/>`]);
// 14 Hand of cards: every script in one hand
I.push(['Hand of cards', `${[-33, -11, 11, 33].map((r, i) => `<g transform="rotate(${r} 64 116)"><rect x="46" y="22" width="36" height="54" rx="5" fill="${FOUR[i]}" ${S()}/><circle cx="64" cy="40" r="6" fill="#fff"/></g>`).join('')}`]);
// 15 King: the piece the game is played around
I.push(['Chess king', `<path d="M64 6 V26 M55 14 H73" fill="none" ${S(9)}/><path d="M64 6 V26 M55 14 H73" fill="none" stroke="${GOLD}" stroke-width="4" stroke-linecap="round"/>
<path d="M40 50 Q36 28 64 28 Q92 28 88 50Z" fill="${P}" ${S()}/><rect x="38" y="48" width="52" height="10" rx="4" fill="${PD}" ${S()}/><path d="M46 58 L42 98 H86 L82 58Z" fill="${P}" ${S()}/><rect x="30" y="98" width="68" height="16" rx="5" fill="${PD}" ${S()}/>`]);
// 16 Lighthouse: keeps watch over every ship
I.push(['Lighthouse', `<path d="M60 34 L6 20 V48Z M68 34 L122 20 V48Z" fill="${GOLD}" opacity=".55"/><path d="M44 120 L52 46 H76 L84 120Z" fill="#fff" ${S()}/><path d="M50 66 H78 L80 84 H48Z M46 102 H82 L84 120 H44Z" fill="${RED}"/><path d="M44 120 L52 46 H76 L84 120Z" fill="none" ${S()}/>
<rect x="50" y="24" width="28" height="22" rx="3" fill="${GOLD}" ${S()}/><path d="M46 24 Q64 4 82 24Z" fill="${P}" ${S()}/>`]);
// 17 Spinning plates: keeping every one of them going
I.push(['Spinning plates', `${[[20, 52], [48, 34], [80, 34], [108, 52]].map(([x, y], i) => `<path d="M${x} ${y} L${f1(64 + (x - 64) * .3)} 122" ${S(4)}/><ellipse cx="${x}" cy="${y}" rx="16" ry="6" fill="${FOUR[i]}" ${S()}/>`).join('')}
<path d="M8 40 Q20 32 32 40 M36 22 Q48 14 60 22 M68 22 Q80 14 92 22 M96 40 Q108 32 120 40" fill="none" stroke="${P}" stroke-width="3" stroke-linecap="round"/>`]);
// 18 Whistle: the referee, keeping the game in order
I.push(['Whistle', `<path d="M24 56 Q24 40 40 40 H104 V60 H82 A30 30 0 1 1 24 66Z" fill="${GOLD}" ${S(5)}/><circle cx="52" cy="72" r="12" fill="${INK}"/><path d="M84 40 V60" ${S(4)}/>
<path d="M30 46 Q16 30 22 14" fill="none" stroke="${P}" stroke-width="5" stroke-linecap="round"/><circle cx="22" cy="12" r="6" fill="${P}" ${S(3)}/>`]);
// 19 Big top: the ringmaster's tent, every act under it
I.push(['Big top', `<path d="M64 16 V2 M64 3 L80 8 L64 13" fill="${RED}" ${S(3)}/><path d="M64 16 L12 70 H116Z" fill="#fff" ${S()}/><path d="M64 16 L38 70 H52Z M64 16 L76 70 H90Z" fill="${P}"/><path d="M64 16 L12 70 H116Z" fill="none" ${S()}/>
<path d="M20 70 H108 V112 H20Z" fill="${P}" ${S()}/><path d="M50 112 V88 Q64 74 78 88 V112Z" fill="${INK}"/>`]);
// 20 Kite: one line, way up there
I.push(['Kite', `<path d="M64 6 L98 46 L64 96 L30 46Z" fill="${P}"/><path d="M64 6 L98 46 L64 46Z" fill="${GOLD}"/><path d="M64 46 L30 46 L64 96Z" fill="${OR}"/><path d="M64 6 L64 96 M30 46 H98" ${S(3)}/><path d="M64 6 L98 46 L64 96 L30 46Z" fill="none" ${S()}/>
<path d="M64 96 Q54 106 64 112 Q74 118 62 124" fill="none" ${S(3)}/>${[[56, 104], [70, 116]].map(([x, y], i) => `<path d="M${x} ${y} l-6 -4 v8Z M${x} ${y} l6 -4 v8Z" fill="${[GR, SKY][i]}" ${S(2)}/>`).join('')}`]);

const cards = I.map(([t, b], i) => { const n = String(i + 1).padStart(2, '0'); writeFileSync(join(dir, `simple-${n}.svg`), svg(`mcs${n}-`, `Mission Control — ${t}`, b)); return { n, t }; });
const fig = c => `<figure>${[96, 48, 28, 16].map(z => `<img src="simple-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-simple.html'), `<!doctype html><meta charset="utf-8"><title>Mission Control icons, round 6</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
.light{background:#fff;color:#222}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}</style>
${sec('light', 'White')}${sec('dark', 'Black')}\n`);
console.log('wrote ' + cards.length);
