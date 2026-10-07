// Round 6 (#680): platform icons at one visual size. Each mark fills its viewBox differently
// (Discogs is inset to 86%, Tidal is short and wide, Apple is tall), so the same 18px box shows
// them at widely different sizes. The page measures each mark's ink (getBBox) and redraws it
// cropped to that ink: once with the same longest side, once with the same area.
//   node dev/mockups/mission_control/round6/build.mjs   (writes icon-sizes.html; icon-sizes.png via Playwright)
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLATFORM_ICONS } from '../../../ui/platform-icons.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CH = ['discogs', 'tidal', 'qobuz', 'deezer', 'apple', 'ytmusic'];
const ALL = Object.keys(PLATFORM_ICONS);
const svg = k => PLATFORM_ICONS[k].svg.replace(/<svg\b([^>]*)>/, (m, a) => '<svg' + a.replace(/\s(?:width|height)="[^"]*"/g, '') + (/xmlns=/.test(a) ? '' : ' xmlns="http://www.w3.org/2000/svg"') + ' width="18" height="18">');
const row = (keys, mode, all) => `<div class="row${all ? ' all' : ''}">` + keys.map(k => `<span class="b" data-mode="${mode}" title="${k}">${svg(k)}</span>`).join('') + (all ? '' : '<span class="b all-btn"><b>⚛</b>All</span>') + '</div>';
const block = (keys, all) => [
    ['now', 'Today', 'stIcon(k, 18): every viewBox at 18px, whatever the mark fills of it'],
    ['side', 'Same longest side', 'cropped to the ink; the longer side is 18px'],
    ['area', 'Same area', 'cropped to the ink; every mark covers the area of a 16px square, longest side capped at 22px'],
].map(([m, t, d]) => `<section><h3>${t}</h3><p>${d}</p>${row(keys, m, all)}</section>`).join('');

const html = `<!doctype html><meta charset="utf-8"><title>Icon sizes</title>
<style>
:root{--bg:#fff;--fg:#222;--dim:#777;--bd:#d6cfe6;--warn:#b5651d}
@media (prefers-color-scheme:dark){:root{--bg:#1d1d22;--fg:#eee;--dim:#999;--bd:#444;--warn:#e8771d}}
body{background:var(--bg);color:var(--fg);font:14px system-ui,sans-serif;margin:24px;max-width:1100px}
h2{margin:28px 0 4px}h3{margin:18px 0 2px;font-size:14px}p{margin:0 0 8px;color:var(--dim);font-size:12.5px}
.row{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
.b{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:1px solid var(--bd);border-radius:5px;box-sizing:border-box}
.row.all .b{width:40px;height:40px}
.all-btn{width:auto!important;padding:0 10px;gap:5px;margin-left:6px;border-color:var(--warn);color:var(--warn);font-weight:600}
.all-btn b{font-size:16px;font-weight:400}
.grid .b svg{outline:1px dashed #f0f3}
label{font-size:12.5px;color:var(--dim)}
</style>
<h1 style="font-size:18px">Platform icons at one visual size</h1>
<label><input type="checkbox" onchange="document.body.classList.toggle('grid',this.checked)"> show each icon's box</label>
<h2>Credit Hoarder's sources</h2>${block(CH)}
<h2>Every platform icon</h2>${block(ALL, true)}
<script>
document.querySelectorAll('.b[data-mode]').forEach(b => {
  const s = b.querySelector('svg'), m = b.dataset.mode; if (m === 'now') return;
  const r = s.getBBox(); if (!r.width || !r.height) return;
  s.setAttribute('viewBox', [r.x, r.y, r.width, r.height].join(' '));
  let w, h;
  if (m === 'side') { const k = 18 / Math.max(r.width, r.height); w = r.width * k; h = r.height * k; }
  else { const k = 16 / Math.sqrt(r.width * r.height); w = r.width * k; h = r.height * k; const c = Math.min(1, 22 / Math.max(w, h)); w *= c; h *= c; }
  s.setAttribute('width', w.toFixed(1)); s.setAttribute('height', h.toFixed(1));
});
</script>`;
writeFileSync(resolve(HERE, 'icon-sizes.html'), html);
console.log('wrote icon-sizes.html');
