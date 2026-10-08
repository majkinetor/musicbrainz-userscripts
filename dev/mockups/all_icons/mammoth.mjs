// Mammoth's icon as an SVG that matches the 🦣 emoji as Windows draws it (the look the script ships). Rebuilt from the
// glyph's own simple shapes, measured on a screenshot of it: a round head, the back a quarter ellipse, a flat belly,
// two rounded legs, the trunk curling in from the head, the cream tusk between trunk and jaw. Writes mammoth.svg.
//   node dev/mockups/all_icons/mammoth.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BROWN = '#784818', TUSK = '#e8e0d0';
// in the screenshot's pixels
const art = `<path d="M104 75 H128 A42 51 0 0 1 170 126 H101 C100 122 96 119 96 114.5 C96 110.5 98 108 100 106Z" fill="${BROWN}"/>
<circle cx="107.5" cy="84.4" r="22.9" fill="${BROWN}"/>
<rect x="105" y="118" width="12.5" height="20.5" rx="6.2" fill="${BROWN}"/><rect x="142.5" y="118" width="13" height="20.5" rx="6.4" fill="${BROWN}"/>
<path d="M89 100.5 C92.5 102.8 95.5 105 99.5 106.5 C97.2 109.8 95.6 113.8 96 117.8 C96.4 121.8 99.8 124.4 100.6 128.4 C95 127.6 90.8 123.4 89.8 117.4 C89.2 111.6 88.6 106 89 100.5Z" fill="${TUSK}"/>
<path d="M88 78 C81 84 76 93 76 104 C76 116 80 127.5 88 129.5 H98.5 C101.5 129.5 102 126.6 99.5 126.2 C94.5 125.5 90.6 121 89.8 115.5 C89.2 110 88.8 105 89.2 100.5 L96 96Z" fill="${BROWN}"/>`;
// fit the glyph's box (x 76..170, y 61.5..138.5) into 128 with a 6 px side margin, centred vertically
const s = 116 / (170 - 76), tx = 6 - 76 * s, ty = (128 - (138.5 - 61.5) * s) / 2 - 61.5 * s;
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'mammoth.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<title>Mammoth</title>
<g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${s.toFixed(5)})">
${art}
</g>
</svg>
`);
