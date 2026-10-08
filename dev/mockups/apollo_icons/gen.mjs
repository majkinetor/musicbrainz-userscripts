// Apollo Editor icons, round 1: twenty styles, each its own take on Apollo (the moonshot, the god of music, the editor).
// Writes icon-r1-01..20.svg and preview-round1.html (128, 48, 28, 16 px on white and black).
//   node dev/mockups/apollo_icons/gen.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
// the current icon's rocket (a 32-unit drawing), placed at (x, y) and scaled by s
const rocket = (x, y, s, c = {}) => { const k = { flame: '#ff8c3b', core: '#ffd24a', fin: '#3d2470', body: '#5f3ec0', win: '#cfe8ff', rim: '#2a1a52', ...c };
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M13 22 L19 22 L16 30 Z" fill="${k.flame}"/><path d="M14.4 22 L17.6 22 L16 27 Z" fill="${k.core}"/><path d="M12 18 L8 23.5 L12 22 Z M20 18 L24 23.5 L20 22 Z" fill="${k.fin}"/>
<path d="M16 2.5 C19 7 20 12 20 16 L20 22 L12 22 L12 16 C12 12 13 7 16 2.5 Z" fill="${k.body}"/><circle cx="16" cy="12.5" r="3" fill="${k.win}" stroke="${k.rim}" stroke-width="1"/></g>`; };
const star = (x, y, r, c) => `<path d="M${x} ${y - r} L${x + r * .28} ${y - r * .28} L${x + r} ${y} L${x + r * .28} ${y + r * .28} L${x} ${y + r} L${x - r * .28} ${y + r * .28} L${x - r} ${y} L${x - r * .28} ${y - r * .28}Z" fill="${c}"/>`;
const I = [];

// 01 Mission patch: an embroidered crew patch, the rocket over the moon
I.push(['01', 'Mission patch', `<defs>${lg('$sky', ['#0b1e4d', '#24407e'])}<clipPath id="$in"><circle cx="64" cy="64" r="43"/></clipPath><path id="$arc" d="M20 64 A44 44 0 0 1 108 64"/></defs>
<circle cx="64" cy="64" r="60" fill="#0b1e4d" stroke="#f2c14e" stroke-width="5"/><circle cx="64" cy="64" r="43" fill="url(#$sky)" stroke="#f2c14e" stroke-width="2.5"/>
<g clip-path="url(#$in)"><circle cx="64" cy="150" r="62" fill="#c9ccd6"/><circle cx="48" cy="98" r="4" fill="#a9adba"/><circle cx="82" cy="104" r="6" fill="#a9adba"/>${star(36, 44, 4, '#fff')}${star(92, 52, 3, '#fff')}${rocket(39, 26, 1.6)}</g>
<text font-family="Arial Black,Helvetica,sans-serif" font-weight="900" font-size="11.5" letter-spacing="2.5" fill="#f2c14e"><textPath href="#$arc" startOffset="50%" text-anchor="middle">APOLLO</textPath></text>`]);
// 02 Lyre: Apollo's own instrument, in gold
I.push(['02', 'Lyre', `<rect x="4" y="4" width="120" height="120" rx="26" fill="#2b1b5e"/>
<g fill="none" stroke="#e6b422" stroke-width="9" stroke-linecap="round"><path d="M48 98 C30 82 26 54 40 32 C44 25 37 18 30 23"/><path d="M80 98 C98 82 102 54 88 32 C84 25 91 18 98 23"/></g>
<path d="M36 40 H92" stroke="#e6b422" stroke-width="7" stroke-linecap="round"/><g stroke="#fff3c4" stroke-width="2.2"><path d="M54 40 V98 M61.3 40 V98 M68.6 40 V98 M76 40 V98" transform="translate(-1 0)"/></g>
<rect x="38" y="94" width="52" height="14" rx="5" fill="#b8860b"/>`]);
// 03 Lunar module: the Eagle, landed, Earth in the sky
I.push(['03', 'Lunar module', `<rect x="4" y="4" width="120" height="120" rx="26" fill="#0d1330"/><circle cx="100" cy="26" r="10" fill="#3a7bd5"/><path d="M94 22 q4 -4 8 0 q2 4 -2 8 q-4 -2 -6 -8Z" fill="#5cc26b"/>
<path d="M4 104 Q64 88 124 104 V98 124 Q124 124 98 124 H30 Q4 124 4 98Z" fill="#8d93a3"/><path d="M4 104 Q64 88 124 104" fill="none" stroke="#b4b9c6" stroke-width="2"/>
<g stroke="#c7ccd6" stroke-width="3.5" stroke-linecap="round"><path d="M44 82 L28 104 M84 82 L100 104 M52 84 L46 102 M76 84 L82 102"/></g><path d="M22 104 H34 M94 104 H106" stroke="#c7ccd6" stroke-width="4" stroke-linecap="round"/>
<path d="M38 64 H90 L86 86 H42Z" fill="#e3a82b"/><path d="M42 64 L48 42 L64 34 L80 42 L86 64Z" fill="#dfe2e9"/><path d="M54 48 L64 44 L66 56 L54 58Z" fill="#1c2440"/><path d="M76 38 L84 28" stroke="#dfe2e9" stroke-width="2.5"/><circle cx="85" cy="27" r="4" fill="none" stroke="#dfe2e9" stroke-width="2.5"/>`]);
// 04 Saturn V: lift-off from the pad, tower beside it
I.push(['04', 'Saturn V', `<defs>${lg('$sky', ['#7fc8f8', '#ffe3b3'])}</defs><rect x="4" y="4" width="120" height="120" rx="26" fill="url(#$sky)"/>
<g stroke="#c0392b" stroke-width="2.5" fill="none"><path d="M30 24 V112 M40 24 V112"/><path d="M30 34 L40 44 L30 54 L40 64 L30 74 L40 84 L30 94 L40 104"/><path d="M40 40 H56 M40 70 H56"/></g>
<path d="M58 20 L64 6 L70 20Z" fill="#222"/><path d="M64 6 V0" stroke="#222" stroke-width="2"/><rect x="57" y="20" width="14" height="70" fill="#fafafa" stroke="#222" stroke-width="1.5"/>
<path d="M57 34 H71 M57 58 H71" stroke="#222" stroke-width="5"/><path d="M57 82 L50 94 H57Z M71 82 L78 94 H71Z" fill="#222"/>
<path d="M58 90 L64 106 L70 90Z" fill="#ff8c3b"/><g fill="#fff" stroke="#d7d7d7" stroke-width="1.5"><circle cx="44" cy="112" r="14"/><circle cx="84" cy="112" r="14"/><circle cx="64" cy="114" r="14"/><circle cx="26" cy="118" r="10"/><circle cx="102" cy="118" r="10"/></g>`]);
// 05 Sun god: Apollo's sun, its rays as tracks of different lengths
{ const rays = Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8, l = [20, 12, 16, 9][i % 4], r0 = 34, c = ['#ff8c3b', '#ffb547', '#ff6b4a', '#ffd24a'][i % 4];
    return `<path d="M${(64 + r0 * Math.cos(a)).toFixed(1)} ${(64 + r0 * Math.sin(a)).toFixed(1)} L${(64 + (r0 + l) * Math.cos(a)).toFixed(1)} ${(64 + (r0 + l) * Math.sin(a)).toFixed(1)}" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`; }).join('');
  I.push(['05', 'Sun god', `<defs><radialGradient id="$s" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#ff8c3b"/></radialGradient></defs>${rays}<circle cx="64" cy="64" r="27" fill="url(#$s)"/><circle cx="64" cy="64" r="27" fill="none" stroke="#e0622a" stroke-width="2.5"/>`]); }
// 06 Laurel record: a vinyl crowned with Apollo's laurel
{ const leaves = side => Array.from({ length: 7 }, (_, i) => { const a = (side < 0 ? 105 : 75) + side * -(i * 20) ; const r = a * Math.PI / 180, x = 64 + 54 * Math.cos(r), y = 64 + 54 * Math.sin(r);
    return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="9" ry="4.2" fill="${i % 2 ? '#4f9d4a' : '#6cc04a'}" transform="rotate(${(a + 90 + side * 30).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`; }).join('');
  I.push(['06', 'Laurel record', `<circle cx="64" cy="64" r="42" fill="#17121f"/><g fill="none" stroke="#3a3346" stroke-width="1.5"><circle cx="64" cy="64" r="35"/><circle cx="64" cy="64" r="29"/><circle cx="64" cy="64" r="23"/></g>
<circle cx="64" cy="64" r="15" fill="#5f3ec0"/><circle cx="64" cy="64" r="2.5" fill="#fff"/><path d="M36 44 A34 34 0 0 1 58 31" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".35"/>${leaves(1)}${leaves(-1)}`]); }
// 07 Launch list: the rocket rising off a tracklist
I.push(['07', 'Launch list', `<rect x="4" y="4" width="120" height="120" rx="26" fill="#f1edff"/>
${[0, 1, 2, 3].map(i => { const y = 70 + i * 13; return `<circle cx="20" cy="${y}" r="3.5" fill="#5f3ec0"/><rect x="28" y="${y - 3}" width="${[52, 38, 46, 30][i]}" height="6" rx="3" fill="${i ? '#b9a8ec' : '#5f3ec0'}"/>`; }).join('')}
<path d="M76 66 L98 40" stroke="#ffb547" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 6"/><g transform="rotate(40 96 34)">${rocket(80, 4, 1.05)}</g>`]);
// 08 Moon record: the moon, pressed as a record
I.push(['08', 'Moon record', `<defs><radialGradient id="$m" cx=".38" cy=".35" r=".75"><stop offset="0" stop-color="#f1f1f5"/><stop offset="1" stop-color="#9da1b0"/></radialGradient></defs>
<circle cx="64" cy="64" r="54" fill="url(#$m)"/><g fill="none" stroke="#7d8192" stroke-width="1" opacity=".55"><circle cx="64" cy="64" r="46"/><circle cx="64" cy="64" r="39"/><circle cx="64" cy="64" r="32"/><circle cx="64" cy="64" r="25"/></g>
<g fill="#8a8e9e" opacity=".8"><circle cx="38" cy="44" r="7"/><circle cx="90" cy="84" r="9"/><circle cx="84" cy="34" r="4"/><circle cx="40" cy="90" r="5"/></g><circle cx="64" cy="64" r="14" fill="#5f3ec0"/><circle cx="64" cy="64" r="2.5" fill="#fff"/>`]);
// 09 Helmet: an astronaut's visor reflecting the tracklist
I.push(['09', 'Helmet', `<defs>${lg('$v', ['#ffd76a', '#d4891c', '#8a4a10'], 1, 1)}<clipPath id="$c"><ellipse cx="64" cy="58" rx="36" ry="30"/></clipPath></defs>
<rect x="34" y="96" width="60" height="22" rx="8" fill="#b9bfcc"/><circle cx="64" cy="60" r="50" fill="#f4f5f8" stroke="#9aa1b1" stroke-width="3"/><ellipse cx="64" cy="58" rx="38" ry="32" fill="#4a4f5c"/>
<ellipse cx="64" cy="58" rx="36" ry="30" fill="url(#$v)"/><g clip-path="url(#$c)" fill="#fff6d8" opacity=".75">${[0, 1, 2, 3].map(i => `<rect x="${36 + i * 2}" y="${42 + i * 10}" width="${[40, 30, 36, 24][i]}" height="4" rx="2"/>`).join('')}</g><path d="M40 40 Q50 32 62 31" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/><circle cx="20" cy="70" r="5" fill="#d0d4de"/><circle cx="108" cy="70" r="5" fill="#d0d4de"/>`]);
// 10 Drachma: a gold coin, meander border, the rocket struck in relief
I.push(['10', 'Drachma', `<defs><radialGradient id="$g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffe38a"/><stop offset="1" stop-color="#c08a1e"/></radialGradient></defs>
<circle cx="64" cy="64" r="58" fill="url(#$g)" stroke="#8a5f10" stroke-width="3"/><circle cx="64" cy="64" r="46" fill="none" stroke="#8a5f10" stroke-width="7" stroke-dasharray="5 4"/><circle cx="64" cy="64" r="40" fill="none" stroke="#8a5f10" stroke-width="1.5"/>
${rocket(40, 18, 1.5, { flame: '#9a6a12', core: '#b98417', fin: '#7a5210', body: '#9a6a12', win: '#ffe38a', rim: '#7a5210' })}`]);
// 11 Rocket A: the A of Apollo, lifting off
I.push(['11', 'Rocket A', `<path d="M64 6 L106 106 H84 L64 54 L44 106 H22Z" fill="#5f3ec0"/><path d="M64 6 L74 30 H54Z" fill="#3d2470"/><circle cx="64" cy="40" r="7" fill="#cfe8ff" stroke="#2a1a52" stroke-width="2.5"/>
<path d="M22 106 L12 118 L36 106Z M106 106 L116 118 L92 106Z" fill="#3d2470"/><path d="M52 92 H76 L64 124Z" fill="#ff8c3b"/><path d="M57 92 H71 L64 112Z" fill="#ffd24a"/>`]);
// 12 Orbit: a planet ringed by its tracks, the rocket on the ring
I.push(['12', 'Orbit', `<defs><radialGradient id="$p" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#9b7bff"/><stop offset="1" stop-color="#3d2470"/></radialGradient></defs>
<g transform="rotate(-20 64 64)"><path d="M10 64 A54 18 0 0 1 118 64" fill="none" stroke="#b9a8ec" stroke-width="3"/></g><circle cx="64" cy="64" r="28" fill="url(#$p)"/>
<g transform="rotate(-20 64 64)"><path d="M118 64 A54 18 0 0 1 10 64" fill="none" stroke="#b9a8ec" stroke-width="3"/>${[0.15, 0.35, 0.55, 0.75].map((t, i) => `<circle cx="${(64 + 54 * Math.cos(Math.PI * t)).toFixed(1)}" cy="${(64 + 18 * Math.sin(Math.PI * t)).toFixed(1)}" r="4.5" fill="${['#ff8c3b', '#ffd24a', '#5cc26b', '#3a9bd5'][i]}"/>`).join('')}</g>
<g transform="rotate(70 108 40)">${rocket(96, 22, .75)}</g>`]);
// 13 Pencil rocket: the editor's pencil, with fins and a flame
I.push(['13', 'Pencil rocket', `<g transform="rotate(-40 64 64)"><path d="M16 59 L0 64 L16 69Z" fill="#ff8c3b"/><path d="M16 61 L8 64 L16 67Z" fill="#ffd24a"/><rect x="16" y="54" width="9" height="20" rx="3" fill="#ff8fab"/><rect x="25" y="54" width="7" height="20" fill="#b9bfcc"/>
<rect x="32" y="54" width="56" height="20" fill="#ffcc33"/><path d="M32 60.5 H88 M32 67.5 H88" stroke="#e0a800" stroke-width="1.5"/><path d="M88 54 L108 64 L88 74Z" fill="#f3d9a4"/><path d="M100 60 L108 64 L100 68Z" fill="#333"/>
<path d="M34 54 L24 38 L48 54Z M34 74 L24 90 L48 74Z" fill="#5f3ec0"/></g>`]);
// 14 Footprint: one small step, in the regolith
I.push(['14', 'Footprint', `<rect x="4" y="4" width="120" height="120" rx="26" fill="#a7abb7"/><g fill="#959aa7"><circle cx="24" cy="30" r="6"/><circle cx="104" cy="98" r="8"/><circle cx="100" cy="24" r="3"/><circle cx="22" cy="104" r="4"/></g>
<g transform="rotate(-18 64 64)"><path d="M48 18 C48 8 80 8 80 18 L80 62 C80 66 76 68 76 72 L76 108 C76 118 52 118 52 108 L52 72 C52 68 48 66 48 62Z" fill="#6f7482"/>
<g stroke="#a7abb7" stroke-width="3.5">${[22, 32, 42, 52, 80, 90, 100].map(y => `<path d="M${y < 70 ? 50 : 54} ${y} H${y < 70 ? 78 : 74}"/>`).join('')}</g></g>`]);
// 15 Flat badge: a plain app tile, an A and a star
I.push(['15', 'Flat badge', `<defs>${lg('$b', ['#7a57e8', '#3b2290'], 1, 1)}</defs><rect x="4" y="4" width="120" height="120" rx="28" fill="url(#$b)"/>
<text x="60" y="102" text-anchor="middle" font-family="Arial Black,Helvetica,sans-serif" font-weight="900" font-size="88" fill="#fff">A</text>${star(98, 30, 13, '#ffd24a')}`]);
// 16 Pixel rocket: 8-bit, 16 by 16
{ const map = ['.......RR.......', '.S....RRRR......', '......WWWW......', '.....WWWWWW.....', '.....WWWWWW..S..', '.....WWBBWW.....', '.....WWBBWW.....', '.....WWWWWW.....',
    '.....WWWWWW.....', '.....WWWWWW.....', '....RWWWWWWR....', '...RRWWWWWWRR...', '...RR.WWWW.RR..S', '......OYYO......', '..S....OO.......', '................'];
  const col = { R: '#ff4d6d', W: '#f4f5f8', B: '#4cc9f0', O: '#ff8c3b', Y: '#ffd24a', S: '#ffffff' };
  const px = map.flatMap((r, y) => [...r].map((ch, x) => col[ch] ? `<rect x="${x * 8}" y="${y * 8}" width="8" height="8" fill="${col[ch]}"/>` : '')).join('');
  I.push(['16', 'Pixel rocket', `<rect x="0" y="0" width="128" height="128" rx="16" fill="#1b1440"/><g shape-rendering="crispEdges">${px}</g>`]); }
// 17 Lyra: the lyre constellation, Vega the bright one
{ const p = [[40, 100], [32, 70], [36, 40], [48, 26], [88, 100], [96, 70], [92, 40], [80, 26]];
  I.push(['17', 'Lyra', `<rect x="4" y="4" width="120" height="120" rx="26" fill="#0f1640"/><g stroke="#7f8ccf" stroke-width="1.8" fill="none"><path d="M${p.slice(0, 4).join(' L')}"/><path d="M${p.slice(4).join(' L')}"/><path d="M36 40 H92 M40 100 H88"/><path d="M56 40 V100 M72 40 V100" stroke-dasharray="3 4" opacity=".7"/></g>
${p.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#fff"/>`).join('')}${star(48, 26, 10, '#ffe680')}<g fill="#fff" opacity=".5"><circle cx="18" cy="20" r="1.2"/><circle cx="110" cy="56" r="1.2"/><circle cx="20" cy="84" r="1"/><circle cx="108" cy="112" r="1.2"/></g>`]); }
// 18 Sunrise launch: a silhouette climbing out of a striped sun
I.push(['18', 'Sunrise launch', `<defs>${lg('$sky', ['#3d2470', '#c2448f', '#ff8c3b'])}<clipPath id="$c"><rect x="4" y="4" width="120" height="120" rx="26"/></clipPath></defs>
<g clip-path="url(#$c)"><rect x="4" y="4" width="120" height="120" fill="url(#$sky)"/><circle cx="64" cy="98" r="38" fill="#ffd24a"/>${[80, 89, 97, 104].map((y, i) => `<rect x="20" y="${y}" width="88" height="${2 + i}" fill="#ff8c3b"/>`).join('')}<rect x="4" y="104" width="120" height="20" fill="#2a1a52"/>
<path d="M64 104 C62 90 66 80 64 70" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".6"/>${rocket(48, 18, 1.1, { flame: '#fff', core: '#ffd24a', fin: '#1a0f33', body: '#1a0f33', win: '#ffd24a', rim: '#1a0f33' })}</g>`]);
// 19 Splashdown: the capsule home under three chutes
{ const dome = (x, y, c) => `<path d="M${x - 15} ${y} A15 13 0 0 1 ${x + 15} ${y} Z" fill="${c}" stroke="#a23b3b" stroke-width="1.5"/><path d="M${x - 15} ${y} L64 76 M${x + 15} ${y} L64 76" stroke="#555" stroke-width="1"/>`;
  I.push(['19', 'Splashdown', `<rect x="4" y="4" width="120" height="120" rx="26" fill="#cfe9fb"/>${dome(34, 34, '#e94b4b')}${dome(94, 34, '#e94b4b')}${dome(64, 24, '#fff')}
<path d="M52 96 L58 76 H70 L76 96Z" fill="#c8ccd4" stroke="#556070" stroke-width="2"/><path d="M4 96 H124 V98 Q124 124 98 124 H30 Q4 124 4 98Z" fill="#1e6fb8"/><path d="M14 106 q8 -5 16 0 t16 0 M70 112 q8 -5 16 0 t16 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`]); }
// 20 Monoline: the current rocket as a single outline
I.push(['20', 'Monoline', `<g transform="scale(4)" fill="none" stroke="#5f3ec0" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M16 2.5 C19 7 20 12 20 16 L20 22 L12 22 L12 16 C12 12 13 7 16 2.5 Z"/><circle cx="16" cy="12.5" r="2.6"/><path d="M12 18 L8 23.5 L12 22 M20 18 L24 23.5 L20 22"/><path d="M14 25 L16 29.5 L18 25" stroke="#ff8c3b"/></g>`]);

const cards = I.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r1-${n}.svg`), svg(`ap${n}-`, `Apollo Editor — ${t}`, b)); return { n, t }; });
const fig = (src, cap) => `<figure>${[128, 48, 28, 16].map(z => `<img src="${src}" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${cap}</figcaption></figure>`;
const row = () => cards.map(c => fig(`icon-r1-${c.n}.svg`, `${c.n} · ${c.t}`)).join('');
writeFileSync(join(dir, 'preview-round1.html'), `<!doctype html><meta charset="utf-8"><title>Apollo Editor icons, round 1</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}</style>
<section class="light">${fig('../../../userscripts/apollo_editor/icon.svg', 'now · Rocket')}${row()}</section><section class="dark">${row()}</section>\n`);
console.log('wrote ' + cards.length);
