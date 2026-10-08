// Apollo Editor icons, round 2: twenty more styles, none repeating round 1.
// Writes icon-r2-01..20.svg and preview-round2.html (128, 48, 28, 16 px on white and black).
//   node dev/mockups/apollo_icons/gen-round2.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
// the current icon's rocket outline (32 units): body, fins, window
const BODY = 'M16 2.5 C19 7 20 12 20 16 L20 22 L12 22 L12 16 C12 12 13 7 16 2.5 Z', FINS = 'M12 18 L8 23.5 L12 22 Z M20 18 L24 23.5 L20 22 Z';
const rocket = (x, y, s, c = {}) => { const k = { flame: '#ff8c3b', core: '#ffd24a', fin: '#3d2470', body: '#5f3ec0', win: '#cfe8ff', rim: '#2a1a52', ...c };
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M13 22 L19 22 L16 30 Z" fill="${k.flame}"/><path d="M14.4 22 L17.6 22 L16 27 Z" fill="${k.core}"/><path d="${FINS}" fill="${k.fin}"/><path d="${BODY}" fill="${k.body}"/><circle cx="16" cy="12.5" r="3" fill="${k.win}" stroke="${k.rim}" stroke-width="1"/></g>`; };
const star = (x, y, r, c) => `<path d="M${x} ${y - r} L${x + r * .28} ${y - r * .28} L${x + r} ${y} L${x + r * .28} ${y + r * .28} L${x} ${y + r} L${x - r * .28} ${y + r * .28} L${x - r} ${y} L${x - r * .28} ${y - r * .28}Z" fill="${c}"/>`;
const pol = (r, a) => [64 + r * Math.cos(a), 64 + r * Math.sin(a)].map(v => v.toFixed(1));
const I = [];

// 01 Neon sign: the rocket in glowing tube on a dark wall
I.push(['01', 'Neon sign', `<defs><filter id="$g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<rect x="4" y="4" width="120" height="120" rx="26" fill="#1a1024"/><g transform="translate(16 12) scale(3)" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#$g)"><path d="${BODY}" stroke="#ff4fd8" stroke-width="1.3"/><path d="${FINS}" stroke="#ff4fd8" stroke-width="1.3"/><circle cx="16" cy="12.5" r="2.6" stroke="#4ff3ff" stroke-width="1.3"/><path d="M14 24.5 L16 29 L18 24.5" stroke="#ffd24a" stroke-width="1.3"/></g>`]);
// 02 Swoosh seal: a round agency-style seal, orbit and a red chevron
I.push(['02', 'Swoosh seal', `<circle cx="64" cy="64" r="58" fill="#3b2290"/><g fill="#fff">${[[30, 40, 1.6], [44, 92, 1.2], [96, 30, 1.4], [100, 96, 1.2], [80, 22, 1]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>
<ellipse cx="64" cy="64" rx="50" ry="17" fill="none" stroke="#fff" stroke-width="3.5" transform="rotate(-24 64 64)"/><path d="M14 92 C46 74 78 60 118 30 C90 64 60 84 30 102 Z" fill="#ff4d4d"/>
<text x="64" y="76" text-anchor="middle" font-family="Arial Black,Helvetica,sans-serif" font-weight="900" font-size="38" fill="#fff" font-style="italic">AE</text>`]);
// 03 Art deco: a gold sunburst behind a black rocket
{ const rays = Array.from({ length: 18 }, (_, i) => { const a = Math.PI + i * Math.PI / 17, [x1, y1] = pol(60, a - .045), [x2, y2] = pol(60, a + .045); return `<path d="M64 96 L${x1} ${(+y1 + 32).toFixed(1)} L${x2} ${(+y2 + 32).toFixed(1)}Z" fill="#a8862e"/>`; }).join('');
  I.push(['03', 'Art deco', `<rect x="4" y="4" width="120" height="120" rx="20" fill="#121212"/><rect x="9" y="9" width="110" height="110" rx="16" fill="none" stroke="#e8c35a" stroke-width="2"/>${rays}<path d="M24 96 H104" stroke="#e8c35a" stroke-width="3"/>
${rocket(40, 14, 1.5, { flame: '#fff1c2', core: '#fff', fin: '#e8c35a', body: '#e8c35a', win: '#121212', rim: '#e8c35a' })}`]); }
// 04 Paper cut: layered paper hills under a paper moon and rocket
I.push(['04', 'Paper cut', `<defs><filter id="$s"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-opacity=".35"/></filter><clipPath id="$c"><rect x="4" y="4" width="120" height="120" rx="26"/></clipPath></defs>
<g clip-path="url(#$c)"><rect x="4" y="4" width="120" height="120" fill="#ffe9d6"/><circle cx="88" cy="40" r="20" fill="#fff8ec" filter="url(#$s)"/><g filter="url(#$s)"><path d="M4 86 Q34 66 64 82 T124 74 V124 H4Z" fill="#c7a8ff"/><path d="M4 100 Q40 84 76 98 T124 94 V124 H4Z" fill="#8a63e6"/><path d="M4 112 Q48 100 88 112 T124 110 V124 H4Z" fill="#4b2aa8"/></g>
<g filter="url(#$s)">${rocket(22, 18, 1.3, { body: '#ff8fab', fin: '#e85d8a', win: '#fff', rim: '#e85d8a' })}</g></g>`]);
// 05 Stained glass: the lyre in a leaded window
I.push(['05', 'Stained glass', `<rect x="10" y="4" width="108" height="120" rx="54" ry="40" fill="#22223b" />
<g stroke="#22223b" stroke-width="3"><path d="M14 44 Q64 -20 114 44 V120 H14Z" fill="#3a86ff"/><path d="M14 44 L64 64 L114 44" fill="none"/><path d="M14 44 L64 64 V120 H14Z" fill="#8338ec"/><path d="M114 44 L64 64 V120 H114Z" fill="#3a0ca3"/><path d="M14 90 L64 64 L114 90 L64 120Z" fill="#ff006e" opacity=".85"/></g>
<g fill="none" stroke="#ffbe0b" stroke-width="7" stroke-linecap="round"><path d="M52 104 C40 92 38 68 48 52"/><path d="M76 104 C88 92 90 68 80 52"/><path d="M44 58 H84"/></g><g stroke="#fff3c4" stroke-width="2"><path d="M58 58 V102 M64 58 V102 M70 58 V102"/></g><rect x="46" y="100" width="36" height="9" rx="3" fill="#ffbe0b"/>`]);
// 06 Isometric pad: the rocket standing on an isometric launch pad
{ const slab = (y, c1, c2, c3) => `<path d="M64 ${y} l40 20 l-40 20 l-40 -20Z" fill="${c1}"/><path d="M24 ${y + 20} l40 20 v8 l-40 -20Z" fill="${c2}"/><path d="M104 ${y + 20} l-40 20 v8 l40 -20Z" fill="${c3}"/>`;
  I.push(['06', 'Isometric pad', `${slab(70, '#d9dce6', '#a8adbd', '#7f8598')}<path d="M44 90 l20 10 l20 -10" fill="none" stroke="#ffd24a" stroke-width="2.5" stroke-dasharray="4 3"/><ellipse cx="64" cy="94" rx="14" ry="6" fill="#ff8c3b" opacity=".7"/>${rocket(40, 44, 1.5)}`]); }
// 07 Comet: the tracklist streams behind it as a tail
I.push(['07', 'Comet', `<rect x="4" y="4" width="120" height="120" rx="26" fill="#140e33"/>${[[0, '#ffd24a', 70], [1, '#ff8c3b', 56], [2, '#ff4d6d', 64], [3, '#b983ff', 46]].map(([i, c, l]) => `<path d="M${88 - l} ${108 - i * 10 - l * .7} L88 ${46 + i * 6 - 16}" stroke="${c}" stroke-width="5" stroke-linecap="round" opacity="${1 - i * .15}"/>`).join('')}
<circle cx="92" cy="34" r="14" fill="#fff4c2"/><circle cx="92" cy="34" r="9" fill="#fff"/>`]);
// 08 Glass: a frosted glass tile over colour blobs, a white A
I.push(['08', 'Glass', `<defs><filter id="$b"><feGaussianBlur stdDeviation="8"/></filter><clipPath id="$c"><rect x="4" y="4" width="120" height="120" rx="28"/></clipPath></defs>
<g clip-path="url(#$c)"><rect x="4" y="4" width="120" height="120" fill="#5f3ec0"/><g filter="url(#$b)"><circle cx="30" cy="30" r="30" fill="#ff8c3b"/><circle cx="104" cy="96" r="36" fill="#4cc9f0"/><circle cx="96" cy="26" r="20" fill="#ff4fd8"/></g>
<rect x="18" y="18" width="92" height="92" rx="20" fill="#fff" opacity=".18" stroke="#fff" stroke-opacity=".6" stroke-width="2"/></g>
<text x="64" y="94" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="800" font-size="72" fill="#fff">A</text>`]);
// 09 Crescent lyre: the moon's crescent is the lyre's frame
I.push(['09', 'Crescent lyre', `<rect x="4" y="4" width="120" height="120" rx="26" fill="#1b2a4a"/><mask id="$m"><rect width="128" height="128" fill="#fff"/><circle cx="64" cy="46" r="38" fill="#000"/></mask><circle cx="64" cy="62" r="46" fill="#f2e6b8" mask="url(#$m)"/>
<g stroke="#fff3c4" stroke-width="2.4"><path d="M28 44 H100" stroke="#f2e6b8" stroke-width="4"/><path d="M44 44 V92 M54 44 V96 M64 44 V98 M74 44 V96 M84 44 V92"/></g>${star(100, 28, 6, '#ffd24a')}`]);
// 10 Groove launch: the rocket lifts off from a record's label
I.push(['10', 'Groove launch', `<circle cx="64" cy="72" r="52" fill="#17121f"/><g fill="none" stroke="#3a3346" stroke-width="1.5"><circle cx="64" cy="72" r="44"/><circle cx="64" cy="72" r="37"/><circle cx="64" cy="72" r="30"/></g><circle cx="64" cy="72" r="18" fill="#ff8c3b"/>
<path d="M54 72 C58 60 70 60 74 72" fill="none" stroke="#fff" stroke-width="2.5" opacity=".7"/>${rocket(46, -4, 1.15)}`]);
// 11 Star rocket: the rocket drawn as a constellation
{ const p = [[64, 10], [76, 34], [80, 62], [80, 88], [96, 104], [64, 96], [32, 104], [48, 88], [48, 62], [52, 34]];
  I.push(['11', 'Star rocket', `<rect x="4" y="4" width="120" height="120" rx="26" fill="#0b1238"/><path d="M${p.join(' L')}Z" fill="none" stroke="#7f8ccf" stroke-width="1.8"/><circle cx="64" cy="50" r="8" fill="none" stroke="#7f8ccf" stroke-width="1.8"/>
${p.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i ? 3.4 : 5}" fill="${i ? '#fff' : '#ffe680'}"/>`).join('')}<path d="M58 104 L64 120 L70 104" fill="none" stroke="#ff8c3b" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`]); }
// 12 Sticker: die-cut rocket with a white border and a peel
I.push(['12', 'Sticker', `<defs><filter id="$s"><feDropShadow dx="1" dy="3" stdDeviation="2" flood-opacity=".3"/></filter></defs><g filter="url(#$s)"><g transform="translate(16 2) scale(3)"><path d="${BODY}" fill="#fff" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><path d="${FINS} M13 22 L19 22 L16 30 Z" fill="#fff" stroke="#fff" stroke-width="4" stroke-linejoin="round"/></g>
${rocket(16, 2, 3, { body: '#7a57e8' })}</g><path d="M86 82 L94 92 L84 94Z" fill="#e8e3f7"/>`]);
// 13 Blueprint: a technical drawing of the rocket
I.push(['13', 'Blueprint', `<defs><pattern id="$p" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0 H0 V8" fill="none" stroke="#3d78c4" stroke-width=".6"/></pattern></defs><rect x="4" y="4" width="120" height="120" rx="12" fill="#1f5aa6"/><rect x="4" y="4" width="120" height="120" rx="12" fill="url(#$p)"/>
<g transform="translate(16 6) scale(3)" fill="none" stroke="#fff" stroke-width=".6"><path d="${BODY}"/><path d="${FINS}"/><circle cx="16" cy="12.5" r="2.6"/><path d="M12 16 H20 M14 25 L16 29.5 L18 25" stroke-dasharray="1 .8"/></g>
<g stroke="#cfe3ff" stroke-width="1" fill="#cfe3ff"><path d="M100 14 V72 M96 14 H104 M96 72 H104"/><path d="M28 112 H100 M28 108 V116 M100 108 V116"/></g><text x="108" y="46" font-family="monospace" font-size="9" fill="#cfe3ff" transform="rotate(90 108 46)">H 58</text>`]);
// 14 Waveform: audio bars that rise into a rocket's plume
{ const h = [8, 14, 22, 30, 40, 52, 40, 30, 22, 14, 8];
  I.push(['14', 'Waveform', `<rect x="4" y="4" width="120" height="120" rx="26" fill="#2a1a52"/>${h.map((v, i) => `<rect x="${16 + i * 9}" y="${118 - v - 4}" width="6" height="${v}" rx="3" fill="${['#ffd24a', '#ff8c3b', '#ff4d6d'][Math.abs(i - 5) % 3]}"/>`).join('')}${rocket(48, 8, 1)}`]); }
// 15 Temple: a Greek pediment whose columns are tracks
I.push(['15', 'Temple', `<rect x="4" y="4" width="120" height="120" rx="26" fill="#f4efe4"/><path d="M14 46 L64 16 L114 46Z" fill="#5f3ec0"/><circle cx="64" cy="35" r="5" fill="#ffd24a"/><rect x="16" y="46" width="96" height="8" fill="#3d2470"/>
${[0, 1, 2, 3, 4].map(i => `<rect x="${22 + i * 18}" y="56" width="10" height="${[44, 36, 48, 40, 30][i]}" rx="2" fill="#7a57e8"/>`).join('')}<rect x="12" y="106" width="104" height="8" rx="2" fill="#3d2470"/>`]);
// 16 Cute rocket: the rocket with a face
I.push(['16', 'Cute rocket', `<rect x="4" y="4" width="120" height="120" rx="26" fill="#ffe6f1"/>${rocket(16, 4, 3, { body: '#8f6cff', fin: '#ff6fa8', win: '#fff', rim: '#5f3ec0' })}<g fill="#2a1a52"><circle cx="58" cy="44" r="2.2"/><circle cx="70" cy="44" r="2.2"/></g><path d="M60 50 Q64 54 68 50" stroke="#2a1a52" stroke-width="2" fill="none" stroke-linecap="round"/>
<circle cx="54" cy="50" r="2.6" fill="#ff9cc4"/><circle cx="74" cy="50" r="2.6" fill="#ff9cc4"/>`]);
// 17 Hex monogram: a hexagonal badge with A over a lyre string set
{ const hex = Array.from({ length: 6 }, (_, i) => pol(58, Math.PI / 6 + i * Math.PI / 3).join(' ')).join(' L');
  I.push(['17', 'Hex monogram', `<path d="M${hex}Z" fill="#2a1a52"/><path d="M${Array.from({ length: 6 }, (_, i) => pol(50, Math.PI / 6 + i * Math.PI / 3).join(' ')).join(' L')}Z" fill="none" stroke="#ffd24a" stroke-width="2.5"/>
<path d="M64 30 L88 94 H76 L64 60 L52 94 H40Z" fill="#fff"/><path d="M50 80 H78" stroke="#ffd24a" stroke-width="5" stroke-linecap="round"/>`]); }
// 18 Phases: four moon phases in a row, tracks done to tracks to come
{ const ph = (x, f) => `<circle cx="${x}" cy="64" r="12" fill="#3d2470"/><path d="M${x} 52 A12 12 0 0 1 ${x} 76 A${Math.abs(12 - f * 24).toFixed(1)} 12 0 0 ${f < .5 ? 0 : 1} ${x} 52Z" fill="#f2e6b8"/>`;
  I.push(['18', 'Phases', `<rect x="4" y="4" width="120" height="120" rx="26" fill="#140e33"/>${ph(22, .15)}${ph(49, .4)}${ph(76, .7)}<circle cx="104" cy="64" r="12" fill="#f2e6b8"/><path d="M14 90 H114" stroke="#5f3ec0" stroke-width="4" stroke-linecap="round"/><path d="M14 90 H80" stroke="#ffd24a" stroke-width="4" stroke-linecap="round"/>`]); }
// 19 Signature: the exhaust writes a looping line, like a pen
I.push(['19', 'Signature', `<path d="M10 112 C30 112 30 84 46 90 C62 96 46 116 38 104 C30 92 60 80 70 64 C74 56 80 50 85 43" fill="none" stroke="#ff8c3b" stroke-width="5" stroke-linecap="round"/><g transform="rotate(38 84 40)">${rocket(68, 6, 1.15)}</g>`]);
// 20 Bauhaus: moon circle, rocket triangle, launch bar
I.push(['20', 'Bauhaus', `<rect x="4" y="4" width="120" height="120" fill="#f2efe6"/><circle cx="84" cy="42" r="28" fill="#ffd24a"/><path d="M40 20 L62 96 H18Z" fill="#e30613"/><rect x="12" y="100" width="104" height="14" fill="#1d3fbb"/><circle cx="40" cy="70" r="7" fill="#f2efe6"/>`]);

const cards = I.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r2-${n}.svg`), svg(`ap2${n}-`, `Apollo Editor — ${t}`, b)); return { n, t }; });
const fig = (src, cap) => `<figure>${[128, 48, 28, 16].map(z => `<img src="${src}" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${cap}</figcaption></figure>`;
const row = () => cards.map(c => fig(`icon-r2-${c.n}.svg`, `${c.n} · ${c.t}`)).join('');
writeFileSync(join(dir, 'preview-round2.html'), `<!doctype html><meta charset="utf-8"><title>Apollo Editor icons, round 2</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}</style>
<section class="light">${fig('../../../userscripts/apollo_editor/icon.svg', 'now · Rocket')}${row()}</section><section class="dark">${row()}</section>\n`);
console.log('wrote ' + cards.length);
