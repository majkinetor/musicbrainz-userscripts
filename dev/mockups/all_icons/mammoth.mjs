// Mammoth's icon as an SVG that matches the 🦣 emoji as Windows draws it (the look the script ships). Rebuilt from the
// glyph's own simple shapes, measured on a screenshot of it: a round head, the back a quarter ellipse, a flat belly,
// two rounded legs, the trunk curling in from the head, the cream tusk a crescent around the jaw, a sliver of see-through gap above it. Writes mammoth.svg.
//   node dev/mockups/all_icons/mammoth.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BROWN = '#784818', TUSK = '#e8e0d0';
// in the screenshot's pixels
const art = `<mask id="cut" maskUnits="userSpaceOnUse" x="60" y="50" width="130" height="100"><rect x="60" y="50" width="130" height="100" fill="#fff"/>
<path d="M88.4 99.4 L91.8 103.4 C90.8 105.5 90.3 108 90.3 110.6 C89.4 108 88.6 104 88.4 99.4Z" fill="#000"/></mask>
<g fill="${BROWN}" mask="url(#cut)"><path d="M104 75 H128 A42 51 0 0 1 170 126 H101 C100 122 96 119 96 114.5 C96 110.5 98 108 100 106Z"/>
<circle cx="107.5" cy="84.4" r="22.9"/><rect x="105" y="118" width="12.5" height="20.5" rx="6.2"/><rect x="142.5" y="118" width="13" height="20.5" rx="6.4"/>
<path d="M88 78 C81 84 76 93 76 104 C76 118 81 129.5 90 129.8 C95 130 100 129.6 102.5 128.6 C103.6 127.6 103 125.5 101.5 124 L100 106 L96 96Z"/></g>
<path d="M96 102.3 C97.8 102.3 99.2 103.7 99.2 105.5 C99 108 97 110 96.8 113 C96.6 116 97.6 120 99.6 123.5 C100.6 125.2 101.5 126.5 102 128 C98 128.6 93.5 126.5 91.2 122 C89.5 118.5 89.4 113.5 90.4 110 C91.2 107 92.4 104.5 93.2 103.6 C94 102.7 95 102.3 96 102.3Z" fill="${TUSK}"/>`;
// fit the glyph's box (x 76..170, y 61.5..138.5) into 128 with a 6 px side margin, centred vertically
const s = 116 / (170 - 76), tx = 6 - 76 * s, ty = (128 - (138.5 - 61.5) * s) / 2 - 61.5 * s;
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'mammoth.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<title>Mammoth</title>
<g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${s.toFixed(5)})">
${art}
</g>
</svg>
`);
