// Generates the vaporwave/chillwave Art Station icon candidates (icon-01..10.svg) and preview.html.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const P = { pink: '#ff71ce', cyan: '#01cdfe', mint: '#05ffa1', purple: '#b967ff', yellow: '#fffb96', peach: '#ffb17a', night: '#1b0f3b', ink: '#2a1458' };

const svg = (id, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${title}</title>\n${body.replaceAll('$', id)}\n</svg>\n`;

// Striped retro sun: a gradient disc with gaps cut across its lower half.
const sun = (cx, cy, r, from = P.yellow, to = P.pink) => {
  let gaps = '';
  for (let i = 0, y = cy - r * 0.38, h = r * 0.05; y < cy + r; i++, y += h * 2.2, h *= 1.25)
    gaps += `<rect x="${cx - r}" y="${y.toFixed(1)}" width="${2 * r}" height="${h.toFixed(1)}" fill="#000"/>`;
  const k = `${cx}${cy}${r}`.replaceAll('.', '');
  return `<defs><linearGradient id="$sg${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
<mask id="$sm${k}"><rect x="0" y="0" width="128" height="128" fill="#fff"/>${gaps}</mask></defs>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#$sg${k})" mask="url(#$sm${k})"/>`;
};

// Perspective neon grid from the horizon y0 down to y1, between x0 and x1.
const grid = (x0, x1, y0, y1, color, sw = 1.4) => {
  const cx = (x0 + x1) / 2, w = x1 - x0;
  let d = `M${x0} ${y0}H${x1}`;
  for (let t = 0.12; t < 1; t = t * 1.0 + 0.1 + t * 0.55) d += `M${x0} ${(y0 + (y1 - y0) * t).toFixed(1)}H${x1}`;
  for (let i = -4; i <= 4; i++) d += `M${(cx + i * w / 22).toFixed(1)} ${y0}L${(cx + i * w / 3.2).toFixed(1)} ${y1}`;
  return `<path d="${d}" stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
};

const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;

const icons = [];

// 1. Sunset sleeve: the current icon's sleeve + vinyl, as a vaporwave cover.
icons.push(['Sunset sleeve', `<defs>${lg('$sky', [P.night, '#6b2fa8', P.pink])}<clipPath id="$c"><rect x="10" y="22" width="78" height="84" rx="8"/></clipPath></defs>
<circle cx="86" cy="64" r="38" fill="${P.night}" stroke="${P.cyan}" stroke-width="3"/>
<circle cx="86" cy="64" r="29" fill="none" stroke="#4a3480" stroke-width="1.5"/><circle cx="86" cy="64" r="21" fill="none" stroke="#4a3480" stroke-width="1.5"/>
<circle cx="86" cy="64" r="11" fill="${P.mint}"/><circle cx="86" cy="64" r="2.5" fill="${P.night}"/>
<g clip-path="url(#$c)"><rect x="10" y="22" width="78" height="84" fill="url(#$sky)"/>${sun(49, 70, 24)}<rect x="10" y="74" width="78" height="32" fill="${P.night}"/>${grid(10, 88, 74, 106, P.cyan)}</g>
<rect x="10" y="22" width="78" height="84" rx="8" fill="none" stroke="${P.pink}" stroke-width="3"/>`]);

// 2. Vinyl sunset: a record whose label is the sunset.
icons.push(['Vinyl sunset', `<defs>${lg('$rim', [P.pink, P.purple, P.cyan], 1, 1)}<clipPath id="$c"><circle cx="64" cy="64" r="24"/></clipPath>${lg('$lab', ['#3d1b7a', P.purple, P.peach])}</defs>
<circle cx="64" cy="64" r="56" fill="${P.night}" stroke="url(#$rim)" stroke-width="5"/>
<g fill="none" stroke="#3b2770" stroke-width="1.6"><circle cx="64" cy="64" r="46"/><circle cx="64" cy="64" r="39"/><circle cx="64" cy="64" r="32"/></g>
<path d="M30 36 A44 44 0 0 1 64 20" fill="none" stroke="${P.cyan}" stroke-width="3" stroke-linecap="round" opacity=".8"/>
<g clip-path="url(#$c)"><rect x="40" y="40" width="48" height="48" fill="url(#$lab)"/>${sun(64, 66, 15)}<rect x="40" y="68" width="48" height="20" fill="${P.night}"/>${grid(40, 88, 68, 88, P.pink, 1.1)}</g>
<circle cx="64" cy="64" r="24" fill="none" stroke="${P.yellow}" stroke-width="2"/><circle cx="64" cy="64" r="3" fill="#fff"/>`]);

// 3. Palm frame: a gallery frame holding a palm-tree sunset.
icons.push(['Palm frame', `<defs>${lg('$sky', [P.purple, P.pink, P.peach])}${lg('$fr', [P.cyan, P.purple], 1, 1)}<clipPath id="$c"><rect x="18" y="18" width="92" height="92" rx="4"/></clipPath></defs>
<rect x="8" y="8" width="112" height="112" rx="14" fill="url(#$fr)"/>
<g clip-path="url(#$c)"><rect x="18" y="18" width="92" height="92" fill="url(#$sky)"/>${sun(70, 76, 26, P.yellow, '#ff8a5c')}
<rect x="18" y="80" width="92" height="30" fill="#2b7fd1"/><path d="M18 88H110M26 96H102M34 104H94" stroke="${P.cyan}" stroke-width="2.2" stroke-linecap="round"/>
<path d="M38 112 C40 90 42 70 48 50" stroke="${P.ink}" stroke-width="5" fill="none" stroke-linecap="round"/>
<g fill="${P.ink}"><path d="M48 50 C38 40 26 42 20 50 C30 46 40 48 48 52Z"/><path d="M48 50 C56 38 70 38 78 46 C66 44 56 46 48 52Z"/><path d="M48 50 C44 36 34 30 26 32 C36 36 42 42 47 52Z"/><path d="M48 50 C56 42 66 46 70 58 C62 50 54 50 48 53Z"/><path d="M48 50 C40 50 30 58 28 66 C34 58 42 54 48 53Z"/></g></g>
<rect x="18" y="18" width="92" height="92" rx="4" fill="none" stroke="${P.ink}" stroke-width="2"/>`]);

// 4. Fanned covers: the gallery, three pastel covers fanned out.
icons.push(['Fanned covers', `<defs>${lg('$a', [P.cyan, P.mint], 1, 1)}${lg('$b', [P.purple, P.pink], 1, 1)}${lg('$f', [P.night, '#7a2fb8', P.pink])}<clipPath id="$c"><rect x="30" y="34" width="68" height="68" rx="7"/></clipPath></defs>
<g stroke="${P.ink}" stroke-width="3"><rect x="30" y="34" width="68" height="68" rx="7" fill="url(#$a)" transform="translate(-16 -2) rotate(-16 64 68)"/>
<rect x="30" y="34" width="68" height="68" rx="7" fill="url(#$b)" transform="translate(-7 -1) rotate(-6 64 68)"/></g>
<g transform="translate(8 2) rotate(5 64 68)"><g clip-path="url(#$c)"><rect x="30" y="34" width="68" height="68" fill="url(#$f)"/>${sun(64, 72, 20)}<rect x="30" y="76" width="68" height="26" fill="${P.night}"/>${grid(30, 98, 76, 102, P.cyan, 1.2)}</g>
<rect x="30" y="34" width="68" height="68" rx="7" fill="none" stroke="${P.yellow}" stroke-width="3"/></g>`]);

// 5. Polaroid: an instant photo of a pastel sunset.
icons.push(['Polaroid', `<defs>${lg('$sky', ['#7fe7ff', '#d9a6ff', P.pink, P.peach])}<clipPath id="$c"><rect x="32" y="24" width="64" height="60"/></clipPath></defs>
<g transform="rotate(-7 64 64)"><rect x="22" y="14" width="84" height="102" rx="5" fill="#fdf7ff" stroke="${P.purple}" stroke-width="3"/>
<g clip-path="url(#$c)"><rect x="32" y="24" width="64" height="60" fill="url(#$sky)"/>${sun(64, 66, 20, '#fff6a8', '#ff7aa8')}<rect x="32" y="68" width="64" height="16" fill="${P.purple}"/>${grid(32, 96, 68, 84, P.yellow, 1.1)}</g>
<path d="M44 100 C52 94 58 104 66 98 S80 96 84 100" stroke="${P.pink}" stroke-width="3" fill="none" stroke-linecap="round"/></g>`]);

// 6. Wireframe peaks: the image-placeholder glyph as a synthwave landscape.
icons.push(['Wireframe peaks', `<defs>${lg('$bg', [P.night, '#3a1670', '#8a2a9c'])}<clipPath id="$c"><rect x="8" y="8" width="112" height="112" rx="22"/></clipPath></defs>
<g clip-path="url(#$c)"><rect x="8" y="8" width="112" height="112" fill="url(#$bg)"/>
<g fill="#fff"><circle cx="24" cy="24" r="1.2"/><circle cx="102" cy="20" r="1.4"/><circle cx="88" cy="36" r="1"/><circle cx="38" cy="40" r="1"/></g>
${sun(64, 60, 24, P.yellow, P.pink)}
<path d="M8 84 L34 50 L50 70 L70 42 L96 76 L106 64 L120 80 V120 H8Z" fill="${P.night}"/>
<path d="M8 84 L34 50 L50 70 L70 42 L96 76 L106 64 L120 80" fill="none" stroke="${P.cyan}" stroke-width="3" stroke-linejoin="round"/>
<path d="M34 50 L40 84 M50 70 L54 84 M70 42 L66 84 M70 42 L82 84 M96 76 L94 84" stroke="${P.cyan}" stroke-width="1.4" opacity=".7"/>
${grid(8, 120, 84, 120, P.pink, 1.4)}</g>
<rect x="8" y="8" width="112" height="112" rx="22" fill="none" stroke="${P.pink}" stroke-width="3"/>`]);

// 7. Marble bust: the vaporwave statue, in profile, over a pastel cover.
icons.push(['Marble bust', `<defs>${lg('$bg', ['#7fe7ff', '#c9a7ff', P.pink], 1, 1)}${lg('$m', ['#ffffff', '#e4dcf0', '#b9aed0'], 1, 0)}<clipPath id="$c"><rect x="10" y="10" width="108" height="108" rx="16"/></clipPath></defs>
<g clip-path="url(#$c)"><rect x="10" y="10" width="108" height="108" fill="url(#$bg)"/>${sun(84, 46, 22, P.yellow, P.peach)}
<path d="M62 22 C46 22 36 34 36 48 C36 52 34 56 30 61 C29 63 31 64 34 64 L34 70 C33 72 35 73 36 74 C35 77 37 78 39 78 C38 82 40 86 46 86 L52 86 L54 96 C40 98 28 106 24 118 H104 C100 104 88 96 76 94 C78 86 82 78 84 68 C88 52 82 22 62 22Z" fill="url(#$m)" stroke="${P.ink}" stroke-width="2.6" stroke-linejoin="round"/>
<path d="M58 22 C66 26 78 24 84 34 C80 30 74 32 70 30 C76 36 84 38 84 48 C80 42 74 42 70 40" fill="none" stroke="#8f84ab" stroke-width="2.2" stroke-linecap="round"/>
<rect x="32" y="44" width="30" height="9" rx="2" fill="${P.night}"/><path d="M36 47 H46" stroke="${P.cyan}" stroke-width="2" stroke-linecap="round"/></g>
<rect x="10" y="10" width="108" height="108" rx="16" fill="none" stroke="${P.ink}" stroke-width="3"/>`]);

// 8. Easel: the station itself, a canvas mid-painting.
icons.push(['Easel', `<defs>${lg('$sky', [P.purple, P.pink, P.peach])}${lg('$wood', [P.cyan, '#5aa7ff'])}<clipPath id="$c"><rect x="26" y="18" width="76" height="62" rx="3"/></clipPath></defs>
<g stroke="${P.ink}" stroke-width="3" stroke-linecap="round"><path d="M64 10 V20" stroke="${P.cyan}"/><path d="M50 80 L36 120 M78 80 L92 120 M64 80 V112" stroke="url(#$wood)" stroke-width="6"/></g>
<rect x="22" y="78" width="84" height="7" rx="3" fill="${P.yellow}" stroke="${P.ink}" stroke-width="2.5"/>
<g clip-path="url(#$c)"><rect x="26" y="18" width="76" height="62" fill="url(#$sky)"/>${sun(64, 58, 20, P.yellow, '#ff7a8a')}<rect x="26" y="60" width="76" height="20" fill="${P.night}"/>${grid(26, 102, 60, 80, P.mint, 1.2)}</g>
<rect x="26" y="18" width="76" height="62" rx="3" fill="none" stroke="${P.ink}" stroke-width="3"/>
<path d="M98 104 L114 88" stroke="${P.ink}" stroke-width="4" stroke-linecap="round"/><path d="M114 88 L118 84" stroke="${P.pink}" stroke-width="6" stroke-linecap="round"/>`]);

// 9. Desktop window: a 90s window previewing a cover.
icons.push(['Desktop window', `<defs>${lg('$bar', [P.pink, P.purple], 1, 0)}${lg('$sky', [P.night, '#6b2fa8', P.pink])}<clipPath id="$c"><rect x="20" y="36" width="88" height="68"/></clipPath></defs>
<rect x="10" y="14" width="108" height="100" rx="4" fill="#d9d3e8" stroke="${P.ink}" stroke-width="3"/>
<rect x="14" y="18" width="100" height="14" fill="url(#$bar)"/>
<g fill="#d9d3e8" stroke="${P.ink}" stroke-width="1.5"><rect x="80" y="20" width="9" height="9"/><rect x="91" y="20" width="9" height="9"/><rect x="102" y="20" width="9" height="9"/></g>
<path d="M104 22 l5 5 m0 -5 l-5 5" stroke="${P.ink}" stroke-width="1.5"/><path d="M18 25 H44" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
<g clip-path="url(#$c)"><rect x="20" y="36" width="88" height="68" fill="url(#$sky)"/>${sun(64, 80, 22, P.yellow, P.pink)}<rect x="20" y="84" width="88" height="20" fill="${P.night}"/>${grid(20, 108, 84, 104, P.cyan, 1.2)}</g>
<path d="M20 104 V36 H108" fill="none" stroke="#6d6489" stroke-width="2"/><path d="M108 36 V104 H20" fill="none" stroke="#fff" stroke-width="2"/>`]);

// 10. Neon sign: sleeve and record as glowing neon tubes.
icons.push(['Neon sign', `<defs><filter id="$g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<rect x="6" y="6" width="116" height="116" rx="24" fill="#120826" stroke="#3b2770" stroke-width="2"/>
<g fill="none" stroke-linecap="round" filter="url(#$g)"><circle cx="78" cy="58" r="28" stroke="${P.cyan}" stroke-width="3.5"/><circle cx="78" cy="58" r="8" stroke="${P.cyan}" stroke-width="3"/>
<rect x="22" y="30" width="56" height="56" rx="6" fill="#120826" stroke="${P.pink}" stroke-width="3.5"/>
<path d="M32 72 A18 18 0 0 1 68 72" stroke="${P.yellow}" stroke-width="3"/><path d="M30 76 H70" stroke="${P.yellow}" stroke-width="3"/>
<path d="M30 102 H98" stroke="${P.mint}" stroke-width="3"/><path d="M40 110 H88" stroke="${P.purple}" stroke-width="3"/></g>`]);

const cards = icons.map(([title, body], i) => {
  const n = String(i + 1).padStart(2, '0');
  const s = svg(`i${n}`, `Art Station — ${title}`, body);
  writeFileSync(join(dir, `icon-${n}.svg`), s);
  return { n, title, s };
});

const sizes = [128, 48, 16];
const row = (bg) => cards.map(c => `<figure>${sizes.map(z => `<img src="icon-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.title}</figcaption></figure>`).join('\n');
writeFileSync(join(dir, 'preview.html'), `<!doctype html><meta charset="utf-8"><title>Art Station icons</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:18px}
.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:10px;flex-wrap:wrap}figcaption{width:100%}</style>
<section class="dark">${row()}</section><section class="light">${row()}</section>\n`);
console.log(`wrote ${cards.length} icons`);
