// Round 8 (#680): larger provider icons in the cards' headers. Today the icon is 16 px in a 22 px
// tile; the variants try bigger tiles and icons, with and without the tile.
//   node dev/mockups/mission_control/round8/build.mjs   → header-icons.html
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(HERE, '../../../../userscripts/mission_control/mission_control.user.js'), 'utf8');
const ICON = JSON.parse(src.match(/const PROVIDER_ICONS = (\{[\s\S]*?\n\});/)[1].replace(/,\s*\}$/, '}'));
const tokens = src.match(/^const MBU_TOKENS = '(.*)';$/m)[1].replace(/\\'/g, "'");
const V = [
  ['Today', 'Icon 16 px in a 22 px tile.', 22, 16, true],
  ['A · 28 / 22', 'Tile 28, icon 22.', 28, 22, true],
  ['B · 32 / 26', 'Tile 32, icon 26: as tall as the title line and the state word together.', 32, 26, true],
  ['C · 28, no tile', 'Icon 28 on its own; the header tint shows round it. The off state greys the icon alone.', 28, 28, false],
  ['D · 36, no tile', 'Icon 36 on its own, the header a little taller.', 36, 36, false],
];
const head = (id, t, state, cls, tile, img, bg) => `<div class="h ${cls}"><span class="ic" style="width:${tile}px;height:${tile}px;${bg ? '' : 'background:none;'}"><img src="${ICON[id]}" style="width:${img}px;height:${img}px"></span><b>${t}</b><span class="st">${state}</span></div>`;
const row = ([name, note, tile, img, bg]) => `<h2>${name}</h2><p>${note}</p><div class="row"><div class="card">${head('pc', 'Release and entity links', 'OK', 'ok', tile, img, bg)}<div class="body"></div></div><div class="card">${head('as', 'Cover art', 'ADD', 'add', tile, img, bg)}<div class="body add"></div></div></div>
<div class="row small"><div class="card">${head('is', 'ISRCs', 'ADD', 'add', tile, img, bg)}</div><div class="card">${head('fusion', 'Merge suggestions', 'OK', 'ok', tile, img, bg)}</div><div class="card">${head('ch', 'Credits', 'INFO', 'idle', tile, img, bg)}</div></div>`;
writeFileSync(resolve(HERE, 'header-icons.html'), `<!doctype html><html><head><meta charset="utf-8"><title>MC header icons — round 8</title><style>${tokens}
body{margin:0;padding:22px 26px;font:14px -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:var(--mbu-text);background:#f5f4f9}
h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:20px 0 2px}p{margin:0 0 8px;color:#666;font-size:12.5px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:16px;width:1300px}.row.small{grid-template-columns:repeat(3,1fr);margin-top:10px}
.card{background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:10px;overflow:hidden}
.h{display:flex;align-items:center;gap:10px;padding:7px 12px;border-bottom:1px solid var(--mbu-divider)}
.h.ok{background:var(--mbu-ok-bg)}.h.add{background:var(--mbu-accent-soft)}.h.idle{background:var(--mbu-bg-raised)}
.ic{border-radius:7px;background:var(--mbu-accent-soft);display:grid;place-items:center;flex:none}.ic img{object-fit:contain;display:block}
.h b{font-size:12.5px}.st{font-size:11px;font-weight:700;letter-spacing:.4px}.ok .st{color:var(--mbu-ok)}.add .st{color:var(--mbu-accent-text)}.idle .st{color:var(--mbu-text-weak)}
.body{height:18px}.body.add{box-shadow:inset 3px 0 0 var(--mbu-accent)}
</style></head><body><h1>Mission Control: larger icons in the card headers, round 8</h1><p>#680. The provider's icon at the left of each card's header (it's also the card's on/off switch).</p>
${V.map(row).join('\n')}</body></html>`);
