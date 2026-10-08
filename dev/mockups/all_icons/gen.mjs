// Every userscript's icon side by side, as each script ships it (its @icon), with candidate swaps.
// Writes preview.html (128, 48, 28, 16 px on white and black).
//   node dev/mockups/all_icons/gen.mjs
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '../../../userscripts');
// candidate icons standing in for a script's own, by folder name
const SWAP = { falcon: { src: '../falcon_icons/icon-r6-08.svg', note: 'Flat out (falcon round 6, 08)' } };

const cards = readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => {
  const folder = join(root, d.name), js = [join(folder, `${d.name}.user.js`), join(folder, 'dist', `${d.name}.user.js`)].find(existsSync);
  if (!js) return null;
  const head = readFileSync(js, 'utf8').split('// ==/UserScript==')[0];
  const name = (head.match(/@name\s+(.+)/) || [])[1]?.trim() || d.name, icon = (head.match(/@icon\s+(.+)/) || [])[1]?.trim();
  // a remote @icon (only the frozen Discogs Credits has one) is shown from its local copy
  const local = ['icon.svg', 'icon.png'].map(f => join(folder, f)).find(existsSync);
  const src = SWAP[d.name]?.src || (icon && icon.startsWith('data:') ? icon : local && relative(dir, local).replaceAll('\\', '/'));
  return src && { name, src, note: SWAP[d.name]?.note };
}).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));

const fig = c => `<figure>${[128, 48, 28, 16].map(z => `<img src="${c.src}" width="${z}" height="${z}" alt="">`).join('')}<figcaption><b>${c.name}</b>${c.note ? `<br><small>${c.note}</small>` : ''}</figcaption></figure>`;
writeFileSync(join(dir, 'preview.html'), `<!doctype html><meta charset="utf-8"><title>All userscript icons</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}.mb{background:#f5f5f5;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}small{opacity:.65}</style>
<section class="light">${cards.map(fig).join('')}</section><section class="dark">${cards.map(fig).join('')}</section>\n`);
console.log('wrote ' + cards.length);
