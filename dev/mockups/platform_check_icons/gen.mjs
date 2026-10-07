// Platform Check icons, round 1: twenty styles, each its own take on checking a release across platforms.
// Writes icon-r1-01..20.svg and preview-round1.html (128, 48, 28, 16 px on white and black).
//   node dev/mockups/platform_check_icons/gen.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
// a tick centred on (x, y), about 22 px wide at s = 1
const ck = (x, y, s = 1, c = '#fff', w = 5) => `<path d="M${x - 11 * s} ${y} L${x - 3 * s} ${y + 8 * s} L${x + 12 * s} ${y - 8 * s}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const xx = (x, y, s = 1, c = '#fff', w = 5) => `<path d="M${x - 7 * s} ${y - 7 * s} L${x + 7 * s} ${y + 7 * s} M${x + 7 * s} ${y - 7 * s} L${x - 7 * s} ${y + 7 * s}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
const P = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#b983ff'];
const I = [];

// 01 Station sign: an enamel railway sign hanging from two rods
I.push(['01', 'Station sign', `<path d="M36 6 V30 M92 6 V30" stroke="#5b5b66" stroke-width="5"/><rect x="8" y="30" width="112" height="66" rx="10" fill="#0b3d91" stroke="#fff" stroke-width="4"/><rect x="8" y="30" width="112" height="66" rx="10" fill="none" stroke="#0b3d91" stroke-width="1.5"/>
<text x="64" y="80" text-anchor="middle" font-family="Arial Black,Helvetica,sans-serif" font-weight="900" font-size="44" fill="#fff">PC</text><text x="64" y="47" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="10" letter-spacing="3" fill="#ffd400">PLATFORM</text>
<circle cx="104" cy="104" r="18" fill="#1db954" stroke="#fff" stroke-width="4"/>${ck(104, 104, .75, '#fff', 4.5)}`]);
// 02 Split-flap board: departures, one row per platform
{ const rows = [['#ff4d6d', 1], ['#4cc9f0', 1], ['#f9c74f', 0], ['#90be6d', 1]].map(([c, ok], i) => { const y = 26 + i * 22;
  return `<rect x="14" y="${y}" width="14" height="16" rx="2" fill="${c}"/>${[0, 1, 2, 3, 4].map(k => `<rect x="${32 + k * 12}" y="${y}" width="10" height="16" rx="1.5" fill="#2a2a2e"/><path d="M${32 + k * 12} ${y + 8} h10" stroke="#111" stroke-width="1"/>`).join('')}<rect x="${32}" y="${y + 5}" width="${20 + (i * 13) % 36}" height="6" rx="1" fill="#e8e8e8" opacity=".85"/>${ok ? ck(104, y + 8, .55, '#4ade80', 3.5) : xx(104, y + 8, .55, '#ff5a5a', 3.5)}`; }).join('');
  I.push(['02', 'Split-flap board', `<rect x="4" y="12" width="120" height="104" rx="8" fill="#111114"/><rect x="4" y="12" width="120" height="8" rx="4" fill="#ffb000"/>${rows}`]); }
// 03 Radar: a sweep finds platforms
I.push(['03', 'Radar', `<defs><radialGradient id="$sw" cx="64" cy="64" r="56" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3dff8a" stop-opacity=".0"/><stop offset="1" stop-color="#3dff8a" stop-opacity=".55"/></radialGradient></defs>
<circle cx="64" cy="64" r="58" fill="#062b1a"/><g fill="none" stroke="#1f7a4a" stroke-width="2"><circle cx="64" cy="64" r="40"/><circle cx="64" cy="64" r="22"/><path d="M64 8 V120 M8 64 H120"/></g>
<path d="M64 64 L64 6 A58 58 0 0 1 114 35 Z" fill="url(#$sw)"/><path d="M64 64 L114 35" stroke="#7dffb0" stroke-width="3" stroke-linecap="round"/><circle cx="64" cy="64" r="58" fill="none" stroke="#3dff8a" stroke-width="4"/>
<circle cx="88" cy="38" r="6" fill="#ff5ea8"/><circle cx="40" cy="44" r="5" fill="#ffd23f"/><circle cx="44" cy="92" r="5" fill="#4dc9ff"/><circle cx="92" cy="86" r="5" fill="#b983ff"/>`]);
// 04 Isometric: stacked platforms, the top one ticked
{ const slab = (y, c1, c2, c3) => `<path d="M64 ${y} l44 22 l-44 22 l-44 -22Z" fill="${c1}"/><path d="M20 ${y + 22} l44 22 v10 l-44 -22Z" fill="${c2}"/><path d="M108 ${y + 22} l-44 22 v10 l44 -22Z" fill="${c3}"/>`;
  I.push(['04', 'Isometric platforms', `${slab(64, '#bde0fe', '#8ab6e8', '#5a8fd0')}${slab(44, '#ffc8dd', '#f19bb8', '#d06e93')}${slab(24, '#caffbf', '#94d88a', '#5eaf55')}<g transform="translate(64 46) matrix(1 .5 -1 .5 0 0)"><path d="M-14 4 L-4 12 L10 -14" fill="none" stroke="#1d3b17" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>`]); }
// 05 Clipboard: a checklist of platforms
I.push(['05', 'Clipboard', `<rect x="18" y="14" width="92" height="108" rx="10" fill="#c98b5a"/><rect x="26" y="24" width="76" height="92" rx="4" fill="#fffdf6"/><rect x="46" y="8" width="36" height="16" rx="5" fill="#8a8f98"/><rect x="54" y="4" width="20" height="10" rx="5" fill="none" stroke="#8a8f98" stroke-width="4"/>
${[0, 1, 2, 3].map(i => { const y = 40 + i * 20; return `<rect x="34" y="${y - 7}" width="14" height="14" rx="3" fill="none" stroke="#2b2d42" stroke-width="2.5"/><rect x="54" y="${y - 3}" width="${38 - (i % 2) * 10}" height="6" rx="3" fill="${P[i + 1]}"/>${i === 2 ? '' : ck(42, y - 2, .6, '#e63946', 4)}`; }).join('')}`]);
// 06 Satellite dish: listening to every platform
I.push(['06', 'Satellite dish', `<rect x="4" y="4" width="120" height="120" rx="26" fill="#1e1b4b"/><g fill="#fff"><circle cx="20" cy="24" r="1.5"/><circle cx="104" cy="16" r="1.2"/><circle cx="110" cy="58" r="1.5"/><circle cx="32" cy="58" r="1"/></g>
<path d="M30 110 L50 86 L70 110Z" fill="#94a3b8"/><path d="M22 52 A42 42 0 0 0 76 106 Z" fill="#e2e8f0" transform="rotate(-8 50 80)"/><path d="M48 80 L78 50" stroke="#e2e8f0" stroke-width="4"/><circle cx="80" cy="48" r="5" fill="#f472b6"/>
<g fill="none" stroke-linecap="round" stroke-width="5"><path d="M90 38 A14 14 0 0 1 92 58" stroke="#fbbf24" transform="rotate(-45 80 48)"/><path d="M96 28 A26 26 0 0 1 100 66" stroke="#34d399" transform="rotate(-45 80 48)"/><path d="M102 18 A38 38 0 0 1 108 76" stroke="#60a5fa" transform="rotate(-45 80 48)"/></g>`]);
// 07 Stethoscope: a check-up for the release
I.push(['07', 'Check-up', `<circle cx="64" cy="64" r="58" fill="#e0f7f4"/><circle cx="74" cy="72" r="34" fill="#1f2937"/><circle cx="74" cy="72" r="24" fill="none" stroke="#374151" stroke-width="2"/><circle cx="74" cy="72" r="11" fill="#f43f5e"/><circle cx="74" cy="72" r="3" fill="#1f2937"/>
<g fill="none" stroke="#0e7490" stroke-width="5" stroke-linecap="round"><path d="M22 16 V40 C22 58 46 58 46 40 V16"/><path d="M34 56 V84 C34 104 52 112 62 104"/></g><circle cx="22" cy="14" r="4" fill="#0e7490"/><circle cx="46" cy="14" r="4" fill="#0e7490"/><circle cx="66" cy="100" r="9" fill="#94a3b8" stroke="#0e7490" stroke-width="4"/>`]);
// 08 Traffic light, lying down: found, partial, missing
I.push(['08', 'Traffic light', `<rect x="6" y="38" width="116" height="52" rx="26" fill="#2b2d42"/><circle cx="32" cy="64" r="16" fill="#3a1d1d"/><circle cx="64" cy="64" r="16" fill="#3a331d"/><circle cx="96" cy="64" r="16" fill="#22c55e"/><circle cx="96" cy="64" r="22" fill="#22c55e" opacity=".25"/>${ck(96, 63, .62, '#fff', 4.5)}
<path d="M64 90 V122" stroke="#2b2d42" stroke-width="8"/><path d="M14 38 L28 26 H100 L114 38" fill="#2b2d42"/>`]);
// 09 Magnifier over a row of platform tiles
I.push(['09', 'Magnifier', `${P.map((c, i) => `<rect x="${8 + i * 23}" y="${i % 2 ? 22 : 14}" width="20" height="20" rx="5" fill="${c}"/>`).join('')}${P.map((c, i) => `<rect x="${8 + i * 23}" y="${i % 2 ? 46 : 38}" width="20" height="20" rx="5" fill="${c}" opacity=".45"/>`).join('')}
<circle cx="58" cy="74" r="28" fill="#ffffffcc" stroke="#22223b" stroke-width="8"/>${ck(58, 74, .9, '#22a06b', 6)}<path d="M78 94 L108 124" stroke="#22223b" stroke-width="13" stroke-linecap="round"/>`]);
// 10 Pastel tick grid: nine platforms, eight found
I.push(['10', 'Tick grid', `<rect x="4" y="4" width="120" height="120" rx="24" fill="#fff3e6"/>${Array.from({ length: 9 }, (_, i) => { const x = 16 + (i % 3) * 34, y = 16 + Math.floor(i / 3) * 34, c = ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff', '#ffadad'][i];
  return `<rect x="${x}" y="${y}" width="28" height="28" rx="8" fill="${c}"/>${i === 7 ? `<circle cx="${x + 14}" cy="${y + 14}" r="4" fill="#22223b" opacity=".4"/>` : ck(x + 14, y + 13, .55, '#22223b', 3.5)}`; }).join('')}`]);
// 11 Lighthouse: beams sweep the sea of platforms
I.push(['11', 'Lighthouse', `<defs>${lg('$sky', ['#2b2d6e', '#f28482'])}</defs><rect x="4" y="4" width="120" height="120" rx="20" fill="url(#$sky)"/><path d="M58 40 L6 22 V58Z M70 40 L122 22 V58Z" fill="#fff6a8" opacity=".55"/>
<path d="M54 46 L50 108 H78 L74 46Z" fill="#fff"/><path d="M51.8 70 H76.2 L77 84 H51Z" fill="#e63946"/><rect x="52" y="32" width="24" height="14" rx="2" fill="#ffd166"/><path d="M50 32 L64 20 L78 32Z" fill="#e63946"/>
<path d="M4 108 Q20 100 36 108 T68 108 T100 108 T132 108 V124 H4Z" fill="#457b9d"/>`]);
// 12 Barcode scan: a laser line crosses the code
I.push(['12', 'Barcode scan', `<rect x="10" y="20" width="108" height="78" rx="8" fill="#fff" stroke="#22223b" stroke-width="4"/>${[3, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1].reduce((a, w) => { a.s += a.on ? `<rect x="${a.x}" y="30" width="${w * 1.6}" height="54" fill="#22223b"/>` : ''; a.x += w * 1.6 + 1.2; a.on = !a.on; return a; }, { x: 20, on: true, s: '' }).s}
<rect x="4" y="54" width="120" height="5" rx="2.5" fill="#ff2e63"/><rect x="4" y="50" width="120" height="13" rx="6" fill="#ff2e63" opacity=".25"/><circle cx="102" cy="104" r="20" fill="#08d9d6" stroke="#22223b" stroke-width="4"/>${ck(102, 104, .7, '#22223b', 4.5)}`]);
// 13 Constellation: platforms joined into one release
{ const n = [[24, 30], [58, 18], [100, 26], [108, 74], [70, 104], [22, 88]];
  I.push(['13', 'Constellation', `<rect x="4" y="4" width="120" height="120" rx="26" fill="#0f172a"/><g stroke="#64748b" stroke-width="2">${n.map(([x, y]) => `<path d="M64 64 L${x} ${y}"/>`).join('')}</g>${n.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="7" fill="${['#f472b6', '#facc15', '#4ade80', '#38bdf8', '#a78bfa', '#fb923c'][i]}"/>`).join('')}<circle cx="64" cy="64" r="20" fill="#fff"/>${ck(64, 64, .75, '#0f172a', 5)}`]); }
// 14 Venn: three platforms overlap on one release
I.push(['14', 'Venn', `<g style="mix-blend-mode:multiply"><circle cx="48" cy="50" r="34" fill="#ff8fab" opacity=".85"/><circle cx="80" cy="50" r="34" fill="#80ed99" opacity=".8"/><circle cx="64" cy="78" r="34" fill="#74c0fc" opacity=".8"/></g><circle cx="64" cy="60" r="11" fill="#fff"/>${ck(64, 60, .45, '#22223b', 3.5)}`]);
// 15 Signal bars: every bar ticked up
I.push(['15', 'Signal bars', `<rect x="4" y="4" width="120" height="120" rx="26" fill="#22223b"/>${[0, 1, 2, 3].map(i => `<rect x="${18 + i * 24}" y="${98 - (i + 1) * 18}" width="18" height="${(i + 1) * 18}" rx="4" fill="${['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff'][i]}"/>`).join('')}${ck(34, 34, .8, '#fff', 5)}`]);
// 16 Boarding pass: the release cleared for every platform
I.push(['16', 'Boarding pass', `<g transform="rotate(-8 64 64)"><path d="M8 34 H120 V52 A8 8 0 0 0 120 68 V94 H8 V68 A8 8 0 0 0 8 52Z" fill="#fef3c7" stroke="#22223b" stroke-width="3.5"/><path d="M86 38 V90" stroke="#22223b" stroke-width="2" stroke-dasharray="4 4"/>
<rect x="16" y="42" width="60" height="10" rx="2" fill="#e76f51"/><text x="16" y="72" font-family="Arial Black,Helvetica,sans-serif" font-weight="900" font-size="18" fill="#22223b">PLAT</text><text x="16" y="88" font-family="Helvetica,Arial,sans-serif" font-size="10" fill="#22223b">ALL GATES</text>
<circle cx="103" cy="64" r="12" fill="none" stroke="#2a9d8f" stroke-width="3.5"/>${ck(103, 64, .45, '#2a9d8f', 3.5)}</g>`]);
// 17 Neon sign: a glowing tick on brick
I.push(['17', 'Neon tick', `<defs><filter id="$g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><pattern id="$br" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#3b1f2b"/><path d="M0 11.5 H24 M12 0 V6 M0 6 H24 M24 6 V12 M0 6 V12" stroke="#2a141e" stroke-width="1.4"/></pattern></defs>
<rect x="4" y="4" width="120" height="120" rx="20" fill="url(#$br)"/><g filter="url(#$g)" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="16" y="16" width="96" height="96" rx="18" stroke="#ff4fd8" stroke-width="4"/>${ck(64, 64, 2.1, '#3dfcff', 7)}</g>`]);
// 18 Pixel art: an 8-bit tick on a ground of tiles
{ const px = ['..........KK', '.........KGK', '........KGGK', 'KK.....KGGK.', 'KGK...KGGK..', 'KGGK.KGGK...', '.KGGKGGK....', '..KGGGK.....', '...KGK......', '....K.......'];
  let r = ''; px.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') r += `<rect x="${22 + x * 7}" y="${18 + y * 7}" width="7.2" height="7.2" fill="${ch === 'K' ? '#1a1c2c' : '#38b764'}"/>`; }));
  I.push(['18', 'Pixel tick', `<rect x="4" y="4" width="120" height="120" rx="6" fill="#73eff7"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${4 + i * 15}" y="100" width="15" height="24" fill="${i % 2 ? '#b13e53' : '#ef7d57'}"/>`).join('')}${r}`]); }
// 19 Origami: a folded paper tick
I.push(['19', 'Origami', `<rect x="4" y="4" width="120" height="120" rx="24" fill="#f1faee"/><path d="M14 66 L36 46 L56 70 Z" fill="#2a9d8f"/><path d="M36 46 L56 70 L48 98 Z" fill="#21867a"/><path d="M48 98 L56 70 L112 24 Z" fill="#e9c46a"/><path d="M56 70 L112 24 L92 32 Z" fill="#f4a261"/><path d="M14 66 L48 98 L36 46Z" fill="#264653" opacity=".25"/>`]);
// 20 Swiss poster: a grid of platforms, one red
I.push(['20', 'Swiss poster', `<rect x="4" y="4" width="120" height="120" fill="#f2efe6"/>${Array.from({ length: 16 }, (_, i) => { const x = 22 + (i % 4) * 28, y = 22 + Math.floor(i / 4) * 28; return i === 6 ? `<circle cx="${x}" cy="${y}" r="13" fill="#e30613"/>` : `<circle cx="${x}" cy="${y}" r="${i % 3 ? 5 : 9}" fill="#111"/>`; }).join('')}<path d="M4 120 H124" stroke="#e30613" stroke-width="8"/>`]);

const cards = I.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r1-${n}.svg`), svg(`pc${n}-`, `Platform Check — ${t}`, b)); return { n, t }; });
const row = () => cards.map(c => `<figure>${[128, 48, 28, 16].map(z => `<img src="icon-r1-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`).join('');
writeFileSync(join(dir, 'preview-round1.html'), `<!doctype html><meta charset="utf-8"><title>Platform Check icons, round 1</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}</style>
<section class="light"><figure><img src="../../../userscripts/platform_check/icon.svg" width="128" height="128" alt=""><img src="../../../userscripts/platform_check/icon.svg" width="48" height="48" alt=""><img src="../../../userscripts/platform_check/icon.svg" width="28" height="28" alt=""><img src="../../../userscripts/platform_check/icon.svg" width="16" height="16" alt=""><figcaption>now · Broadcast</figcaption></figure>${row()}</section><section class="dark">${row()}</section>\n`);
console.log('wrote ' + cards.length);
