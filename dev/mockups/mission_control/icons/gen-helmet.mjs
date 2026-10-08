// Mission Control icons: variants on round 2's 03, the helmet. Writes helmet-01..15.svg and preview-helmet.html
// (96, 48, 28, 16 px on white and black).
//   node dev/mockups/mission_control/icons/gen-helmet.mjs
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
const f1 = v => +v.toFixed(1);
const hexPts = (r, rot = -90) => Array.from({ length: 6 }, (_, i) => { const a = (i * 60 + rot) * Math.PI / 180; return `${f1(r * Math.cos(a))} ${f1(r * Math.sin(a))}`; }).join(' L');
const NOTE = `<path d="M-5 6 V-11 L8 -15 V2" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/><path d="M-5 -11 L8 -15 V-10 L-5 -6Z" fill="#fff"/><ellipse cx="-9" cy="6" rx="5" ry="4" fill="#fff" transform="rotate(-20 -9 6)"/><ellipse cx="4" cy="2" rx="5" ry="4" fill="#fff" transform="rotate(-20 4 2)"/>`;
const hex = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M${hexPts(20)}Z" fill="${P}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>${NOTE}</g>`;
const FOUR = [OR, GR, GOLD, P];
const VISOR = 'M30 60 A34 30 0 0 1 98 60 V64 A34 26 0 0 1 30 64Z';
const SHINE = '<path d="M40 48 Q50 38 64 38" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".55"/>';
const SKYSTARS = `${star(50, 52, 6, '#fff')}${star(78, 66, 4, GOLD)}<circle cx="86" cy="50" r="2" fill="#fff"/>`;
// round 2's 03, the helmet; o tweaks it
const helmet = (o = {}) => { const k = { shell: '#fff', visor: PD, inside: SKYSTARS, collar: GREY, badge: `<rect x="56" y="98" width="16" height="12" rx="3" fill="${OR}"/>`, extra: '', under: '', shine: true, ...o };
  return `${k.under}<rect x="22" y="94" width="84" height="22" rx="8" fill="${k.collar}" stroke="${INK}" stroke-width="4"/><circle cx="64" cy="58" r="46" fill="${k.shell}" stroke="${INK}" stroke-width="5"/>
<defs><clipPath id="$v"><path d="${VISOR}"/></clipPath></defs><path d="${VISOR}" fill="${k.visor}"/><g clip-path="url(#$v)">${k.inside}</g><path d="${VISOR}" fill="none" stroke="${INK}" stroke-width="4"/>${k.shine ? SHINE : ''}${k.badge}${k.extra}`; };
const I = [];
I.push(['03 as it is', helmet()]);
I.push(['the emblem in the visor', helmet({ inside: `${hex(64, 62, .85)}${star(40, 56, 4, '#fff')}${star(90, 58, 3, GOLD)}` })]);
I.push(['the control room in the visor', helmet({ visor: '#101a4a', inside: `<g stroke="#5ec8ff" stroke-width="2.4" stroke-linecap="round">${[[34, 44], [50, 40], [66, 40], [82, 44]].map(([x, y], i) => `<rect x="${x}" y="${y}" width="13" height="16" rx="2" fill="${FOUR[i]}" stroke="none"/>`).join('')}</g><path d="M30 70 H98" stroke="#2b3a8f" stroke-width="8"/>` })]);
I.push(['the Earth in the visor', helmet({ visor: '#101a4a', inside: `<circle cx="64" cy="100" r="40" fill="#2d7be0"/><path d="M44 68 Q54 62 62 68 L58 74Z M74 64 Q86 64 92 72 L80 74Z" fill="${GR}"/>${star(46, 48, 4, '#fff')}${star(84, 50, 3, GOLD)}` })]);
I.push(['gold visor', helmet({ visor: GOLD, inside: `<path d="M30 58 Q64 40 98 58 V40 H30Z" fill="#ffe08a"/>${hex(64, 62, .6)}` })]);
I.push(['purple shell', helmet({ shell: P, collar: PD, badge: `<rect x="56" y="98" width="16" height="12" rx="3" fill="${GOLD}"/>`, visor: '#101a4a' })]);
I.push(['with a headset mic', helmet({ extra: `<path d="M18 58 Q16 92 48 96" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="96" r="5" fill="${OR}" stroke="${INK}" stroke-width="3"/><rect x="10" y="46" width="14" height="24" rx="6" fill="${GOLD}" stroke="${INK}" stroke-width="4"/>` })]);
I.push(['script lamps on the collar', helmet({ badge: FOUR.map((c, i) => `<circle cx="${40 + i * 16}" cy="105" r="5" fill="${c}" stroke="${INK}" stroke-width="2"/>`).join('') })]);
I.push(['emblem patch on the collar', helmet({ badge: hex(64, 105, .42) })]);
I.push(['script-coloured ear pods', helmet({ extra: `<rect x="8" y="44" width="14" height="28" rx="6" fill="${OR}" stroke="${INK}" stroke-width="4"/><rect x="106" y="44" width="14" height="28" rx="6" fill="${GR}" stroke="${INK}" stroke-width="4"/>` })]);
I.push(['links to the scripts in the visor', helmet({ inside: `<g stroke="${GOLD}" stroke-width="2.5">${[[38, 50], [52, 76], [76, 76], [90, 50]].map(([x, y]) => `<path d="M64 60 L${x} ${y}"/>`).join('')}</g>${[[38, 50], [52, 76], [76, 76], [90, 50]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="5" fill="${FOUR[i]}"/>`).join('')}${hex(64, 60, .5)}`, shine: false })]);
I.push(['helmet only, bigger', helmet({ collar: 'none', badge: '' }).replace('<rect x="22" y="94" width="84" height="22" rx="8" fill="none" stroke="#22223b" stroke-width="4"/>', '').replace('<circle cx="64" cy="58" r="46"', '<circle cx="64" cy="62" r="54"').replace(/(<path d="M30 60 A34)/, '$1')]);
I.push(['slate shell', helmet({ shell: '#c7cee0', collar: '#8a9cc8' })]);
I.push(['with an antenna', helmet({ under: `<path d="M96 22 L110 6" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="111" cy="5" r="4.5" fill="${RED}" stroke="${INK}" stroke-width="2"/>` })]);
I.push(['emblem in a gold visor, mic, lamps', helmet({ visor: GOLD, inside: `<path d="M30 58 Q64 40 98 58 V40 H30Z" fill="#ffe08a"/>${hex(64, 62, .6)}`, badge: FOUR.map((c, i) => `<circle cx="${40 + i * 16}" cy="105" r="5" fill="${c}" stroke="${INK}" stroke-width="2"/>`).join(''), extra: `<path d="M18 58 Q16 92 30 94" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><rect x="10" y="46" width="14" height="24" rx="6" fill="${INK}"/>` })]);

const cards = I.map(([t, b], i) => { const n = String(i + 1).padStart(2, '0'); writeFileSync(join(dir, `helmet-${n}.svg`), svg(`mch${n}-`, `Mission Control — ${t}`, b)); return { n, t }; });
const fig = c => `<figure>${[96, 48, 28, 16].map(z => `<img src="helmet-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-helmet.html'), `<!doctype html><meta charset="utf-8"><title>Mission Control helmet icons</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
.light{background:#fff;color:#222}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}</style>
${sec('light', 'White')}${sec('dark', 'Black')}\n`);
console.log('wrote ' + cards.length);
