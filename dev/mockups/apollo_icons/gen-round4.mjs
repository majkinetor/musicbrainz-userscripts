// Apollo Editor icons, round 4: twenty variations on the current rocket — angle, proportions, palette, window, flame, setting.
// Writes icon-r4-01..20.svg and preview-round4.html (128, 48, 28, 16 px on white and black).
//   node dev/mockups/apollo_icons/gen-round4.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const star = (x, y, r, c) => `<path d="M${x} ${y - r} L${x + r * .28} ${y - r * .28} L${x + r} ${y} L${x + r * .28} ${y + r * .28} L${x} ${y + r} L${x - r * .28} ${y + r * .28} L${x - r} ${y} L${x - r * .28} ${y - r * .28}Z" fill="${c}"/>`;
const dots = (pts, c = '#fff') => `<g fill="${c}">${pts.map(([x, y, r = 1.3]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
const tile = (fill, rx = 26) => `<rect x="4" y="4" width="120" height="120" rx="${rx}" fill="${fill}"/>`;

// The current rocket, in its 32-unit space, with knobs. Shapes: normal (today's), slim, chunky.
const SHAPES = {
  normal: { body: 'M16 2.5 C19 7 20 12 20 16 L20 22 L12 22 L12 16 C12 12 13 7 16 2.5 Z', fins: 'M12 18 L8 23.5 L12 22 Z M20 18 L24 23.5 L20 22 Z', w: [12, 20] },
  slim: { body: 'M16 1.5 C18.6 6 19.2 11 19.2 16 L19.2 22 L12.8 22 L12.8 16 C12.8 11 13.4 6 16 1.5 Z', fins: 'M12.8 18.5 L10 23.5 L12.8 22 Z M19.2 18.5 L22 23.5 L19.2 22 Z', w: [12.8, 19.2] },
  chunky: { body: 'M16 4 C20.6 7.6 21.6 12 21.6 16 L21.6 22 L10.4 22 L10.4 16 C10.4 12 11.4 7.6 16 4 Z', fins: 'M10.4 16.5 L5.5 24 L10.4 22 Z M21.6 16.5 L26.5 24 L21.6 22 Z', w: [10.4, 21.6] },
};
const DEF = { shape: 'normal', body: '#5f3ec0', fin: '#3d2470', win: '#cfe8ff', rim: '#2a1a52', flame: '#ff8c3b', core: '#ffd24a', flameLen: 30, window: 'round', outline: null, stripes: null, shade: false, tip: null };
const rk = (o = {}) => { const k = { ...DEF, ...o }, S = SHAPES[k.shape], ol = k.outline ? ` stroke="${k.outline}" stroke-width="1.1" stroke-linejoin="round"` : '';
  const fl = `<path d="M13.4 22 L18.6 22 L16 ${k.flameLen} Z" fill="${k.flame}"${ol}/><path d="M14.6 22 L17.4 22 L16 ${22 + (k.flameLen - 22) * .6} Z" fill="${k.core}"/>`;
  const shade = k.shade ? `<clipPath id="$bc"><path d="${S.body}"/></clipPath><g clip-path="url(#$bc)"><rect x="16" y="0" width="8" height="24" fill="#000" opacity=".22"/><rect x="${S.w[0] + 1.2}" y="5" width="1.4" height="15" rx=".7" fill="#fff" opacity=".45"/></g>` : '';
  const tip = k.tip ? `<clipPath id="$tc"><path d="${S.body}"/></clipPath><rect x="0" y="0" width="32" height="7.5" fill="${k.tip}" clip-path="url(#$tc)"/>` : '';
  const st = k.stripes ? `<clipPath id="$sc"><path d="${S.body}"/></clipPath><g clip-path="url(#$sc)" fill="${k.stripes}">${[17.2, 19.4].map(y => `<rect x="0" y="${y}" width="32" height="1.1"/>`).join('')}</g>` : '';
  const win = { round: `<circle cx="16" cy="12.5" r="3" fill="${k.win}" stroke="${k.rim}" stroke-width="1"/>`,
    two: `<circle cx="16" cy="9.6" r="2.1" fill="${k.win}" stroke="${k.rim}" stroke-width=".8"/><circle cx="16" cy="15" r="2.1" fill="${k.win}" stroke="${k.rim}" stroke-width=".8"/>`,
    record: `<circle cx="16" cy="12.5" r="3.2" fill="#17121f" stroke="${k.rim}" stroke-width=".6"/><circle cx="16" cy="12.5" r="2.2" fill="none" stroke="#4a4256" stroke-width=".35"/><circle cx="16" cy="12.5" r="1.2" fill="${k.win}"/><circle cx="16" cy="12.5" r=".35" fill="#17121f"/>`,
    note: `<circle cx="16" cy="12.5" r="3.3" fill="${k.win}" stroke="${k.rim}" stroke-width="1"/><path d="M15.6 14.2 V10.6 L17.6 10.1" fill="none" stroke="${k.rim}" stroke-width=".7" stroke-linecap="round"/><circle cx="15" cy="14.3" r=".85" fill="${k.rim}"/>`,
    star: `<circle cx="16" cy="12.5" r="3.2" fill="${k.win}" stroke="${k.rim}" stroke-width="1"/>${star(16, 12.5, 2, k.rim)}` }[k.window];
  return `${fl}<path d="${S.fins}" fill="${k.fin}"${ol}/><path d="${S.body}" fill="${k.body}"${ol}/>${tip}${st}${shade}${win}`; };
// place a rocket centred at (cx, cy), scale s, rotated rot degrees
const at = (inner, s = 4, rot = 0, cx = 64, cy = 64) => `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${s}) translate(-16 -16.25)">${inner}</g>`;
const I = [];

I.push(['01', 'Tilted', at(rk(), 3.9, 40)]);
I.push(['02', 'Purple tile', `${tile('#5f3ec0')}${at(rk({ body: '#fff', fin: '#ffd24a', win: '#5f3ec0', rim: '#3d2470' }), 3)}`]);
I.push(['03', 'Star badge', `<circle cx="64" cy="64" r="58" fill="#1e1440"/><circle cx="64" cy="64" r="58" fill="none" stroke="#7a57e8" stroke-width="4"/>${dots([[30, 36, 1.6], [96, 30], [100, 84, 1.6], [26, 90], [44, 22, 1]])}${star(94, 50, 5, '#ffd24a')}${at(rk({ body: '#8f6cff' }), 3)}`]);
I.push(['04', 'Slim', at(rk({ shape: 'slim' }), 4.1)]);
I.push(['05', 'Chunky', at(rk({ shape: 'chunky' }), 3.9)]);
I.push(['06', 'Two portholes', at(rk({ window: 'two' }), 4)]);
I.push(['07', 'Shaded', at(rk({ shade: true }), 4)]);
I.push(['08', 'Long flame', `${dots([[42, 118, 9], [58, 122, 8], [76, 121, 9], [88, 116, 6]], '#d9d4e6')}${at(rk({ flameLen: 33.5 }), 3.6, 0, 64, 58)}`]);
I.push(['09', 'Orbit ring', `<ellipse cx="64" cy="66" rx="58" ry="16" fill="none" stroke="#b9a8ec" stroke-width="4" transform="rotate(-18 64 66)" stroke-dasharray="170 40"/>${at(rk(), 3.7)}<circle cx="114" cy="42" r="5" fill="#ffd24a"/>`]);
I.push(['10', 'Moon behind', `<circle cx="74" cy="56" r="44" fill="#ece8f7"/>${dots([[96, 36, 7], [100, 76, 5], [62, 28, 4]], '#d6d0ea')}${at(rk(), 3.8, 20, 58, 66)}`]);
I.push(['11', 'Retro red', at(rk({ body: '#f2e8d5', fin: '#d63a2f', tip: '#d63a2f', win: '#7ec8e3', rim: '#3a2a20', flame: '#ff8c3b' }), 4)]);
I.push(['12', 'Teal', at(rk({ body: '#159a8c', fin: '#0b5c54', win: '#e8fff9', rim: '#083e39', flame: '#ff6b6b', core: '#ffd166' }), 4)]);
I.push(['13', 'Duotone', at(rk({ body: '#5f3ec0', fin: '#5f3ec0', win: '#fff', rim: '#5f3ec0', flame: '#b9a8ec', core: '#fff' }), 4)]);
I.push(['14', 'Inked', at(rk({ outline: '#1a0f33', body: '#7a57e8', fin: '#ffd24a', rim: '#1a0f33' }), 3.8)]);
I.push(['15', 'Record window', at(rk({ window: 'record', win: '#ff8c3b' }), 4)]);
I.push(['16', 'Note window', at(rk({ window: 'note' }), 4)]);
I.push(['17', 'Track stripes', at(rk({ stripes: '#ffd24a', tip: '#3d2470' }), 4)]);
I.push(['18', 'Speed lines', `<g stroke="#b9a8ec" stroke-width="5" stroke-linecap="round"><path d="M14 94 L36 72 M28 112 L46 94 M8 70 L22 56"/></g>${at(rk(), 3.5, 40, 70, 58)}`]);
I.push(['19', 'Night glow', `<defs><radialGradient id="$g" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#7a57e8" stop-opacity=".55"/><stop offset="1" stop-color="#7a57e8" stop-opacity="0"/></radialGradient></defs>${tile('#0e0a24')}<circle cx="64" cy="64" r="56" fill="url(#$g)"/>${dots([[22, 24], [104, 20, 1.6], [110, 70], [20, 84, 1], [96, 108]])}${at(rk({ body: '#9b7bff', fin: '#5f3ec0' }), 3.1)}`]);
I.push(['20', 'Pastel day', `<defs>${lg('$s', ['#ffd6e8', '#d6e4ff'])}</defs>${tile('url(#$s)')}<circle cx="98" cy="30" r="10" fill="#fff6c9"/><path d="M14 104 q10 -8 20 0 q10 -8 20 0 M80 110 q8 -6 16 0 q8 -6 16 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>${at(rk({ body: '#a58bff', fin: '#ff8fbf', win: '#fff', rim: '#6b52c9', flame: '#ffb38a', core: '#fff1a8' }), 3)}`]);

const cards = I.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r4-${n}.svg`), svg(`ap4${n}-`, `Apollo Editor — ${t}`, b)); return { n, t }; });
const fig = (src, cap) => `<figure>${[128, 48, 28, 16].map(z => `<img src="${src}" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${cap}</figcaption></figure>`;
const row = () => cards.map(c => fig(`icon-r4-${c.n}.svg`, `${c.n} · ${c.t}`)).join('');
writeFileSync(join(dir, 'preview-round4.html'), `<!doctype html><meta charset="utf-8"><title>Apollo Editor icons, round 4</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}</style>
<section class="light">${fig('../../../userscripts/apollo_editor/icon.svg', 'now · Rocket')}${row()}</section><section class="dark">${fig('../../../userscripts/apollo_editor/icon.svg', 'now · Rocket')}${row()}</section>\n`);
console.log('wrote ' + cards.length);
