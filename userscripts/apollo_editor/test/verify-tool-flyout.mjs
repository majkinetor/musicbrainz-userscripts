// Collapsed-tool flyouts (#280) — majkinetor, on the #615 Merge/Split tools collapsed to their
// icons: the flyout was only as wide as the icon, so every label wrapped a word per line
// ("into / first / ticked:", "new / medium / from #"), and a flyout held open by a focused
// checkbox overlapped the next tool's flyout.
//
// test.musicbrainz.org release editor (a 3+ medium sandbox release), nothing submitted:
// collapse both tools, hover each → its flyout is ONE line; tick a Merge checkbox (it keeps
// focus), hover Split → only Split's flyout shows. APOLLO_SRC=<old build> to compare.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.APOLLO_SRC || resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const REL = process.argv[2] || 'c16af706-4926-4248-80c5-5faee767d579';   // sandbox, 4 media (from the #615 e2e)
// ICON_ONLY=1 → both tools on the bar as icon-only, collapsed (the reported look); default: icon + title
const ICON_ONLY = !!process.env.ICON_ONLY;
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
await ctx.addInitScript((iconOnly) => { const s = new Map(); if (iconOnly) s.set('apolloEditor.settings.v1', JSON.stringify({ toolCfg: [{ act: 'mergemed', onBar: true, icon: true, text: false, hideParams: true }, { act: 'splitmed', onBar: true, icon: true, text: false, hideParams: true }] })); window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d; window.GM_setValue = (k, v) => s.set(k, v); window.GM_info = { script: { name: 'Apollo Editor', version: 't' } }; }, ICON_ONLY);
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://test.musicbrainz.org/release/${REL}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => window.MB && MB.releaseEditor && MB.releaseEditor.rootField && MB.releaseEditor.rootField.release(), null, { timeout: 60000 });
await page.waitForTimeout(2000);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => window.__apolloEditor, null, { timeout: 20000 });
await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => x.textContent.trim() === 'Tracklist'); if (a) a.click(); });
await page.waitForSelector('.tc-tools', { timeout: 30000 });
await page.waitForTimeout(1500);
for (const act of ['mergemed', 'splitmed']) {
  if (!ICON_ONLY) await page.evaluate(a => window.__apolloEditor.pickTool(a), act);
  await page.waitForSelector(`.tc-opt[data-tool="${act}"] .tc-opttrig`, { timeout: 15000 });
  // right-click the name → collapse its params to a hover flyout (already collapsed when seeded icon-only)
  if (!ICON_ONLY) await page.click(`.tc-opt[data-tool="${act}"] .tc-opttrig`, { button: 'right' });
  await page.waitForTimeout(300);
}
console.log(ICON_ONLY ? 'mode: icon-only' : 'mode: icon + title');
const flyout = act => page.evaluate(a => {
  const g = document.querySelector(`.tc-opt[data-tool="${a}"]`), f = g && [...g.children].find(c => !c.classList.contains('tc-optname'));
  if (!f) return null;
  const cs = getComputedStyle(f), r = f.getBoundingClientRect();
  const lab = f.querySelector('.tc-mmo-lab');
  return { shown: cs.display !== 'none', w: Math.round(r.width), h: Math.round(r.height), labelH: lab ? Math.round(lab.getBoundingClientRect().height) : null, collapsed: g.classList.contains('tc-collapsed'), rect: { x: r.x, y: r.y, width: r.width, height: r.height } };
}, act);
const shots = [];
for (const act of ['mergemed', 'splitmed']) {
  await page.mouse.move(0, 0); await page.waitForTimeout(150);
  await page.hover(`.tc-opt[data-tool="${act}"] .tc-opttrig`); await page.waitForTimeout(300);
  const f = await flyout(act);
  console.log(act, JSON.stringify(f));
  ck(f && f.collapsed && f.shown, `${act}: collapsed, flyout shows on hover`);
  ck(f && f.labelH != null && f.labelH < 26, `${act}: its label is on ONE line (label height ${f && f.labelH}px)`);
  ck(f && f.h < 48, `${act}: the whole flyout is one row (height ${f && f.h}px)`);
  const shot = join(tmpdir(), `flyout-${act}${ICON_ONLY ? '-icon' : ''}.png`);
  await page.screenshot({ path: shot, clip: { x: Math.max(0, f.rect.x - 60), y: Math.max(0, f.rect.y - 60), width: Math.min(900, f.rect.width + 140), height: f.rect.height + 90 } });
  shots.push(shot);
}
// tick a Merge checkbox (it keeps focus), then hover Split
await page.hover('.tc-opt[data-tool="mergemed"] .tc-opttrig'); await page.waitForTimeout(250);
await page.click('.tc-opt[data-tool="mergemed"] .tc-mmo input[type=checkbox]');
await page.hover('.tc-opt[data-tool="splitmed"] .tc-opttrig'); await page.waitForTimeout(300);
const m = await flyout('mergemed'), sp = await flyout('splitmed');
console.log('after ticking merge, hovering split:', JSON.stringify({ merge: m.shown, split: sp.shown }));
ck(sp.shown && !m.shown, 'hovering Split hides the Merge flyout that focus kept open — no overlap');
console.log('screenshots:', shots.join(' , '));
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
