// Credit Hoarder icons, round 3: twenty styles, each its own take on hoarding credits.
// Writes icon-r3-01..20.svg and preview-round3.html (128, 48, 16 px on white and black).
//   node dev/mockups/credit_hoarder_icons/gen-round3.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const note = (x, y, s = 1, c = '#000') => `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}"><ellipse cx="0" cy="10" rx="6" ry="4.5" transform="rotate(-20 0 10)"/><rect x="4.2" y="-14" width="2.6" height="24"/><path d="M6.8 -14 C14 -11 16 -6 13 0 C13 -5 10 -7 6.8 -8Z"/></g>`;
const I = [];

// 01 Pixel art: an 8-bit hamster with a coin
{ const px = ['....oo......oo....', '...oPPo....oPPo...', '...oooooooooooo...', '..ooFFFFFFFFFFoo..', '.ooFFFFFFFFFFFFoo.', '.oFFKFFFFFFFFKFFo.', '.oCCFFFFFFFFFFCCo.', 'oCCCCFFFnnFFFCCCCo', 'oCCCCFFFFFFFFCCCCo', 'oFCCCFFGGGGFFCCCFo', '.oFFFFGGYYGGFFFFo.', '.oFFFFGYYYYGFFFFo.', '..oFFFGGYYGGFFFo..', '...ooFFGGGGFFoo...', '.....oooooooo.....'];
  const col = { o: '#3b2414', P: '#ff9fb8', F: '#e8a25c', K: '#1a1a1a', C: '#f7c99a', n: '#ff6f91', G: '#e0a800', Y: '#ffd84d' }; let r = '';
  px.forEach((row, y) => [...row].forEach((ch, x) => { if (col[ch]) r += `<rect x="${10 + x * 6}" y="${19 + y * 6}" width="6.2" height="6.2" fill="${col[ch]}"/>`; }));
  I.push(['01', 'Pixel art', `<rect x="4" y="4" width="120" height="120" rx="6" fill="#5ab4e8"/><rect x="4" y="100" width="120" height="24" fill="#3c9a3c"/>${r}`]); }
// 02 Monoline: one continuous stroke, a jar of notes
I.push(['02', 'Monoline', `<g fill="none" stroke="#1d1d1f" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M40 28 H88 M44 28 V40 C30 46 28 56 28 66 V100 C28 108 34 114 42 114 H86 C94 114 100 108 100 100 V66 C100 56 98 46 84 40 V28"/>
<path d="M50 96 V70 L66 64 V90"/><circle cx="45" cy="96" r="5"/><circle cx="61" cy="90" r="5"/><path d="M78 84 V66"/><circle cx="73" cy="84" r="5"/></g><circle cx="98" cy="26" r="5" fill="#ff5a3c"/>`]);
// 03 Neon: a dragon outline glowing over its hoard
I.push(['03', 'Neon dragon', `<defs><filter id="$g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<rect x="4" y="4" width="120" height="120" rx="26" fill="#0d0221"/><g fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#$g)">
<path d="M24 104 C30 90 98 90 104 104" stroke="#ffd319" stroke-width="3"/><path d="M38 98 h0 M52 94 h0 M66 93 h0 M80 94 h0 M92 98 h0" stroke="#ffd319" stroke-width="6"/>
<path d="M34 92 C28 70 42 52 62 54 C80 56 86 72 78 88" stroke="#ff2a6d" stroke-width="3.5"/><path d="M62 54 C60 40 70 30 84 30 C96 30 102 40 96 48 C90 54 78 52 72 50" stroke="#ff2a6d" stroke-width="3.5"/>
<path d="M52 56 L46 38 L58 48 L62 34 L68 50" stroke="#05d9e8" stroke-width="3"/><circle cx="86" cy="38" r="2.5" stroke="#05d9e8" stroke-width="3"/><path d="M78 88 C92 84 104 74 100 62" stroke="#ff2a6d" stroke-width="3.5"/></g>`]);
// 04 Isometric: a stack of crates full of records
{ const cube = (x, y, c1, c2, c3) => `<path d="M${x} ${y} l20 -11 l20 11 l-20 11Z" fill="${c1}"/><path d="M${x} ${y} l20 11 v22 l-20 -11Z" fill="${c2}"/><path d="M${x + 40} ${y} l-20 11 v22 l20 -11Z" fill="${c3}"/><path d="M${x + 6} ${y} l14 -7.7 l14 7.7 M${x + 9} ${y + 1.6} l11 -6 l11 6" stroke="#1b1b2f" stroke-width="2.2" fill="none"/>`;
  I.push(['04', 'Isometric crates', `${cube(24, 70, '#ffd166', '#f4a259', '#e07a5f')}${cube(64, 70, '#a0e7e5', '#6ec5c3', '#3d9a98')}${cube(44, 59 - 22, '#cdb4db', '#a98cc0', '#7d63a0')}${cube(44, 81, '#b5e48c', '#7fc06a', '#4f9a45')}`]); }
// 05 Art deco: a gold sunburst fan with a note
I.push(['05', 'Art deco', `<rect x="4" y="4" width="120" height="120" rx="8" fill="#0f2a2a"/><rect x="10" y="10" width="108" height="108" rx="4" fill="none" stroke="#d4af37" stroke-width="2"/>
${Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (i + .5) / 9; return `<path d="M64 98 L${(64 - Math.cos(a) * 52).toFixed(1)} ${(98 - Math.sin(a) * 52).toFixed(1)}" stroke="#d4af37" stroke-width="${i % 2 ? 2 : 4}"/>`; }).join('')}
<path d="M18 98 H110" stroke="#d4af37" stroke-width="3"/><circle cx="64" cy="98" r="20" fill="#0f2a2a" stroke="#d4af37" stroke-width="3"/>${note(60, 90, 1.1, '#d4af37')}<path d="M30 110 H98" stroke="#d4af37" stroke-width="1.5"/>`]);
// 06 Kawaii: a blob hamster face, cheeks stuffed
I.push(['06', 'Kawaii', `<ellipse cx="64" cy="70" rx="54" ry="46" fill="#ffe3c2"/><circle cx="26" cy="34" r="12" fill="#ffe3c2"/><circle cx="102" cy="34" r="12" fill="#ffe3c2"/><circle cx="26" cy="34" r="6" fill="#ffb4c6"/><circle cx="102" cy="34" r="6" fill="#ffb4c6"/>
<ellipse cx="28" cy="84" rx="18" ry="16" fill="#ffc9a0"/><ellipse cx="100" cy="84" rx="18" ry="16" fill="#ffc9a0"/><circle cx="46" cy="64" r="6" fill="#3a2a2a"/><circle cx="82" cy="64" r="6" fill="#3a2a2a"/><circle cx="48" cy="62" r="2" fill="#fff"/><circle cx="84" cy="62" r="2" fill="#fff"/>
<path d="M58 78 Q64 84 70 78" stroke="#3a2a2a" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="34" cy="76" rx="7" ry="4" fill="#ff9db5" opacity=".7"/><ellipse cx="94" cy="76" rx="7" ry="4" fill="#ff9db5" opacity=".7"/>${note(24, 78, .7, '#c98a5a')}${note(96, 78, .7, '#c98a5a')}`]);
// 07 Brutalist: black slab, bold CH, a red tag
I.push(['07', 'Brutalist', `<rect x="6" y="6" width="116" height="116" fill="#111"/><text x="14" y="96" font-family="Arial Black,Impact,Helvetica,sans-serif" font-weight="900" font-size="76" fill="#f2f2f2" letter-spacing="-6">CH</text><rect x="74" y="12" width="40" height="22" fill="#ff3b1f"/><path d="M80 23 H108" stroke="#111" stroke-width="4"/><rect x="6" y="112" width="116" height="10" fill="#ff3b1f"/>`]);
// 08 Rubber stamp: a round seal, HOARDED
I.push(['08', 'Rubber stamp', `<defs><path id="$arc" d="M24 64 A40 40 0 0 1 104 64"/><path id="$arc2" d="M28 70 A36 36 0 0 0 100 70"/><filter id="$r"><feTurbulence baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.2 1.6"/><feComposite in="SourceGraphic" operator="in"/></filter></defs>
<g filter="url(#$r)" fill="#c8102e" stroke="#c8102e" transform="rotate(-10 64 64)"><circle cx="64" cy="64" r="56" fill="none" stroke-width="5"/><circle cx="64" cy="64" r="47" fill="none" stroke-width="2"/>
<text font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="15" stroke="none" letter-spacing="2"><textPath href="#$arc" startOffset="50%" text-anchor="middle">CREDITS</textPath></text>
<text font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="13" stroke="none" letter-spacing="2"><textPath href="#$arc2" startOffset="50%" text-anchor="middle">HOARDED</textPath></text>${note(60, 58, 1.2, '#c8102e')}</g>`]);
// 09 Blueprint: a technical drawing of a treasure chest
I.push(['09', 'Blueprint', `<defs><pattern id="$p" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0 H0 V8" fill="none" stroke="#3d74c8" stroke-width=".6"/></pattern></defs><rect x="4" y="4" width="120" height="120" rx="6" fill="#1d4e9e"/><rect x="4" y="4" width="120" height="120" rx="6" fill="url(#$p)"/>
<g fill="none" stroke="#e8f1ff" stroke-width="2.4" stroke-linejoin="round"><path d="M24 62 C24 40 104 40 104 62"/><rect x="24" y="62" width="80" height="42"/><path d="M24 74 H104 M44 62 V104 M84 62 V104"/><rect x="56" y="68" width="16" height="14"/>
<path d="M24 112 H104 M24 109 V115 M104 109 V115" stroke-width="1.4"/><path d="M114 62 V104 M111 62 H117 M111 104 H117" stroke-width="1.4"/></g><text x="64" y="123" font-family="monospace" font-size="7" fill="#e8f1ff" text-anchor="middle">CH-01  1:1</text>`]);
// 10 Stained glass: a record in jewel segments
I.push(['10', 'Stained glass', `${['#c0392b', '#2e86c1', '#f1c40f', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#d35400'].map((c, i) => { const a0 = i * Math.PI / 4, a1 = a0 + Math.PI / 4, p = (r, a) => `${(64 + r * Math.cos(a)).toFixed(1)} ${(64 + r * Math.sin(a)).toFixed(1)}`; return `<path d="M${p(20, a0)} L${p(58, a0)} A58 58 0 0 1 ${p(58, a1)} L${p(20, a1)} A20 20 0 0 0 ${p(20, a0)}Z" fill="${c}" stroke="#1a1a1a" stroke-width="3.5"/>`; }).join('')}
<circle cx="64" cy="64" r="20" fill="#f8f3e6" stroke="#1a1a1a" stroke-width="3.5"/>${note(60, 56, .95, '#1a1a1a')}<circle cx="64" cy="64" r="40" fill="none" stroke="#1a1a1a" stroke-width="2.5"/>`]);
// 11 Paper cutout: layered tags with drop shadows
I.push(['11', 'Paper cutout', `<defs><filter id="$s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-opacity=".35"/></filter></defs><rect x="4" y="4" width="120" height="120" rx="20" fill="#fbe8d3"/>
${[['#f28f3b', 18, 26, -10], ['#c8553d', 22, 46, 6], ['#588b8b', 16, 66, -4], ['#2d3047', 24, 86, 3]].map(([c, x, y, r]) => `<g filter="url(#$s)" transform="rotate(${r} 64 ${y + 9})"><path d="M${x + 12} ${y} H${x + 86} V${y + 22} H${x + 12} L${x} ${y + 11}Z" fill="${c}"/><circle cx="${x + 10}" cy="${y + 11}" r="2.6" fill="#fbe8d3"/></g>`).join('')}`]);
// 12 Glass: frosted cards over a colour blob
I.push(['12', 'Glassmorphism', `<defs>${lg('$b', ['#ff6ec4', '#7873f5'], 1, 1)}${lg('$w', ['rgba(255,255,255,.65)', 'rgba(255,255,255,.25)'], 1, 1)}<filter id="$bl"><feGaussianBlur stdDeviation="6"/></filter></defs>
<circle cx="50" cy="50" r="34" fill="url(#$b)"/><circle cx="88" cy="84" r="26" fill="#4ade80" filter="url(#$bl)"/>
<rect x="30" y="24" width="72" height="50" rx="12" fill="url(#$w)" stroke="rgba(255,255,255,.8)" stroke-width="1.5" transform="rotate(-8 66 49)"/><rect x="24" y="48" width="80" height="56" rx="14" fill="url(#$w)" stroke="rgba(255,255,255,.9)" stroke-width="1.5"/>${note(56, 66, 1.4, '#3b2d6b')}`]);
// 13 Halftone: a record in duotone dots
{ let d = ''; for (let y = 8; y <= 120; y += 7) for (let x = 8; x <= 120; x += 7) { const r = Math.hypot(x - 64, y - 64); if (r > 58) continue; const v = r < 16 ? 0 : (Math.sin(r / 4) + 1.2) / 2.2; d += `<circle cx="${x}" cy="${y}" r="${(1 + v * 2.6).toFixed(2)}"/>`; }
  I.push(['13', 'Halftone', `<rect x="4" y="4" width="120" height="120" rx="10" fill="#ffe14d"/><g fill="#e4006d">${d}</g><circle cx="64" cy="64" r="15" fill="#ffe14d"/>${note(60, 56, .9, '#e4006d')}`]); }
// 14 Tattoo flash: a swallow carrying a credit tag
I.push(['14', 'Tattoo flash', `<rect x="4" y="4" width="120" height="120" rx="10" fill="#f3e9d2"/><g stroke="#111" stroke-width="3.5" stroke-linejoin="round">
<path d="M18 50 C34 40 52 44 62 54 C70 46 84 40 98 42 L112 30 L106 46 C100 60 82 70 66 70 C56 78 40 82 26 76 L10 82 L20 70 C14 64 14 56 18 50Z" fill="#1f5f8b"/>
<path d="M66 70 C70 62 78 56 90 54" fill="none"/><path d="M62 54 C66 62 66 66 66 70" fill="#c0392b"/><circle cx="90" cy="48" r="2" fill="#111"/><path d="M98 42 L108 40 L100 47Z" fill="#e8b33a"/></g>
<g stroke="#111" stroke-width="3" transform="rotate(12 70 96)"><path d="M52 86 H96 V106 H52 L42 96Z" fill="#e8b33a"/><circle cx="50" cy="96" r="2.5" fill="#111"/><path d="M58 96 H90" stroke-width="2"/></g><path d="M44 74 Q48 82 46 88" stroke="#111" stroke-width="2" fill="none"/>`]);
// 15 Swiss: stacked bars and a coin, grid-aligned
I.push(['15', 'Swiss minimal', `<rect x="4" y="4" width="120" height="120" fill="#f4f1ea"/><rect x="16" y="20" width="72" height="16" fill="#e63322"/><rect x="16" y="44" width="56" height="16" fill="#111"/><rect x="16" y="68" width="88" height="16" fill="#111"/><rect x="16" y="92" width="40" height="16" fill="#111"/><circle cx="92" cy="100" r="16" fill="#e63322"/>`]);
// 16 Comic: a burst with flying tags
I.push(['16', 'Comic burst', `<path d="M64 6 L74 36 L104 18 L94 48 L124 54 L96 68 L118 94 L86 88 L88 120 L66 98 L48 124 L42 92 L10 104 L28 76 L4 58 L34 48 L18 20 L48 32Z" fill="#ffde00" stroke="#111" stroke-width="4" stroke-linejoin="round"/>
<path d="M64 26 L70 46 L90 38 L82 56 L100 64 L80 70 L88 90 L68 80 L58 98 L52 78 L32 84 L42 66 L26 56 L46 50 L40 32Z" fill="#ff3d3d" stroke="#111" stroke-width="3" stroke-linejoin="round"/>${note(58, 54, 1.4, '#fff')}<path d="M54 56 C56 52 60 50 64 50" stroke="#111" stroke-width="0"/>`]);
// 17 Chrome: 80s chrome letters on a horizon
I.push(['17', '80s chrome', `<defs>${lg('$ch', ['#ffffff', '#9ec9ff', '#1c3f7a', '#ffd1f2', '#ffffff'])}${lg('$sk', ['#120458', '#7a04eb', '#ff124f'])}</defs><rect x="4" y="4" width="120" height="120" rx="14" fill="url(#$sk)"/>
<path d="M4 88 H124" stroke="#ff8ad8" stroke-width="2"/>${[96, 104, 114].map(y => `<path d="M4 ${y} H124" stroke="#ff8ad8" stroke-width="1.2" opacity=".7"/>`).join('')}${[-60, -30, 0, 30, 60].map(d => `<path d="M${64 + d / 4} 88 L${64 + d * 1.2} 124" stroke="#ff8ad8" stroke-width="1.2" opacity=".7"/>`).join('')}
<text x="64" y="76" text-anchor="middle" font-family="Arial Black,Impact,sans-serif" font-weight="900" font-size="54" font-style="italic" fill="url(#$ch)" stroke="#120458" stroke-width="2">CH</text>`]);
// 18 Linocut: a carved chest in cream and black
I.push(['18', 'Linocut', `<rect x="4" y="4" width="120" height="120" rx="4" fill="#efe6d0"/><g fill="#1a1a1a"><path d="M18 60 C18 32 110 32 110 60Z"/><rect x="18" y="62" width="92" height="50"/></g>
<g stroke="#efe6d0" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M28 54 C34 44 94 44 100 54 M26 74 H102 M40 62 V112 M88 62 V112"/>${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${46 + i * 6} ${82 + (i % 2) * 2} l3 18" stroke-width="1.8"/>`).join('')}<path d="M24 88 l10 -4 M24 98 l10 -4 M94 88 l10 -4 M94 98 l10 -4" stroke-width="1.8"/></g>
<rect x="56" y="64" width="16" height="14" fill="#efe6d0"/><path d="M64 68 v6" stroke="#1a1a1a" stroke-width="2.4"/><g fill="#1a1a1a">${note(44, 20, .8)}${note(76, 16, .8)}</g>`]);
// 19 Sticker: a die-cut coin pile with a white border and shadow
{ const c = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="20" ry="8" fill="#f5b700" stroke="#7a4a00" stroke-width="2.5"/><path d="M${x - 20} ${y} v6 a20 8 0 0 0 40 0 v-6" fill="#d48f00" stroke="#7a4a00" stroke-width="2.5"/>`;
  const pile = `${c(46, 98)}${c(82, 98)}${c(64, 90)}${c(46, 82)}${c(82, 82)}${c(64, 74)}${c(64, 58)}`;
  I.push(['19', 'Sticker', `<defs><filter id="$sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity=".4"/></filter></defs>
<g filter="url(#$sh)"><g stroke="#fff" stroke-width="14" stroke-linejoin="round">${pile}<path d="M50 22 h28 v28 h-28z"/></g>${pile}<rect x="48" y="16" width="34" height="30" rx="4" fill="#ff5c8a" stroke="#7a4a00" stroke-width="2.5" transform="rotate(10 65 31)"/>${note(60, 24, .9, '#fff')}</g>`]); }
// 20 Terminal: green on black, credits++
I.push(['20', 'Terminal', `<rect x="4" y="12" width="120" height="104" rx="10" fill="#0b0f0c" stroke="#2b3a2e" stroke-width="2"/><circle cx="16" cy="22" r="3" fill="#ff5f56"/><circle cx="26" cy="22" r="3" fill="#ffbd2e"/><circle cx="36" cy="22" r="3" fill="#27c93f"/>
<g font-family="Menlo,Consolas,monospace" font-size="13" fill="#39ff6a"><text x="12" y="50">&gt; hoard</text><text x="12" y="70" fill="#1f9a40">credits: 294</text><text x="12" y="90">&gt; ♪♪♪</text></g><rect x="62" y="80" width="8" height="13" fill="#39ff6a"/>`]);

const cards = I.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r3-${n}.svg`), svg(`d${n}`, `Credit Hoarder — ${t}`, b)); return { n, t }; });
const row = () => cards.map(c => `<figure>${[128, 48, 16].map(z => `<img src="icon-r3-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`).join('');
writeFileSync(join(dir, 'preview-round3.html'), `<!doctype html><meta charset="utf-8"><title>Credit Hoarder icons, round 3</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}</style>
<section class="light">${row()}</section><section class="dark">${row()}</section>\n`);
console.log('wrote ' + cards.length);
