// Credit Hoarder icons: the ant without its cream tile or ground line, made to read on dark pages as well as light —
// a halo like Apollo's rocket, a lighter or coloured body, a glow. Writes icon-ant-00..12.svg and preview-ant.html
// (96, 48, 28, 16 px on white, dark grey and black); 00 is the ant as it is, minus tile and ground.
//   node dev/mockups/credit_hoarder_icons/gen-ant.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const INK = '#22223b';
const GRAD = '<linearGradient id="$g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f9a826"/><stop offset=".5" stop-color="#f3722c"/><stop offset="1" stop-color="#d00070"/></linearGradient>';
const LEGS = 'M26 86 l-6 12 M34 88 l2 12 M46 82 l-4 16 M52 84 l8 14 M72 62 C78 52 86 48 92 48 M70 62 C72 52 70 44 64 40';
const HEX = 'M113.6 45.0 L98.0 54.0 L82.4 45.0 L82.4 27.0 L98.0 18.0 L113.6 27.0Z';
const body = (c, extra = 0, stroke = 'none') => `<g fill="${c}" stroke="${stroke === 'none' && extra ? c : stroke}" stroke-width="${extra}"><ellipse cx="30" cy="80" rx="14" ry="10"/><circle cx="50" cy="76" r="8"/><circle cx="66" cy="70" r="10"/></g>`;
const legs = (c, w = 3.5) => `<g stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none"><path d="${LEGS}"/></g>`;
const badge = (line = INK) => `<path d="${HEX}" fill="url(#$g)" stroke="${line}" stroke-width="3" stroke-linejoin="round" transform="rotate(-10 98 36)"/><g transform="translate(98 37) scale(0.9)" fill="#fff"><circle cx="0" cy="-5" r="5"/><path d="M-9 9 C-9 0 9 0 9 9Z"/></g>`;
// the ant: body colour, leg colour, badge outline
const ant = (o = {}) => { const k = { body: INK, legs: null, line: INK, ...o }; return `${body(k.body)}${legs(k.legs || k.body)}${badge(k.line)}`; };
// a halo of width w on every edge: the whole silhouette, widened
const halo = (c, w, op = 1) => `<g opacity="${op}">${body(c, w * 2)}${legs(c, 3.5 + w * 2)}<path d="${HEX}" fill="${c}" stroke="${c}" stroke-width="${3 + w * 2}" stroke-linejoin="round" transform="rotate(-10 98 36)"/></g>`;
const glow = (c, sd, op) => `<filter id="$b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${sd}"/></filter><g filter="url(#$b)">${halo(c, 2, op)}</g>`;

const V = [
  ['00', 'As it is, no tile', ant()],
  ['01', 'Halo, 2, at 70%', halo('#fff', 2, .7) + ant()],
  ['02', 'Halo, 1.5, at 70%', halo('#fff', 1.5, .7) + ant()],
  ['03', 'Halo, 2, full', halo('#fff', 2) + ant()],
  ['04', 'Halo, 2, light slate', halo('#aab6d0', 2) + ant()],
  ['05', 'Soft glow', glow('#fff', 2.5, .7) + ant()],
  ['06', 'Slate body', ant({ body: '#5a6f9c', line: '#5a6f9c' })],
  ['07', 'Light slate body', ant({ body: '#8a9cc8', line: '#8a9cc8' })],
  ['08', 'Purple body', ant({ body: '#7a57e8', line: '#7a57e8' })],
  ['09', 'Rust body', ant({ body: '#b5501d', line: '#b5501d' })],
  ['10', 'Gradient body', ant({ body: 'url(#$g)', line: '#d00070' })],
  ['11', 'Slate body, halo', halo('#fff', 1.5, .6) + ant({ body: '#5a6f9c', line: '#5a6f9c' })],
  ['12', 'Ink body, light outline', ant({ body: INK }).replace(`<g fill="${INK}" stroke="none" stroke-width="0">`, `<g fill="${INK}" stroke="#aab6d0" stroke-width="2">`)],
];
const cards = V.map(([n, t, b]) => { writeFileSync(join(dir, `icon-ant-${n}.svg`), svg(`cha${n}-`, `Credit Hoarder — ${t}`, `<defs>${GRAD}</defs>${b}`)); return { n, t }; });
const fig = c => `<figure${c.n === '00' ? ' class="pick"' : ''}>${[96, 48, 28, 16].map(z => `<img src="icon-ant-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-ant.html'), `<!doctype html><meta charset="utf-8"><title>Credit Hoarder ant icons</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
.light{background:#fff;color:#222}.grey{background:#2b2b2b;color:#ddd}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}.pick figcaption{font-weight:700}</style>
${sec('dark', 'Black')}${sec('grey', 'Dark grey (#2b2b2b)')}${sec('light', 'White')}\n`);
console.log('wrote ' + cards.length);
