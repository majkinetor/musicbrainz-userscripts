// Every userscript's icon side by side, as each script ships it (its @icon), with candidate swaps — then each one measured
// and fitted to the same box, so the set reads as one bundle: same visual size, centred both ways.
// Writes norm/<script>.svg and preview.html, a single file: 128, 48, 28, 16 px on white and black, toolbar strips, every animation.
//   node dev/all-icons-generator/gen.mjs
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '../../userscripts');
const { chromium } = await import(pathToFileURL(join(dir, '../../node_modules/@playwright/test/index.mjs')).href);
// candidate icons standing in for a script's own, by folder name (a file path)
const SWAP = {
  mammoth: { file: join(root, 'mammoth/icon.svg'), note: 'its icon.svg in place of the emoji' },
};
const SKIP = new Set(['discogs_credits', 'bandcamp_player_enhanced']); // discogs_credits is frozen (Credit Hoarder replaced it); Bandcamp Player Enhanced is left out of the set
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
// line shapes, so they get a little more margin (an optical correction, not a pixel one) — but only when roughly square:
// a wide or tall icon already looks smaller, its short side well short of the box, so it gets the least margin.
mkdirSync(join(dir, 'norm'), { recursive: true });
icons.forEach((ic, i) => { const m = metrics[i], w = m.x1 - m.x0 + 1, h = m.y1 - m.y0 + 1, cx = m.x0 + w / 2, cy = m.y0 + h / 2;
  const square = Math.min(w, h) / Math.max(w, h) > .8, margin = !square ? .02 : m.fill > .85 ? .07 : m.fill > .6 ? .05 : .03, side = Math.max(w, h) / (1 - 2 * margin);
  ic.m = { ...m, margin };
  writeFileSync(join(dir, 'norm', `${ic.key}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(cx - side / 2).toFixed(1)} ${(cy - side / 2).toFixed(1)} ${side.toFixed(1)} ${side.toFixed(1)}" width="128" height="128">\n<title>${ic.name}</title>\n<image href="${ic.src}" width="512" height="512"/>\n</svg>\n`); });

// Animations: the folded dock live, the busy icons beside the icon they replace, and every animation the scripts play,
// each on that script's own element and CSS (demos.mjs), in a frame of its own so no script's rules meet another's.
const { UI_JS, UI_CSS } = await import(pathToFileURL(join(dir, '../ui/ui-components.mjs')).href);
const { tokensCss } = await import(pathToFileURL(join(dir, '../tokens/design-tokens.mjs')).href);
const TOK = tokensCss();
const srcOf = key => { const f = join(root, key), js = [join(f, `${key}.user.js`), join(f, 'dist', `${key}.user.js`)].find(existsSync); return js ? readFileSync(js, 'utf8') : ''; };
const { cssOf } = await import(pathToFileURL(join(dir, 'css-of.mjs')).href);
const { demos } = await import(pathToFileURL(join(dir, 'demos.mjs')).href);
const iconOf = k => (icons.find(c => c.key === k) || {}).src || '';
const EHV = cssOf(srcOf('event_horizon'), s => /^:root(\[data-eh-theme=dark\])?$/.test(s));
const DEMOS = demos(srcOf, iconOf).map(d => {
  const src = srcOf(d.key), name = (icons.find(c => c.key === d.key) || {}).name || d.key;
  let css = cssOf(src, s => !s.startsWith('@') && !s.includes(':where(') && d.want(s));
  const names = [...(css + (d.extra || '') + d.html).matchAll(/animation(?:-name)?\s*:\s*([^;}"]+)/g)].flatMap(m => m[1].split(/[\s,]+/));
  css += '\n' + cssOf(src, () => false, names) + '\n' + (d.extra || '') + (d.eh ? '\n' + EHV : '');
  if (!/@keyframes/.test(css)) console.warn(`demo "${d.label}": no @keyframes found`);
  const again = d.again ? `<script>setInterval(function(){document.querySelectorAll(${JSON.stringify(d.again[0])}).forEach(function(e){e.classList.remove(${JSON.stringify(d.again[1])});void e.offsetWidth;e.classList.add(${JSON.stringify(d.again[1])})})},2600)</script>` : '';
  return { label: d.label, name, css, html: d.html + again, root: d.root || '', body: d.body || '', eh: !!d.eh };
});
console.log(DEMOS.map(d => `${(d.name + ' · ' + d.label).padEnd(48)} css ${d.css.length}`).join('\n'));
// busy icons: shown in place of the icon while a dock entry works with nothing counted yet
const busy = icons.map(ic => { const m = srcOf(ic.key).match(/(?:busyIcon\s*:|BUSY_URI\s*=)\s*'(data:[^']+)'/); return m && { ...ic, busy: m[1] }; }).filter(Boolean);
const bfig = c => `<figure>${[48, 28].map(z => `<img data-i="${c.key}" width="${z}" height="${z}" alt="">`).join('')}<span class="arrow">→</span>${[48, 28].map(z => `<img src="${c.busy}" width="${z}" height="${z}" alt="">`).join('')}<figcaption><b>${c.name}</b><br><small>busy icon</small></figcaption></figure>`;
// the folded dock, live: entries peek out (a count, or actionable) and slide back; busy runs the dash, the dots or the busy icon
const DOCK = ['isrc_scout', 'fuzzy_logic', 'platform_check', 'fusion'].filter(k => icons.some(c => c.key === k));
const dockDoc = dark => `<!doctype html><html data-mbu-st data-mbu-dock${dark ? ' data-mbu-theme="dark"' : ''}><meta charset="utf-8"><style>${TOK}${UI_CSS}html,body{margin:0;height:100%;background:${dark ? '#000' : '#fff'}}</style><body><script>${UI_JS}
var I = ${JSON.stringify(Object.fromEntries(DOCK.map(k => [k, icons.find(c => c.key === k).src])))}, B = ${JSON.stringify(Object.fromEntries(busy.map(c => [c.key, c.busy])))};
var e = ${JSON.stringify(DOCK)}.map(function (k, n) { return mbuDockItem({ id: 'demo-' + k, label: k, icon: I[k], busyIcon: B[k], order: 50 + n }); });
var steps = [function () { e[0].status('3'); }, function () { e[1].busy(true); }, function () { e[3].setAttribute('data-mbu-actionable', ''); e[3].busy(true); },
  function () { e[0].status(''); }, function () { e[2].status('12'); e[1].busy(false); }, function () { e[3].removeAttribute('data-mbu-actionable'); e[3].busy(false); },
  function () { e[2].status(''); }], s = 0;
setInterval(function () { steps[s++ % steps.length](); }, 1800);
<\/script>`;
const live = dark => `<figure class="live"><iframe srcdoc="${dockDoc(dark).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe><figcaption><b>Folded dock</b><br><small>entries peek out and slide back (a count, or actionable); busy runs the dash, the dots or the busy icon</small></figcaption></figure>`;
const dfig = (d, i) => `<figure class="demo"><iframe data-demo="${i}" title="${d.label}"></iframe><figcaption><b>${d.label}</b><br><small>${d.name}</small></figcaption></figure>`;
const animSection = dark => `<h2>Animations</h2>${live(dark)}${busy.map(bfig).join('')}${DEMOS.map(dfig).join('')}`;
// fills each demo frame at load: one copy of the shared CSS in the page, not one per frame
const DEMO_JS = `<script>(function(){var BASE=${JSON.stringify(TOK + UI_CSS).replace(/</g, '\\u003c')},D=${JSON.stringify(DEMOS).replace(/</g, '\\u003c')};
document.querySelectorAll('iframe[data-demo]').forEach(function(f){var d=D[f.dataset.demo],dark=!!f.closest('.dark');
f.srcdoc='<!doctype html><html data-mbu-st'+(dark?' data-mbu-theme="dark" data-eh-theme="dark"':'')+d.root+'><meta charset="utf-8"><style>'+BASE+d.css+'\\nhtml,body{margin:0;height:100%}body{background:'+(dark?'#000':'#fff')+';color:'+(dark?'#ddd':'#222')+';display:flex;align-items:center;justify-content:center;gap:10px;font:13px system-ui,sans-serif}</style><body class="'+d.body+'">'+d.html;});})();</script>`;
const ANIM_CSS = `h2{grid-column:1/-1;margin:14px 0 0;font-size:15px}.arrow{opacity:.5;align-self:end;margin-bottom:14px}
.live{grid-column:span 2}.live iframe{width:100%;height:240px;border:1px solid rgba(127,127,127,.3);border-radius:10px}
.demo iframe{width:100%;height:96px;border:1px solid rgba(127,127,127,.3);border-radius:10px}`;
// the fitted icons ride in the page, once each, so preview.html is a single file that opens anywhere
const NORM_JS = `<script>(function(){var I=${JSON.stringify(Object.fromEntries(icons.map(c => [c.key, 'data:image/svg+xml;base64,' + readFileSync(join(dir, 'norm', `${c.key}.svg`)).toString('base64')])))};
document.querySelectorAll('img[data-i]').forEach(function(e){e.src=I[e.dataset.i]})})()</script>`;
const fig = c => `<figure>${[128, 48, 28, 16].map(z => `<img data-i="${c.key}" width="${z}" height="${z}" alt="">`).join('')}<figcaption><b>${c.name}</b>${c.note ? `<br><small>${c.note}</small>` : ''}</figcaption></figure>`;
const strip = z => `<div class="strip">${icons.map(c => `<img data-i="${c.key}" width="${z}" height="${z}" title="${c.name}" alt="">`).join('')}</div>`;
writeFileSync(join(dir, 'preview.html'), `<!doctype html><meta charset="utf-8"><title>All userscript icons</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{padding:18px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px}.dark{background:#000;color:#ddd}.light{background:#fff;color:#222}figure{margin:0;display:flex;align-items:end;gap:8px;flex-wrap:wrap}figcaption{width:100%}small{opacity:.65}
.strip{grid-column:1/-1;display:flex;gap:14px;align-items:center;padding:10px 14px;border-radius:10px;background:rgba(127,127,127,.12)}
${ANIM_CSS}</style>
<section class="light">${strip(40)}${strip(24)}${icons.map(fig).join('')}${animSection(false)}</section><section class="dark">${strip(40)}${strip(24)}${icons.map(fig).join('')}${animSection(true)}</section>${NORM_JS}${DEMO_JS}\n`);
console.log(icons.map(c => `${c.key.padEnd(26)} fill ${c.m.fill.toFixed(2)} margin ${c.m.margin}`).join('\n'));
