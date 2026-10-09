// Apollo Editor icons, round 9: twenty new rockets, none built on the current line rocket.
// Writes icon-r9-00..20.svg and preview-round9.html (96, 48, 28, 16 px on white, dark grey and black,
// plus greyscale on dark grey, as the corner launcher shows it while off). 00 is today's icon.
//   node dev/mockups/apollo_icons/gen-round9.mjs
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

const V = [
  ['00', 'Today\'s icon', readFileSync(join(dir, '../../../userscripts/apollo_editor/icon.svg'), 'utf8').replace(/^[\s\S]*?<\/title>\r?\n|<\/svg>\s*$/g, '')],
  ['01', 'Fat cartoon', halo(rocket({ body: RED, fin: N, win: SKY, ring: '#fff' }))],
  ['02', 'Emoji tilt', halo(at(64, 64, .86, 45, rocket({ body: '#e8edf5', nose: RED, fin: RED })))],
  ['03', 'Retro silver', halo(`<path d="M54 92 L64 122 L74 92 Z" fill="${OR}"/><g stroke="${N}" stroke-width="4" stroke-linejoin="round"><path d="M51 62 C36 72 30 92 28 116 L51 98 Z" fill="${RED}"/><path d="M77 62 C92 72 98 92 100 116 L77 98 Z" fill="${RED}"/><path d="M64 6 C74 14 78 30 78 50 L78 94 L50 94 L50 50 C50 30 54 14 64 6 Z" fill="#c9ced8"/><rect x="50" y="70" width="28" height="7" fill="${RED}"/><rect x="61" y="82" width="6" height="34" rx="2" fill="${RED}"/></g><circle cx="64" cy="42" r="8" fill="${SKY}" stroke="${N}" stroke-width="4"/>`)],
  ['04', 'Shuttle stack', halo(`<g fill="${OR}"><path d="M32 106 L38 124 L44 106 Z"/><path d="M84 106 L90 124 L96 106 Z"/><path d="M58 106 L64 120 L70 106 Z"/></g><g stroke="${N}" stroke-width="4" stroke-linejoin="round"><path d="M50 34 C50 16 78 16 78 34 L78 104 L50 104 Z" fill="#e07a2e"/><path d="M32 40 L38 24 L44 40 L44 106 L32 106 Z" fill="#fff"/><path d="M84 40 L90 24 L96 40 L96 106 L84 106 Z" fill="#fff"/><path d="M56 84 L38 108 L56 104 Z" fill="#fff"/><path d="M72 84 L90 108 L72 104 Z" fill="#fff"/><path d="M56 56 C56 44 72 44 72 56 L72 106 L56 106 Z" fill="#fff"/><path d="M56 56 C56 44 72 44 72 56 Z" fill="${N}"/></g>`)],
  ['05', 'Escape tower', halo(`<path d="M56 110 C58 118 62 122 64 126 C66 122 70 118 72 110 Z" fill="${OR}"/><g stroke="${N}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><path d="M52 92 L38 114 L52 108 Z" fill="${RED}"/><path d="M76 92 L90 114 L76 108 Z" fill="${RED}"/><path d="M54 104 L74 104 L72 110 L56 110 Z" fill="${N}"/><path d="M52 44 L76 44 L76 104 L52 104 Z" fill="#fff"/><path d="M52 44 L64 24 L76 44 Z" fill="${N}"/><path d="M64 24 L64 6" fill="none"/><path d="M58 24 L64 12 L70 24" fill="none" stroke-width="3"/></g><rect x="54" y="58" width="20" height="8" fill="${N}"/><rect x="54" y="80" width="10" height="12" fill="${N}"/><rect x="64" y="68" width="10" height="12" fill="${N}"/>`)],
  ['06', 'Geometric', halo(`<path d="M48 96 L64 124 L80 96 Z" fill="#ffb020"/><path d="M42 70 L20 106 L42 96 Z" fill="${OR}"/><path d="M86 70 L108 106 L86 96 Z" fill="${OR}"/><rect x="42" y="46" width="44" height="50" fill="${N}"/><path d="M64 8 L86 46 L42 46 Z" fill="${RED}"/><circle cx="64" cy="68" r="10" fill="#fff"/>`)],
  ['07', 'Liftoff smoke', halo(at(64, 46, .6, 0, rocket({ fin: RED })) + (c => `<g fill="${N}">${c.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 4}"/>`).join('')}</g><g fill="#e8edf5">${c.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`)([[24, 108, 11], [42, 102, 15], [64, 98, 17], [86, 102, 15], [104, 108, 11], [64, 112, 12]]))],
  ['08', 'Navy tile', `<rect x="6" y="6" width="116" height="116" rx="28" fill="${N}"/>` + at(64, 66, .78, 0, rocket({ body: '#fff', fin: '#fff', line: 'none', noz: '#9fb3dc', win: N, ring: 'none' }) + `<circle cx="64" cy="50" r="5" fill="${OR}"/>`)],
  ['09', 'Orange tile', `<linearGradient id="$g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffa21a"/><stop offset="1" stop-color="${RED}"/></linearGradient><rect x="6" y="6" width="116" height="116" rx="28" fill="url(#$g)"/>` + at(64, 64, .74, 45, rocket({ body: '#fff', fin: '#fff', line: 'none', noz: '#ffe3c2', win: N, ring: 'none', flame: '#fff3c4', core: '#fff' }))],
  ['10', 'Shaded', halo(rocket({ body: '#fff', nose: RED, fin: RED }) + `<clipPath id="$s"><path d="${BODY}"/><path d="${FINL}"/><path d="${FINR}"/></clipPath><rect x="64" y="0" width="64" height="104" fill="${N}" opacity=".2" clip-path="url(#$s)"/>`)],
  ['11', 'Checkered', halo(`<pattern id="$p" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#fff"/><rect width="8" height="8" fill="${RED}"/><rect x="8" y="8" width="8" height="8" fill="${RED}"/></pattern>` + rocket({ body: `url(#$p)`, fin: RED, win: SKY }))],
  ['12', 'Swoosh trail', `<linearGradient id="$t" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${OR}" stop-opacity="0"/><stop offset=".55" stop-color="${OR}"/><stop offset="1" stop-color="${YE}"/></linearGradient><path d="M8 124 C22 94 42 76 70 62" fill="none" stroke="url(#$t)" stroke-width="14" stroke-linecap="round"/><path d="M30 124 C40 104 54 92 74 82" fill="none" stroke="url(#$t)" stroke-width="7" stroke-linecap="round" opacity=".8"/>` + halo(at(84, 44, .58, 45, rocket({ body: '#fff', nose: RED, fin: RED, flameOn: false }))) ],
  ['13', 'Chibi', halo(`<path d="M50 96 C54 110 64 122 64 122 C64 122 74 110 78 96 Z" fill="${OR}"/><path d="M56 96 C58 104 64 112 64 112 C64 112 70 104 72 96 Z" fill="${YE}"/><g stroke="${N}" stroke-width="5" stroke-linejoin="round"><path d="M42 70 C26 78 26 96 32 106 L48 94 Z" fill="${OR}"/><path d="M86 70 C102 78 102 96 96 106 L80 94 Z" fill="${OR}"/><ellipse cx="64" cy="58" rx="28" ry="44" fill="${PUR}"/></g><circle cx="64" cy="52" r="15" fill="#fff" stroke="${N}" stroke-width="5"/><circle cx="59" cy="47" r="4" fill="${SKY}"/>`)],
  ['14', 'Blastoff', halo(`<path d="M48 70 C38 96 46 112 64 126 C82 112 90 96 80 70 Z" fill="${OR}"/><path d="M54 70 C49 92 54 104 64 116 C74 104 79 92 74 70 Z" fill="${YE}"/><path d="M60 70 C58 84 60 92 64 100 C68 92 70 84 68 70 Z" fill="#fff"/>` + `<g transform="translate(64 2) scale(.7) translate(-64 0)">${rocket({ body: '#fff', nose: RED, fin: RED, flameOn: false })}</g><g stroke="${N}" stroke-width="5" stroke-linecap="round"><path d="M26 30 L26 52"/><path d="M14 50 L14 64"/><path d="M102 30 L102 52"/><path d="M114 50 L114 64"/></g>`)],
  ['15', 'Among stars', halo(at(64, 68, .74, 0, rocket({ body: '#fff', nose: RED, fin: RED })), 2.5) + star(22, 26, 13, '#ffb020') + star(106, 22, 9, '#ffb020') + star(110, 86, 11, '#ffb020') + star(16, 94, 7, '#ffb020')],
  ['16', 'Single colour', halo(`<g fill="${N}"><path d="${FINL}"/><path d="${FINR}"/><path d="${NOZ}"/><path d="${BODY}"/><path d="M52 106 C54 114 60 118 64 126 C68 118 74 114 76 106 Z"/></g><circle cx="64" cy="50" r="12" fill="#fff"/><circle cx="64" cy="50" r="6" fill="${N}"/>`)],
  ['17', 'Gradient', halo(`<linearGradient id="$g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${PUR}"/><stop offset="1" stop-color="${OR}"/></linearGradient>` + rocket({ body: 'url(#$g)', fin: '#4b2fb0', line: 'none', noz: '#4b2fb0', win: '#fff', ring: 'none', flame: '#ffb020', core: '#fff3c4' }) + `<circle cx="64" cy="50" r="5" fill="${N}"/>`)],
  ['18', 'Origami', halo(`<path d="M50 90 L64 124 L78 90 Z" fill="${OR}"/><path d="M57 90 L64 112 L71 90 Z" fill="${YE}"/><path d="M44 60 L20 106 L42 92 Z" fill="#b52a35"/><path d="M44 60 L30 100 L42 92 Z" fill="${RED}"/><path d="M84 60 L108 106 L86 92 Z" fill="#b52a35"/><path d="M84 60 L98 100 L86 92 Z" fill="${RED}"/><path d="M44 40 L64 46 L64 90 L40 90 Z" fill="#a9defa"/><path d="M84 40 L64 46 L64 90 L88 90 Z" fill="#4aa8e0"/><path d="M64 8 L44 40 L64 46 Z" fill="#6cc4f2"/><path d="M64 8 L84 40 L64 46 Z" fill="#2f8fcc"/><path d="M64 56 L74 66 L64 76 L54 66 Z" fill="${N}"/>`)],
  ['19', 'Breakout', `<circle cx="64" cy="76" r="46" fill="${OR}"/>` + halo(rocket({ body: '#fff', nose: RED, fin: N, flame: YE, core: '#fff' }), 2.5)],
  ['20', 'Offset print', halo(`<g transform="translate(6 4)"><path d="${FL}" fill="${OR}"/><path d="${FINL}" fill="${RED}"/><path d="${FINR}" fill="${RED}"/><path d="${BODY}" fill="${SKY}"/></g><g fill="none" stroke="${N}" stroke-width="5" stroke-linejoin="round"><path d="${FINL}"/><path d="${FINR}"/><path d="${NOZ}"/><path d="${BODY}"/><path d="${FL}"/><circle cx="64" cy="50" r="11"/></g>`)],
];
const cards = V.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r9-${n}.svg`), svg(`ap9${n}-`, `Apollo Editor — ${t}`, b)); return { n, t }; });
const fig = c => `<figure${c.n === '00' ? ' class="pick"' : ''}>${[96, 48, 28, 16].map(z => `<img src="icon-r9-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-round9.html'), `<!doctype html><meta charset="utf-8"><title>Apollo Editor icons, round 9</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(7,1fr);gap:16px}
.light{background:#fff;color:#222}.grey,.off{background:#2b2b2b;color:#ddd}.dark{background:#000;color:#ddd}.off img{filter:grayscale(1);opacity:.75}
figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}.pick figcaption{font-weight:700}</style>
${sec('light', 'White')}${sec('grey', 'Dark grey (#2b2b2b)')}${sec('dark', 'Black')}${sec('off', 'Launcher off: greyscale on dark grey')}\n`);
console.log('wrote ' + cards.length);
