// Round 6 (#680): the real MC dashboard (CH's Release credits + a stand-in PC with many platforms),
// snapshotted by a throwaway spec into dash.parts.json, with a switch that redraws every platform
// icon cropped to its ink: Today · Same longest side · Same area.
//   node dev/mockups/mission_control/round6/build-dash.mjs   (writes dash.html)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { css, root } = JSON.parse(readFileSync(resolve(HERE, 'dash.parts.json'), 'utf8'));
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Icon sizes in MC</title>
<style>${css}</style>
<style>
body{margin:0;background:#f4f4f6;font-family:system-ui,sans-serif}
#mock-bar{position:fixed;z-index:2147483647;left:50%;bottom:16px;transform:translateX(-50%);display:flex;gap:4px;padding:5px;background:#222;border-radius:10px;box-shadow:0 4px 18px #0005}
#mock-bar button{border:0;border-radius:7px;padding:7px 14px;font:600 13px system-ui;background:none;color:#ccc;cursor:pointer}
#mock-bar button.on{background:#7c5cff;color:#fff}
</style>
${root}
<div id="mock-bar"><button data-m="now" class="on">Today</button><button data-m="side">Same longest side</button><button data-m="area">Same area</button></div>
<script>
// each icon keeps its slot's size; only how much of the slot the mark fills changes
const icons = [...document.querySelectorAll('svg[data-pi]')];
icons.forEach(s => s._o = { vb: s.getAttribute('viewBox'), w: +s.getAttribute('width') || 16 });
function apply(m) {
  icons.forEach(s => {
    const o = s._o; s.setAttribute('viewBox', o.vb); s.setAttribute('width', o.w); s.setAttribute('height', o.w);
    if (m === 'now') return;
    const r = s.getBBox(); if (!r.width || !r.height) return;
    s.setAttribute('viewBox', [r.x, r.y, r.width, r.height].join(' '));
    let k = m === 'side' ? o.w / Math.max(r.width, r.height) : o.w * 0.88 / Math.sqrt(r.width * r.height);
    k = Math.min(k, o.w * 1.2 / Math.max(r.width, r.height));
    s.setAttribute('width', (r.width * k).toFixed(1)); s.setAttribute('height', (r.height * k).toFixed(1));
  });
  document.querySelectorAll('#mock-bar button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
}
document.getElementById('mock-bar').onclick = e => { const m = e.target.dataset && e.target.dataset.m; if (m) apply(m); };
</script>`;
writeFileSync(resolve(HERE, 'dash.html'), html);
console.log('wrote dash.html');
