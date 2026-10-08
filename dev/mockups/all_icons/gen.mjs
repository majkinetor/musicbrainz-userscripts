// Every userscript's icon side by side, as each script ships it (its @icon), with candidate swaps — then each one measured
// and fitted to the same box, so the set reads as one bundle: same visual size, centred both ways.
// Writes norm/<script>.svg and preview.html (128, 48, 28, 16 px on white and black, plus a toolbar strip).
//   node dev/mockups/all_icons/gen.mjs
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '../../../userscripts');
const { chromium } = await import(pathToFileURL(join(dir, '../../../node_modules/@playwright/test/index.mjs')).href);
// candidate icons standing in for a script's own, by folder name (a file path)
const SWAP = {
  falcon: { file: join(dir, '../falcon_icons/icon-r6-08.svg'), note: 'Flat out (falcon round 6, 08)' },
  apollo_editor: { file: join(root, 'falcon/icon.svg'), note: "Falcon's current icon" },
  mammoth: { file: join(root, 'mammoth/icon.svg'), note: 'its icon.svg in place of the 🦣 emoji' },
};
const SKIP = new Set(['discogs_credits']); // frozen, superseded by Credit Hoarder
const toData = f => `data:${extname(f) === '.png' ? 'image/png' : 'image/svg+xml'};base64,${readFileSync(f).toString('base64')}`;

const icons = readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory() && !SKIP.has(d.name)).map(d => {
  const folder = join(root, d.name), js = [join(folder, `${d.name}.user.js`), join(folder, 'dist', `${d.name}.user.js`)].find(existsSync);
  if (!js) return null;
  const head = readFileSync(js, 'utf8').split('// ==/UserScript==')[0];
  const name = (head.match(/@name\s+(.+)/) || [])[1]?.trim() || d.name, icon = (head.match(/@icon\s+(.+)/) || [])[1]?.trim();
  const src = SWAP[d.name] ? toData(SWAP[d.name].file) : icon?.startsWith('data:') ? icon : null;
  return src && { key: d.name, name, src, note: SWAP[d.name]?.note };
}).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));

// Measure each icon's drawn pixels at 512 px: bounding box and how much of it is filled.
const browser = await chromium.launch(), page = await browser.newPage();
const metrics = await page.evaluate(async srcs => Promise.all(srcs.map(src => new Promise(res => {
  const img = new Image(); img.onload = () => { const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); g.drawImage(img, 0, 0, N, N);
    const d = g.getImageData(0, 0, N, N).data; let x0 = N, y0 = N, x1 = -1, y1 = -1, n = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (d[(y * N + x) * 4 + 3] > 24) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    res({ x0, y0, x1, y1, fill: n / ((x1 - x0 + 1) * (y1 - y0 + 1)) }); };
  img.src = src; }))), icons.map(i => i.src));
await browser.close();

// Fit: the longer side of the drawn box fills the icon, less a margin. Solid tiles and discs carry more weight than open
// line shapes, so they get a little more margin (an optical correction, not a pixel one).
mkdirSync(join(dir, 'norm'), { recursive: true });
icons.forEach((ic, i) => { const m = metrics[i], w = m.x1 - m.x0 + 1, h = m.y1 - m.y0 + 1, cx = m.x0 + w / 2, cy = m.y0 + h / 2;
  const margin = m.fill > .85 ? .07 : m.fill > .6 ? .05 : .03, side = Math.max(w, h) / (1 - 2 * margin);
  ic.m = { ...m, margin };
  writeFileSync(join(dir, 'norm', `${ic.key}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(cx - side / 2).toFixed(1)} ${(cy - side / 2).toFixed(1)} ${side.toFixed(1)} ${side.toFixed(1)}" width="128" height="128">\n<title>${ic.name}</title>\n<image href="${ic.src}" width="512" height="512"/>\n</svg>\n`); });

const fig = c => `<figure>${[128, 48, 28, 16].map(z => `<img src="norm/${c.key}.svg" width="${z}" height="${z}" alt="">`).join('')}<figcaption><b>${c.name}</b>${c.note ? `<br><small>${c.note}</small>` : ''}</figcaption></figure>`;
const strip = z => `<div class="strip">${icons.map(c => `<img src="norm/${c.key}.svg" width="${z}" height="${z}" title="${c.name}" alt="">`).join('')}</div>`;
writeFileSync(join(dir, 'preview.html'), `<!doctype html><meta charset="utf-8"><title>All userscript icons</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}small{opacity:.65}
.strip{grid-column:1/-1;display:flex;gap:14px;align-items:center;padding:10px 14px;border-radius:10px;background:rgba(127,127,127,.12)}</style>
<section class="light">${strip(40)}${strip(24)}${icons.map(fig).join('')}</section><section class="dark">${strip(40)}${strip(24)}${icons.map(fig).join('')}</section>\n`);
console.log(icons.map(c => `${c.key.padEnd(26)} fill ${c.m.fill.toFixed(2)} margin ${c.m.margin}`).join('\n'));
