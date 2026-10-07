// Credit Hoarder icons, round 6: variations on round 5's 05 (gradient-line honeycomb) and 18 (ant
// with a tag). Writes icon-r6-h1..h6.svg and icon-r6-a1..a6.svg, and preview-round6.html.
//   node dev/mockups/credit_hoarder_icons/gen-round6.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const hex = (cx, cy, r) => `M${[0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 6 + i * Math.PI / 3; return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(' L')}Z`;
const GR = lg('$g', ['#f9a826', '#f3722c', '#d00070'], 1, 1);
const SEVEN = [[64, 64], [64, 34], [64, 94], [38, 49], [90, 49], [38, 79], [90, 79]];
// a small tag, centred at (x, y)
const tag = (x, y, s = 1, fill = '#fff', ink = '#d00070', rot = -12) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M-8 -6 H12 V6 H-8 L-14 0Z" fill="${fill}"/><circle cx="-9" cy="0" r="1.8" fill="${ink}"/><path d="M-3 -1.5 H8 M-3 2.5 H4" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/></g>`;
// a person glyph (head and shoulders), centred
const person = (x, y, s = 1, c = '#fff') => `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}"><circle cx="0" cy="-5" r="5"/><path d="M-9 9 C-9 0 9 0 9 9Z"/></g>`;
// the ant, its head at about (66, 70) in the round-5 drawing; s scales it round (cx, cy)
const ant = (ink = '#22223b') => `<g fill="${ink}"><ellipse cx="30" cy="80" rx="14" ry="10"/><circle cx="50" cy="76" r="8"/><circle cx="66" cy="70" r="10"/></g><g stroke="${ink}" stroke-width="3.5" stroke-linecap="round" fill="none"><path d="M26 86 l-6 12 M34 88 l2 12 M46 82 l-4 16 M52 84 l8 14 M72 62 C78 52 86 48 92 48 M70 62 C72 52 70 44 64 40"/></g>`;
const bigTag = (fill = '#ff6b35', ink = '#22223b', inner = 'lines') => `<g transform="rotate(-18 92 40)"><path d="M84 22 H120 V48 H84 L74 35Z" fill="${fill}" stroke="${ink}" stroke-width="3"/><circle cx="82" cy="35" r="3" fill="${ink}"/>${inner === 'lines' ? `<path d="M90 30 H114 M90 40 H106" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>` : person(100, 36, .8)}</g>`;
const I = [];

// ── 05 honeycomb ──
I.push(['h1', 'Honeycomb, one cell left', `<defs>${GR}</defs>${SEVEN.map(([x, y], i) => `<path d="${hex(x, y, 16)}" fill="${i === 4 ? 'none' : 'url(#$g)'}" stroke="url(#$g)" stroke-width="4.5" stroke-linejoin="round"${i === 4 ? ' stroke-dasharray="5 4"' : ''}/>`).join('')}`]);
I.push(['h2', 'Honeycomb of tags', `<defs>${GR}</defs>${SEVEN.map(([x, y], i) => `<path d="${hex(x, y, 16)}" fill="${i % 2 ? 'url(#$g)' : '#fff3e6'}" stroke="url(#$g)" stroke-width="4" stroke-linejoin="round"/>${tag(x + 1, y, .8, i % 2 ? '#fff' : '#f3722c', i % 2 ? '#d00070' : '#fff')}`).join('')}`]);
I.push(['h3', 'Honeycomb of people', `<defs>${GR}</defs>${SEVEN.map(([x, y], i) => `<path d="${hex(x, y, 16)}" fill="${i === 0 ? 'url(#$g)' : 'none'}" stroke="url(#$g)" stroke-width="4" stroke-linejoin="round"/>${person(x, y + 1, .85, i === 0 ? '#fff' : '#f3722c')}`).join('')}`]);
I.push(['h4', 'Neon honeycomb', `<defs>${GR}<filter id="$gl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect x="4" y="4" width="120" height="120" rx="26" fill="#1a0b2e"/>
<g filter="url(#$gl)">${SEVEN.map(([x, y], i) => `<path d="${hex(x, y, 15)}" fill="${i % 3 === 0 ? 'url(#$g)' : 'none'}" fill-opacity=".85" stroke="url(#$g)" stroke-width="3.5" stroke-linejoin="round"/>`).join('')}</g>`]);
I.push(['h5', 'Three big cells', `<defs>${GR}${lg('$g2', ['#ffd166', '#f9a826'], 1, 1)}</defs><path d="${hex(64, 40, 26)}" fill="url(#$g2)" stroke="url(#$g)" stroke-width="5" stroke-linejoin="round"/><path d="${hex(42, 79, 26)}" fill="url(#$g)" stroke="url(#$g)" stroke-width="5" stroke-linejoin="round"/><path d="${hex(86, 79, 26)}" fill="none" stroke="url(#$g)" stroke-width="5" stroke-linejoin="round"/>${tag(42, 79, 1.4)}${person(64, 41, 1.3, '#d00070')}`]);
I.push(['h6', 'Bee with a tag', `<defs>${GR}</defs>${SEVEN.slice(0, 6).map(([x, y], i) => `<path d="${hex(x - 6, y + 8, 14)}" fill="${i % 2 ? 'url(#$g)' : 'none'}" fill-opacity=".8" stroke="url(#$g)" stroke-width="3.5" stroke-linejoin="round"/>`).join('')}
<g transform="translate(96 30)"><ellipse cx="-6" cy="-12" rx="9" ry="6" fill="#d7f3ff" stroke="#22223b" stroke-width="2" transform="rotate(-20 -6 -12)"/><ellipse cx="6" cy="-13" rx="9" ry="6" fill="#d7f3ff" stroke="#22223b" stroke-width="2" transform="rotate(20 6 -13)"/><ellipse cx="0" cy="0" rx="15" ry="11" fill="#ffd166" stroke="#22223b" stroke-width="2.5"/><path d="M-5 -10 V10 M4 -10 V10" stroke="#22223b" stroke-width="4"/><circle cx="14" cy="-2" r="2" fill="#22223b"/></g>
<path d="M90 42 L84 52" stroke="#22223b" stroke-width="2"/>${tag(82, 58, 1.1, '#fff', '#d00070', 8)}`]);

// ── 18 ant ──
const field = (bg = '#c7f9cc', ground = '#57cc99') => `<rect x="4" y="4" width="120" height="120" rx="24" fill="${bg}"/><path d="M4 100 H124" stroke="${ground}" stroke-width="5"/>`;
I.push(['a1', 'Ant with a stack of tags', `${field()}${ant()}<g transform="rotate(-14 96 40)">${['#ff6b35', '#ffd166', '#118ab2'].map((c, i) => `<g transform="translate(${i * 2} ${-i * 9})"><path d="M84 30 H118 V48 H84 L75 39Z" fill="${c}" stroke="#22223b" stroke-width="3"/><circle cx="82" cy="39" r="2.5" fill="#22223b"/></g>`).join('')}</g>`]);
I.push(['a2', 'Ant trail', `${field()}<g transform="translate(-14 4) scale(.62) translate(0 40)">${ant()}${bigTag('#ffd166')}</g><g transform="translate(40 -6) scale(.78) translate(0 30)">${ant()}${bigTag()}</g>`]);
I.push(['a3', 'Ant on a round badge', `<circle cx="64" cy="64" r="58" fill="#c7f9cc"/><path d="M10 92 H118" stroke="#57cc99" stroke-width="5"/><g transform="translate(64 64) scale(1.05) translate(-66 -68)">${ant()}${bigTag()}</g><circle cx="64" cy="64" r="58" fill="none" stroke="#22223b" stroke-width="3"/>`]);
I.push(['a4', 'Ant with a person card', `${field('#e0f2fe', '#7dd3fc')}${ant('#1e293b')}${bigTag('#2563eb', '#1e293b', 'person')}`]);
I.push(['a5', 'Night ant, glowing tag', `<defs><filter id="$gl" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect x="4" y="4" width="120" height="120" rx="24" fill="#14213d"/><g fill="#fff"><circle cx="22" cy="24" r="1.4"/><circle cx="44" cy="16" r="1"/><circle cx="30" cy="44" r="1"/></g><path d="M4 100 H124" stroke="#2b4a7a" stroke-width="5"/>
${ant('#e5e5e5')}<g filter="url(#$gl)">${bigTag('#fca311', '#fca311')}</g>`]);
I.push(['a6', 'Ant carrying a honeycomb cell', `<defs>${GR}</defs>${field('#fff3e6', '#f9a826')}${ant()}<path d="${hex(98, 36, 18)}" fill="url(#$g)" stroke="#22223b" stroke-width="3" stroke-linejoin="round" transform="rotate(-10 98 36)"/>${person(98, 37, .9)}`]);

const cards = I.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r6-${n}.svg`), svg(`g${n}`, `Credit Hoarder — ${t}`, b)); return { n, t }; });
const fig = (src, cap, cls = '') => `<figure${cls}>${[128, 48, 16].map(z => `<img src="${src}" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${cap}</figcaption></figure>`;
const group = (pre, ref, refCap) => fig(ref, refCap, ' class="ref"') + cards.filter(c => c.n[0] === pre).map(c => fig(`icon-r6-${c.n}.svg`, `${c.n} · ${c.t}`)).join('');
const body = cls => `<section class="${cls}"><h2>05 · Honeycomb</h2><div class="g">${group('h', 'icon-r5-05.svg', 'round 5 · 05')}</div><h2>18 · Ant</h2><div class="g">${group('a', 'icon-r5-18.svg', 'round 5 · 18')}</div></section>`;
writeFileSync(join(dir, 'preview-round6.html'), `<!doctype html><meta charset="utf-8"><title>Credit Hoarder icons, round 6</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:16px 18px}h2{font-size:14px;margin:4px 0 10px}.g{display:grid;grid-template-columns:repeat(7,1fr);gap:16px;margin-bottom:12px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}.ref figcaption{opacity:.6}</style>
${body('light')}${body('dark')}\n`);
console.log('wrote ' + cards.length);
