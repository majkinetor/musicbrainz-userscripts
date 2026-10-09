// Apollo Editor icons, round 11: round 10's 17 (cutout disc) without the disc: the rocket is the solid shape,
// its window and seams cut through to the page. Writes icon-r11-00..20.svg and preview-round11.html
// (96, 48, 28, 16 px on white, dark grey and black, plus greyscale as the launcher shows it while off).
// 00 is round 10's 17 as it is.
//   node dev/mockups/apollo_icons/gen-round11.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const N = '#1b2a4a', OR = '#ff6a00', YE = '#ffd24a', RED = '#e63946', PUR = '#7a57e8', MBP = '#ba478f', MBO = '#eb743b';

const BODY = 'M64 8 C84 24 90 52 88 90 L40 90 C38 52 44 24 64 8 Z', SLIM = 'M64 6 C78 24 82 52 80 90 L48 90 C46 52 50 24 64 6 Z';
const FINL = 'M42 64 C28 72 22 90 24 110 L42 98 Z', FINR = 'M86 64 C100 72 106 90 104 110 L86 98 Z';
const NOZ = 'M48 90 L80 90 L76 100 L52 100 Z';
const FL = 'M52 100 C54 112 60 118 64 126 C68 118 74 112 76 100 Z';
const FL3 = 'M52 100 L50 120 L58 112 L64 126 L70 112 L78 120 L76 100 Z';
const lin = (a, b, x2 = 0) => `<linearGradient id="$g" x1="0" y1="0" x2="${x2}" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const halo = b => `<filter id="$h" x="-15%" y="-15%" width="130%" height="130%"><feMorphology in="SourceAlpha" operator="dilate" radius="3" result="d"/><feFlood flood-color="#fff" flood-opacity=".7"/><feComposite in2="d" operator="in" result="h"/><feMerge><feMergeNode in="h"/><feMergeNode in="SourceGraphic"/></feMerge></filter><g filter="url(#$h)">${b}</g>`;

// o: c (fill), flame (own colour, or false for none; default same as c), win (radius), ring, gapFins, seams, body, fl, tilt, defs, extra
const rocket = ({ c = OR, flame, win = 8, ring = false, gapFins = false, seams = true, body = BODY, fl = FL, tilt = 0, defs = '', extra = '', wrap = x => x } = {}) => {
  const tf = tilt ? ` transform="translate(64 64) rotate(${tilt}) scale(.86) translate(-64 -67)"` : '';
  const sameFlame = flame === undefined;
  const mask = `<mask id="$m" maskUnits="userSpaceOnUse" x="0" y="0" width="128" height="128"><g${tf}>` +
    `<g fill="#fff"><path d="${FINL}"/><path d="${FINR}"/></g>` +
    (gapFins ? `<path d="${body}" fill="none" stroke="#000" stroke-width="6" stroke-linejoin="round"/>` : '') +
    `<g fill="#fff"><path d="${body}"/><path d="${NOZ}"/>${sameFlame ? `<path d="${fl}"/>` : ''}</g>` +
    (seams ? `<g stroke="#000" stroke-width="3.5"><path d="M36 90.5 L92 90.5"/>${sameFlame ? '<path d="M46 100.5 L82 100.5"/>' : ''}</g>` : '') +
    `<circle cx="64" cy="50" r="${win}" fill="#000"/>` + (ring ? `<circle cx="64" cy="50" r="${win + 5}" fill="none" stroke="#000" stroke-width="3"/>` : '') +
    extra + `</g></mask>`;
  const fl2 = !sameFlame && flame ? `<g${tf}><path d="${fl}" fill="${flame}" transform="translate(0 3)"/></g>` : '';
  return defs + mask + wrap(fl2 + `<rect width="128" height="128" fill="${c}" mask="url(#$m)"/>`);
};

const V = [
  ['00', 'Round 10, 17', readFileSync(join(dir, 'icon-r10-17.svg'), 'utf8').replace(/^[\s\S]*?<\/title>\r?\n|<\/svg>\s*$/g, '')],
  ['01', 'Solid orange', rocket()],
  ['02', 'No flame', rocket({ flame: false })],
  ['03', 'Yellow flame', rocket({ flame: '#ffb020' })],
  ['04', 'Big window', rocket({ win: 12 })],
  ['05', 'Window ring', rocket({ win: 6, ring: true })],
  ['06', 'Loose fins', rocket({ gapFins: true })],
  ['07', 'No seams', rocket({ seams: false })],
  ['08', 'MusicBrainz orange', rocket({ c: MBO })],
  ['09', 'Red', rocket({ c: RED })],
  ['10', 'Purple', rocket({ c: PUR })],
  ['11', 'MusicBrainz purple', rocket({ c: MBP, flame: MBO })],
  ['12', 'Navy, light halo', rocket({ c: N, flame: OR, wrap: halo })],
  ['13', 'Orange to red', rocket({ c: 'url(#$g)', defs: lin('#ffa21a', RED) })],
  ['14', 'Purple to orange', rocket({ c: 'url(#$g)', defs: lin(PUR, OR) })],
  ['15', 'Tilted', rocket({ tilt: 45 })],
  ['16', 'Slim', rocket({ body: SLIM, gapFins: true })],
  ['17', 'Three-tongue flame', rocket({ fl: FL3 })],
  ['18', 'Nose band', rocket({ extra: '<path d="M44 30 L84 30" stroke="#000" stroke-width="3.5"/>' })],
  ['19', 'Highlight cut', rocket({ extra: '<path d="M51 70 C50 50 53 34 59 22" fill="none" stroke="#000" stroke-width="3.5" stroke-linecap="round"/>' })],
  ['20', 'Navy window', rocket({ extra: '' }) + '<circle cx="64" cy="50" r="6" fill="#1b2a4a"/>'],
];
const cards = V.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r11-${n}.svg`), svg(`ap11${n}-`, `Apollo Editor — ${t}`, b)); return { n, t }; });
const fig = c => `<figure${c.n === '00' ? ' class="pick"' : ''}>${[96, 48, 28, 16].map(z => `<img src="icon-r11-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-round11.html'), `<!doctype html><meta charset="utf-8"><title>Apollo Editor icons, round 11</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(7,1fr);gap:16px}
.light{background:#fff;color:#222}.grey,.off{background:#2b2b2b;color:#ddd}.dark{background:#000;color:#ddd}.off img{filter:grayscale(1);opacity:.75}
figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}.pick figcaption{font-weight:700}</style>
${sec('light', 'White')}${sec('grey', 'Dark grey (#2b2b2b)')}${sec('dark', 'Black')}${sec('off', 'Launcher off: greyscale on dark grey')}\n`);
console.log('wrote ' + cards.length);
