// Apollo Editor icons, round 10: twenty more new rockets, none built on the current line rocket.
// Writes icon-r10-00..20.svg and preview-round10.html (96, 48, 28, 16 px on white, dark grey and black,
// plus greyscale on dark grey, as the corner launcher shows it while off). 00 is today's icon.
//   node dev/mockups/apollo_icons/gen-round10.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const N = '#1b2a4a', OR = '#ff6a00', YE = '#ffd24a', RED = '#e63946', SKY = '#5ec8ff', PUR = '#7a57e8';

// a light halo hugging the outside of whatever it wraps, so navy edges read on dark pages
const halo = (b, r = 3, op = .7) => `<filter id="$h" x="-15%" y="-15%" width="130%" height="130%"><feMorphology in="SourceAlpha" operator="dilate" radius="${r}" result="d"/><feFlood flood-color="#fff" flood-opacity="${op}"/><feComposite in2="d" operator="in" result="h"/><feMerge><feMergeNode in="h"/><feMergeNode in="SourceGraphic"/></feMerge></filter><g filter="url(#$h)">${b}</g>`;
const at = (x, y, s, rot, b) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s}) translate(-64 -67)">${b}</g>`;

// the fat cartoon rocket most variants share
const BODY = 'M64 8 C84 24 90 52 88 90 L40 90 C38 52 44 24 64 8 Z';
const FINL = 'M42 64 C28 72 22 90 24 110 L42 98 Z', FINR = 'M86 64 C100 72 106 90 104 110 L86 98 Z';
const NOZ = 'M48 90 L80 90 L76 100 L52 100 Z';
const FL = 'M52 100 C54 112 60 118 64 126 C68 118 74 112 76 100 Z', FLI = 'M57 100 C58 108 62 112 64 118 C66 112 70 108 71 100 Z';
const rocket = ({ body = '#fff', nose, fin = RED, line = N, sw = 5, win = SKY, ring = N, noz = N, flame = OR, core = YE, flameOn = true } = {}) =>
  (flameOn ? `<path d="${FL}" fill="${flame}"/><path d="${FLI}" fill="${core}"/>` : '') +
  `<g stroke="${line}" stroke-width="${line === 'none' ? 0 : sw}" stroke-linejoin="round"><path d="${FINL}" fill="${fin}"/><path d="${FINR}" fill="${fin}"/><path d="${NOZ}" fill="${noz}"/><path d="${BODY}" fill="${body}"/></g>` +
  (nose ? `<clipPath id="$n"><rect width="128" height="34"/></clipPath><path d="${BODY}" fill="${nose}" clip-path="url(#$n)"/><path d="${BODY}" fill="none" stroke="${line}" stroke-width="${line === 'none' ? 0 : sw}" stroke-linejoin="round"/>` : '') +
  `<circle cx="64" cy="50" r="11" fill="${win}" stroke="${ring}" stroke-width="${ring === 'none' ? 0 : 5}"/>`;
const star = (x, y, r, c) => `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z" fill="${c}"/>`;


const MBP = '#ba478f', MBO = '#eb743b';
const puffs = (c, fill = '#e8edf5') => `<g fill="${N}">${c.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 4}"/>`).join('')}</g><g fill="${fill}">${c.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
const SIL = `<path d="${FINL}"/><path d="${FINR}"/><path d="${NOZ}"/><path d="${BODY}"/>`;

const V = [
  ['00', 'Today\'s icon', readFileSync(join(dir, '../../../userscripts/apollo_editor/icon.svg'), 'utf8').replace(/^[\s\S]*?<\/title>\r?\n|<\/svg>\s*$/g, '')],
  ['01', 'MusicBrainz colours', halo(rocket({ body: MBP, fin: MBO, win: '#fff', flame: MBO }))],
  ['02', 'Flying right', halo(`<g stroke="${N}" stroke-width="5" stroke-linecap="round"><path d="M6 40 L24 40"/><path d="M14 52 L26 52"/><path d="M6 88 L24 88"/><path d="M14 76 L26 76"/></g>` + at(68, 64, .8, 90, rocket({ body: '#fff', nose: RED, fin: RED })))],
  ['03', 'Firework', halo(`<path d="M64 74 L64 124" stroke="#c08a4a" stroke-width="5" stroke-linecap="round"/><g stroke="${N}" stroke-width="4" stroke-linejoin="round"><rect x="50" y="30" width="28" height="46" fill="${RED}"/><path d="M48 30 L64 6 L80 30 Z" fill="#ffb020"/></g><rect x="52" y="44" width="24" height="6" fill="#fff"/><rect x="52" y="58" width="24" height="6" fill="#fff"/>`) + star(44, 92, 9, '#ffb020') + star(86, 98, 8, OR) + star(52, 114, 6, '#ffb020') + star(80, 118, 5, OR)],
  ['04', 'Left tilt', halo(puffs([[98, 104, 11], [112, 118, 7], [84, 116, 7]]) + at(60, 56, .72, -35, rocket({ body: '#fff', nose: SKY, fin: SKY, win: RED })))],
  ['05', 'Soyuz', halo(`<g fill="${OR}"><path d="M42 106 L48 122 L54 106 Z"/><path d="M74 106 L80 122 L86 106 Z"/><path d="M58 106 L64 124 L70 106 Z"/></g><g stroke="${N}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><path d="M64 12 L64 4" fill="none"/><path d="M58 30 L64 12 L70 30 L72 106 L56 106 Z" fill="#fff"/><path d="M56 44 L44 96 L40 106 L58 106 Z" fill="#c9ced8"/><path d="M72 44 L84 96 L88 106 L70 106 Z" fill="#c9ced8"/><path d="M60 24 L64 12 L68 24 Z" fill="${RED}"/></g>`)],
  ['06', 'Long shadow', `<clipPath id="$c"><circle cx="64" cy="64" r="58"/></clipPath><circle cx="64" cy="64" r="58" fill="#2ec4b6"/><g clip-path="url(#$c)" fill="${N}">${Array.from({ length: 40 }, (_, i) => `<g transform="translate(${i * 1.5} ${i * 1.5})" opacity=".05">${at(64, 64, .74, 0, SIL)}</g>`).join('')}</g>` + at(64, 64, .74, 0, rocket({ body: '#fff', fin: OR, line: 'none', noz: '#cfd6e2', win: N, ring: 'none', flame: YE, core: '#fff' }))],
  ['07', 'Crest', `<path d="M64 6 L112 20 L112 60 C112 92 90 112 64 124 C38 112 16 92 16 60 L16 20 Z" fill="${N}" stroke="#ffb020" stroke-width="5" stroke-linejoin="round"/>` + at(64, 66, .62, 0, rocket({ body: '#fff', fin: RED, line: 'none', noz: '#9fb3dc', win: N, ring: 'none' }))],
  ['08', 'Doodle', halo(`<g transform="translate(5 3)" opacity=".85"><path d="${FINL}" fill="${RED}"/><path d="${FINR}" fill="${RED}"/><path d="M63 9 C80 22 92 50 87 89 L41 91 C37 55 45 26 63 9 Z" fill="#ffe8a8"/><path d="${FL}" fill="${OR}"/></g><g fill="none" stroke="${N}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><path d="M63 9 C80 22 92 50 87 89 L41 91 C37 55 45 26 63 9 Z"/><path d="M41 63 C27 73 21 89 25 109 L42 97"/><path d="M87 65 C101 71 107 91 103 111 L86 97"/><path d="M50 91 L52 100 L77 99 L79 90"/><path d="M53 101 C55 112 60 118 64 125 C68 117 74 112 75 100"/><path d="M64 39 C70 39 75 44 75 50 C75 57 70 61 64 61 C57 61 53 56 53 50 C53 45 57 40 66 40"/></g><g fill="none" stroke="${N}" stroke-width="2" opacity=".5"><path d="M65 11 C81 25 91 52 85 88"/></g>`)],
  ['09', 'Glossy', halo(`<radialGradient id="$b" cx=".35" cy=".35" r=".8"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#aab4c8"/></radialGradient><linearGradient id="$f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6b76"/><stop offset="1" stop-color="#b52a35"/></linearGradient><radialGradient id="$w" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#d4f1ff"/><stop offset="1" stop-color="#1f8fd0"/></radialGradient>` + rocket({ body: 'url(#$b)', nose: 'url(#$f)', fin: 'url(#$f)', win: 'url(#$w)' }) + `<path d="M50 44 C50 32 55 22 61 15 C56 28 54 42 55 74 C52 66 50 56 50 44 Z" fill="#fff" opacity=".75"/>`)],
  ['10', 'Delta wings', halo(`<path d="M57 96 L64 124 L71 96 Z" fill="${OR}"/><g stroke="${N}" stroke-width="4" stroke-linejoin="round"><path d="M56 50 L12 100 L12 110 L56 96 Z" fill="${RED}"/><path d="M72 50 L116 100 L116 110 L72 96 Z" fill="${RED}"/><path d="M64 6 C72 16 74 30 74 46 L74 96 L54 96 L54 46 C54 30 56 16 64 6 Z" fill="#fff"/></g><circle cx="64" cy="38" r="6" fill="${SKY}" stroke="${N}" stroke-width="3.5"/>`)],
  ['11', 'Tin toy', halo(rocket({ body: '#c9ced8', nose: RED, fin: RED }) + `<g fill="${N}">${[[48, 66], [80, 66], [46, 82], [82, 82], [64, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4"/>`).join('')}</g><path d="M64 66 L67 73 L74 73 L68.5 77.5 L71 85 L64 80.5 L57 85 L59.5 77.5 L54 73 L61 73 Z" fill="#ffb020" stroke="${N}" stroke-width="1.5" stroke-linejoin="round"/>`)],
  ['12', 'On the pad', halo(`<g fill="none" stroke="${N}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><path d="M12 22 L12 122 M28 22 L28 122 M12 32 L28 46 L12 60 L28 74 L12 88 L28 102 L12 116 M28 50 L44 50 M6 122 L122 122"/></g>` + at(78, 62, .86, 0, rocket({ body: '#fff', nose: RED, fin: RED })))],
  ['13', 'Needle', halo(`<path d="M58 96 L64 126 L70 96 Z" fill="${OR}"/><g stroke="${N}" stroke-width="4" stroke-linejoin="round"><path d="M57 78 L42 114 L57 104 Z" fill="${N}"/><path d="M71 78 L86 114 L71 104 Z" fill="${N}"/><path d="M64 4 C70 20 72 40 72 96 L56 96 C56 40 58 20 64 4 Z" fill="#fff"/></g><circle cx="64" cy="42" r="5" fill="${RED}"/>`)],
  ['14', 'EQ flame', halo(`${[22, 34, 44, 32, 20].map((h, i) => `<rect x="${45 + i * 8}" y="80" width="6" height="${h}" rx="2" fill="${i === 2 ? YE : i % 2 ? '#ffb020' : OR}"/>`).join('')}` + at(64, 52, .8, 0, rocket({ body: '#fff', nose: PUR, fin: PUR, flameOn: false })))],
  ['15', 'Sound-wave exhaust', halo(at(64, 46, .7, 0, rocket({ body: '#fff', nose: RED, fin: RED, flameOn: false })) + `<g fill="none" stroke-width="6" stroke-linecap="round"><path d="M50 80 Q64 89 78 80" stroke="${YE}"/><path d="M40 93 Q64 107 88 93" stroke="#ffb020"/><path d="M30 106 Q64 125 98 106" stroke="${OR}"/></g>`)],
  ['16', 'Candy stripe', halo(`<pattern id="$p" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="14" height="14" fill="#fff"/><rect width="7" height="14" fill="${RED}"/></pattern>` + rocket({ body: 'url(#$p)', fin: N, win: '#fff' }))],
  ['17', 'Cutout disc', `<mask id="$m" maskUnits="userSpaceOnUse" x="0" y="0" width="128" height="128"><circle cx="64" cy="64" r="58" fill="#fff"/><g fill="#000">${at(64, 64, .8, 0, SIL + `<path d="${FL}"/>`)}</g>${at(64, 64, .8, 0, '<circle cx="64" cy="50" r="8" fill="#fff"/>')}</mask><circle cx="64" cy="64" r="58" fill="${OR}" mask="url(#$m)"/>`],
  ['18', 'Kawaii', halo(rocket({ body: '#fff', nose: '#ff8fab', fin: '#ff8fab', win: '#fff', ring: 'none', flame: '#ffb020' }) + `<circle cx="54" cy="56" r="4.5" fill="${N}"/><circle cx="74" cy="56" r="4.5" fill="${N}"/><path d="M57 66 Q64 73 71 66" fill="none" stroke="${N}" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="48" cy="66" rx="5" ry="3" fill="#ff8fab"/><ellipse cx="80" cy="66" rx="5" ry="3" fill="#ff8fab"/>`)],
  ['19', 'Trajectory', halo(`<circle cx="10" cy="122" r="22" fill="${SKY}" stroke="${N}" stroke-width="4"/><path d="M24 104 C34 82 52 70 72 58" fill="none" stroke="${N}" stroke-width="5" stroke-dasharray="0 11" stroke-linecap="round"/>` + at(88, 40, .56, 45, rocket({ body: '#fff', nose: RED, fin: RED })))],
  ['20', 'Ink stamp', `<filter id="$r" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".08" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="4"/></filter><g filter="url(#$r)" opacity=".92"><circle cx="64" cy="64" r="57" fill="none" stroke="#e63946" stroke-width="6"/><circle cx="64" cy="64" r="48" fill="none" stroke="#e63946" stroke-width="2.5"/><g fill="#e63946">${at(64, 64, .66, 0, SIL + `<path d="${FL}"/>`)}</g>${at(64, 64, .66, 0, '<circle cx="64" cy="50" r="9" fill="#fff"/>')}</g>`],
];
const cards = V.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r10-${n}.svg`), svg(`ap10${n}-`, `Apollo Editor — ${t}`, b)); return { n, t }; });
const fig = c => `<figure${c.n === '00' ? ' class="pick"' : ''}>${[96, 48, 28, 16].map(z => `<img src="icon-r10-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-round10.html'), `<!doctype html><meta charset="utf-8"><title>Apollo Editor icons, round 10</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(7,1fr);gap:16px}
.light{background:#fff;color:#222}.grey,.off{background:#2b2b2b;color:#ddd}.dark{background:#000;color:#ddd}.off img{filter:grayscale(1);opacity:.75}
figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}.pick figcaption{font-weight:700}</style>
${sec('light', 'White')}${sec('grey', 'Dark grey (#2b2b2b)')}${sec('dark', 'Black')}${sec('off', 'Launcher off: greyscale on dark grey')}\n`);
console.log('wrote ' + cards.length);
