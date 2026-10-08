// Credit Hoarder icons: ant 02 (no tile, halo 1.5 at 70%) made to hold its own beside the other icons. It looks small
// because it is thin and wide: a lot of empty box round thin legs. These variants give it more body — a bigger ant,
// thicker legs, the badge brought in closer so the whole thing is squarer and scales up.
// Writes icon-ant2-01..08.svg and preview-ant2.html (96, 48, 28, 16 px on white and black).
//   node dev/mockups/credit_hoarder_icons/gen-ant2.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const INK = '#22223b';
const GRAD = '<linearGradient id="$g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f9a826"/><stop offset=".5" stop-color="#f3722c"/><stop offset="1" stop-color="#d00070"/></linearGradient>';
const LEGS = 'M26 86 l-6 12 M34 88 l2 12 M46 82 l-4 16 M52 84 l8 14';
const FEELERS = 'M72 62 C78 52 86 48 92 48 M70 62 C72 52 70 44 64 40';
const HEX = 'M113.6 45.0 L98.0 54.0 L82.4 45.0 L82.4 27.0 L98.0 18.0 L113.6 27.0Z';
const body = (c, extra = 0) => `<g fill="${c}" stroke="${extra ? c : 'none'}" stroke-width="${extra}"><ellipse cx="30" cy="80" rx="14" ry="10"/><circle cx="50" cy="76" r="8"/><circle cx="66" cy="70" r="10"/></g>`;
const lines = (d, c, w) => `<g stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none"><path d="${d}"/></g>`;
const hexFill = (fill, c, w) => `<path d="${HEX}" fill="${fill}" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" transform="rotate(-10 98 36)"/>`;
const PERSON = '<g transform="translate(98 37) scale(0.9)" fill="#fff"><circle cx="0" cy="-5" r="5"/><path d="M-9 9 C-9 0 9 0 9 9Z"/></g>';
// the ant: s scales the body and legs about the rear, lw is leg width, fw feeler width, bs scales the badge, bx/by move it
// (the feelers stretch to meet it); halo 1.5 at 70% round everything
const ant = (o = {}) => { const k = { s: 1, lw: 3.5, fw: 3.5, bs: 1, bx: 0, by: 0, ...o }, H = 1.5;
  const B = `translate(${k.bx} ${k.by}) translate(98 36) scale(${k.bs}) translate(-98 -36)`, A = `translate(16 100) scale(${k.s}) translate(-16 -100)`;
  // feelers: from the head (scaled) to the badge (moved), drawn in page space
  const pt = (x, y) => [16 + (x - 16) * k.s, 100 + (y - 100) * k.s], bp = (x, y) => [98 + k.bx + (x - 98) * k.bs, 36 + k.by + (y - 36) * k.bs];
  const [a1, a2] = [pt(72, 62), pt(70, 62)], e1 = bp(92, 48), c1 = pt(78, 52), c2 = bp(86, 48), c3 = pt(72, 52), c4 = pt(70, 44);
  const F = `M${a1} C${c1} ${c2} ${e1} M${a2} C${c3} ${c4} ${pt(64, 40)}`.replaceAll(',', ' ');
  const draw = (c, w) => `<g transform="${A}">${body(c, w * 2)}${lines(LEGS, c, k.lw + w * 2)}</g>${lines(F, c, k.fw + w * 2)}<g transform="${B}">${hexFill(c, c, 3 + w * 2)}</g>`;
  return `<defs>${GRAD}</defs><g opacity=".7">${draw('#fff', H)}</g><g transform="${A}">${body(INK)}${lines(LEGS, INK, k.lw)}</g>${lines(F, INK, k.fw)}<g transform="${B}">${hexFill('url(#$g)', INK, 3)}${PERSON}</g>`; };
const V = [
  ['01', 'Ant 02 as it is', ant()],
  ['02', 'Thicker legs', ant({ lw: 5, fw: 4.5 })],
  ['03', 'Bigger ant', ant({ s: 1.2 })],
  ['04', 'Bigger ant, thicker legs', ant({ s: 1.2, lw: 5, fw: 4.5 })],
  ['05', 'Badge brought in', ant({ bx: -8, by: 8 })],
  ['06', 'Bigger ant, badge in', ant({ s: 1.2, lw: 5, fw: 4.5, bx: -4, by: 6 })],
  ['07', 'Bigger ant, bigger badge', ant({ s: 1.2, lw: 5, fw: 4.5, bs: 1.2 })],
  ['08', 'Biggest ant, badge in', ant({ s: 1.35, lw: 5.5, fw: 5, bx: -2, by: 10, bs: 1.1 })],
];
const cards = V.map(([n, t, b]) => { writeFileSync(join(dir, `icon-ant2-${n}.svg`), svg(`chb${n}-`, `Credit Hoarder — ${t}`, b)); return { n, t }; });
const fig = c => `<figure>${[96, 48, 28, 16].map(z => `<img src="icon-ant2-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-ant2.html'), `<!doctype html><meta charset="utf-8"><title>Credit Hoarder ant, bigger</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.light{background:#fff;color:#222}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}</style>
${sec('light', 'White')}${sec('dark', 'Black')}\n`);
console.log('wrote ' + cards.length);
