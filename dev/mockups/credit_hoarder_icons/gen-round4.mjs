// Credit Hoarder icons, round 4: twenty more styles, no text, each built to read at 16 px.
// Writes icon-r4-01..20.svg and preview-round4.html (128, 48, 16 px on white and black).
//   node dev/mockups/credit_hoarder_icons/gen-round4.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const rg = (id, stops, cx = .35, cy = .3, r = .8) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</radialGradient>`;
const note = (x, y, s = 1, c = '#000') => `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}"><ellipse cx="0" cy="10" rx="6" ry="4.5" transform="rotate(-20 0 10)"/><rect x="4.2" y="-14" width="2.6" height="24"/><path d="M6.8 -14 C14 -11 16 -6 13 0 C13 -5 10 -7 6.8 -8Z"/></g>`;
const I = [];

// 01 Clay: a soft-shaded 3D hamster, cheeks full
I.push(['01', 'Clay 3D', `<defs>${rg('$b', ['#ffd9b0', '#e9a36a', '#b86f3a'])}${rg('$c', ['#ffe9d6', '#f2b88a'], .4, .35, .7)}${rg('$e', ['#ffc2d1', '#ff8fab'], .4, .35, .7)}${rg('$g', ['#fff2a8', '#f5c400', '#b88a00'])}</defs>
<ellipse cx="64" cy="116" rx="40" ry="6" fill="#000" opacity=".18"/><circle cx="34" cy="34" r="13" fill="url(#$b)"/><circle cx="94" cy="34" r="13" fill="url(#$b)"/><circle cx="34" cy="34" r="6.5" fill="url(#$e)"/><circle cx="94" cy="34" r="6.5" fill="url(#$e)"/>
<ellipse cx="64" cy="70" rx="50" ry="46" fill="url(#$b)"/><ellipse cx="32" cy="80" rx="19" ry="17" fill="url(#$c)"/><ellipse cx="96" cy="80" rx="19" ry="17" fill="url(#$c)"/>
<circle cx="48" cy="62" r="5.5" fill="#2b1a10"/><circle cx="80" cy="62" r="5.5" fill="#2b1a10"/><circle cx="50" cy="60" r="1.8" fill="#fff"/><circle cx="82" cy="60" r="1.8" fill="#fff"/><ellipse cx="64" cy="72" rx="4.5" ry="3" fill="#ff7a96"/>
<circle cx="64" cy="98" r="14" fill="url(#$g)"/>${note(60, 90, .85, '#9a6f00')}`]);
// 02 Origami: a folded crane carrying a note
I.push(['02', 'Origami', `<path d="M10 76 L52 62 L64 30 L76 62 L118 50 L80 80 L64 96 L48 80Z" fill="#e94f37"/><path d="M52 62 L64 30 L64 96 L48 80Z" fill="#c23a24"/><path d="M76 62 L118 50 L80 80Z" fill="#f2765f"/><path d="M10 76 L52 62 L48 80Z" fill="#a52d1a"/>
<path d="M118 50 L124 40 L112 48Z" fill="#a52d1a"/>${note(58, 98, 1, '#393e41')}`]);
// 03 Low poly: a faceted gem, a hoarded treasure
I.push(['03', 'Low-poly gem', `${[['#7b2ff7', 'M64 10 L30 40 L64 46Z'], ['#9d4edd', 'M64 10 L98 40 L64 46Z'], ['#5a189a', 'M30 40 L12 44 L64 46Z'], ['#c77dff', 'M98 40 L116 44 L64 46Z'], ['#3c096c', 'M12 44 L64 118 L40 50Z'], ['#7b2ff7', 'M40 50 L64 118 L64 46Z'], ['#9d4edd', 'M64 46 L64 118 L88 50Z'], ['#5a189a', 'M88 50 L64 118 L116 44Z'], ['#e0aaff', 'M40 50 L64 46 L88 50Z']].map(([c, d]) => `<path d="${d}" fill="${c}" stroke="#2a0a4a" stroke-width="1.2" stroke-linejoin="round"/>`).join('')}${note(60, 58, 1.1, '#fff')}`]);
// 04 Watercolour: bleeding colour blobs under an inked note
I.push(['04', 'Watercolour', `<defs><filter id="$w" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="7"/><feDisplacementMap in="SourceGraphic" scale="14"/><feGaussianBlur stdDeviation="1.4"/></filter></defs>
<g filter="url(#$w)" opacity=".85"><circle cx="50" cy="58" r="34" fill="#4cc9f0"/><circle cx="80" cy="74" r="32" fill="#f72585" opacity=".75"/><circle cx="66" cy="44" r="22" fill="#fee440" opacity=".8"/></g>${note(56, 54, 2.2, '#14213d')}`]);
// 05 Duotone line: a chest, line and a second-colour fill offset
I.push(['05', 'Duotone line', `<g transform="translate(5 5)"><path d="M22 58 C22 38 106 38 106 58Z" fill="#ffd166"/><rect x="22" y="58" width="84" height="46" rx="4" fill="#ffd166"/></g>
<g fill="none" stroke="#073b4c" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"><path d="M22 58 C22 38 106 38 106 58Z"/><rect x="22" y="58" width="84" height="46" rx="4"/><path d="M22 72 H106"/><rect x="56" y="64" width="16" height="16" rx="3"/></g>`]);
// 06 Mosaic: tiles forming a coin with a note
{ let t = ''; for (let y = 8; y < 120; y += 10) for (let x = 8; x < 120; x += 10) { const r = Math.hypot(x + 5 - 64, y + 5 - 64), inNote = (x >= 54 && x < 74 && y >= 38 && y < 88) && ((x >= 64 && x < 74 && y < 78) || (y >= 68 && x < 74) || (y < 48)); const c = r > 56 ? null : inNote ? '#5c2a0b' : r > 46 ? '#c78a00' : ['#ffc93c', '#ffb703', '#ffd166'][(x * 7 + y * 3) % 3]; if (c) t += `<rect x="${x + 1}" y="${y + 1}" width="8" height="8" rx="1.5" fill="${c}"/>`; }
  I.push(['06', 'Mosaic', `<rect x="4" y="4" width="120" height="120" rx="12" fill="#2b2d42"/>${t}`]); }
// 07 Embroidered patch: a stitched badge with a hamster face
I.push(['07', 'Embroidered patch', `<circle cx="64" cy="64" r="58" fill="#2a9d8f" stroke="#e9c46a" stroke-width="7"/><circle cx="64" cy="64" r="50" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 4"/>
<circle cx="42" cy="44" r="9" fill="#f4a261"/><circle cx="86" cy="44" r="9" fill="#f4a261"/><ellipse cx="64" cy="70" rx="32" ry="28" fill="#f4a261"/><ellipse cx="44" cy="78" rx="12" ry="10" fill="#ffd6a5"/><ellipse cx="84" cy="78" rx="12" ry="10" fill="#ffd6a5"/>
<circle cx="54" cy="64" r="4" fill="#264653"/><circle cx="74" cy="64" r="4" fill="#264653"/><path d="M60 74 L64 77 L68 74" stroke="#264653" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<g fill="none" stroke="#e76f51" stroke-width="1" opacity=".5">${Array.from({ length: 12 }, (_, i) => `<path d="M${36 + i * 5} 50 l3 40"/>`).join('')}</g>`]);
// 08 Neon jar: a jar outline glowing, notes inside
I.push(['08', 'Neon jar', `<defs><filter id="$g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<rect x="4" y="4" width="120" height="120" rx="26" fill="#10002b"/><g filter="url(#$g)" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M44 26 H84 M48 26 V36 C34 42 32 52 32 60 V98 C32 106 38 110 46 110 H82 C90 110 96 106 96 98 V60 C96 52 94 42 80 36 V26" stroke="#4cc9f0" stroke-width="3.5"/></g>
<g filter="url(#$g)">${note(52, 68, 1.2, '#f72585')}${note(72, 82, 1, '#ffd60a')}</g>`]);
// 09 Long shadow: a flat coin with a 45° shadow
I.push(['09', 'Long shadow', `<defs><clipPath id="$c"><rect x="4" y="4" width="120" height="120" rx="26"/></clipPath></defs><rect x="4" y="4" width="120" height="120" rx="26" fill="#2ec4b6"/>
<g clip-path="url(#$c)"><path d="M36 92 L92 36 L172 116 L116 172Z" fill="#000" opacity=".18"/></g><circle cx="64" cy="64" r="40" fill="#ffbf00"/><circle cx="64" cy="64" r="32" fill="none" stroke="#e09f00" stroke-width="4"/>${note(58, 54, 1.6, '#7a4f00')}`]);
// 10 70s stripes: rainbow arcs over a stack of records
I.push(['10', '70s stripes', `<rect x="4" y="4" width="120" height="120" rx="18" fill="#fff3e0"/>${['#e63946', '#f4a261', '#e9c46a', '#2a9d8f'].map((c, i) => `<path d="M${14 + i * 10} 96 A${50 - i * 10} ${50 - i * 10} 0 0 1 ${114 - i * 10} 96" fill="none" stroke="${c}" stroke-width="10"/>`).join('')}
${[0, 1, 2].map(i => `<rect x="38" y="${86 + i * 9}" width="52" height="8" rx="4" fill="#3d2b1f"/>`).join('')}`]);
// 11 Atomic: mid-century starburst and boomerang
I.push(['11', 'Mid-century atomic', `<rect x="4" y="4" width="120" height="120" rx="14" fill="#f2e8cf"/><path d="M18 100 C40 70 80 110 110 76 C90 98 52 70 18 100Z" fill="#6a994e"/><path d="M24 34 C48 20 68 46 96 24 C76 52 46 34 24 34Z" fill="#bc4749"/>
${Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<path d="M64 64 L${(64 + Math.cos(a) * 26).toFixed(1)} ${(64 + Math.sin(a) * 26).toFixed(1)}" stroke="#386641" stroke-width="3"/><circle cx="${(64 + Math.cos(a) * 28).toFixed(1)}" cy="${(64 + Math.sin(a) * 28).toFixed(1)}" r="4" fill="#386641"/>`; }).join('')}<circle cx="64" cy="64" r="9" fill="#bc4749"/>`]);
// 12 Record stack: a tall side-view pile of vinyl
I.push(['12', 'Record stack', `${Array.from({ length: 9 }, (_, i) => { const y = 108 - i * 10, c = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#073b4c'][i % 5]; return `<ellipse cx="${64 + (i % 3 - 1) * 4}" cy="${y}" rx="48" ry="11" fill="#1b1b1b"/><ellipse cx="${64 + (i % 3 - 1) * 4}" cy="${y - 2}" rx="48" ry="11" fill="#2b2b2b"/><ellipse cx="${64 + (i % 3 - 1) * 4}" cy="${y - 2}" rx="12" ry="3" fill="${c}"/>`; }).join('')}`]);
// 13 Squirrel: a flat silhouette clutching a ♪ acorn
I.push(['13', 'Squirrel', `<path d="M86 104 C120 96 124 52 104 32 C94 22 78 26 80 40 C82 52 98 50 98 64 C98 80 86 92 76 98Z" fill="#c1693c"/><path d="M90 40 C96 48 104 50 104 62" stroke="#e8a273" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M30 112 C26 90 34 70 50 64 C42 54 44 38 58 34 L60 24 L66 34 C78 36 82 48 76 58 C88 66 90 90 80 112Z" fill="#d97b48"/><circle cx="62" cy="46" r="3.5" fill="#2b1608"/><path d="M48 52 l-6 2" stroke="#2b1608" stroke-width="2.5" stroke-linecap="round"/>
<ellipse cx="54" cy="84" rx="13" ry="15" fill="#8d5524"/><path d="M41 76 C44 66 64 66 67 76Z" fill="#5c3317"/>${note(51, 80, .7, '#ffd166')}`]);
// 14 Bauhaus: circle, triangle and square making a note
I.push(['14', 'Bauhaus', `<rect x="4" y="4" width="120" height="120" fill="#f1ede4"/><circle cx="44" cy="88" r="24" fill="#d62828"/><rect x="62" y="20" width="10" height="70" fill="#111"/><path d="M72 20 L108 40 L72 54Z" fill="#fcbf49"/><rect x="88" y="78" width="24" height="24" fill="#003049"/>`]);
// 15 Game Boy: a four-shade pixel chest
{ const px = ['....3333333.....', '..33222222233...', '.3221111111223..', '.3211111111123..', '3333333333333333', '3222222002222223', '3221111001111223', '3221111331111223', '3333333333333333', '3221111111111223', '3221111111111223', '3222222222222223', '3333333333333333'];
  const c = ['#9bbc0f', '#8bac0f', '#306230', '#0f380f']; let r = ''; px.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') r += `<rect x="${16 + x * 6}" y="${26 + y * 6}" width="6.2" height="6.2" fill="${c[+ch]}"/>`; }));
  I.push(['15', 'Game Boy', `<rect x="4" y="4" width="120" height="120" rx="10" fill="#9bbc0f"/>${r}`]); }
// 16 Chalkboard: a chalk piggy bank
I.push(['16', 'Chalkboard', `<defs><filter id="$k"><feTurbulence baseFrequency="1.2" numOctaves="1" seed="4"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 -1.6 1.4"/><feComposite in="SourceGraphic" operator="in"/></filter></defs>
<rect x="4" y="4" width="120" height="120" rx="8" fill="#2f4f3e" stroke="#8b5a2b" stroke-width="6"/><g filter="url(#$k)" fill="none" stroke="#f4f1e8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
<ellipse cx="60" cy="72" rx="32" ry="24"/><ellipse cx="94" cy="72" rx="8" ry="10"/><path d="M38 54 L34 42 L48 50 M44 94 V104 M74 94 V104 M54 52 H70"/><circle cx="76" cy="62" r="1.5"/><circle cx="62" cy="28" r="9"/><path d="M62 37 V46"/></g>`]);
// 17 App orb: a glossy gradient orb with a white note
I.push(['17', 'Glossy orb', `<defs>${rg('$o', ['#ff9a8b', '#ff6a88', '#7f00ff'], .3, .25, .9)}${lg('$h', ['rgba(255,255,255,.75)', 'rgba(255,255,255,0)'])}</defs><circle cx="64" cy="64" r="56" fill="url(#$o)"/><ellipse cx="60" cy="34" rx="38" ry="20" fill="url(#$h)"/>${note(58, 58, 2.2, '#fff')}`]);
// 18 Embossed coin: ridged metal with a raised note
I.push(['18', 'Embossed coin', `<defs>${rg('$m', ['#fff6d1', '#f2c94c', '#a3780b'], .35, .3, .85)}${rg('$n', ['#d9a520', '#fbe39a'], .6, .65, .8)}</defs>
<circle cx="64" cy="64" r="58" fill="#7a5a08"/>${Array.from({ length: 60 }, (_, i) => { const a = i * Math.PI / 30; return `<path d="M${(64 + Math.cos(a) * 54).toFixed(1)} ${(64 + Math.sin(a) * 54).toFixed(1)} L${(64 + Math.cos(a) * 58).toFixed(1)} ${(64 + Math.sin(a) * 58).toFixed(1)}" stroke="#c9a227" stroke-width="2.4"/>`; }).join('')}
<circle cx="64" cy="64" r="52" fill="url(#$m)"/><circle cx="64" cy="64" r="42" fill="url(#$n)"/><g transform="translate(1.5 1.5)">${note(58, 54, 1.8, '#8a6400')}</g>${note(58, 54, 1.8, '#fff3c4')}`]);
// 19 Playing card: a card whose pips are notes, a crown on top
I.push(['19', 'Playing card', `<rect x="22" y="8" width="84" height="112" rx="9" fill="#fffdf7" stroke="#1d1d1d" stroke-width="3"/><path d="M44 46 L50 30 L58 42 L64 26 L70 42 L78 30 L84 46Z" fill="#e0a500" stroke="#1d1d1d" stroke-width="2.5" stroke-linejoin="round"/>
${note(56, 66, 1.6, '#c1121f')}${note(30, 18, .55, '#c1121f')}<g transform="rotate(180 94 108)">${note(92, 104, .55, '#c1121f')}</g>`]);
// 20 Sumi-e: a brush-ink circle (ensō) around a note
I.push(['20', 'Ensō', `<defs><filter id="$i" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".08" numOctaves="2" seed="2"/><feDisplacementMap in="SourceGraphic" scale="6"/></filter></defs><rect x="4" y="4" width="120" height="120" rx="6" fill="#f6f1e7"/>
<path d="M98 34 C84 16 48 14 30 34 C12 56 22 94 52 106 C80 116 108 96 108 70" fill="none" stroke="#1a1a1a" stroke-width="11" stroke-linecap="round" filter="url(#$i)"/>${note(56, 58, 1.8, '#b5121b')}`]);

const cards = I.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r4-${n}.svg`), svg(`e${n}`, `Credit Hoarder — ${t}`, b)); return { n, t }; });
const row = () => cards.map(c => `<figure>${[128, 48, 16].map(z => `<img src="icon-r4-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`).join('');
writeFileSync(join(dir, 'preview-round4.html'), `<!doctype html><meta charset="utf-8"><title>Credit Hoarder icons, round 4</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}</style>
<section class="light">${row()}</section><section class="dark">${row()}</section>\n`);
console.log('wrote ' + cards.length);
