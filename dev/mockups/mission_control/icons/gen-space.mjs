// Mission Control icons, round 2: space. Twenty ideas in the bundle's style (flat, bold, no tile, the ink given a light
// halo for dark pages), no ringed targets like ISRC Scout's radar, no rocket (Apollo's) and no saucer (First Contact's).
// Writes space-01..20.svg and preview-space.html (96, 48, 28, 16 px on white and black).
//   node dev/mockups/mission_control/icons/gen-space.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const INK = '#22223b', P = '#7a57e8', PL = '#b9a8ec', PD = '#4b2e83', OR = '#f3722c', GOLD = '#ffc94a', GR = '#2ea44f', SKY = '#3fb6f0', RED = '#e63946', GREY = '#d9dce6';
const HALO = '<filter id="$h" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="d"/><feFlood flood-color="#fff" flood-opacity=".7"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n<defs>${HALO}</defs><g filter="url(#$h)">${b}</g>`.replaceAll('$', id) + '\n</svg>\n';
const check = (x, y, s, c, w = 5) => `<path d="M${x - s} ${y} L${x - s * .3} ${y + s * .7} L${x + s} ${y - s * .7}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const star = (x, y, r, c) => `<path d="M${x} ${y - r} L${x + r * .28} ${y - r * .28} L${x + r} ${y} L${x + r * .28} ${y + r * .28} L${x} ${y + r} L${x - r * .28} ${y + r * .28} L${x - r} ${y} L${x - r * .28} ${y - r * .28}Z" fill="${c}"/>`;
const star5 = (x, y, r, c) => `<path d="${Array.from({ length: 10 }, (_, i) => { const a = (i * 36 - 90) * Math.PI / 180, q = i % 2 ? r * .45 : r; return `${i ? 'L' : 'M'}${(x + q * Math.cos(a)).toFixed(1)} ${(y + q * Math.sin(a)).toFixed(1)}`; }).join(' ')}Z" fill="${c}"/>`;
const panel = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${SKY}" stroke="${INK}" stroke-width="3.5"/><path d="M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}" stroke="${INK}" stroke-width="2"/>`;
const I = [];

// 01 Satellite: the craft the controllers talk to
I.push(['Satellite', `<g transform="rotate(-30 64 64)">${panel(6, 50, 36, 28)}${panel(86, 50, 36, 28)}<path d="M42 64 H86" stroke="${INK}" stroke-width="5"/>
<rect x="48" y="44" width="32" height="40" rx="6" fill="${GOLD}" stroke="${INK}" stroke-width="4"/><path d="M64 44 V30" stroke="${INK}" stroke-width="4"/><path d="M52 30 A12 7 0 0 0 76 30Z" fill="${P}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/></g>`]);
// 02 Space station: modules and wings, a home in orbit
I.push(['Space station', `${panel(4, 24, 22, 34)}${panel(4, 70, 22, 34)}${panel(102, 24, 22, 34)}${panel(102, 70, 22, 34)}<path d="M26 41 H102 M26 87 H102 M30 41 V87 M98 41 V87" stroke="${INK}" stroke-width="4"/>
<rect x="44" y="50" width="40" height="28" rx="12" fill="${P}" stroke="${INK}" stroke-width="4"/><rect x="56" y="30" width="16" height="68" rx="8" fill="${GREY}" stroke="${INK}" stroke-width="4"/><circle cx="64" cy="64" r="5" fill="${GOLD}"/>`]);
// 03 Helmet: an astronaut's visor, mission reflected in it
I.push(['Helmet', `<rect x="22" y="94" width="84" height="22" rx="8" fill="${GREY}" stroke="${INK}" stroke-width="4"/><circle cx="64" cy="58" r="46" fill="#fff" stroke="${INK}" stroke-width="5"/>
<path d="M30 60 A34 30 0 0 1 98 60 V64 A34 26 0 0 1 30 64Z" fill="${PD}" stroke="${INK}" stroke-width="4"/>${star(50, 52, 6, '#fff')}${star(78, 66, 4, GOLD)}<circle cx="86" cy="50" r="2" fill="#fff"/><path d="M40 48 Q50 38 64 38" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".55"/>
<rect x="56" y="98" width="16" height="12" rx="3" fill="${OR}"/>`]);
// 04 Capsule: the crew capsule, heat shield down
I.push(['Capsule', `<path d="M48 18 H80 L106 96 H22Z" fill="${GREY}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><rect x="54" y="8" width="20" height="12" rx="3" fill="${INK}"/>
<path d="M18 96 H110 Q108 112 64 114 Q20 112 18 96Z" fill="${OR}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><circle cx="64" cy="58" r="12" fill="${SKY}" stroke="${INK}" stroke-width="4"/><path d="M40 82 H88" stroke="${P}" stroke-width="6" stroke-linecap="round"/>`]);
// 05 Splashdown: the capsule home under its parachute
I.push(['Splashdown', `<path d="M10 52 A54 44 0 0 1 118 52 Q109 46 100 52 Q91 46 82 52 Q73 46 64 52 Q55 46 46 52 Q37 46 28 52 Q19 46 10 52Z" fill="${RED}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<path d="M46 52 Q46 20 64 8 Q82 20 82 52" fill="#fff" stroke="${INK}" stroke-width="3"/><path d="M10 52 L52 96 M46 52 L56 96 M82 52 L72 96 M118 52 L76 96" stroke="${INK}" stroke-width="2.5"/>
<path d="M54 94 H74 L82 116 H46Z" fill="${GREY}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><circle cx="64" cy="106" r="4" fill="${SKY}"/>`]);
// 06 Lander: the lunar module, gold foil and four legs
I.push(['Lander', `<path d="M30 78 L14 112 M98 78 L114 112 M44 82 L38 112 M84 82 L90 112" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M6 112 H22 M106 112 H122" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
<path d="M26 60 H102 L96 86 H32Z" fill="${GOLD}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M38 60 L42 26 L64 16 L86 26 L90 60Z" fill="${GREY}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<path d="M54 34 L64 30 L74 34 L72 46 H56Z" fill="${PD}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><path d="M84 22 L96 10" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="98" cy="8" r="4" fill="${RED}"/>`]);
// 07 Reporting in: four craft on one orbit round the world, each a script
I.push(['Reporting in', `<circle cx="64" cy="64" r="28" fill="${SKY}" stroke="${INK}" stroke-width="5"/><path d="M48 50 Q60 56 54 70 Q66 74 70 62 Q80 60 78 48" fill="${GR}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
<ellipse cx="64" cy="64" rx="58" ry="22" fill="none" stroke="${P}" stroke-width="4" stroke-dasharray="7 6" transform="rotate(-20 64 64)"/>
${[[10, 82, OR], [44, 92, GOLD], [118, 46, RED], [88, 30, PL]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="7" fill="${c}" stroke="${INK}" stroke-width="3"/>`).join('')}`]);
// 08 Constellation: the stars join up into a tick
I.push(['Constellation', `<path d="M14 62 L44 96 L76 56 L114 18" fill="none" stroke="${PL}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
${star5(14, 62, 12, GOLD)}${star5(44, 96, 14, GOLD)}${star5(76, 56, 12, GOLD)}${star5(114, 18, 12, GOLD)}<g fill="${P}"><circle cx="30" cy="22" r="3"/><circle cx="100" cy="98" r="3.5"/><circle cx="62" cy="20" r="2.5"/></g>`]);
// 09 Ground station: the dish on the ground, its beam up to a star
I.push(['Ground station', `<path d="M66 30 L100 10" stroke="${GOLD}" stroke-width="4" stroke-dasharray="6 5" stroke-linecap="round"/>${star5(108, 10, 10, GOLD)}
<path d="M52 82 L36 116 H92 L76 82Z" fill="${P}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<path d="M14 50 A50 50 0 0 0 92 92 Z" fill="#fff" stroke="${INK}" stroke-width="5" stroke-linejoin="round" transform="rotate(-6 64 64)"/><path d="M53 71 L66 30" stroke="${INK}" stroke-width="4"/><circle cx="66" cy="30" r="6" fill="${OR}" stroke="${INK}" stroke-width="3"/>`]);
// 10 Ringed planet: a world with its ring, a star for the goal
I.push(['Ringed planet', `<circle cx="60" cy="68" r="34" fill="${P}" stroke="${INK}" stroke-width="5"/><path d="M30 56 Q60 50 90 58 M28 76 Q60 70 92 80" stroke="${PL}" stroke-width="5" fill="none" stroke-linecap="round"/>
<path d="M18 92 C-6 108 34 104 64 92 S130 52 102 46" fill="none" stroke="${GOLD}" stroke-width="7" stroke-linecap="round"/>${star5(106, 20, 14, GOLD)}`]);
// 11 Comet: the scripts' findings streaming in as one tail
I.push(['Comet', `${[[OR, -14], [GOLD, -4], [GR, 6], [SKY, 16]].map(([c, d]) => `<path d="M${84 + d * .3} ${44 + d} L${10} ${110 + d * .7}" stroke="${c}" stroke-width="8" stroke-linecap="round"/>`).join('')}<circle cx="88" cy="40" r="26" fill="${P}" stroke="${INK}" stroke-width="5"/><circle cx="80" cy="32" r="7" fill="#fff" opacity=".5"/>`]);
// 12 Moon flag: the crescent moon, a ticked flag planted on it
I.push(['Moon flag', `<path d="M62 14 A52 52 0 1 0 114 70 A40 40 0 1 1 62 14Z" fill="${GOLD}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<path d="M76 70 V18" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M78 20 H120 L112 34 L120 48 H78Z" fill="${P}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>${check(97, 34, 8, '#fff', 4.5)}`]);
// 13 Telescope: eyes on the sky
I.push(['Telescope', `<path d="M58 72 L34 118 M64 74 L64 118 M70 72 L94 118" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
<g transform="rotate(-30 64 60)"><rect x="18" y="48" width="78" height="24" rx="6" fill="${P}" stroke="${INK}" stroke-width="5"/><rect x="96" y="44" width="16" height="32" rx="4" fill="${PL}" stroke="${INK}" stroke-width="5"/><rect x="6" y="54" width="12" height="12" rx="2" fill="${INK}"/><path d="M48 48 V72" stroke="${GOLD}" stroke-width="5"/></g>${star5(108, 14, 9, GOLD)}<circle cx="122" cy="40" r="2.5" fill="${GOLD}"/>`]);
// 14 Shooting star: a star whose trail is a tick
I.push(['Shooting star', `<path d="M10 62 L38 92 L84 40" fill="none" stroke="${PL}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 68 L38 90 L76 48" fill="none" stroke="${P}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
${star5(96, 30, 28, GOLD)}<path d="${star5(96, 30, 28, '').match(/d="([^"]+)"/)[1]}" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`]);
// 15 Orbital sunrise: the sun coming up over the world's rim, seen from orbit
I.push(['Orbital sunrise', `<circle cx="64" cy="70" r="14" fill="${GOLD}"/><g stroke="${GOLD}" stroke-width="4" stroke-linecap="round">${[-150, -120, -90, -60, -30].map(d => { const a = d * Math.PI / 180; return `<path d="M${(64 + 22 * Math.cos(a)).toFixed(1)} ${(70 + 22 * Math.sin(a)).toFixed(1)} L${(64 + 32 * Math.cos(a)).toFixed(1)} ${(70 + 32 * Math.sin(a)).toFixed(1)}"/>`; }).join('')}</g>
<path d="M2 120 Q64 60 126 120Z" fill="${SKY}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M30 104 Q46 92 58 100 Q72 90 84 98" fill="none" stroke="${GR}" stroke-width="5" stroke-linecap="round"/>
<g transform="translate(100 22) rotate(-20)"><rect x="-14" y="-4" width="10" height="8" fill="${SKY}" stroke="${INK}" stroke-width="2"/><rect x="4" y="-4" width="10" height="8" fill="${SKY}" stroke="${INK}" stroke-width="2"/><rect x="-5" y="-6" width="10" height="12" rx="2" fill="${P}" stroke="${INK}" stroke-width="2"/></g>`]);
// 16 Rover: wheels down on another world, mast camera up
I.push(['Rover', `<path d="M2 116 H126" stroke="${OR}" stroke-width="5" stroke-linecap="round"/><path d="M26 80 L18 98 M64 80 V98 M102 80 L110 98" stroke="${INK}" stroke-width="5"/>
<rect x="18" y="58" width="92" height="26" rx="6" fill="${GREY}" stroke="${INK}" stroke-width="5"/>${panel(30, 44, 68, 14)}<path d="M92 58 V22" stroke="${INK}" stroke-width="5"/><rect x="80" y="12" width="26" height="14" rx="4" fill="${P}" stroke="${INK}" stroke-width="4"/><circle cx="98" cy="19" r="3" fill="${GOLD}"/>
${[18, 64, 110].map(x => `<circle cx="${x}" cy="102" r="12" fill="${INK}"/><circle cx="${x}" cy="102" r="4" fill="${GREY}"/>`).join('')}`]);
// 17 Spacewalk: an astronaut afloat, waving
I.push(['Spacewalk', `<rect x="40" y="52" width="48" height="40" rx="14" fill="#fff" stroke="${INK}" stroke-width="5"/><rect x="30" y="48" width="14" height="40" rx="5" fill="${GREY}" stroke="${INK}" stroke-width="4"/>
<path d="M84 60 L104 34" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="M84 60 L104 34" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M44 66 L30 92" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="M44 66 L30 92" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
<path d="M52 92 L48 118 M76 92 L82 118" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="M52 92 L48 118 M76 92 L82 118" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
<circle cx="66" cy="30" r="22" fill="#fff" stroke="${INK}" stroke-width="5"/><rect x="52" y="20" width="30" height="20" rx="9" fill="${PD}"/><rect x="58" y="62" width="18" height="12" rx="3" fill="${OR}"/><path d="M58 26 Q64 22 70 24" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>`]);
// 18 Docking: two craft meeting, the hand-off the scripts make
I.push(['Docking', `${panel(4, 40, 18, 48)}<rect x="22" y="48" width="36" height="32" rx="8" fill="${P}" stroke="${INK}" stroke-width="5"/><rect x="58" y="56" width="8" height="16" fill="${INK}"/>
<rect x="70" y="48" width="36" height="32" rx="8" fill="${OR}" stroke="${INK}" stroke-width="5"/>${panel(106, 40, 18, 48)}<rect x="62" y="56" width="8" height="16" fill="${INK}"/>
<path d="M44 24 H84 M76 16 L84 24 L76 32 M84 104 H44 M52 96 L44 104 L52 112" fill="none" stroke="${GOLD}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`]);
// 19 Flight plan: a window on the sky, a dashed course from world to world
I.push(['Flight plan', `<rect x="8" y="14" width="112" height="100" rx="14" fill="${INK}"/><g fill="#fff"><circle cx="30" cy="34" r="2"/><circle cx="94" cy="96" r="2"/><circle cx="62" cy="26" r="1.6"/><circle cx="104" cy="58" r="1.6"/></g>
<path d="M34 88 C44 50 80 76 92 40" fill="none" stroke="${GOLD}" stroke-width="4" stroke-dasharray="6 6" stroke-linecap="round"/><circle cx="32" cy="92" r="12" fill="${SKY}"/><circle cx="94" cy="36" r="10" fill="${OR}"/>${check(94, 36, 5, '#fff', 3.5)}`]);
// 20 Line-up: the sun and its worlds in a row, every script in its place
I.push(['Line-up', `<circle cx="-10" cy="64" r="44" fill="${GOLD}" stroke="${INK}" stroke-width="5"/><path d="M38 64 H124" stroke="${PL}" stroke-width="3" stroke-dasharray="4 5"/>
${[[50, 6, OR], [70, 8, SKY], [95, 11, P], [119, 6, GR]].map(([x, r, c]) => `<circle cx="${x}" cy="64" r="${r}" fill="${c}" stroke="${INK}" stroke-width="4"/>`).join('')}`]);

const cards = I.map(([t, b], i) => { const n = String(i + 1).padStart(2, '0'); writeFileSync(join(dir, `space-${n}.svg`), svg(`mcs${n}-`, `Mission Control — ${t}`, b)); return { n, t }; });
const fig = c => `<figure>${[96, 48, 28, 16].map(z => `<img src="space-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-space.html'), `<!doctype html><meta charset="utf-8"><title>Mission Control icons, round 2: space</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
.light{background:#fff;color:#222}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}</style>
${sec('light', 'White')}${sec('dark', 'Black')}\n`);
console.log('wrote ' + cards.length);
