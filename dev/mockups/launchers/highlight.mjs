// Corner launchers, #695: ways to show that Apollo Editor or Art Station is ON (the icon is the switch).
// Each variant shows both icons off and on, above Fusion and Falcon for context, on a light and a dark page.
// Writes highlight.html.
//   node dev/mockups/launchers/highlight.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url)), root = join(dir, '../../..');
const uri = s => 'data:image/svg+xml;base64,' + Buffer.from(readFileSync(join(root, 'userscripts', s, 'icon.svg'))).toString('base64');
const ICONS = { as: uri('art_station'), ap: uri('apollo_editor'), fs: uri('fusion'), fa: uri('falcon') };

const V = [
  ['1', 'Green disc + ring', 'today in the branch: Falcon\'s "clean run" look'],
  ['2', 'Ring only', 'a 2px accent ring, no fill'],
  ['3', 'Glow', 'a soft coloured halo around the icon itself'],
  ['4', 'Colour vs grey', 'off is greyscale and dim, on is full colour; nothing added'],
  ['5', 'Status dot', 'a small green dot at the lower right, like a presence badge'],
  ['6', 'Bar under', 'a short accent bar under the icon, like an active tab'],
  ['7', 'Tinted disc', 'a pale accent disc behind the icon, no ring'],
  ['8', 'Check badge', 'a small ✓ in a green circle at the upper right'],
];

const btn = (k, v, on, label) => `<div class="cell"><button class="l v${v}${on ? ' on' : ''}" title="${label}"><img src="${ICONS[k]}" alt=""></button></div>`;
const plain = k => `<div class="cell"><button class="l"><img src="${ICONS[k]}" alt=""></button></div>`;
const fig = ([v, name, note]) => `<figure>
  <figcaption><b>${v} · ${name}</b><span>${note}</span></figcaption>
  <div class="grid">
    <div class="h">off</div><div class="h">on</div>
    ${plain('fs')}${plain('fs')}
    ${btn('as', v, false, 'Art Station off')}${btn('as', v, true, 'Art Station on')}
    ${btn('ap', v, false, 'Apollo off')}${btn('ap', v, true, 'Apollo on')}
    ${plain('fa')}${plain('fa')}
  </div>
</figure>`;
const sec = cls => `<section class="${cls}">${V.map(fig).join('')}</section>`;

writeFileSync(join(dir, 'highlight.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Launcher highlight</title>
<style>
body{margin:0;font:13px system-ui,sans-serif}
section{display:flex;flex-wrap:wrap;gap:22px;padding:22px 26px}
.light{background:#fff;color:#222;--bg:#fff;--accent:#5b3fc4;--ok:#1f9d6b;--soft:#e9e3fb}
.dark{background:#2b2b2b;color:#ddd;--bg:#1e1e24;--accent:#b9a8ec;--ok:#3fbf8a;--soft:#3b3550}
figure{margin:0;width:200px;display:flex;flex-direction:column;gap:10px}
figcaption{display:flex;flex-direction:column;gap:2px;min-height:44px}figcaption span{opacity:.7;font-size:12px}
.grid{display:grid;grid-template-columns:60px 60px;gap:10px 0;justify-items:center}
.h{font-size:11px;opacity:.6;text-transform:uppercase;letter-spacing:.05em}
.cell{width:48px;height:48px;display:flex;align-items:center;justify-content:center}
.l{position:relative;width:40px;height:40px;border-radius:50%;border:none;padding:0;display:flex;align-items:center;justify-content:center;background:transparent;cursor:pointer;opacity:.85;transition:transform .1s,opacity .15s,filter .15s}
.l:hover{opacity:1;transform:scale(1.08)}
.l img{width:34px;height:34px;display:block;pointer-events:none}
.l.on{opacity:1}
/* 1 green disc + ring (Falcon's done state) */
.v1.on{background:#1f9d6b;box-shadow:0 0 0 2px #9bd3b6,0 2px 10px rgba(31,157,107,.45)}
/* 2 ring only */
.v2.on{box-shadow:0 0 0 2px var(--accent)}
/* 3 glow */
.v3.on img{filter:drop-shadow(0 0 4px var(--accent)) drop-shadow(0 0 8px color-mix(in srgb,var(--accent) 60%,transparent))}
/* 4 colour vs grey */
.v4:not(.on) img{filter:grayscale(1);opacity:.55}
/* 5 status dot */
.v5.on::after{content:"";position:absolute;right:1px;bottom:1px;width:11px;height:11px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 2px var(--bg)}
/* 6 bar under */
.v6.on::after{content:"";position:absolute;left:10px;right:10px;bottom:-5px;height:3px;border-radius:2px;background:var(--accent)}
/* 7 tinted disc */
.v7.on{background:var(--soft)}
/* 8 check badge */
.v8.on::after{content:"✓";position:absolute;right:-2px;top:-2px;width:14px;height:14px;border-radius:50%;background:var(--ok);color:#fff;font:bold 10px/14px system-ui;text-align:center;box-shadow:0 0 0 2px var(--bg)}
@media (max-width:520px){section{padding:16px;justify-content:center}}
</style>
${sec('light')}
${sec('dark')}
`);
console.log('wrote highlight.html');
