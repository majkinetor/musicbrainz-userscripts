// Falcon icons, round 4: no falcon, no car, no rocket — just what Falcon is, a bulk editor: many items, a pool of workers, a queue.
// Writes icon-r4-01..20.svg and preview-round4.html (128, 48, 28, 16 px on white and black).
//   node dev/mockups/falcon_icons/gen-round4.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const tile = (fill, rx = 26) => `<rect x="4" y="4" width="120" height="120" rx="${rx}" fill="${fill}"/>`;
const C = { navy: '#1b2a4a', slate: '#4a5a78', mist: '#b8c4da', cream: '#f6efe2', orange: '#ff6a00', gold: '#f5c518', green: '#2fb37a', red: '#e63946' };
const ck = (x, y, s = 1, c = '#fff', w = 4) => `<path d="M${x - 7 * s} ${y} L${x - 2 * s} ${y + 5 * s} L${x + 8 * s} ${y - 6 * s}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const gear = (cx, cy, r, teeth, c, hole = '#fff') => { let d = ''; for (let i = 0; i < teeth * 2; i++) { const a0 = i * Math.PI / teeth, a1 = (i + 1) * Math.PI / teeth, R = i % 2 ? r : r + r * .22;
    d += `${i ? 'L' : 'M'}${(cx + R * Math.cos(a0)).toFixed(1)} ${(cy + R * Math.sin(a0)).toFixed(1)} L${(cx + R * Math.cos(a1)).toFixed(1)} ${(cy + R * Math.sin(a1)).toFixed(1)} `; }
  return `<path d="${d}Z" fill="${c}"/><circle cx="${cx}" cy="${cy}" r="${r * .38}" fill="${hole}"/>`; };
const I = [];

// 01 Done stack: a fanned stack of cards, each ticked
I.push(['01', 'Done stack', `${[3, 2, 1, 0].map(i => `<rect x="${22 + i * 8}" y="${16 + i * 10}" width="74" height="54" rx="8" fill="${[C.navy, C.slate, '#6b7a98', C.mist][i]}" transform="rotate(${-6 + i * 3} 64 64)"/>`).join('')}
<rect x="22" y="46" width="78" height="62" rx="9" fill="#fff" stroke="${C.navy}" stroke-width="4"/><circle cx="44" cy="77" r="12" fill="${C.green}"/>${ck(44, 77, 1, '#fff', 4)}<path d="M62 70 H88 M62 84 H80" stroke="${C.mist}" stroke-width="5" stroke-linecap="round"/>`]);
// 02 Conveyor: items ride a belt under a stamping press
I.push(['02', 'Conveyor', `<rect x="56" y="10" width="16" height="30" fill="${C.slate}"/><rect x="46" y="38" width="36" height="12" rx="3" fill="${C.orange}"/><path d="M64 54 V60" stroke="${C.orange}" stroke-width="3" stroke-dasharray="2 2"/>
${[[18, C.mist, 0], [52, '#fff', 1], [86, C.green, 2]].map(([x, c, i]) => `<rect x="${x}" y="64" width="24" height="24" rx="4" fill="${c}" stroke="${C.navy}" stroke-width="3"/>${i === 2 ? ck(x + 12, 76, .8, '#fff', 3.5) : ''}`).join('')}
<rect x="8" y="90" width="112" height="14" rx="7" fill="${C.navy}"/>${[18, 38, 58, 78, 98, 112].map(x => `<circle cx="${x}" cy="97" r="3.5" fill="${C.mist}"/>`).join('')}<path d="M12 112 H30 M40 112 H58" stroke="${C.mist}" stroke-width="3" stroke-linecap="round"/>`]);
// 03 Multi-cursor: one edit, typed on every line at once
I.push(['03', 'Multi-cursor', `${tile('#14213d', 20)}${[0, 1, 2, 3, 4].map(i => { const y = 22 + i * 19, w = [44, 30, 52, 38, 26][i]; return `<rect x="18" y="${y}" width="${w}" height="9" rx="3" fill="#5a6a8c"/><rect x="${22 + w}" y="${y - 3}" width="4" height="15" rx="1" fill="${C.orange}"/><rect x="${30 + w}" y="${y}" width="16" height="9" rx="3" fill="${C.gold}"/>`; }).join('')}`]);
// 04 Gears: a pool of workers, meshed
I.push(['04', 'Gears', `${gear(46, 50, 26, 10, C.navy)}${gear(88, 82, 20, 8, C.orange)}${gear(90, 30, 12, 6, C.slate)}${gear(36, 100, 12, 6, C.slate)}`]);
// 05 Pencil fan: many pencils, one hand
I.push(['05', 'Pencil fan', `${[-36, -18, 0, 18, 36].map((a, i) => `<g transform="rotate(${a} 64 112)"><rect x="58" y="22" width="12" height="76" fill="${[C.mist, C.slate, C.orange, C.slate, C.mist][i]}"/><path d="M58 22 L64 8 L70 22Z" fill="#f3d9a4"/><path d="M62 13 L64 8 L66 13Z" fill="${C.navy}"/><rect x="58" y="94" width="12" height="8" fill="#c0c6d0"/></g>`).join('')}<circle cx="64" cy="112" r="12" fill="${C.navy}"/>`]);
// 06 Stamp: a rubber stamp over a grid of approved forms
I.push(['06', 'Stamp', `${[0, 1, 2].flatMap(r => [0, 1, 2].map(c => `<rect x="${12 + c * 36}" y="${50 + r * 24}" width="30" height="20" rx="3" fill="${r === 2 && c === 2 ? '#fff' : '#e9f6ef'}" stroke="${C.mist}" stroke-width="2"/>${r === 2 && c === 2 ? '' : `<circle cx="${27 + c * 36}" cy="${60 + r * 24}" r="6" fill="none" stroke="${C.green}" stroke-width="2.5"/>`}`)).join('')}
<g transform="rotate(-14 96 40)"><rect x="80" y="4" width="16" height="22" rx="6" fill="${C.orange}"/><rect x="84" y="24" width="8" height="10" fill="${C.navy}"/><rect x="72" y="34" width="32" height="10" rx="3" fill="${C.navy}"/><rect x="74" y="44" width="28" height="5" rx="1" fill="${C.green}"/></g>`]);
// 07 Queue: rows of work, each with its progress
I.push(['07', 'Queue', `${tile('#fff', 20)}<rect x="4" y="4" width="120" height="120" rx="20" fill="none" stroke="${C.mist}" stroke-width="3"/>${[1, 1, .6, .25, 0].map((p, i) => { const y = 22 + i * 19; return `<circle cx="22" cy="${y + 4}" r="5" fill="${p === 1 ? C.green : p ? C.orange : C.mist}"/><rect x="34" y="${y}" width="76" height="8" rx="4" fill="#e6ebf2"/><rect x="34" y="${y}" width="${(76 * p).toFixed(0)}" height="8" rx="4" fill="${p === 1 ? C.green : C.orange}"/>`; }).join('')}`]);
// 08 Heatmap: a grid filling in, done, running, waiting
{ const st = 'ggggggggggggggogoggggo..go......'.split('');
  I.push(['08', 'Grid', `${tile(C.navy, 22)}${st.map((s, i) => { const x = 16 + (i % 6) * 16.5, y = 18 + Math.floor(i / 6) * 16.5; return `<rect x="${x}" y="${y}" width="12" height="12" rx="3" fill="${s === 'g' ? C.green : s === 'o' ? C.orange : '#33446a'}"/>`; }).slice(0, 36).join('')}`]); }
// 09 Record pile: a stack of records, all getting the same edit
I.push(['09', 'Record pile', `${[0, 1, 2, 3, 4].map(i => `<ellipse cx="60" cy="${100 - i * 11}" rx="46" ry="13" fill="${i === 4 ? '#17121f' : '#2a2433'}" stroke="#0d0a12" stroke-width="2"/>`).join('')}<ellipse cx="60" cy="56" rx="34" ry="9" fill="none" stroke="#3a3346" stroke-width="1.5"/><ellipse cx="60" cy="56" rx="12" ry="3.4" fill="${C.orange}"/>
<g transform="rotate(35 100 30)"><rect x="94" y="0" width="12" height="52" rx="2" fill="${C.gold}"/><path d="M94 52 L100 64 L106 52Z" fill="#f3d9a4"/><rect x="94" y="0" width="12" height="7" fill="#ff8fab"/></g>`]);
// 10 Bulldozer: bulk, literally — a dozer pushing a pile of entries
I.push(['10', 'Bulldozer', `${[[8, 76], [14, 62], [24, 70], [10, 90], [26, 84]].map(([x, y], i) => `<rect x="${x}" y="${y}" width="16" height="12" rx="2" fill="${[C.mist, '#fff', C.green, C.slate, C.orange][i]}" stroke="${C.navy}" stroke-width="2" transform="rotate(${[-12, 8, -4, 14, -20][i]} ${x + 8} ${y + 6})"/>`).join('')}
<path d="M40 60 L48 104 H44 L36 62Z" fill="${C.navy}"/><path d="M46 80 H60" stroke="${C.navy}" stroke-width="4"/><rect x="58" y="62" width="50" height="28" rx="4" fill="${C.gold}"/><rect x="72" y="40" width="28" height="24" rx="3" fill="${C.gold}"/><rect x="77" y="45" width="18" height="12" rx="2" fill="#bfe3f2"/>
<rect x="56" y="90" width="58" height="18" rx="9" fill="${C.navy}"/>${[66, 80, 94, 106].map(x => `<circle cx="${x}" cy="99" r="4.5" fill="${C.mist}"/>`).join('')}`]);
// 11 Robot arm: an assembly line that edits
I.push(['11', 'Robot arm', `<rect x="14" y="100" width="40" height="12" rx="3" fill="${C.navy}"/><circle cx="34" cy="96" r="9" fill="${C.slate}"/><path d="M34 96 L58 46 L96 60" stroke="${C.orange}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="58" cy="46" r="7" fill="${C.navy}"/>
<path d="M96 60 L104 74 M96 60 L88 74" stroke="${C.navy}" stroke-width="5" stroke-linecap="round"/>${[70, 92].map((x, i) => `<rect x="${x + 6}" y="86" width="22" height="18" rx="3" fill="${i ? C.green : '#fff'}" stroke="${C.navy}" stroke-width="2.5"/>`).join('')}<path d="M66 112 H124" stroke="${C.mist}" stroke-width="4"/>`]);
// 12 Bolt list: a list struck through by speed
I.push(['12', 'Bolt list', `${tile('#fff4e8', 22)}${[0, 1, 2, 3].map(i => `<rect x="18" y="${24 + i * 22}" width="${[70, 54, 64, 46][i]}" height="10" rx="5" fill="${C.slate}"/>`).join('')}<path d="M80 8 L54 64 H74 L60 120 L104 52 H82 L98 8Z" fill="${C.orange}" stroke="#fff4e8" stroke-width="4" stroke-linejoin="round"/>`]);
// 13 Lanes: parallel tracks, a worker on each
I.push(['13', 'Lanes', `${[0, 1, 2, 3].map(i => { const y = 22 + i * 26, p = [96, 70, 108, 50][i]; return `<rect x="10" y="${y}" width="108" height="14" rx="7" fill="#e6ebf2"/><rect x="10" y="${y}" width="${p - 10}" height="14" rx="7" fill="${[C.navy, C.slate, C.navy, C.slate][i]}"/><circle cx="${p}" cy="${y + 7}" r="9" fill="${C.orange}"/>`; }).join('')}`]);
// 14 Copy fan: one edit becomes many
I.push(['14', 'Copy fan', `<rect x="10" y="46" width="34" height="40" rx="5" fill="${C.orange}"/><path d="M18 58 H36 M18 66 H32 M18 74 H34" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
${[-1, 0, 1].flatMap(r => [0, 1].map(c => { const x = 66 + c * 30, y = 50 + r * 34; return `<path d="M44 66 C54 66 54 ${y + 14} ${x} ${y + 14}" fill="none" stroke="${C.mist}" stroke-width="2.5"/><rect x="${x}" y="${y}" width="24" height="28" rx="4" fill="#fff" stroke="${C.navy}" stroke-width="3"/><path d="M${x + 5} ${y + 9} H${x + 19} M${x + 5} ${y + 16} H${x + 15}" stroke="${C.orange}" stroke-width="2.5" stroke-linecap="round"/>`; })).join('')}`]);
// 15 Crate: a shipping crate full of records, bulk
I.push(['15', 'Crate', `${[30, 46, 62, 78, 94].map((x, i) => `<rect x="${x - 2}" y="${22 + (i % 2) * 6}" width="8" height="40" rx="2" fill="${[C.orange, C.navy, C.green, C.slate, C.gold][i]}"/>`).join('')}<rect x="14" y="54" width="100" height="58" rx="4" fill="#c98b5a"/><path d="M14 72 H114 M14 92 H114" stroke="#a46a3e" stroke-width="3"/><path d="M14 54 L114 112 M114 54 L14 112" stroke="#a46a3e" stroke-width="5"/>
<rect x="14" y="54" width="100" height="58" rx="4" fill="none" stroke="#7a4a26" stroke-width="4"/><rect x="44" y="76" width="40" height="14" fill="#f6efe2"/><text x="64" y="87" text-anchor="middle" font-family="Arial Black,Helvetica,sans-serif" font-weight="900" font-size="11" fill="${C.navy}">BULK</text>`]);
// 16 Dominoes: one push, the whole row goes
I.push(['16', 'Dominoes', `<path d="M6 108 H122" stroke="${C.mist}" stroke-width="4" stroke-linecap="round"/>${[0, 1, 2, 3, 4].map(i => { const x = 18 + i * 22, a = [62, 50, 34, 16, 0][i]; return `<g transform="rotate(${a} ${x + 14} 106)"><rect x="${x}" y="58" width="14" height="48" rx="3" fill="${i < 3 ? C.navy : C.slate}"/><circle cx="${x + 7}" cy="72" r="2.4" fill="#fff"/><circle cx="${x + 7}" cy="92" r="2.4" fill="#fff"/></g>`; }).join('')}<path d="M118 40 L106 52" stroke="${C.orange}" stroke-width="5" stroke-linecap="round"/><path d="M108 40 H118 V50" stroke="${C.orange}" stroke-width="5" fill="none" stroke-linecap="round"/>`]);
// 17 Press: a roller printing line after line
I.push(['17', 'Press', `<rect x="14" y="62" width="100" height="56" rx="4" fill="#fff" stroke="${C.mist}" stroke-width="3"/>${[0, 1, 2].map(i => `<rect x="24" y="${74 + i * 13}" width="${[70, 56, 64][i]}" height="7" rx="3.5" fill="${C.navy}"/>`).join('')}
<rect x="8" y="34" width="112" height="24" rx="12" fill="${C.orange}"/><rect x="8" y="34" width="112" height="8" rx="4" fill="#ff9a4d"/><path d="M20 34 V14 H108 V34" stroke="${C.navy}" stroke-width="6" fill="none" stroke-linejoin="round"/><rect x="58" y="6" width="12" height="12" rx="3" fill="${C.navy}"/>`]);
// 18 Times N: a single row and a big multiplier
I.push(['18', 'Times N', `${tile(C.navy, 24)}<rect x="18" y="26" width="52" height="14" rx="4" fill="#fff"/><rect x="18" y="46" width="52" height="14" rx="4" fill="#fff" opacity=".6"/><rect x="18" y="66" width="52" height="14" rx="4" fill="#fff" opacity=".35"/><rect x="18" y="86" width="52" height="14" rx="4" fill="#fff" opacity=".15"/>
<text x="96" y="80" text-anchor="middle" font-family="Arial Black,Helvetica,sans-serif" font-weight="900" font-size="38" fill="${C.orange}">×n</text>`]);
// 19 Wand: one sweep, the whole grid changes
I.push(['19', 'Wand', `${[0, 1, 2, 3].flatMap(r => [0, 1, 2, 3].map(c => { const on = c + (3 - r) < 4; return `<rect x="${44 + c * 20}" y="${44 + r * 20}" width="14" height="14" rx="3" fill="${on ? C.gold : '#d8deea'}"/>`; })).join('')}
<path d="M10 118 L52 76" stroke="${C.navy}" stroke-width="8" stroke-linecap="round"/><path d="M48 80 L52 76" stroke="#fff" stroke-width="8" stroke-linecap="round"/><path d="M36 30 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3Z M18 56 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2Z M62 12 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2Z" fill="${C.orange}"/>`]);
// 20 Batch badge: a counter on a tray of items, the count going down
I.push(['20', 'Batch badge', `<rect x="10" y="30" width="94" height="84" rx="16" fill="${C.navy}"/>${[0, 1, 2].flatMap(r => [0, 1, 2].map(c => `<rect x="${22 + c * 26}" y="${42 + r * 22}" width="18" height="14" rx="3" fill="${r * 3 + c < 5 ? C.green : '#33446a'}"/>`)).join('')}
<circle cx="100" cy="30" r="24" fill="${C.orange}" stroke="#fff" stroke-width="4"/><text x="100" y="39" text-anchor="middle" font-family="Arial Black,Helvetica,sans-serif" font-weight="900" font-size="24" fill="#fff">4</text>`]);

const cards = I.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r4-${n}.svg`), svg(`fa4${n}-`, `Falcon — ${t}`, b)); return { n, t }; });
const fig = (src, cap) => `<figure>${[128, 48, 28, 16].map(z => `<img src="${src}" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${cap}</figcaption></figure>`;
const row = () => cards.map(c => fig(`icon-r4-${c.n}.svg`, `${c.n} · ${c.t}`)).join('');
writeFileSync(join(dir, 'preview-round4.html'), `<!doctype html><meta charset="utf-8"><title>Falcon icons, round 4</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}</style>
<section class="light">${row()}</section><section class="dark">${row()}</section>\n`);
console.log('wrote ' + cards.length);
