// Apollo Editor icons, round 7: round 6's 08 (both sides, 2, at 70%) with the porthole outlined too.
// Writes icon-r7-00..03.svg and preview-round7.html (96, 48, 28, 16 px on white, dark grey and black).
// 00 is round 6's 08 as it is.
//   node dev/mockups/apollo_icons/gen-round7.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = (id, t, b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">\n<title>${t}</title>\n${b.replaceAll('$', id)}\n</svg>\n`;
const NAVY = '#1b2a4a', FLAME_C = '#ff6a00';
const BODY = 'M64 10 C82 28 90 56 90 80 L38 80 C38 56 46 28 64 10 Z', FINL = 'M38 80 L20 110 L40 96 Z', FINR = 'M90 80 L108 110 L88 96 Z', FLAME = 'M50 80 L45 108 L64 122 L83 108 L78 80 Z';
const rocket = `<g fill="none" stroke="${NAVY}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"><path d="${BODY}"/><path d="${FINL}"/><path d="${FINR}"/></g><circle cx="64" cy="44" r="10" fill="${NAVY}"/>
<path d="${FLAME}" fill="${FLAME_C}" stroke="${NAVY}" stroke-width="5" stroke-linejoin="round"/>`;
// the rocket's whole silhouette (lines widened to their stroke), for halos
const shape = (stroke, extra) => `<g stroke="${stroke}" stroke-linejoin="round" stroke-linecap="round"><path d="${BODY}" fill="${stroke}" stroke-width="${7 + extra}"/><path d="${FINL}" fill="${stroke}" stroke-width="${7 + extra}"/><path d="${FINR}" fill="${stroke}" stroke-width="${7 + extra}"/><path d="${FLAME}" fill="${stroke}" stroke-width="${5 + extra}"/></g>`;
// a halo around the outside of the silhouette only: the widened shape, minus the shape itself
const outer = (c, w, op = 1) => `<mask id="$o" maskUnits="userSpaceOnUse" x="0" y="0" width="128" height="128"><rect width="128" height="128" fill="#fff"/>${shape('#000', 0)}</mask><g mask="url(#$o)" opacity="${op}">${shape(c, w * 2)}</g>`;
// a halo on both sides of every line (round 5's)
const both = (c, w, op = 1) => `<g fill="none" stroke="${c}" stroke-linejoin="round" stroke-linecap="round" opacity="${op}"><path d="${BODY}" stroke-width="${7 + w * 2}"/><path d="${FINL}" stroke-width="${7 + w * 2}"/><path d="${FINR}" stroke-width="${7 + w * 2}"/><path d="${FLAME}" stroke-width="${5 + w * 2}"/></g>`;
// a soft glow: the silhouette, blurred
const glow = (c, sd, op) => `<filter id="$b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${sd}"/></filter><g filter="url(#$b)" opacity="${op}">${shape(c, 4)}</g>`;

// a halo ring around the porthole, on both sides of its edge
const port = (w, op = 1) => `<circle cx="64" cy="44" r="10" fill="#fff" stroke="#fff" stroke-width="${w * 2}" opacity="${op}"/>`;
const V = [
  ['00', 'Both sides, 2, at 70% (round 6, 08)', both('#fff', 2, .7) + rocket],
  ['01', '+ porthole outline, 2, at 70%', both('#fff', 2, .7) + port(2, .7) + rocket],
  ['02', '+ porthole outline, 1.5, at 70%', both('#fff', 2, .7) + port(1.5, .7) + rocket],
  ['03', '+ porthole outline, 2, full', both('#fff', 2, .7) + port(2) + rocket],
];
const cards = V.map(([n, t, b]) => { writeFileSync(join(dir, `icon-r7-${n}.svg`), svg(`ap7${n}-`, `Apollo Editor — ${t}`, b)); return { n, t }; });
const fig = c => `<figure${c.n === '00' ? ' class="pick"' : ''}>${[96, 48, 28, 16].map(z => `<img src="icon-r7-${c.n}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption>${c.n} · ${c.t}</figcaption></figure>`;
const sec = (cls, label) => `<h3 class="${cls}">${label}</h3><section class="${cls}">${cards.map(fig).join('')}</section>`;
writeFileSync(join(dir, 'preview-round7.html'), `<!doctype html><meta charset="utf-8"><title>Apollo Editor icons, round 7</title>
<style>body{margin:0;font:13px system-ui,sans-serif}h3{margin:0;padding:10px 18px 0;font-size:13px}section{padding:12px 18px 18px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.light{background:#fff;color:#222}.grey{background:#2b2b2b;color:#ddd}.dark{background:#000;color:#ddd}figure{margin:0;display:flex;align-items:end;gap:6px;flex-wrap:wrap}figcaption{width:100%}.pick figcaption{font-weight:700}</style>
${sec('light', 'White')}${sec('grey', 'Dark grey (#2b2b2b)')}${sec('dark', 'Black')}\n`);
console.log('wrote ' + cards.length);
