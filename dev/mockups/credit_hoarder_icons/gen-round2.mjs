// Credit Hoarder icons, round 2: in Art Station's pastel-day vaporwave style (gradient sky, striped
// sun, neon grid, dark-ink outlines), so the two read as a family. Writes icon-r2-1..6.svg and
// preview-round2.html (128, 48, 16 px on white and black, beside Art Station's icon).
//   node dev/mockups/credit_hoarder_icons/gen-round2.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const P = { pink: '#ff71ce', cyan: '#01cdfe', mint: '#05ffa1', purple: '#b967ff', yellow: '#fffb96', peach: '#ffb17a', night: '#1b0f3b', ink: '#2a1458', sky1: '#7fe7ff', sky2: '#d9a6ff', sun1: '#fff6a8', sun2: '#ff8a5c' };
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
let K = 0;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const sun = (cx, cy, r, from = P.sun1, to = P.sun2) => {
  let gaps = ''; for (let y = cy - r * 0.38, h = r * 0.05; y < cy + r; y += h * 2.2, h *= 1.25) gaps += `<rect x="${cx - r}" y="${y.toFixed(1)}" width="${2 * r}" height="${h.toFixed(1)}" fill="#000"/>`;
  const k = 's' + K++;
  return `<defs>${lg('$g' + k, [from, to])}<mask id="$m${k}"><rect width="128" height="128" fill="#fff"/>${gaps}</mask></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#$g${k})" mask="url(#$m${k})"/>`;
};
const grid = (x0, x1, y0, y1, color, sw = 1.3) => {
  const cx = (x0 + x1) / 2, w = x1 - x0; let d = `M${x0} ${y0}H${x1}`;
  for (let t = 0.12; t < 1; t = t + 0.1 + t * 0.55) d += `M${x0} ${(y0 + (y1 - y0) * t).toFixed(1)}H${x1}`;
  for (let i = -4; i <= 4; i++) d += `M${(cx + i * w / 22).toFixed(1)} ${y0}L${(cx + i * w / 3.2).toFixed(1)} ${y1}`;
  return `<path d="${d}" stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
};
// the pastel-day scene, clipped to a rounded rect
const scene = (c, x, y, w, h, o = {}) => { const hz = y + h * (o.horizon || .62);
  return `<defs>${lg('$sky' + c, [P.sky1, P.sky2, P.pink])}<clipPath id="$c${c}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx || 0}"/></clipPath></defs>
<g clip-path="url(#$c${c})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#$sky${c})"/>${sun(o.sunX || x + w / 2, hz + 2, o.sunR || w * .3)}<rect x="${x}" y="${hz}" width="${w}" height="${y + h - hz}" fill="${P.purple}"/>${grid(x, x + w, hz, y + h, P.yellow, o.gridW || 1.2)}${o.extra || ''}</g>`; };
const O = (w = 3) => `stroke="${P.ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
// a pastel credit tag with a note on it
const tag = (x, y, w, h, rot = 0, fill = '#fdf7ff') => `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"><path d="M${x} ${y} H${x + w} V${y + h} H${x} L${x - h * .45} ${y + h / 2}Z" fill="${fill}" ${O(2.6)}/><circle cx="${x - 1}" cy="${y + h / 2}" r="1.8" fill="${P.ink}"/>
<path d="M${x + 6} ${y + h * .72} V${y + h * .26} L${x + 12} ${y + h * .18}" stroke="${P.pink}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M${x + 16} ${y + h * .38} H${x + w - 5} M${x + 16} ${y + h * .66} H${x + w * .72}" stroke="${P.purple}" stroke-width="2.2" stroke-linecap="round"/></g>`;
const coin = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${P.yellow}" ${O(2.4)}/><path d="M${x - r * .15} ${y + r * .4} V${y - r * .45} L${x + r * .4} ${y - r * .6}" stroke="${P.peach}" stroke-width="${r * .24}" fill="none" stroke-linecap="round"/><circle cx="${x - r * .32}" cy="${y + r * .4}" r="${r * .2}" fill="${P.peach}"/>`;

const I = [];
// 1. Tag stack: a pile of credit tags in front of the sunset sleeve's world
I.push(['1', 'Tag pile on the sunset', `${scene('a', 10, 10, 108, 108, { rx: 16, horizon: .5 })}<rect x="10" y="10" width="108" height="108" rx="16" fill="none" ${O(3)}/>
${tag(36, 66, 62, 22, -8)}${tag(30, 82, 66, 22, 4, '#e8fff6')}${tag(40, 96, 62, 22, -2, '#fff6fb')}`]);
// 2. Hamster, pastel: the same idea, drawn in the palette over a sunset disc
I.push(['2', 'Pastel hamster', `<defs>${lg('$fur', ['#ffd1a6', P.peach])}</defs>${scene('b', 8, 8, 112, 112, { rx: 56, horizon: .58 })}<circle cx="64" cy="64" r="56" fill="none" ${O(3)}/>
<circle cx="40" cy="40" r="10" fill="url(#$fur)" ${O(3)}/><circle cx="88" cy="40" r="10" fill="url(#$fur)" ${O(3)}/><circle cx="40" cy="40" r="5" fill="${P.pink}"/><circle cx="88" cy="40" r="5" fill="${P.pink}"/>
<path d="M28 112 C24 74 36 44 64 44 C92 44 104 74 100 112Z" fill="url(#$fur)" ${O(3)}/><ellipse cx="40" cy="74" rx="14" ry="12" fill="#ffc0d8" ${O(2.4)}/><ellipse cx="88" cy="74" rx="14" ry="12" fill="#ffc0d8" ${O(2.4)}/>
<circle cx="54" cy="62" r="4" fill="${P.ink}"/><circle cx="74" cy="62" r="4" fill="${P.ink}"/><circle cx="55.3" cy="60.7" r="1.3" fill="#fff"/><circle cx="75.3" cy="60.7" r="1.3" fill="#fff"/>
<path d="M60 70 L64 73 L68 70" fill="${P.pink}" stroke="${P.ink}" stroke-width="2.2" stroke-linejoin="round"/>${coin(64, 96, 13)}`]);
// 3. Cassette: a tape whose window is the sunset, its label a credit list
I.push(['3', 'Credits cassette', `<rect x="8" y="26" width="112" height="76" rx="10" fill="#fdf7ff" ${O(3)}/><rect x="16" y="34" width="96" height="16" rx="3" fill="${P.sky2}" ${O(2)}/>
<path d="M22 42 H60 M66 42 H90" stroke="${P.ink}" stroke-width="2.6" stroke-linecap="round"/>${scene('c', 26, 56, 76, 30, { rx: 6, horizon: .7, sunR: 14 })}<rect x="26" y="56" width="76" height="30" rx="6" fill="none" ${O(2.4)}/>
<circle cx="46" cy="70" r="7" fill="#fdf7ff" ${O(2.4)}/><circle cx="82" cy="70" r="7" fill="#fdf7ff" ${O(2.4)}/><path d="M32 102 L38 92 H90 L96 102" fill="${P.purple}" ${O(3)}/>`]);
// 4. Treasure box: a pastel chest, the lid's inside a sunset, credit tags and ♪ coins spilling
I.push(['4', 'Pastel treasure chest', `<defs>${lg('$box', [P.purple, '#8c4de0'])}</defs>${scene('d', 18, 14, 92, 46, { rx: 10, horizon: .66, sunR: 22 })}<rect x="18" y="14" width="92" height="46" rx="10" fill="none" ${O(3)}/>
${tag(28, 46, 38, 16, -14)}${coin(78, 52, 9)}${coin(94, 56, 7)}
<rect x="14" y="60" width="100" height="52" rx="8" fill="url(#$box)" ${O(3)}/><path d="M14 76 H114" stroke="${P.ink}" stroke-width="3"/><path d="M38 60 V112 M90 60 V112" stroke="${P.cyan}" stroke-width="5"/>
<rect x="54" y="68" width="20" height="18" rx="4" fill="${P.yellow}" ${O(2.6)}/><path d="M64 74 V80" stroke="${P.ink}" stroke-width="2.6" stroke-linecap="round"/>`]);
// 5. Credit roll: a film-credits scroll over the sunset
I.push(['5', 'Credit roll', `${scene('e', 10, 10, 108, 108, { rx: 16, horizon: .7 })}<rect x="10" y="10" width="108" height="108" rx="16" fill="none" ${O(3)}/>
<path d="M30 20 H98 V86 C98 92 92 96 86 96 H30Z" fill="#fdf7ff" ${O(3)}/><path d="M30 96 C24 96 22 90 22 86 V24 C22 20 26 18 30 20" fill="${P.sky2}" ${O(3)}/>
${[34, 46, 58, 70, 82].map((y, i) => `<path d="M40 ${y} H${[86, 74, 82, 68, 78][i]}" stroke="${i % 2 ? P.purple : P.pink}" stroke-width="4" stroke-linecap="round"/>`).join('')}`]);
// 6. Jar of credits: a mason jar stuffed with tags and ♪ coins, the sunset in the glass
I.push(['6', 'Jar of credits', `<defs><clipPath id="$j"><path d="M28 40 C24 46 24 54 24 60 V104 C24 110 30 114 36 114 H92 C98 114 104 110 104 104 V60 C104 54 104 46 100 40Z"/></clipPath></defs>
<g clip-path="url(#$j)">${scene('f', 20, 36, 88, 80, { horizon: .48, sunR: 26 })}${tag(36, 64, 44, 18, -10)}${tag(48, 82, 44, 18, 8, '#e8fff6')}${coin(40, 100, 9)}${coin(88, 96, 8)}</g>
<path d="M28 40 C24 46 24 54 24 60 V104 C24 110 30 114 36 114 H92 C98 114 104 110 104 104 V60 C104 54 104 46 100 40Z" fill="none" ${O(3)}/>
<path d="M34 50 V96" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/><rect x="26" y="22" width="76" height="18" rx="5" fill="${P.cyan}" ${O(3)}/><path d="M34 31 H94" stroke="${P.ink}" stroke-width="2" opacity=".35"/>`]);

const cards = I.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r2-${n}.svg`), svg(`c${n}`, `Credit Hoarder — ${t}`, b)); return { n, t }; });
const fig = (src, cap, cls = '') => `<figure${cls}>${[128, 48, 16].map(z => `<img src="${src}" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${cap}</figcaption></figure>`;
const row = () => fig('../../../userscripts/art_station/icon.svg', 'Art Station (for reference)', ' class="ref"') + cards.map(c => fig(`icon-r2-${c.n}.svg`, `${c.n} · ${c.t}`)).join('');
writeFileSync(join(dir, 'preview-round2.html'), `<!doctype html><meta charset="utf-8"><title>Credit Hoarder icons, round 2</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:20px;display:grid;grid-template-columns:repeat(4,1fr);gap:22px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:10px;flex-wrap:wrap}figcaption{width:100%}.ref figcaption{opacity:.6}</style>
<section class="light">${row()}</section><section class="dark">${row()}</section>\n`);
console.log('wrote ' + cards.length);
