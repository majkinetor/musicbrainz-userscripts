// Apollo Editor icons, round 5: Falcon's current line rocket (the pick for Apollo) made to read on dark pages as well
// as light — line colour, a halo, a filled body, a tile. Writes icon-r5-00..16.svg and preview-round5.html
// (128, 48, 28, 16 px on white, MusicBrainz grey, dark grey and black); 00 is the rocket as it is.
//   node dev/mockups/apollo_icons/gen-round5.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
// Falcon's icon.svg: an outlined body and fins, a porthole, a filled flame
const BODY = 'M64 10 C82 28 90 56 90 80 L38 80 C38 56 46 28 64 10 Z', FINL = 'M38 80 L20 110 L40 96 Z', FINR = 'M90 80 L108 110 L88 96 Z', FLAME = 'M50 80 L45 108 L64 122 L83 108 L78 80 Z';
const rocket = (o = {}) => { const k = { line: '#1b2a4a', w: 7, fill: 'none', fins: 'none', win: null, flame: '#ff6a00', flameLine: null, halo: null, haloW: 6, ...o };
  const lines = (stroke, w) => `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"><path d="${BODY}"/><path d="${FINL}"/><path d="${FINR}"/></g>`;
  return `${k.halo ? lines(k.halo, k.w + k.haloW * 2) + `<path d="${FLAME}" fill="none" stroke="${k.halo}" stroke-width="${5 + k.haloW * 2}" stroke-linejoin="round"/>` : ''}
<path d="${BODY}" fill="${k.fill}"/><path d="${FINL}" fill="${k.fins}"/><path d="${FINR}" fill="${k.fins}"/>${lines(k.line, k.w)}<circle cx="64" cy="44" r="10" fill="${k.win || k.line}"/>
<path d="${FLAME}" fill="${k.flame}" stroke="${k.flameLine || k.line}" stroke-width="5" stroke-linejoin="round"/>`; };
const tile = (fill, rx = 26) => `<rect x="4" y="4" width="120" height="120" rx="${rx}" fill="${fill}"/>`;
// shrink the rocket into a tile
const inTile = (t, r) => `${t}<g transform="translate(64 64) scale(.78) translate(-64 -66)">${r}</g>`;

const V = [
  ['00', 'As it is (navy)', rocket()],
  ['01', 'Slate line', rocket({ line: '#5a6f9c' })],
  ['02', 'Purple line', rocket({ line: '#7a57e8' })],
  ['03', 'Light halo', rocket({ halo: '#ffffff' })],
  ['04', 'Thin light halo', rocket({ halo: '#e8ecf5', haloW: 3 })],
  ['05', 'Cream body', rocket({ fill: '#f6efe2', fins: '#f6efe2' })],
  ['06', 'White body, blue fins', rocket({ fill: '#ffffff', fins: '#5a6f9c' })],
  ['07', 'Cream body, purple', rocket({ line: '#5f3ec0', fill: '#f1ecff', fins: '#b9a8ec', win: '#5f3ec0' })],
  ['08', 'Two-tone', rocket({ line: '#1b2a4a', fill: '#9fb3dc', fins: '#ff6a00', win: '#1b2a4a' })],
  ['09', 'Filled slate', rocket({ line: '#2b3a5e', fill: '#5a6f9c', fins: '#2b3a5e', win: '#f6efe2' })],
  ['10', 'Steel gradient', `<defs>${lg('$g', ['#e9edf5', '#9aa7c2'], 1, 0)}</defs>${rocket({ fill: 'url(#$g)', fins: '#5a6f9c' })}`],
  ['11', 'Light line (dark-first)', rocket({ line: '#dfe5f2', flameLine: '#dfe5f2', win: '#dfe5f2' })],
  ['12', 'Navy tile', inTile(tile('#1b2a4a'), rocket({ line: '#f6efe2', flameLine: '#f6efe2', win: '#f6efe2' }))],
  ['13', 'Cream tile', inTile(tile('#f6efe2'), rocket())],
  ['14', 'Orange tile', inTile(tile('#ff6a00'), rocket({ line: '#1b2a4a', fill: '#ffffff', fins: '#ffffff', flame: '#ffd24a' }))],
  ['15', 'Round badge', `<circle cx="64" cy="64" r="60" fill="#e8ecf5"/>${`<g transform="translate(64 64) scale(.74) translate(-64 -66)">${rocket()}</g>`}`],
  ['16', 'Gold line', rocket({ line: '#c9a227', flame: '#ff6a00', flameLine: '#c9a227' })],
];
const cards = V.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r5-${n}.svg`), svg(`ap5${n}-`, `Apollo Editor — ${t}`, b)); return { n, t }; });
const fig = c => `<figure${c.n === '00' ? ' class="pick"' : ''}>${[96, 48, 28, 16].map(z => `<img src="icon-r5-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-round5.html'), `<!doctype html><meta charset="utf-8"><title>Apollo Editor icons, round 5</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(6,1fr);gap:16px}
.light{background:#fff;color:#222}.mb{background:#f2f2f2;color:#222}.grey{background:#2b2b2b;color:#ddd}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}.pick figcaption{font-weight:700}</style>
${sec('light', 'White')}${sec('grey', 'Dark grey (#2b2b2b)')}${sec('dark', 'Black')}\n`);
console.log('wrote ' + cards.length);
