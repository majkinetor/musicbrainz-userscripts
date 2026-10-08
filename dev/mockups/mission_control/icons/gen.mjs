// Mission Control icons, round 1: twenty ideas in the bundle's style (flat, bold, no tile, the ink #22223b given a light
// halo so it reads on dark pages), none built on the current crosshair and nothing round and ringed like ISRC Scout's radar.
// Mission Control is one window that asks the other scripts what is missing, reviews it all, and applies the ticked
// changes in order: a flight controller's console, checklist and go/no-go.
// Writes icon-01..20.svg and preview.html (96, 48, 28, 16 px on white, dark grey and black).
//   node dev/mockups/mission_control/icons/gen.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const INK = '#22223b', P = '#7a57e8', PL = '#b9a8ec', OR = '#f3722c', GOLD = '#ffc94a', GR = '#2ea44f', SKY = '#3fb6f0', RED = '#e63946', CREAM = '#f6efe2';
// the light halo, outside the shapes only (like the ant's and the rocket's): invisible on white
const HALO = '<filter id="$h" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="d"/><feFlood flood-color="#fff" flood-opacity=".7"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n<defs>${HALO}</defs><g filter="url(#$h)">${b}</g>`.replaceAll('$', id) + '\n</svg>\n';
const check = (x, y, s, c, w = 5) => `<path d="M${x - s} ${y} L${x - s * .3} ${y + s * .7} L${x + s} ${y - s * .7}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const I = [];

// 01 Console: the flight controller's desk, three screens over a row of buttons
I.push(['Console', `<path d="M8 86 H120 L112 112 H16Z" fill="${P}"/><rect x="8" y="78" width="112" height="10" rx="3" fill="${PL}"/>
<rect x="12" y="30" width="32" height="40" rx="4" fill="${INK}"/><rect x="48" y="22" width="32" height="48" rx="4" fill="${INK}"/><rect x="84" y="30" width="32" height="40" rx="4" fill="${INK}"/>
<path d="M17 54 L23 46 L29 52 L39 40" fill="none" stroke="${GR}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>${check(64, 46, 9, GOLD, 5)}<g fill="${SKY}"><rect x="89" y="50" width="5" height="14"/><rect x="97" y="42" width="5" height="22"/><rect x="105" y="47" width="5" height="17"/></g>
<g><circle cx="30" cy="98" r="5" fill="${RED}"/><circle cx="48" cy="98" r="5" fill="${GOLD}"/><circle cx="66" cy="98" r="5" fill="${GR}"/><rect x="78" y="94" width="30" height="8" rx="4" fill="${INK}"/></g>`]);
// 02 Checklist: a clipboard, every line ticked
I.push(['Checklist', `<rect x="22" y="16" width="84" height="104" rx="12" fill="${P}"/><rect x="31" y="30" width="66" height="82" rx="5" fill="#fff"/><rect x="46" y="8" width="36" height="18" rx="6" fill="${INK}"/>
${[50, 72, 94].map((y, i) => `<rect x="38" y="${y - 8}" width="16" height="16" rx="3" fill="none" stroke="${INK}" stroke-width="3"/>${i < 2 ? check(46, y, 6, GR, 4) : ''}<path d="M62 ${y} H88" stroke="${PL}" stroke-width="6" stroke-linecap="round"/>`).join('')}`]);
// 03 Launch button: the big red button on a hazard-striped base
I.push(['Launch button', `<defs><pattern id="$s" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="${GOLD}"/><rect width="6" height="12" fill="${INK}"/></pattern></defs>
<path d="M10 84 V96 A54 16 0 0 0 118 96 V84Z" fill="url(#$s)"/><ellipse cx="64" cy="84" rx="54" ry="16" fill="${INK}"/>
<path d="M30 80 V60 A34 13 0 0 1 98 60 V80 A34 13 0 0 1 30 80Z" fill="#b51d2a"/><ellipse cx="64" cy="58" rx="34" ry="13" fill="${RED}"/><ellipse cx="54" cy="54" rx="12" ry="4" fill="#fff" opacity=".45"/>`]);
// 04 Headset: what every controller at the desk wears
I.push(['Headset', `<path d="M22 74 A42 42 0 0 1 106 74" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
<rect x="10" y="62" width="26" height="40" rx="10" fill="${P}"/><rect x="92" y="62" width="26" height="40" rx="10" fill="${P}"/><rect x="16" y="70" width="6" height="24" rx="3" fill="${PL}"/><rect x="106" y="70" width="6" height="24" rx="3" fill="${PL}"/>
<path d="M26 100 Q30 118 58 116" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><rect x="56" y="108" width="20" height="14" rx="7" fill="${OR}"/>`]);
// 05 Switches: a row of toggles with their lamps — two go, one waiting
I.push(['Switches', `<rect x="8" y="22" width="112" height="84" rx="14" fill="${INK}"/>
${[[32, GR, -1], [64, GR, -1], [96, GOLD, 1]].map(([x, c, d]) => `<circle cx="${x}" cy="38" r="6" fill="${c}"/><rect x="${x - 9}" y="56" width="18" height="38" rx="9" fill="#3a3b5e"/><path d="M${x} 75 L${x} ${75 + d * 18}" stroke="#d9dce6" stroke-width="6" stroke-linecap="round"/><circle cx="${x}" cy="${75 + d * 18}" r="7" fill="#fff"/>`).join('')}`]);
// 06 One window: every script's finding gathered into one window
I.push(['One window', `<rect x="10" y="16" width="108" height="96" rx="12" fill="#fff" stroke="${INK}" stroke-width="6"/><path d="M10 28 A12 12 0 0 1 22 16 H106 A12 12 0 0 1 118 28 V38 H10Z" fill="${P}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<g fill="#fff"><circle cx="24" cy="27" r="3.5"/><circle cx="35" cy="27" r="3.5"/><circle cx="46" cy="27" r="3.5"/></g>
<rect x="22" y="48" width="38" height="24" rx="5" fill="${OR}"/><rect x="68" y="48" width="38" height="24" rx="5" fill="${SKY}"/><rect x="22" y="78" width="38" height="24" rx="5" fill="${GOLD}"/><rect x="68" y="78" width="38" height="24" rx="5" fill="${GR}"/>`]);
// 07 Funnel: the findings poured in, one tick out
I.push(['Funnel', `<circle cx="28" cy="14" r="8" fill="${OR}"/><circle cx="52" cy="10" r="8" fill="${SKY}"/><circle cx="76" cy="10" r="8" fill="${GOLD}"/><circle cx="100" cy="14" r="8" fill="${PL}"/>
<path d="M12 30 H116 L76 72 V88 H52 V72Z" fill="${P}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><circle cx="64" cy="106" r="16" fill="${GR}"/>${check(64, 106, 8, '#fff', 4.5)}`]);
// 08 Mission patch: an embroidered crew patch, a gold star on its orbit
I.push(['Mission patch', `<ellipse cx="64" cy="64" rx="48" ry="58" fill="${INK}" stroke="${GOLD}" stroke-width="6"/><ellipse cx="64" cy="64" rx="38" ry="48" fill="${P}"/>
<path d="M28 82 Q64 40 104 50" fill="none" stroke="${OR}" stroke-width="6" stroke-linecap="round"/><path d="M64 34 L70 50 L87 50 L73 60 L78 76 L64 66 L50 76 L55 60 L41 50 L58 50Z" fill="${GOLD}"/>
<g fill="#fff"><circle cx="40" cy="44" r="2.5"/><circle cx="88" cy="80" r="2.5"/><circle cx="56" cy="92" r="2"/></g>`]);
// 09 Go / no-go: the status lamps, all three lit
I.push(['Go / no-go', `<rect x="38" y="6" width="52" height="116" rx="22" fill="${INK}"/><circle cx="64" cy="32" r="14" fill="${RED}"/><circle cx="64" cy="64" r="14" fill="${GOLD}"/><circle cx="64" cy="96" r="14" fill="${GR}"/>
<g fill="#fff" opacity=".5"><circle cx="59" cy="27" r="4"/><circle cx="59" cy="59" r="4"/><circle cx="59" cy="91" r="4"/></g><path d="M38 24 H26 M38 56 H26 M38 88 H26 M90 24 H102 M90 56 H102 M90 88 H102" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`]);
// 10 Faders: three channels, each set to its own level
I.push(['Faders', `<rect x="10" y="10" width="108" height="108" rx="16" fill="${P}"/>${[[34, 44, OR], [64, 84, GOLD], [94, 58, SKY]].map(([x, y, c]) => `<rect x="${x - 3}" y="22" width="6" height="84" rx="3" fill="${INK}"/><rect x="${x - 12}" y="${y - 8}" width="24" height="16" rx="4" fill="${c}" stroke="${INK}" stroke-width="3"/>`).join('')}`]);
// 11 Approved: one window, one big tick
I.push(['Approved', `<rect x="12" y="18" width="104" height="92" rx="14" fill="${P}"/><rect x="20" y="36" width="88" height="66" rx="6" fill="#fff"/><g fill="#fff"><circle cx="26" cy="27" r="3.5"/><circle cx="37" cy="27" r="3.5"/><circle cx="48" cy="27" r="3.5"/></g>${check(64, 70, 22, GR, 10)}`]);
// 12 GO: the board's display reads GO
I.push(['GO', `<rect x="8" y="24" width="112" height="80" rx="14" fill="${P}"/><rect x="18" y="34" width="92" height="60" rx="6" fill="${INK}"/>
<text x="64" y="83" text-anchor="middle" font-family="Arial Black,Helvetica,sans-serif" font-weight="900" font-size="46" fill="${GR}">GO</text><circle cx="100" cy="42" r="3" fill="${RED}"/>`]);
// 13 Throttle: a lever pushed all the way forward
I.push(['Throttle', `<path d="M22 108 A60 60 0 0 1 106 40" fill="none" stroke="${PL}" stroke-width="16" stroke-linecap="round"/><path d="M22 108 A60 60 0 0 1 106 40" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 12"/>
<rect x="8" y="98" width="52" height="24" rx="8" fill="${INK}"/><path d="M34 106 L92 30" stroke="#d9dce6" stroke-width="9" stroke-linecap="round"/><path d="M34 106 L92 30" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="94" cy="28" r="16" fill="${OR}" stroke="${INK}" stroke-width="4"/>`]);
// 14 Joystick: the controller's stick, thumb button ready
I.push(['Joystick', `<path d="M14 98 L24 84 H104 L114 98 V106 A10 10 0 0 1 104 116 H24 A10 10 0 0 1 14 106Z" fill="${P}"/><path d="M14 98 L24 84 H104 L114 98Z" fill="${PL}"/>
<rect x="58" y="44" width="12" height="46" rx="5" fill="${INK}"/><circle cx="64" cy="36" r="22" fill="${RED}"/><ellipse cx="57" cy="29" rx="7" ry="5" fill="#fff" opacity=".45"/><circle cx="94" cy="92" r="6" fill="${GOLD}"/><circle cx="30" cy="92" r="4" fill="${GR}"/>`]);
// 15 Stack: the scripts' layers, one on top of the other, read as one
I.push(['Stack', `${[[78, OR], [60, SKY], [42, P]].map(([y, c]) => `<path d="M64 ${y - 26} L116 ${y} L64 ${y + 26} L12 ${y}Z" fill="${c}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`).join('')}${check(64, 42, 13, '#fff', 6)}`]);
// 16 In order: the ticked changes, applied one, two, three
I.push(['In order', `<path d="M30 96 C40 70 52 70 60 62 M68 58 C80 46 88 42 96 34" fill="none" stroke="${INK}" stroke-width="4" stroke-dasharray="5 6" stroke-linecap="round"/>
${[[24, 102, OR, '1'], [64, 62, GOLD, '2']].map(([x, y, c, n]) => `<circle cx="${x}" cy="${y}" r="17" fill="${c}" stroke="${INK}" stroke-width="4"/><text x="${x}" y="${y + 9}" text-anchor="middle" font-family="Arial Black,Helvetica,sans-serif" font-weight="900" font-size="24" fill="${INK}">${n}</text>`).join('')}
<circle cx="102" cy="26" r="20" fill="${GR}" stroke="${INK}" stroke-width="4"/>${check(102, 26, 10, '#fff', 5.5)}`]);
// 17 Launch key: turn the key to commit
I.push(['Launch key', `<rect x="70" y="40" width="48" height="48" rx="12" fill="${INK}"/><rect x="88" y="52" width="12" height="24" rx="3" fill="#3a3b5e"/>
<path d="M34 58 H96 V70 H34Z" fill="${GOLD}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M58 70 V80 H66 V70 M74 70 V78 H80 V70" fill="${GOLD}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<circle cx="30" cy="64" r="24" fill="${P}" stroke="${INK}" stroke-width="5"/><circle cx="24" cy="64" r="7" fill="#fff" stroke="${INK}" stroke-width="3"/>`]);
// 18 Safety cover: the switch under the flip-up guard
I.push(['Safety cover', `<rect x="16" y="56" width="96" height="58" rx="12" fill="${INK}"/><rect x="50" y="72" width="28" height="30" rx="8" fill="#3a3b5e"/><path d="M64 88 L64 70" stroke="#d9dce6" stroke-width="7" stroke-linecap="round"/><circle cx="64" cy="66" r="7" fill="#fff"/>
<path d="M28 56 L46 14 H98 L104 56Z" fill="${RED}" fill-opacity=".8" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M50 22 H94" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".5"/>`]);
// 19 Orbit screen: the tracking display, a craft on its path round the world
I.push(['Orbit screen', `<rect x="8" y="14" width="112" height="80" rx="12" fill="${INK}"/><path d="M50 94 L44 114 H84 L78 94Z" fill="${P}"/><rect x="34" y="110" width="60" height="8" rx="4" fill="${P}"/>
<circle cx="64" cy="54" r="16" fill="${SKY}"/><path d="M58 46 Q66 50 62 58 Q70 60 72 52" fill="none" stroke="${GR}" stroke-width="4" stroke-linecap="round"/><ellipse cx="64" cy="54" rx="44" ry="16" fill="none" stroke="${GOLD}" stroke-width="3" stroke-dasharray="6 5" transform="rotate(-14 64 54)"/><circle cx="104" cy="44" r="6" fill="${OR}"/>`]);
// 20 Flag planted: mission accomplished, a ticked flag on the ground
I.push(['Flag planted', `<path d="M4 118 Q64 84 124 118Z" fill="${PL}"/><circle cx="34" cy="108" r="4" fill="${P}" opacity=".6"/><circle cx="92" cy="104" r="3" fill="${P}" opacity=".6"/>
<path d="M40 104 V12" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M42 14 H110 L98 36 L110 58 H42Z" fill="${P}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>${check(72, 36, 12, '#fff', 6)}`]);

const cards = I.map(([t, b], i) => { const n = String(i + 1).padStart(2, '0'); writeFileSync(join(dir, `icon-${n}.svg`), svg(`mc${n}-`, `Mission Control — ${t}`, b)); return { n, t }; });
const fig = c => `<figure>${[96, 48, 28, 16].map(z => `<img src="icon-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview.html'), `<!doctype html><meta charset="utf-8"><title>Mission Control icons, round 1</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
.light{background:#fff;color:#222}.grey{background:#2b2b2b;color:#ddd}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}</style>
${sec('light', 'White')}${sec('dark', 'Black')}\n`);
console.log('wrote ' + cards.length);
