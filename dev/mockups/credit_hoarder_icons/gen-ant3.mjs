// Credit Hoarder icons: ant 02 with its badge and feelers left exactly as they are, and only the ant grown — bigger,
// or reared up so the whole icon is squarer and fills more of its box. The body grows about the head, so it stays
// joined to the feelers. Writes icon-ant3-01..10.svg and preview-ant3.html (96, 48, 28, 16 px on white and black).
//   node dev/mockups/credit_hoarder_icons/gen-ant3.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b, vb) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
// a grown ant runs off the 128 box, so each icon gets a square viewBox round what it draws: the ant's outline points
// (moved like the body), the badge, the feelers, plus room for the halo
const OUTLINE = [[16, 70], [16, 90], [30, 70], [30, 90], [44, 72], [20, 100], [36, 102], [42, 100], [62, 100], [58, 60], [76, 70], [66, 80], [54, 70]];
const frame = ({ s = 1, rot = 0 }) => { const a = rot * Math.PI / 180, mv = ([x, y]) => [66 + s * ((x - 66) * Math.cos(a) - (y - 70) * Math.sin(a)), 70 + s * ((x - 66) * Math.sin(a) + (y - 70) * Math.cos(a))];
  const pts = [...OUTLINE.map(mv), [80, 14], [117, 58], [62, 38]], xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs) - 4, x1 = Math.max(...xs) + 4, y0 = Math.min(...ys) - 4, y1 = Math.max(...ys) + 4, side = Math.max(x1 - x0, y1 - y0, 128);
  return [x0 + (x1 - x0) / 2 - side / 2, y0 + (y1 - y0) / 2 - side / 2, side, side].map(v => +v.toFixed(1)).join(' '); };
const INK = '#22223b';
const GRAD = '<linearGradient id="$g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f9a826"/><stop offset=".5" stop-color="#f3722c"/><stop offset="1" stop-color="#d00070"/></linearGradient>';
const LEGS = 'M26 86 l-6 12 M34 88 l2 12 M46 82 l-4 16 M52 84 l8 14';
const FEELERS = 'M72 62 C78 52 86 48 92 48 M70 62 C72 52 70 44 64 40';
const HEX = 'M113.6 45.0 L98.0 54.0 L82.4 45.0 L82.4 27.0 L98.0 18.0 L113.6 27.0Z';
const body = (c, extra = 0) => `<g fill="${c}" stroke="${extra ? c : 'none'}" stroke-width="${extra}"><ellipse cx="30" cy="80" rx="14" ry="10"/><circle cx="50" cy="76" r="8"/><circle cx="66" cy="70" r="10"/></g>`;
const lines = (d, c, w) => `<g stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none"><path d="${d}"/></g>`;
const hexFill = (fill, c, w) => `<path d="${HEX}" fill="${fill}" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" transform="rotate(-10 98 36)"/>`;
const PERSON = '<g transform="translate(98 37) scale(0.9)" fill="#fff"><circle cx="0" cy="-5" r="5"/><path d="M-9 9 C-9 0 9 0 9 9Z"/></g>';
// s grows the body and legs about the head (66,70), rot tilts them about it (negative rears the ant up), lw is the leg
// width before scaling; the badge and feelers never move
const ant = (o = {}) => { const k = { s: 1, rot: 0, lw: 3.5, ...o }, H = 1.5;
  const A = `translate(66 70) rotate(${k.rot}) scale(${k.s}) translate(-66 -70)`, lw = k.lw / k.s; // keep legs' drawn width at lw
  const draw = (c, w) => `<g transform="${A}">${body(c, w * 2 / k.s)}${lines(LEGS, c, lw + w * 2 / k.s)}</g>${lines(FEELERS, c, 3.5 + w * 2)}${hexFill(c, c, 3 + w * 2)}`;
  return `<defs>${GRAD}</defs><g opacity=".7">${draw('#fff', H)}</g><g transform="${A}">${body(INK)}${lines(LEGS, INK, lw)}</g>${lines(FEELERS, INK, 3.5)}${hexFill('url(#$g)', INK, 3)}${PERSON}`; };
const O = [
  ['01', 'Ant 02 as it is', {}],
  ['02', 'Ant ×1.25', { s: 1.25, lw: 4 }],
  ['03', 'Ant ×1.4', { s: 1.4, lw: 4.5 }],
  ['04', 'Ant ×1.55', { s: 1.55, lw: 5 }],
  ['05', 'Ant ×1.25, head up', { s: 1.25, rot: -12, lw: 4 }],
  ['06', 'Ant ×1.4, head up', { s: 1.4, rot: -12, lw: 4.5 }],
  ['07', 'Ant ×1.4, head well up', { s: 1.4, rot: -25, lw: 4.5 }],
  ['08', 'Ant ×1.55, head well up', { s: 1.55, rot: -25, lw: 5 }],
  ['09', 'Ant ×1.4, tail up', { s: 1.4, rot: 12, lw: 4.5 }],
  ['10', 'Ant ×1.7, head well up', { s: 1.7, rot: -30, lw: 5.5 }],
];
const cards = O.map(([n, t, o]) => { writeFileSync(join(dir, `icon-ant3-${n}.svg`), svg(`chc${n}-`, `Credit Hoarder — ${t}`, ant(o), frame(o))); return { n, t }; });
const fig = c => `<figure>${[96, 48, 28, 16].map(z => `<img src="icon-ant3-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-ant3.html'), `<!doctype html><meta charset="utf-8"><title>Credit Hoarder ant, same badge, bigger ant</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
.light{background:#fff;color:#222}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}</style>
${sec('light', 'White')}${sec('dark', 'Black')}\n`);
console.log('wrote ' + cards.length);
