// Probe #245: the edit-note box must not grow without bound. The #229 floor
// (ta.minHeight = side.offsetHeight) fed back through align-items:stretch, so the
// panel and field kept inflating each other. Sample the heights over time — they
// must converge, not keep climbing.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'mammoth.user.js');
const log = (...a) => console.log('[probe-runaway]', ...a);

const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext('', { headless: true, viewport: { width: 1200, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
await page.addInitScript(() => {
  window.__gm = {};
  window.GM_getValue = (k, d) => (k in window.__gm ? window.__gm[k] : d);
  window.GM_setValue = (k, v) => { window.__gm[k] = v; };
  // a few saved notes so the sidebar has real content height
  window.__gm['mammoth:data'] = JSON.stringify({ history: ['note one', 'note two', 'note three'], saved: [] });
});
await page.goto('about:blank');
await page.setContent('<!doctype html><html><body><form><fieldset class="editnote"><div class="row"><label for="en">Edit note:</label><textarea id="en" class="edit-note" rows="3" cols="80"></textarea></div></fieldset></form></body></html>');
await page.addScriptTag({ content: code });
await page.waitForSelector('.mmth-side', { timeout: 10000 });

const sample = () => page.evaluate(() => {
  const ta = document.querySelector('textarea.edit-note'); const side = document.querySelector('.mmth-side');
  return { taMinH: parseInt(ta.style.minHeight, 10) || 0, taH: ta.offsetHeight, sideH: side.offsetHeight };
});

const series = [];
for (let i = 0; i < 6; i++) { await page.waitForTimeout(250); series.push(await sample()); }
series.forEach((s, i) => log(`t=${(i + 1) * 250}ms`, JSON.stringify(s)));

const first = series[0], last = series[series.length - 1];
const grew = last.taH - first.taH;
let fail = 0;
const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(last.taH >= last.sideH - 1, 'textarea is at least as tall as the sidebar');
check(grew <= 4, `field height is stable over time (grew ${grew}px across 1.25s — must be ~0)`);
check(last.taH < 1200, `field height stays sane (${last.taH}px, not runaway)`);
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
