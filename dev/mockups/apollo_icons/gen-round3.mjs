// Apollo Editor icons, round 3: twenty fresh ideas, none built on the current rocket.
// Apollo the archer, the oracle, the sun, the god of music and his swan, Python and laurel; the moon programme; the Apollo Theater.
// Writes icon-r3-01..20.svg and preview-round3.html (128, 48, 28, 16 px on white and black).
//   node dev/mockups/apollo_icons/gen-round3.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const rg = (id, a, b, cx = .38, cy = .32) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r=".8"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
const star = (x, y, r, c) => `<path d="M${x} ${y - r} L${x + r * .28} ${y - r * .28} L${x + r} ${y} L${x + r * .28} ${y + r * .28} L${x} ${y + r} L${x - r * .28} ${y + r * .28} L${x - r} ${y} L${x - r * .28} ${y - r * .28}Z" fill="${c}"/>`;
const at = (cx, cy, r, deg) => { const a = deg * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
const f1 = v => v.toFixed(1);
const grooves = (cx, cy, rs, c) => `<g fill="none" stroke="${c}" stroke-width="1.4">${rs.map(r => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join('')}</g>`;
const dots = (pts, c = '#fff') => `<g fill="${c}">${pts.map(([x, y, r = 1.3]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
const tile = (fill, rx = 26) => `<rect x="4" y="4" width="120" height="120" rx="${rx}" fill="${fill}"/>`;
const I = [];

// 01 Bullseye: Apollo the archer; the arrow lands dead centre on a record
I.push(['01', 'Bullseye', `${tile('#fdf1dc')}<circle cx="58" cy="70" r="44" fill="#17121f"/>${grooves(58, 70, [37, 31, 25], '#3a3346')}<circle cx="58" cy="70" r="17" fill="#e63946"/><circle cx="58" cy="70" r="11.5" fill="#fff"/><circle cx="58" cy="70" r="6" fill="#e63946"/>
<path d="M60 68 L112 16" stroke="#7a4a1e" stroke-width="4.5" stroke-linecap="round"/><path d="M104 24 L100 10 L112 16Z M104 24 L118 28 L112 16Z" fill="#2a9d8f"/><path d="M98 30 L94 18 L104 24Z M98 30 L110 34 L104 24Z" fill="#e9c46a"/>
<path d="M30 30 L40 38 M22 46 L34 50 M44 20 L50 32" stroke="#e63946" stroke-width="3" stroke-linecap="round" opacity=".55"/>`]);
// 02 Earthrise: the Earth comes up over the moon, pressed as a record
I.push(['02', 'Earthrise', `<defs><clipPath id="$c"><rect x="4" y="4" width="120" height="120" rx="26"/></clipPath>${rg('$m', '#c9ccd4', '#6f7482', .5, 0)}</defs><g clip-path="url(#$c)">${tile('#05070f')}
${dots([[18, 20], [104, 18, 1.6], [28, 52, 1], [112, 50], [86, 12, 1]])}<circle cx="64" cy="58" r="32" fill="#2d6fd6"/>${grooves(64, 58, [26, 20], '#1d4fa8')}<circle cx="64" cy="58" r="10" fill="#5cc26b"/><circle cx="64" cy="58" r="2.4" fill="#05070f"/>
<path d="M40 40 Q54 30 70 32" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".7"/><circle cx="64" cy="176" r="96" fill="url(#$m)"/>${dots([[30, 104, 5], [84, 96, 3.5], [100, 112, 6], [56, 116, 3]], '#8a8f9c')}</g>`]);
// 03 Golden record: an engraved gold disc, the engraving a flight path between two worlds
I.push(['03', 'Golden record', `<defs>${rg('$g', '#ffe9a3', '#b8811c')}</defs><circle cx="64" cy="64" r="58" fill="url(#$g)" stroke="#8a5f10" stroke-width="2.5"/>${grooves(64, 64, [52, 47], '#c99a3a')}
<g stroke="#6b4508" stroke-width="1.6" fill="none" stroke-linecap="round"><circle cx="34" cy="86" r="9"/><circle cx="96" cy="40" r="5"/><path d="M42 80 C56 50 74 70 90 44" stroke-dasharray="3 3"/>
${[0, 40, 85, 140, 200, 250, 300].map((d, i) => { const [x1, y1] = at(64, 64, 8, d), [x2, y2] = at(64, 64, 8 + [14, 22, 10, 18, 26, 12, 20][i], d); return `<path d="M${f1(x1)} ${f1(y1)} L${f1(x2)} ${f1(y2)}"/>`; }).join('')}</g><circle cx="64" cy="64" r="3.5" fill="#6b4508"/>`]);
// 04 Oracle: Delphi's all-seeing eye, its iris a record
I.push(['04', 'Oracle', `<g stroke="#e9b949" stroke-width="4" stroke-linecap="round">${[-60, -38, -16, 16, 38, 60].map(d => { const [x1, y1] = at(64, 64, 50, d - 90), [x2, y2] = at(64, 64, 60, d - 90); return `<path d="M${f1(x1)} ${f1(y1)} L${f1(x2)} ${f1(y2)}"/>`; }).join('')}</g>
<path d="M6 70 Q64 10 122 70 Q64 126 6 70Z" fill="#fff" stroke="#2a1a52" stroke-width="5" stroke-linejoin="round"/><circle cx="64" cy="70" r="27" fill="#17121f"/>${grooves(64, 70, [22, 17], '#3f3550')}<circle cx="64" cy="70" r="10" fill="#7a57e8"/><circle cx="64" cy="70" r="2.6" fill="#fff"/><circle cx="74" cy="58" r="5" fill="#fff" opacity=".85"/>`]);
// 05 Swan note: Apollo's swan, shaped like a quaver
I.push(['05', 'Swan note', `${tile('#1d3b8a')}<path d="M16 104 q10 -5 20 0 t20 0 t20 0 t20 0 t20 0" stroke="#5f86d9" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M78 92 C92 72 72 56 80 34 C84 22 98 22 100 32" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/><path d="M100 30 L114 34 L100 38Z" fill="#ff8c3b"/><circle cx="96" cy="31" r="2" fill="#1d3b8a"/>
<ellipse cx="56" cy="92" rx="30" ry="15" fill="#fff" transform="rotate(-12 56 92)"/><path d="M34 86 C44 70 64 70 74 80" fill="none" stroke="#c9d6f5" stroke-width="3" stroke-linecap="round"/>`]);
// 06 Marquee: the Apollo Theater's sign, ringed with bulbs
{ const bulbs = []; for (let x = 18; x <= 110; x += 11.5) bulbs.push([x, 30], [x, 98]); for (let y = 41.5; y < 98; y += 11.5) bulbs.push([14, y], [114, y]);
  I.push(['06', 'Marquee', `<rect x="6" y="22" width="116" height="84" rx="10" fill="#b5122b"/><rect x="22" y="40" width="84" height="48" rx="4" fill="#fff3d6"/>${dots(bulbs.map(([x, y]) => [x, y, 3.6]), '#ffd24a')}
<text x="64" y="73" text-anchor="middle" font-family="Arial Black,Helvetica,sans-serif" font-weight="900" font-size="19" letter-spacing="-.5" fill="#b5122b">APOLLO</text><path d="M48 106 V122 M80 106 V122" stroke="#5b1020" stroke-width="5"/>`]); }
// 07 Sun wheel: the chariot of the sun, its wheel ablaze
{ const fl = Array.from({ length: 14 }, (_, i) => { const d = i * 360 / 14, [a, b] = at(64, 64, 44, d - 9), [c, e] = at(64, 64, 44, d + 9), [x, y] = at(64, 64, 60, d + 6); return `<path d="M${f1(a)} ${f1(b)} Q${f1((a + x) / 2 + 3)} ${f1((b + y) / 2)} ${f1(x)} ${f1(y)} L${f1(c)} ${f1(e)}Z" fill="${i % 2 ? '#ff8c3b' : '#ffb547'}"/>`; }).join('');
  const sp = Array.from({ length: 8 }, (_, i) => { const [x, y] = at(64, 64, 36, i * 45); return `M64 64 L${f1(x)} ${f1(y)}`; }).join(' ');
  I.push(['07', 'Sun wheel', `${fl}<circle cx="64" cy="64" r="40" fill="#ffe08a" stroke="#c9741a" stroke-width="6"/><path d="${sp}" stroke="#c9741a" stroke-width="5" stroke-linecap="round"/><circle cx="64" cy="64" r="11" fill="#c9741a"/><circle cx="64" cy="64" r="4" fill="#ffe08a"/>`]); }
// 08 Barcode step: a boot print pressed into the release's barcode
{ const w = [3, 1, 2, 1, 4, 1, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 4, 2, 1, 3, 1, 2, 2, 1, 3, 1]; let x = 16; const bars = w.map((v, i) => { const r = i % 2 ? '' : `<rect x="${x}" y="18" width="${v * 2.1}" height="74"/>`; x += v * 2.1 + 1.2; return r; }).join('');
  I.push(['08', 'Barcode step', `<defs><mask id="$m"><rect width="128" height="128" fill="#fff"/><g transform="rotate(-16 64 56)" fill="#000"><path d="M50 14 C50 4 78 4 78 14 L78 50 C78 54 74 56 74 60 L74 92 C74 102 54 102 54 92 L54 60 C54 56 50 54 50 50Z"/></g></mask></defs>
${tile('#fff', 18)}<g fill="#141414" mask="url(#$m)">${bars}</g><g transform="rotate(-16 64 56)" stroke="#9aa0ad" stroke-width="2.5">${[18, 26, 34, 42, 66, 74, 82].map(y => `<path d="M${y < 50 ? 54 : 58} ${y} H${y < 50 ? 74 : 70}"/>`).join('')}</g>
<text x="64" y="112" text-anchor="middle" font-family="monospace" font-size="13" letter-spacing="1.5" fill="#141414">0 11969 1969</text>`]); }
// 09 Paper plane: a tracklist, folded and thrown
I.push(['09', 'Paper plane', `<defs><clipPath id="$w"><path d="M118 20 L10 58 L56 70Z"/></clipPath></defs><path d="M10 104 C24 104 30 92 24 84 C18 76 8 86 18 92 C30 98 42 86 50 78" fill="none" stroke="#8f7fd6" stroke-width="3" stroke-dasharray="4 5" stroke-linecap="round"/>
<path d="M118 20 L10 58 L56 70Z" fill="#fff" stroke="#3d2470" stroke-width="3" stroke-linejoin="round"/><g clip-path="url(#$w)" stroke="#b9a8ec" stroke-width="2.5">${[0, 1, 2, 3, 4].map(i => `<path d="M0 ${48 + i * 7} L128 ${8 + i * 7}"/>`).join('')}</g>
<path d="M118 20 L56 70 L64 84Z" fill="#cbbdf5" stroke="#3d2470" stroke-width="3" stroke-linejoin="round"/><path d="M118 20 L64 84 L72 110Z" fill="#ece6ff" stroke="#3d2470" stroke-width="3" stroke-linejoin="round"/>`]);
// 10 Sound laurel: a laurel wreath whose leaves are level meters
{ const side = s => Array.from({ length: 9 }, (_, i) => { const d = 90 + s * (30 + i * 17), [x1, y1] = at(64, 66, 34, d), [x2, y2] = at(64, 66, 34 + [10, 16, 22, 14, 24, 18, 12, 20, 9][i], d); return `<path d="M${f1(x1)} ${f1(y1)} L${f1(x2)} ${f1(y2)}" stroke="${i % 3 === 1 ? '#e9b949' : '#4f9d4a'}"/>`; }).join('');
  I.push(['10', 'Sound laurel', `<g stroke-width="6" stroke-linecap="round">${side(1)}${side(-1)}</g><path d="M60 104 Q64 112 68 104" stroke="#4f9d4a" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="64" cy="64" r="20" fill="#7a57e8"/><path d="M60 54 V74 M60 54 L72 50 V70" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="57" cy="75" r="4" fill="#fff"/><circle cx="69" cy="71" r="4" fill="#fff"/>`]); }
// 11 Rover tracks: the lunar rover leaves tracks — a tracklist
I.push(['11', 'Rover tracks', `<defs><clipPath id="$c"><rect x="4" y="4" width="120" height="120" rx="26"/></clipPath></defs><g clip-path="url(#$c)">${tile('#0d1330')}<circle cx="104" cy="26" r="9" fill="#3a7bd5"/>${dots([[20, 20], [50, 14, 1], [74, 30]])}<rect x="4" y="76" width="120" height="48" fill="#9aa0ad"/>
${[0, 1, 2].map(i => `<circle cx="12" cy="${88 + i * 11}" r="2.5" fill="#5f3ec0"/><path d="M18 ${88 + i * 11} H${62 - i * 10}" stroke="#6d7382" stroke-width="5" stroke-dasharray="3 2"/>`).join('')}
<path d="M64 62 H112 L116 70 H60Z" fill="#d9dce3"/><rect x="66" y="56" width="10" height="7" fill="#e3a82b"/><path d="M92 62 V40" stroke="#d9dce3" stroke-width="2"/><path d="M84 42 Q92 32 100 42Z" fill="#d9dce3"/>
<circle cx="72" cy="76" r="9" fill="#2a2f3a" stroke="#d9dce3" stroke-width="3"/><circle cx="104" cy="76" r="9" fill="#2a2f3a" stroke="#d9dce3" stroke-width="3"/></g>`]);
// 12 Gramophone thruster: the horn is an engine bell, playing fire
I.push(['12', 'Gramophone thruster', `<defs>${lg('$b', ['#e9ecf2', '#8d94a5'], 1, 0)}</defs><path d="M98 18 C118 26 120 10 112 6 M106 30 C126 30 124 18 118 14" stroke="#ff8c3b" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M90 20 L116 2 L110 26 L124 32 L98 40Z" fill="#ffb547"/>
<path d="M56 74 L60 66 C74 56 84 42 90 20 L112 42 C92 50 76 60 66 76Z" fill="url(#$b)" stroke="#4b5263" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="101" cy="31" rx="15" ry="5" transform="rotate(45 101 31)" fill="#4b5263"/>
<rect x="18" y="86" width="74" height="28" rx="4" fill="#8a4b22"/><rect x="18" y="86" width="74" height="6" fill="#a8622f"/><ellipse cx="50" cy="84" rx="26" ry="6" fill="#17121f"/><path d="M62 78 L54 84" stroke="#4b5263" stroke-width="4" stroke-linecap="round"/>`]);
// 13 Eclipse: the corona is a waveform around a dark moon
{ const pts = Array.from({ length: 73 }, (_, i) => { const d = i * 5, r = 40 + 8 * Math.abs(Math.sin(i * 1.7)) * Math.abs(Math.cos(i * .45)) + 3; return at(64, 64, r, d).map(f1).join(' '); });
  I.push(['13', 'Eclipse', `<defs><radialGradient id="$g" cx=".5" cy=".5" r=".5"><stop offset=".6" stop-color="#ffe680"/><stop offset="1" stop-color="#ff8c3b" stop-opacity="0"/></radialGradient></defs>${tile('#0b0820')}<circle cx="64" cy="64" r="56" fill="url(#$g)" opacity=".55"/>
<path d="M${pts.join(' L')}Z" fill="#ffd24a"/><circle cx="64" cy="64" r="36" fill="#0b0820"/>${star(92, 38, 9, '#fff')}`]); }
// 14 T-minus: a countdown clock reading a track length
I.push(['14', 'T-minus', `${tile('#1b1b1f', 20)}<rect x="12" y="34" width="104" height="52" rx="6" fill="#0a0a0c" stroke="#3a3a42" stroke-width="2"/>
<text x="64" y="73" text-anchor="middle" font-family="Consolas,Courier New,monospace" font-weight="700" font-size="34" fill="#ff8c3b">3:47</text><text x="20" y="27" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="13" fill="#9a9aa6">T−</text>
<circle cx="102" cy="22" r="5" fill="#e63946"/><path d="M12 100 H116" stroke="#3a3a42" stroke-width="6" stroke-linecap="round"/><path d="M12 100 H84" stroke="#ff8c3b" stroke-width="6" stroke-linecap="round"/>`]);
// 15 Python groove: the serpent Apollo slew, coiled into a record's spiral
{ const sp = Array.from({ length: 160 }, (_, i) => { const t = i / 159, d = 90 + t * 900, r = 14 + t * 38; return at(64, 64, r, d).map(f1).join(' '); }); const [hx, hy] = at(64, 64, 52, 990);
  I.push(['15', 'Python groove', `<circle cx="64" cy="64" r="58" fill="#17121f"/><path d="M${sp.join(' L')}" fill="none" stroke="#3fae5b" stroke-width="7" stroke-linecap="round"/><path d="M${sp.join(' L')}" fill="none" stroke="#9be08a" stroke-width="1.6" stroke-dasharray="2 6"/>
<circle cx="64" cy="64" r="8" fill="#e9b949"/><circle cx="${f1(hx)}" cy="${f1(hy)}" r="7" fill="#3fae5b"/><circle cx="${f1(hx + 2)}" cy="${f1(hy - 2.5)}" r="1.6" fill="#17121f"/><path d="M${f1(hx + 7)} ${f1(hy)} l7 -2 m-7 2 l7 3" stroke="#e63946" stroke-width="1.8" stroke-linecap="round"/>`]); }
// 16 Pick moon: a guitar pick that is the moon
I.push(['16', 'Pick moon', `<defs>${rg('$m', '#f1f1f5', '#9da1b0')}<clipPath id="$p"><path d="M64 118 C40 94 12 58 16 34 C20 14 44 8 64 8 C84 8 108 14 112 34 C116 58 88 94 64 118Z"/></clipPath></defs>
<g clip-path="url(#$p)"><rect width="128" height="128" fill="url(#$m)"/><circle cx="104" cy="70" r="56" fill="#2a1a52" opacity=".35"/>${dots([[40, 36, 8], [74, 26, 5], [58, 70, 10], [42, 84, 4], [84, 50, 4]], '#8a8e9e')}</g>
<path d="M64 118 C40 94 12 58 16 34 C20 14 44 8 64 8 C84 8 108 14 112 34 C116 58 88 94 64 118Z" fill="none" stroke="#5c6070" stroke-width="3"/>`]);
// 17 Moon flag: planted on the moon, flying a note
I.push(['17', 'Moon flag', `<defs><clipPath id="$c"><rect x="4" y="4" width="120" height="120" rx="26"/></clipPath></defs><g clip-path="url(#$c)">${tile('#120c2c')}${dots([[18, 18], [110, 22, 1.6], [96, 60, 1], [24, 56]])}<path d="M4 98 Q64 80 124 98 V124 H4Z" fill="#a7abb7"/>
<path d="M44 96 V20" stroke="#d9dce3" stroke-width="4" stroke-linecap="round"/><path d="M46 22 C62 18 74 28 104 22 V60 C74 66 62 56 46 60Z" fill="#7a57e8"/><path d="M70 30 V50 M70 30 L82 34" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="66" cy="51" r="4.5" fill="#fff"/>
<g fill="#8a8f9c">${[[72, 104], [82, 110], [92, 104], [102, 110]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3.5" ry="2"/>`).join('')}</g></g>`]);
// 18 Amphora: a black-figure vase painted with a launch
I.push(['18', 'Amphora', `<path d="M34 46 C18 46 18 66 36 70 M94 46 C110 46 110 66 92 70" fill="none" stroke="#1a1410" stroke-width="5"/><rect x="42" y="12" width="44" height="8" rx="2" fill="#1a1410"/>
<path d="M48 20 H80 L78 34 C104 46 108 92 84 116 H44 C20 92 24 46 50 34Z" fill="#d7743b"/><path d="M38 44 H90" stroke="#1a1410" stroke-width="3"/><path d="M36 50 h6 v-4 h6 v4 h6 v-4 h6 v4 h6 v-4 h6 v4 h6 v-4 h6 v4 h6" fill="none" stroke="#1a1410" stroke-width="2"/>
<path d="M64 56 C71 64 71 80 69 94 H59 C57 80 57 64 64 56Z" fill="#1a1410"/><path d="M59 86 L52 98 L59 94Z M69 86 L76 98 L69 94Z" fill="#1a1410"/><path d="M60 98 L64 110 L68 98" fill="none" stroke="#1a1410" stroke-width="2.5"/><circle cx="64" cy="70" r="3" fill="#d7743b"/><path d="M30 104 H98" stroke="#1a1410" stroke-width="3"/>`]);
// 19 Cassette: a tape whose reels are the Earth and the Moon
I.push(['19', 'Cassette', `<rect x="6" y="24" width="116" height="80" rx="10" fill="#3b2290"/><rect x="16" y="32" width="96" height="48" rx="5" fill="#f4efe4"/><rect x="16" y="32" width="96" height="10" rx="3" fill="#ff8c3b"/>
<rect x="32" y="50" width="64" height="24" rx="12" fill="#2a1a52"/><circle cx="44" cy="62" r="10" fill="#2d6fd6"/><path d="M38 58 q4 -4 8 0 q2 4 -2 8 q-4 -2 -6 -8Z" fill="#5cc26b"/><circle cx="84" cy="62" r="10" fill="#c9ccd4"/>${dots([[80, 59, 2.2], [87, 66, 2.8]], '#8a8e9e')}
<path d="M44 52 C60 48 70 48 84 52" stroke="#5a4a2a" stroke-width="1.5" fill="none"/><path d="M28 104 L36 88 H92 L100 104Z" fill="#2a1a52"/>${dots([[44, 96, 3], [84, 96, 3]], '#3b2290')}`]);
// 20 Laurel headphones: the god of music's crown, worn as headphones
{ const lv = Array.from({ length: 11 }, (_, i) => { const d = 190 + i * 16, [x, y] = at(64, 70, 44, d); return `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="8" ry="3.6" fill="${i % 2 ? '#4f9d4a' : '#6cc04a'}" transform="rotate(${d + 90 + (i % 2 ? 35 : -35)} ${f1(x)} ${f1(y)})"/>`; }).join('');
  I.push(['20', 'Laurel headphones', `<path d="M20 74 A44 44 0 0 1 108 74" fill="none" stroke="#3b7a37" stroke-width="5"/>${lv}<rect x="10" y="68" width="22" height="40" rx="10" fill="#7a57e8"/><rect x="96" y="68" width="22" height="40" rx="10" fill="#7a57e8"/><rect x="26" y="74" width="10" height="28" rx="4" fill="#3d2470"/><rect x="92" y="74" width="10" height="28" rx="4" fill="#3d2470"/>`]); }

const cards = I.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r3-${n}.svg`), svg(`ap3${n}-`, `Apollo Editor — ${t}`, b)); return { n, t }; });
const fig = (src, cap) => `<figure>${[128, 48, 28, 16].map(z => `<img src="${src}" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${cap}</figcaption></figure>`;
const row = () => cards.map(c => fig(`icon-r3-${c.n}.svg`, `${c.n} · ${c.t}`)).join('');
writeFileSync(join(dir, 'preview-round3.html'), `<!doctype html><meta charset="utf-8"><title>Apollo Editor icons, round 3</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}</style>
<section class="light">${row()}</section><section class="dark">${row()}</section>\n`);
console.log('wrote ' + cards.length);
