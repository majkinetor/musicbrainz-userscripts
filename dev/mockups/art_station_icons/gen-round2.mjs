// Round 2: variations of the three picks from round 1 — 01 Sunset sleeve, 03 Palm frame, 08 Easel.
// Writes icon-01a..icon-08e.svg and preview-round2.html (128, 48 and 16 px on black and white).
//   node dev/mockups/art_station_icons/gen-round2.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const P = { pink: '#ff71ce', cyan: '#01cdfe', mint: '#05ffa1', purple: '#b967ff', yellow: '#fffb96', peach: '#ffb17a', night: '#1b0f3b', ink: '#2a1458', sea: '#2b7fd1' };
const svg = (id, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${title}</title>\n${body.replaceAll('$', id)}\n</svg>\n`;
let K = 0;
// striped retro sun (as round 1)
const sun = (cx, cy, r, from = P.yellow, to = P.pink, stripes = true) => {
  let gaps = '';
  if (stripes) for (let y = cy - r * 0.38, h = r * 0.05; y < cy + r; y += h * 2.2, h *= 1.25)
    gaps += `<rect x="${cx - r}" y="${y.toFixed(1)}" width="${2 * r}" height="${h.toFixed(1)}" fill="#000"/>`;
  const k = 's' + (K++);
  return `<defs><linearGradient id="$g${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
<mask id="$m${k}"><rect width="128" height="128" fill="#fff"/>${gaps}</mask></defs>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#$g${k})" mask="url(#$m${k})"/>`;
};
const grid = (x0, x1, y0, y1, color, sw = 1.4) => {
  const cx = (x0 + x1) / 2, w = x1 - x0;
  let d = `M${x0} ${y0}H${x1}`;
  for (let t = 0.12; t < 1; t = t + 0.1 + t * 0.55) d += `M${x0} ${(y0 + (y1 - y0) * t).toFixed(1)}H${x1}`;
  for (let i = -4; i <= 4; i++) d += `M${(cx + i * w / 22).toFixed(1)} ${y0}L${(cx + i * w / 3.2).toFixed(1)} ${y1}`;
  return `<path d="${d}" stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
};
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
// a palm at (x, base y), height h, leaning `lean`; s scales the fronds
const palm = (x, y, h, color = P.ink, lean = 10, s = 1) => {
  const tx = x + lean, ty = y - h;
  const f = (dx1, dy1, dx2, dy2) => `<path d="M${tx} ${ty} C${tx + dx1 * s} ${ty + dy1 * s} ${tx + dx2 * s} ${ty + dy2 * s} ${tx + dx2 * s * 1.1} ${ty + dy2 * s + 6 * s} C${tx + dx2 * s * .6} ${ty + dy2 * s * .5} ${tx + dx1 * s * .5} ${ty + dy1 * s * .3} ${tx} ${ty + 2}Z"/>`;
  return `<path d="M${x} ${y} C${x + 2} ${y - h * .4} ${x + lean * .6} ${y - h * .75} ${tx} ${ty}" stroke="${color}" stroke-width="${4.5 * s}" fill="none" stroke-linecap="round"/>
<g fill="${color}">${f(-10, -10, -26, 2)}${f(10, -12, 28, 0)}${f(-6, -14, -18, -14)}${f(6, -14, 18, -16)}${f(-12, 2, -20, 16)}${f(12, 2, 22, 14)}</g>`;
};
// vinyl record
const vinyl = (cx, cy, r, rim = P.cyan, label = P.mint) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${P.night}" stroke="${rim}" stroke-width="3"/>
<circle cx="${cx}" cy="${cy}" r="${r * .76}" fill="none" stroke="#4a3480" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="${r * .55}" fill="none" stroke="#4a3480" stroke-width="1.5"/>
<circle cx="${cx}" cy="${cy}" r="${r * .29}" fill="${label}"/><circle cx="${cx}" cy="${cy}" r="${r * .066}" fill="${P.night}"/>`;
// a sunset scene clipped to a rect: sky, sun, ground (grid | sea | plain)
const scene = (c, x, y, w, h, o = {}) => {
  const hz = y + h * (o.horizon || .62), sky = o.sky || [P.night, '#6b2fa8', P.pink];
  const ground = o.ground === 'sea'
    ? `<rect x="${x}" y="${hz}" width="${w}" height="${y + h - hz}" fill="${o.seaColor || P.sea}"/><path d="M${x} ${hz + 6}H${x + w}M${x + w * .1} ${hz + 13}H${x + w * .9}M${x + w * .2} ${hz + 20}H${x + w * .8}" stroke="${P.cyan}" stroke-width="2.2" stroke-linecap="round"/>`
    : o.ground === 'plain' ? `<rect x="${x}" y="${hz}" width="${w}" height="${y + h - hz}" fill="${o.groundColor || P.night}"/>`
    : `<rect x="${x}" y="${hz}" width="${w}" height="${y + h - hz}" fill="${o.groundColor || P.night}"/>${grid(x, x + w, hz, y + h, o.gridColor || P.cyan, o.gridW || 1.3)}`;
  return `<defs>${lg('$sky' + c, sky)}<clipPath id="$c${c}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx || 0}"/></clipPath></defs>
<g clip-path="url(#$c${c})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#$sky${c})"/>${o.stars ? `<g fill="#fff"><circle cx="${x + w * .15}" cy="${y + h * .14}" r="1.3"/><circle cx="${x + w * .8}" cy="${y + h * .1}" r="1.5"/><circle cx="${x + w * .62}" cy="${y + h * .24}" r="1"/><circle cx="${x + w * .3}" cy="${y + h * .3}" r="1"/></g>` : ''}
${sun(o.sunX || x + w / 2, hz + 2, o.sunR || w * .3, o.sunFrom, o.sunTo, o.stripes !== false)}${ground}${o.extra || ''}</g>`;
};

const V = [];
// ── 01 Sunset sleeve ──────────────────────────────────────────────
V.push(['01a', 'Sleeve, record up top', `${vinyl(64, 40, 34)}${scene('a', 18, 34, 92, 84, { rx: 8 })}<rect x="18" y="34" width="92" height="84" rx="8" fill="none" stroke="${P.pink}" stroke-width="3"/>`]);
V.push(['01b', 'Big sleeve, no grid (reads at 16 px)', `${vinyl(94, 64, 30)}${scene('b', 8, 16, 92, 96, { rx: 10, ground: 'plain', sunR: 32 })}<rect x="8" y="16" width="92" height="96" rx="10" fill="none" stroke="${P.pink}" stroke-width="4"/>`]);
V.push(['01c', 'Pastel day', `${vinyl(86, 64, 38, P.purple, P.pink)}${scene('c', 10, 22, 78, 84, { rx: 8, sky: ['#7fe7ff', '#d9a6ff', P.pink], sunFrom: '#fff6a8', sunTo: '#ff8a5c', groundColor: P.purple, gridColor: P.yellow })}<rect x="10" y="22" width="78" height="84" rx="8" fill="none" stroke="${P.ink}" stroke-width="3"/>`]);
V.push(['01d', 'Sleeve with a palm', `${vinyl(86, 64, 38)}${scene('d', 10, 22, 78, 84, { rx: 8, sky: [P.purple, P.pink, P.peach], ground: 'sea', extra: palm(24, 106, 52, P.ink, 8, .85) })}<rect x="10" y="22" width="78" height="84" rx="8" fill="none" stroke="${P.pink}" stroke-width="3"/>`]);
V.push(['01e', 'Neon outline', `<defs><filter id="$gl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<rect x="4" y="4" width="120" height="120" rx="24" fill="#120826"/><g filter="url(#$gl)">${vinyl(84, 62, 32)}${scene('e', 16, 30, 66, 70, { rx: 6 })}<rect x="16" y="30" width="66" height="70" rx="6" fill="none" stroke="${P.pink}" stroke-width="3"/></g>`]);
// ── 03 Palm frame ─────────────────────────────────────────────────
const frame = (id, inner, fr = [P.cyan, P.purple], rx = 14) => `<defs>${lg('$fr' + id, fr, 1, 1)}</defs><rect x="8" y="8" width="112" height="112" rx="${rx}" fill="url(#$fr${id})"/>${inner}<rect x="18" y="18" width="92" height="92" rx="4" fill="none" stroke="${P.ink}" stroke-width="2"/>`;
V.push(['03a', 'Two palms, night', frame('a', scene('a', 18, 18, 92, 92, { horizon: .66, sky: ['#5a2a9c', '#b04ab0', P.pink], stars: true, ground: 'sea', sunX: 70, extra: palm(34, 112, 66, '#0d0626', 12) + palm(96, 112, 46, '#0d0626', -8, .7) }), [P.pink, P.purple])]);
V.push(['03b', 'Palm on the grid', frame('b', scene('b', 18, 18, 92, 92, { horizon: .64, sky: [P.purple, P.pink, P.peach], sunX: 70, extra: palm(36, 110, 66, P.ink, 12) }))]);
V.push(['03c', 'Porthole', `<defs>${lg('$rg', [P.cyan, P.purple, P.pink], 1, 1)}<clipPath id="$o"><circle cx="64" cy="64" r="46"/></clipPath></defs><circle cx="64" cy="64" r="58" fill="url(#$rg)"/>
<g clip-path="url(#$o)">${scene('c', 18, 18, 92, 92, { horizon: .64, sky: [P.purple, P.pink, P.peach], ground: 'sea', sunX: 72, extra: palm(40, 112, 66, P.ink, 12) })}</g><circle cx="64" cy="64" r="46" fill="none" stroke="${P.ink}" stroke-width="2.5"/>`]);
V.push(['03d', 'Pastel day, thin frame', frame('d', scene('d', 18, 18, 92, 92, { horizon: .66, sky: ['#7fe7ff', '#d9a6ff', '#ffb3d9'], sunFrom: '#fff6a8', sunTo: '#ff8a5c', ground: 'sea', seaColor: '#4fb6e8', sunX: 72, extra: palm(36, 112, 66, '#5b3a8c', 12) }), ['#ffffff', '#e8dcff'], 10)]);
V.push(['03e', 'Bold, few details (reads at 16 px)', frame('e', scene('e', 18, 18, 92, 92, { horizon: .62, sky: [P.purple, P.pink], ground: 'plain', groundColor: P.sea, stripes: false, sunR: 30, sunX: 74, extra: palm(36, 112, 70, P.ink, 14, 1.25) }))]);
// ── 08 Easel ──────────────────────────────────────────────────────
const easel = (legs = `url(#$wood)`) => `<defs>${lg('$wood', [P.cyan, '#5aa7ff'])}</defs><g stroke-linecap="round"><path d="M64 6 V18" stroke="${P.cyan}" stroke-width="5"/><path d="M48 88 L34 122 M80 88 L94 122 M64 88 V116" stroke="${legs}" stroke-width="6"/></g>`;
const ledge = y => `<rect x="18" y="${y}" width="92" height="7" rx="3" fill="${P.yellow}" stroke="${P.ink}" stroke-width="2.5"/>`;
V.push(['08a', 'Big canvas, no brush', `${easel()}${scene('a', 14, 14, 100, 74, { rx: 3 })}<rect x="14" y="14" width="100" height="74" rx="3" fill="none" stroke="${P.ink}" stroke-width="3"/>${ledge(86)}`]);
V.push(['08b', 'Palm painting', `${easel()}${scene('b', 22, 16, 84, 68, { rx: 3, sky: [P.purple, P.pink, P.peach], ground: 'sea', horizon: .66, sunX: 72, extra: palm(38, 86, 52, P.ink, 10, .85) })}<rect x="22" y="16" width="84" height="68" rx="3" fill="none" stroke="${P.ink}" stroke-width="3"/>${ledge(82)}`]);
V.push(['08c', 'Brush mid-stroke', `${easel()}${scene('c', 22, 16, 84, 68, { rx: 3, extra: `<rect x="70" y="16" width="36" height="68" fill="#efe6ff"/><path d="M70 16 V84" stroke="${P.ink}" stroke-width="1" stroke-dasharray="2 3"/>` })}<rect x="22" y="16" width="84" height="68" rx="3" fill="none" stroke="${P.ink}" stroke-width="3"/>${ledge(82)}
<path d="M82 70 L110 40" stroke="${P.ink}" stroke-width="5" stroke-linecap="round"/><path d="M76 76 L84 68" stroke="${P.pink}" stroke-width="8" stroke-linecap="round"/><path d="M60 78 C66 72 72 78 78 74" stroke="${P.pink}" stroke-width="5" fill="none" stroke-linecap="round"/>`]);
V.push(['08d', 'Night, neon legs', `<rect x="4" y="4" width="120" height="120" rx="24" fill="#120826"/>${easel(P.pink)}${scene('d', 22, 18, 84, 66, { rx: 3, stars: true })}<rect x="22" y="18" width="84" height="66" rx="3" fill="none" stroke="${P.cyan}" stroke-width="3"/>${ledge(82)}`]);
V.push(['08e', 'Easel holding a sleeve', `${easel()}${vinyl(84, 50, 30)}${scene('e', 16, 18, 62, 66, { rx: 4 })}<rect x="16" y="18" width="62" height="66" rx="4" fill="none" stroke="${P.pink}" stroke-width="3"/>${ledge(82)}`]);

const cards = V.map(([n, title, body]) => { writeFileSync(join(dir, `icon-${n}.svg`), svg(`v${n}`, `Art Station — ${title}`, body)); return { n, title }; });
const sizes = [128, 48, 16];
const group = (bg, pre) => `<section class="${bg}"><h2>${{ '01': '01 · Sunset sleeve', '03': '03 · Palm frame', '08': '08 · Easel' }[pre]}</h2><div class="g">${['', ...cards.filter(c => c.n.startsWith(pre)).map(c => c.n)].map(n => {
  const src = n ? `icon-${n}.svg` : `icon-${pre}.svg`, cap = n ? `${n} · ${cards.find(c => c.n === n).title}` : `${pre} · round 1`;
  return `<figure${n ? '' : ' class="orig"'}>${sizes.map(z => `<img src="${src}" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${cap}</figcaption></figure>`; }).join('')}</div></section>`;
writeFileSync(join(dir, 'preview-round2.html'), `<!doctype html><meta charset="utf-8"><title>Art Station icons, round 2</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:14px 20px}h2{font-size:14px;margin:0 0 10px}.g{display:grid;grid-template-columns:repeat(6,1fr);gap:16px}
.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:10px;flex-wrap:wrap}figcaption{width:100%}.orig figcaption{opacity:.6}</style>
${['01', '03', '08'].map(p => group('dark', p) + group('light', p)).join('\n')}\n`);
console.log(`wrote ${cards.length} icons`);
