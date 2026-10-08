// String Theory icons, round 1: twenty ideas for the bundle's own icon, nothing like the current purple node-and-spokes.
// The name read three ways — strings that tie things into one bundle, strings that make music, the physicist's
// vibrating string. One object each, flat and bold like the rest of the bundle, light halo for dark pages.
// Writes icon-01..20.svg and preview.html (96, 48, 28, 16 px on white and black).
//   node dev/mockups/string_theory_icons/gen.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const INK = '#22223b', P = '#7a57e8', PL = '#b9a8ec', PD = '#4b2e83', OR = '#f3722c', GOLD = '#ffc94a', GR = '#2ea44f', SKY = '#3fb6f0', RED = '#e63946', PINK = '#f15bb5', GREY = '#d9dce6', KRAFT = '#d9a066', WOOD = '#b5651d';
const HALO = '<filter id="$h" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="d"/><feFlood flood-color="#fff" flood-opacity=".7"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n<defs>${HALO}</defs><g filter="url(#$h)">${b}</g>`.replaceAll('$', id) + '\n</svg>\n';
const f1 = v => +v.toFixed(1);
const S = (w = 4) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
// a string: an ink line with a coloured core, so it reads on light and dark
const str = (d, c = P, w = 6) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 4}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
// a point on a quadratic curve
const qp = (a, c, b, t) => [f1((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0]), f1((1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1])];
const SIX = [OR, GOLD, GR, SKY, P, PINK];
const I = [];

// 01 Parcel: everything bundled, tied up with string
I.push(['Parcel', `<rect x="16" y="40" width="96" height="74" rx="6" fill="${KRAFT}" ${S()}/>${str('M64 40 V114', P, 6)}${str('M16 76 H112', P, 6)}
<path d="M64 38 C48 18 30 26 42 38 C50 46 60 40 64 38Z M64 38 C80 18 98 26 86 38 C78 46 68 40 64 38Z" fill="${P}" ${S()}/><circle cx="64" cy="39" r="6" fill="${PD}" ${S(3)}/>`]);
// 02 Beads: every script a bead on the one string
{ const a = [10, 34], c = [64, 140], b = [118, 34];
  I.push(['Beads on a string', `<path d="M${a.join(' ')} Q${c.join(' ')} ${b.join(' ')}" fill="none" ${S(4)}/>${[.12, .3, .5, .7, .88].map((t, i) => { const [x, y] = qp(a, c, b, t); return `<circle cx="${x}" cy="${y}" r="12" fill="${SIX[i]}" ${S()}/>`; }).join('')}`]); }
// 03 Bunting: the scripts as flags on one line
{ const a = [6, 26], c = [64, 70], b = [122, 26];
  I.push(['Bunting', `<path d="M${a.join(' ')} Q${c.join(' ')} ${b.join(' ')}" fill="none" ${S(4)}/>${[.14, .32, .5, .68, .86].map((t, i) => { const [x, y] = qp(a, c, b, t); return `<path d="M${x - 11} ${y} H${x + 11} L${x} ${y + 34}Z" fill="${SIX[i]}" ${S()}/>`; }).join('')}`]); }
// 04 Tin-can telephone: two scripts talking down one string
I.push(['Tin-can telephone', `<path d="M30 70 Q64 18 98 70" fill="none" ${S(3.5)}/>
<g transform="rotate(-12 28 92)"><rect x="12" y="72" width="32" height="44" rx="4" fill="${SKY}" ${S()}/><ellipse cx="28" cy="72" rx="16" ry="5" fill="${GREY}" ${S()}/><path d="M12 86 H44 M12 102 H44" stroke="${INK}" stroke-width="2.5"/></g>
<g transform="rotate(12 100 92)"><rect x="84" y="72" width="32" height="44" rx="4" fill="${OR}" ${S()}/><ellipse cx="100" cy="72" rx="16" ry="5" fill="${GREY}" ${S()}/><path d="M84 86 H116 M84 102 H116" stroke="${INK}" stroke-width="2.5"/></g>`]);
// 05 Ball of yarn: all of it wound into one ball
I.push(['Ball of yarn', `${str('M96 96 Q110 112 98 120 Q88 126 112 122', P, 5)}<circle cx="58" cy="62" r="46" fill="${P}" ${S()}/>
<path d="M22 44 Q60 30 92 50 M16 66 Q58 50 102 72 M24 90 Q60 74 96 92 M42 20 Q30 62 50 106 M70 18 Q94 56 78 106" fill="none" stroke="${PD}" stroke-width="4" stroke-linecap="round"/>`]);
// 06 Spool: the thread wound on one reel
I.push(['Spool', `<rect x="34" y="28" width="60" height="72" fill="${P}" ${S()}/><path d="M34 42 H94 M34 56 H94 M34 70 H94 M34 84 H94" stroke="${PD}" stroke-width="3.5"/>
<rect x="22" y="12" width="84" height="18" rx="5" fill="${WOOD}" ${S()}/><rect x="22" y="98" width="84" height="18" rx="5" fill="${WOOD}" ${S()}/>${str('M94 70 Q114 74 110 92 Q106 108 120 116', P, 5)}`]);
// 07 Needle and thread: stitching things together
I.push(['Needle and thread', `${str('M84 30 Q118 40 100 66 Q80 94 44 82 Q14 72 26 104', P, 5)}<path d="M18 118 L96 22 Q104 14 108 20 Q110 26 102 34Z" fill="${GREY}" ${S()}/><path d="M92 32 L100 24" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`]);
// 08 Button: four holes, sewn on with a cross of thread
I.push(['Button', `<circle cx="64" cy="64" r="52" fill="${GOLD}" ${S(5)}/><circle cx="64" cy="64" r="38" fill="none" stroke="${INK}" stroke-width="3" opacity=".35"/>
${str('M48 48 L80 80 M80 48 L48 80', P, 6)}${[[48, 48], [80, 48], [48, 80], [80, 80]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${INK}"/>`).join('')}${str('M48 48 L80 80 M80 48 L48 80', P, 5)}`]);
// 09 Bow: tied, done, all in one
I.push(['Bow', `<path d="M58 66 L36 116 L46 112 L52 120 L64 72Z M70 66 L92 116 L82 112 L76 120 L64 72Z" fill="${PD}" ${S()}/>
<path d="M64 60 C40 20 4 30 18 62 C26 82 52 72 64 60Z M64 60 C88 20 124 30 110 62 C102 82 76 72 64 60Z" fill="${P}" ${S()}/><path d="M64 60 C46 44 30 44 30 56 M64 60 C82 44 98 44 98 56" fill="none" stroke="${PD}" stroke-width="3.5" stroke-linecap="round"/><rect x="54" y="50" width="20" height="22" rx="6" fill="${P}" ${S()}/>`]);
// 10 Cat's cradle: one loop of string, a whole figure
I.push(['Cat\'s cradle', `${str('M24 28 L104 100 M104 28 L24 100 M24 28 H104 M24 100 H104 M24 64 L64 28 L104 64 L64 100Z', P, 4)}${[[24, 28], [104, 28], [24, 64], [104, 64], [24, 100], [104, 100]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${GOLD}" ${S()}/>`).join('')}`]);
// 11 Harp: every string on one frame
I.push(['Harp', `<path d="M38 34 V104 M52 40 V100 M66 48 V96 M80 58 V92 M94 70 V88" stroke="${GOLD}" stroke-width="3.5" stroke-linecap="round"/>
<path d="M24 22 Q22 14 32 14 Q72 20 112 70 L104 82 Q72 40 34 32 V112 H24Z" fill="${P}" ${S()}/><path d="M34 112 L104 82 L112 70 L118 74 L44 120 H18 V112Z" fill="${PD}" ${S()}/>`]);
// 12 Lyre: the oldest strings there are
I.push(['Lyre', `<path d="M48 32 V102 M64 30 V102 M80 32 V102" stroke="${GOLD}" stroke-width="4" stroke-linecap="round"/>
<path d="M30 14 Q14 30 24 60 Q32 86 40 104 H88 Q96 86 104 60 Q114 30 98 14 Q110 34 96 60 Q88 78 82 94 H46 Q40 78 32 60 Q18 34 30 14Z" fill="${P}" ${S()}/><rect x="28" y="22" width="72" height="12" rx="5" fill="${WOOD}" ${S()}/><rect x="36" y="100" width="56" height="16" rx="5" fill="${PD}" ${S()}/>`]);
// 13 Headstock: six tuning pegs, every string set
I.push(['Guitar headstock', `<path d="M44 124 L46 82 L34 12 Q64 4 94 12 L82 82 L84 124Z" fill="${WOOD}" ${S()}/>${[26, 46, 66].map(y => `<circle cx="${30 - y * .05}" cy="${y}" r="8" fill="${GREY}" ${S(3.5)}/><circle cx="${98 + y * .05}" cy="${y}" r="8" fill="${GREY}" ${S(3.5)}/>`).join('')}
<path d="M54 26 L58 124 M54 46 L61 124 M54 66 L62 124 M74 26 L70 124 M74 46 L67 124 M74 66 L66 124" stroke="${GOLD}" stroke-width="2.4"/>${[26, 46, 66].map(y => `<circle cx="54" cy="${y}" r="3" fill="${INK}"/><circle cx="74" cy="${y}" r="3" fill="${INK}"/>`).join('')}`]);
// 14 Plucked string: one string, ringing between two pegs
I.push(['Plucked string', `<path d="M16 64 Q40 26 64 64 T112 64" fill="none" stroke="${PL}" stroke-width="5" stroke-linecap="round"/>${str('M16 64 Q40 102 64 64 T112 64', P, 6)}<circle cx="14" cy="64" r="10" fill="${GOLD}" ${S()}/><circle cx="114" cy="64" r="10" fill="${GOLD}" ${S()}/>`]);
// 15 Closed string: the physicist's loop, vibrating
{ const loop = (amp, ph) => 'M' + Array.from({ length: 73 }, (_, i) => { const a = i * 5 * Math.PI / 180, r = 42 + amp * Math.sin(5 * a + ph); return `${f1(64 + r * Math.cos(a))} ${f1(64 + r * Math.sin(a))}`; }).join(' L') + 'Z';
  I.push(['Closed string', `<path d="${loop(9, Math.PI)}" fill="none" stroke="${PL}" stroke-width="5" stroke-linejoin="round"/>${str(loop(9, 0), P, 7)}`]); }
// 16 Tuning fork: one note everything tunes to
I.push(['Tuning fork', `<path d="M40 16 V64 Q40 84 64 84 Q88 84 88 64 V16 H76 V64 Q76 72 64 72 Q52 72 52 64 V16Z" fill="${GREY}" ${S()}/><rect x="58" y="82" width="12" height="38" rx="5" fill="${GREY}" ${S()}/>
<path d="M28 24 Q20 40 28 56 M18 18 Q6 40 18 62 M100 24 Q108 40 100 56 M110 18 Q122 40 110 62" fill="none" stroke="${P}" stroke-width="4" stroke-linecap="round"/>`]);
// 17 Yo-yo: always comes back on its string
I.push(['Yo-yo', `${str('M64 8 V62', P, 4)}<circle cx="64" cy="8" r="6" fill="none" ${S(4)}/><circle cx="64" cy="84" r="36" fill="${RED}" ${S(5)}/><circle cx="64" cy="84" r="20" fill="${OR}" ${S(4)}/><circle cx="64" cy="84" r="6" fill="${INK}"/>`]);
// 18 Braid: strands woven into one
I.push(['Braid', `${Array.from({ length: 6 }, (_, i) => { const y = 10 + i * 18, c = SIX[i % 3 * 2]; return `<path d="M${i % 2 ? 88 : 40} ${y} Q64 ${y + 6} ${i % 2 ? 40 : 88} ${y + 22} L${i % 2 ? 54 : 74} ${y + 30} Q64 ${y + 14} ${i % 2 ? 100 : 28} ${y + 4}Z" fill="${c}" ${S(3.5)}/>`; }).join('')}`]);
// 19 Tied scrolls: rolled up together, one string round them
I.push(['Tied scrolls', `${[[20, 60, SKY], [64, 60, GR], [42, 26, GOLD]].map(([x, y, c]) => `<rect x="${x - 2}" y="${y}" width="48" height="36" rx="18" fill="${c}" ${S()}/><circle cx="${x + 28}" cy="${y + 18}" r="7" fill="#fff" ${S(3)}/>`).join('')}${str('M64 22 V100', P, 6)}<path d="M64 100 L52 120 M64 100 L76 120" fill="none" stroke="${P}" stroke-width="5" stroke-linecap="round"/>`]);
// 20 Tag: a label on a string, the name for the bundle
I.push(['Tag', `${str('M44 40 Q20 10 52 8 Q80 8 66 30', P, 5)}<path d="M30 46 L58 26 L112 84 Q116 90 110 96 L88 116 Q82 120 76 114 L22 58Z" fill="${GOLD}" ${S()}/><circle cx="48" cy="44" r="7" fill="#fff" ${S(3.5)}/>
<path d="M58 74 L84 102 M70 66 L96 94" stroke="${INK}" stroke-width="4" stroke-linecap="round" opacity=".5"/>`]);

const cards = I.map(([t, b], i) => { const n = String(i + 1).padStart(2, '0'); writeFileSync(join(dir, `icon-${n}.svg`), svg(`st${n}-`, `String Theory — ${t}`, b)); return { n, t }; });
const fig = c => `<figure>${[96, 48, 28, 16].map(z => `<img src="icon-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview.html'), `<!doctype html><meta charset="utf-8"><title>String Theory icons, round 1</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
.light{background:#fff;color:#222}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}</style>
${sec('light', 'White')}${sec('dark', 'Black')}\n`);
console.log('wrote ' + cards.length);
