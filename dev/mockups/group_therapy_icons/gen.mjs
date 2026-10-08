// Group Therapy icons, round 1: eighteen ideas for a new icon, nothing like the current green triangle of nodes.
// The name taken at its word — the therapy session, the couch, the name tag — and at its job: grouping credits,
// fixing relationships, picking many at once. One object each, flat and bold like the rest of the bundle, light halo
// for dark pages. Writes icon-01..18.svg and preview.html (96, 48, 28, 16 px on white and black).
//   node dev/mockups/group_therapy_icons/gen.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const INK = '#22223b', P = '#7a57e8', PL = '#b9a8ec', PD = '#4b2e83', OR = '#f3722c', GOLD = '#ffc94a', GR = '#2ea44f', SKY = '#3fb6f0', RED = '#e63946', PINK = '#f15bb5', GREY = '#d9dce6', WOOD = '#b5651d', SKIN = '#f2c29b';
const HALO = '<filter id="$h" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="d"/><feFlood flood-color="#fff" flood-opacity=".7"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n<defs>${HALO}</defs><g filter="url(#$h)">${b}</g>`.replaceAll('$', id) + '\n</svg>\n';
const S = (w = 4) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const I = [];

// 01 Couch: the therapist's chaise
I.push(['Couch', `<path d="M18 96 L14 112 M110 96 L114 112" ${S(6)}/><path d="M10 66 Q10 52 24 52 H96 Q104 52 106 60 L112 74 Q120 76 120 86 V98 H10Z" fill="${GR}" ${S()}/>
<path d="M10 66 Q6 40 24 36 Q40 34 40 52 V74 H10Z" fill="${GR}" ${S()}/><rect x="40" y="74" width="80" height="12" rx="5" fill="#5fc27e" ${S(3.5)}/><ellipse cx="54" cy="64" rx="13" ry="9" fill="${GOLD}" ${S(3.5)}/>`]);
// 02 Name tag: Hello, my name is
I.push(['Name tag', `<rect x="8" y="26" width="112" height="78" rx="10" fill="#fff" ${S(5)}/><path d="M8 52 V36 Q8 26 18 26 H110 Q120 26 120 36 V52Z" fill="${RED}" ${S(5)}/>
<path d="M30 39 H98" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M26 80 Q36 66 46 80 T66 80 T86 80 T104 76" fill="none" stroke="${P}" stroke-width="5" stroke-linecap="round"/>`]);
// 03 Band-aid: patching up relationships
I.push(['Band-aid', `<g transform="rotate(-35 64 64)"><rect x="4" y="44" width="120" height="40" rx="20" fill="${SKIN}" ${S()}/><rect x="44" y="44" width="40" height="40" fill="#f7dcc4" ${S(3.5)}/>
${[[52, 54], [64, 54], [76, 54], [58, 64], [70, 64], [52, 74], [64, 74], [76, 74]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="${INK}" opacity=".45"/>`).join('')}</g>`]);
// 04 Tissues: every session has a box
I.push(['Box of tissues', `<path d="M52 44 Q40 20 62 16 Q70 30 66 24 Q84 10 88 30 Q92 44 76 46Z" fill="#fff" ${S()}/><rect x="16" y="46" width="96" height="66" rx="8" fill="${SKY}" ${S()}/>
<rect x="44" y="40" width="40" height="12" rx="6" fill="${INK}"/><path d="M16 74 H112" stroke="${INK}" stroke-width="3" opacity=".35"/><path d="M30 92 Q46 80 62 92 T94 92" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`]);
// 05 Pill: a dose of therapy
I.push(['Capsule', `<g transform="rotate(-40 64 64)"><path d="M64 38 H40 A26 26 0 0 0 40 90 H64Z" fill="${P}" ${S()}/><path d="M64 38 H88 A26 26 0 0 1 88 90 H64Z" fill="${GOLD}" ${S()}/><path d="M34 50 Q30 58 32 66" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6"/></g>`]);
// 06 Talking it through: two speech bubbles
I.push(['Speech bubbles', `<path d="M58 26 H112 Q122 26 122 36 V70 Q122 80 112 80 H104 L106 96 L88 80 H58 Q48 80 48 70 V36 Q48 26 58 26Z" fill="${SKY}" ${S()}/>
<path d="M16 46 H70 Q80 46 80 56 V88 Q80 98 70 98 H36 L20 112 L22 98 H16 Q6 98 6 88 V56 Q6 46 16 46Z" fill="${OR}" ${S()}/><circle cx="26" cy="72" r="5" fill="#fff"/><circle cx="43" cy="72" r="5" fill="#fff"/><circle cx="60" cy="72" r="5" fill="#fff"/>`]);
// 07 Venn: three groups, overlapping
I.push(['Venn of three', `${[[64, 40, OR], [44, 76, GR], [84, 76, SKY]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="32" fill="${c}" fill-opacity=".75" ${S()}/>`).join('')}`]);
// 08 Lasso: rope round the lot, the batch pick
I.push(['Lasso', `<ellipse cx="60" cy="54" rx="50" ry="38" fill="none" stroke="${INK}" stroke-width="10"/><ellipse cx="60" cy="54" rx="50" ry="38" fill="none" stroke="${GOLD}" stroke-width="5" stroke-dasharray="10 5"/>
<path d="M84 88 Q96 104 88 120" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M84 88 Q96 104 88 120" fill="none" stroke="${GOLD}" stroke-width="5" stroke-linecap="round"/>${[[40, 50, OR], [62, 40, GR], [80, 60, SKY], [50, 70, P]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="9" fill="${c}" ${S(3.5)}/>`).join('')}`]);
// 09 Puzzle: two pieces that fit
I.push(['Puzzle pieces', `<path d="M10 30 H44 Q40 18 52 16 Q64 18 60 30 H64 V54 Q76 50 78 62 Q76 74 64 70 V98 H10Z" fill="${GR}" ${S()}/><path d="M64 30 H118 V98 H90 Q94 110 82 112 Q70 110 74 98 H64 V70 Q76 74 78 62 Q76 50 64 54Z" fill="${P}" ${S()}/>`]);
// 10 Rubber band: the credits bundled together
I.push(['Banded cards', `${[[-10, OR], [-3, GOLD], [4, SKY]].map(([r, c], i) => `<rect x="24" y="${30 - i * 4}" width="80" height="58" rx="6" fill="${c}" transform="rotate(${r} 64 64)" ${S()}/>`).join('')}<path d="M64 14 V110" stroke="${INK}" stroke-width="11" stroke-linecap="round" transform="rotate(4 64 64)"/><path d="M64 14 V110" stroke="${RED}" stroke-width="6" stroke-linecap="round" transform="rotate(4 64 64)"/>`]);
// 11 Paper clip: holding the group together
I.push(['Paper clip', `<rect x="22" y="34" width="72" height="84" rx="6" fill="#fff" ${S()}/><rect x="34" y="24" width="72" height="84" rx="6" fill="${SKY}" ${S()}/><path d="M48 54 H92 M48 68 H86 M48 82 H90" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
<path d="M84 46 V14 Q84 6 92 6 Q100 6 100 14 V50 Q100 62 88 62 Q76 62 76 50 V20" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M84 46 V14 Q84 6 92 6 Q100 6 100 14 V50 Q100 62 88 62 Q76 62 76 50 V20" fill="none" stroke="${GREY}" stroke-width="4" stroke-linecap="round"/>`]);
// 12 Linked: two rings, one relationship
I.push(['Linked rings', `<circle cx="46" cy="64" r="30" fill="none" stroke="${INK}" stroke-width="16"/><circle cx="46" cy="64" r="30" fill="none" stroke="${GR}" stroke-width="9"/><circle cx="82" cy="64" r="30" fill="none" stroke="${INK}" stroke-width="16"/><circle cx="82" cy="64" r="30" fill="none" stroke="${P}" stroke-width="9"/>
<path d="M75 36 A30 30 0 0 1 75 92" fill="none" stroke="${INK}" stroke-width="16"/><path d="M75 36 A30 30 0 0 1 75 92" fill="none" stroke="${GR}" stroke-width="9"/>`]);
// 13 Group hug: three of them, arms round each other
I.push(['Group hug', `${[[34, OR], [94, SKY], [64, GR]].map(([x, c]) => `<path d="M${x - 22} 118 V96 Q${x - 22} 74 ${x} 74 Q${x + 22} 74 ${x + 22} 96 V118Z" fill="${c}" ${S()}/><circle cx="${x}" cy="${x === 64 ? 46 : 52}" r="${x === 64 ? 18 : 15}" fill="${c}" ${S()}/>`).join('')}<path d="M20 98 Q64 80 108 98" fill="none" ${S(5)}/>`]);
// 14 Paper chain: people cut from one sheet, hands joined
{ const doll = x => `<circle cx="${x}" cy="40" r="12"/><path d="M${x - 20} 58 H${x + 20} V66 H${x + 8} V84 L${x + 16} 108 H${x + 4} L${x} 92 L${x - 4} 108 H${x - 16} L${x - 8} 84 V66 H${x - 20}Z"/>`;
  I.push(['Paper chain', `<g fill="#fff" ${S()}>${[24, 64, 104].map(doll).join('')}</g><g fill="${P}">${[24, 64, 104].map(x => `<circle cx="${x}" cy="40" r="7"/>`).join('')}</g>`]); }
// 15 Highlighter: pick a role out everywhere
I.push(['Highlighter', `<path d="M14 108 H70" stroke="${GOLD}" stroke-width="14" stroke-linecap="round" opacity=".8"/><g transform="rotate(40 80 56)"><rect x="66" y="10" width="28" height="70" rx="5" fill="${GOLD}" ${S()}/><rect x="66" y="10" width="28" height="18" rx="5" fill="${INK}"/><path d="M70 80 H90 L86 96 H74Z" fill="${GREY}" ${S()}/><path d="M74 96 H86 L82 106 H78Z" fill="${GOLD}" ${S(3)}/></g>`]);
// 16 Sticky notes: credits stuck up in a group
I.push(['Sticky notes', `${[[16, 20, PINK, -8], [50, 30, GOLD, 6], [28, 56, SKY, 3]].map(([x, y, c, r]) => `<g transform="rotate(${r} ${x + 30} ${y + 30})"><path d="M${x} ${y} H${x + 62} V${y + 46} L${x + 46} ${y + 62} H${x}Z" fill="${c}" ${S()}/><path d="M${x + 62} ${y + 46} H${x + 46} V${y + 62}" fill="none" ${S(3)}/></g>`).join('')}`]);
// 17 Mugs: two of them, the talk over coffee
I.push(['Two mugs', `<path d="M20 44 H62 V96 Q62 108 50 108 H32 Q20 108 20 96Z" fill="${OR}" ${S()}/><path d="M62 56 Q76 56 76 68 Q76 80 62 80" fill="none" ${S(5)}/>
<path d="M66 32 H108 V84 Q108 96 96 96 H78 Q66 96 66 84Z" fill="${SKY}" ${S()}/><path d="M108 44 Q122 44 122 56 Q122 68 108 68" fill="none" ${S(5)}/><path d="M30 34 Q26 26 32 18 M44 34 Q40 26 46 18" fill="none" stroke="${PL}" stroke-width="4" stroke-linecap="round"/>`]);
// 18 Braces: { a group }
I.push(['Braces', `<path d="M36 14 Q20 14 20 30 V50 Q20 64 8 64 Q20 64 20 78 V98 Q20 114 36 114" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><path d="M92 14 Q108 14 108 30 V50 Q108 64 120 64 Q108 64 108 78 V98 Q108 114 92 114" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
${[[46, OR], [64, GR], [82, SKY]].map(([x, c]) => `<circle cx="${x}" cy="64" r="9" fill="${c}" ${S(3.5)}/>`).join('')}`]);

const cards = I.map(([t, b], i) => { const n = String(i + 1).padStart(2, '0'); writeFileSync(join(dir, `icon-${n}.svg`), svg(`gt${n}-`, `Group Therapy — ${t}`, b)); return { n, t }; });
const fig = c => `<figure>${[96, 48, 28, 16].map(z => `<img src="icon-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview.html'), `<!doctype html><meta charset="utf-8"><title>Group Therapy icons, round 1</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(6,1fr);gap:16px}
.light{background:#fff;color:#222}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}</style>
${sec('light', 'White')}${sec('dark', 'Black')}\n`);
console.log('wrote ' + cards.length);
