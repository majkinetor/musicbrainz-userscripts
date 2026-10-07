// Credit Hoarder icon candidates: things that hoard, holding music credits (♪ coins, credit tags).
// Flat, dark-outlined, like the set's rocket, UFO and mammoth. Writes icon-1..6.svg and preview.html.
//   node dev/mockups/credit_hoarder_icons/gen.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const C = { ink: '#1f1a3d', gold: '#f6c445', goldD: '#d99a1c', green: '#2f9e5f', greenD: '#2f6f54', purple: '#7c4dff', purpleL: '#b39dff', paper: '#fffaf0', wood: '#a0612c', woodD: '#6e3f17', pink: '#ff8fb1', grey: '#c9c3dc', brown: '#c47a3a' };
const svg = (t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b}\n</svg>\n`;
const S = `stroke="${C.ink}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
// a gold coin with a note on it
const coin = (x, y, r = 10, rot = 0) => `<g transform="rotate(${rot} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r}" fill="${C.gold}" ${S.replace('4', '3')}/><path d="M${x - r * .15} ${y + r * .4} V${y - r * .45} L${x + r * .4} ${y - r * .6}" fill="none" stroke="${C.goldD}" stroke-width="${r * .22}" stroke-linecap="round"/><circle cx="${x - r * .32}" cy="${y + r * .4}" r="${r * .2}" fill="${C.goldD}"/></g>`;
// a credit tag: a paper label with two "text" lines
const tag = (x, y, w = 30, h = 16, rot = 0, fill = C.paper) => `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"><path d="M${x} ${y} H${x + w} V${y + h} H${x} L${x - 7} ${y + h / 2}Z" fill="${fill}" ${S.replace('4', '3')}/><circle cx="${x - 1}" cy="${y + h / 2}" r="2" fill="${C.ink}"/><path d="M${x + 5} ${y + h * .36} H${x + w - 5} M${x + 5} ${y + h * .68} H${x + w * .6}" stroke="${C.greenD}" stroke-width="2.4" stroke-linecap="round"/></g>`;

const I = [];
I.push(['1', 'Treasure chest', `${coin(34, 26, 9, -15)}${tag(64, 14, 30, 15, 18)}${coin(92, 38, 8, 20)}
<path d="M20 58 C20 34 108 34 108 58 Z" fill="${C.wood}" ${S}/><path d="M28 55 C30 42 98 42 100 55" fill="none" stroke="${C.woodD}" stroke-width="3"/>
<path d="M22 60 C40 44 60 52 64 46 C70 52 90 42 106 60Z" fill="${C.gold}" ${S}/>${coin(46, 52, 8)}${coin(66, 48, 8, 10)}${coin(84, 53, 8, -8)}
<rect x="16" y="58" width="96" height="52" rx="6" fill="${C.wood}" ${S}/><path d="M16 74 H112" stroke="${C.woodD}" stroke-width="4"/><path d="M40 58 V110 M88 58 V110" stroke="${C.goldD}" stroke-width="6"/>
<rect x="54" y="66" width="20" height="20" rx="4" fill="${C.gold}" ${S.replace('4', '3')}/><path d="M64 73 V79" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>`]);
I.push(['2', 'Hamster, cheeks full', `<ellipse cx="64" cy="82" rx="44" ry="36" fill="${C.brown}" ${S}/><ellipse cx="64" cy="92" rx="28" ry="22" fill="#f3d3a8"/>
<circle cx="36" cy="42" r="12" fill="${C.brown}" ${S}/><circle cx="92" cy="42" r="12" fill="${C.brown}" ${S}/><circle cx="36" cy="42" r="6" fill="${C.pink}"/><circle cx="92" cy="42" r="6" fill="${C.pink}"/>
<ellipse cx="64" cy="62" rx="36" ry="30" fill="${C.brown}" ${S}/><ellipse cx="38" cy="72" rx="16" ry="14" fill="#e0a565" ${S.replace('4', '3')}/><ellipse cx="90" cy="72" rx="16" ry="14" fill="#e0a565" ${S.replace('4', '3')}/>
<circle cx="52" cy="56" r="4.5" fill="${C.ink}"/><circle cx="76" cy="56" r="4.5" fill="${C.ink}"/><circle cx="53.5" cy="54.5" r="1.4" fill="#fff"/><circle cx="77.5" cy="54.5" r="1.4" fill="#fff"/>
<path d="M60 66 L64 69 L68 66" fill="${C.pink}" stroke="${C.ink}" stroke-width="2.5" stroke-linejoin="round"/>
${coin(64, 98, 15)}<path d="M44 96 C46 104 52 106 54 100 M84 96 C82 104 76 106 74 100" fill="#f3d3a8" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>`]);
I.push(['3', 'Dragon on its hoard', `<path d="M14 112 C18 90 40 84 64 86 C88 84 110 90 114 112Z" fill="${C.gold}" ${S}/>${coin(30, 100, 8, -10)}${coin(50, 94, 8)}${coin(98, 100, 8, 12)}${tag(70, 92, 24, 13, -12)}
<path d="M96 96 C112 80 108 56 92 50" fill="none" stroke="${C.ink}" stroke-width="13" stroke-linecap="round"/><path d="M96 96 C112 80 108 56 92 50" fill="none" stroke="${C.purple}" stroke-width="6" stroke-linecap="round"/>
<path d="M30 92 C24 64 44 40 70 44 C92 48 98 70 86 88 Z" fill="${C.purple}" ${S}/><path d="M46 84 C44 66 54 56 68 58" fill="none" stroke="${C.purpleL}" stroke-width="5" stroke-linecap="round"/>
<path d="M58 46 L52 26 L66 38 L74 22 L78 44 Z" fill="${C.green}" ${S.replace('4', '3')}/>
<path d="M66 44 C66 30 82 22 94 26 C108 30 112 42 104 50 C96 56 80 54 72 52Z" fill="${C.purple}" ${S}/><circle cx="92" cy="36" r="4" fill="#fff" stroke="${C.ink}" stroke-width="2"/><circle cx="93" cy="36" r="2" fill="${C.ink}"/>
<path d="M100 46 C104 46 106 44 107 42" stroke="${C.ink}" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M84 24 L80 14 M94 24 L96 13" stroke="${C.ink}" stroke-width="3.5" stroke-linecap="round"/>`]);
I.push(['4', 'Magpie with a credit', `<path d="M14 84 C30 80 44 84 52 92 L40 104 C30 98 22 92 14 84Z" fill="${C.ink}"/>
<path d="M40 96 C40 66 58 48 82 50 C100 52 108 66 104 82 C100 98 80 108 60 106 C50 105 44 102 40 96Z" fill="#fff" ${S}/>
<path d="M58 56 C70 48 92 50 102 64 C96 64 84 62 74 70 C66 76 56 74 52 70Z" fill="${C.ink}"/><path d="M60 82 C70 72 88 72 96 80 C88 92 70 96 60 82Z" fill="${C.ink}"/><path d="M64 84 C74 78 86 78 92 82" stroke="#3f7fd9" stroke-width="3" fill="none"/>
<circle cx="94" cy="44" r="16" fill="${C.ink}"/><circle cx="98" cy="40" r="3.5" fill="#fff"/><circle cx="98.5" cy="40" r="1.6" fill="${C.ink}"/><path d="M108 44 L122 48 L108 52Z" fill="${C.ink}"/>
<path d="M70 106 L66 118 M82 104 L82 118" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>
${tag(98, 52, 22, 14, 30, C.gold)}`]);
I.push(['5', 'Overflowing drawer', `${tag(30, 10, 34, 16, -14)}${tag(64, 6, 34, 16, 10, '#e7f6ee')}${tag(46, 22, 34, 16, 4, C.gold)}${tag(76, 26, 30, 15, -6)}
<rect x="18" y="40" width="92" height="76" rx="6" fill="${C.grey}" ${S}/><rect x="26" y="48" width="76" height="28" rx="3" fill="#ece8f7" ${S.replace('4', '3')}/><rect x="26" y="82" width="76" height="26" rx="3" fill="#ece8f7" ${S.replace('4', '3')}/>
<rect x="52" y="58" width="24" height="7" rx="3.5" fill="${C.ink}"/><rect x="52" y="91" width="24" height="7" rx="3.5" fill="${C.ink}"/>
<path d="M22 44 C30 36 44 40 50 34 C58 40 70 34 78 38 C86 34 98 40 106 44" fill="${C.paper}" ${S.replace('4', '3')}/>`]);
I.push(['6', 'Piggy bank', `${coin(70, 18, 11, 12)}<path d="M66 32 H82" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>
<ellipse cx="62" cy="72" rx="44" ry="34" fill="${C.pink}" ${S}/><path d="M38 100 V114 H50 V104 M76 104 V114 H88 V100" fill="${C.pink}" ${S}/>
<path d="M34 46 L30 30 L46 40" fill="${C.pink}" ${S}/><path d="M60 40 H84" stroke="#d65a86" stroke-width="5" stroke-linecap="round"/>
<ellipse cx="104" cy="74" rx="12" ry="14" fill="#ffb3c9" ${S}/><circle cx="101" cy="70" r="2.4" fill="${C.ink}"/><circle cx="101" cy="78" r="2.4" fill="${C.ink}"/>
<circle cx="80" cy="58" r="4.5" fill="${C.ink}"/><path d="M18 74 C8 70 8 82 16 80" fill="none" stroke="${C.ink}" stroke-width="3.5" stroke-linecap="round"/>
${tag(36, 70, 30, 15, -8)}`]);

const cards = I.map(([n, t, b]) => { writeFileSync(join(dir, `icon-${n}.svg`), svg(`Credit Hoarder — ${t}`, b)); return { n, t }; });
const row = () => cards.map(c => `<figure>${[128, 48, 16].map(z => `<img src="icon-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`).join('');
writeFileSync(join(dir, 'preview.html'), `<!doctype html><meta charset="utf-8"><title>Credit Hoarder icons</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:20px;display:grid;grid-template-columns:repeat(3,1fr);gap:22px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:10px;flex-wrap:wrap}figcaption{width:100%}</style>
<section class="light">${row()}</section><section class="dark">${row()}</section>\n`);
console.log('wrote ' + cards.length);
