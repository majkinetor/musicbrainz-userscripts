// #149: with multiple collapsed mediums, Apollo must render ALL of them (each
// with an expand control) and let the user expand any/all on demand — previously
// only the first loaded medium showed. Native load buttons are hidden.
//
// Example release (4 collapsed mediums): 60e810ef-7ef1-4e90-8482-ab4653802786
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '60e810ef-7ef1-4e90-8482-ab4653802786';
const HEADED = process.argv.includes('--headed');
const OUT = resolve(HERE, 'logs', 'shots'); await (await import('node:fs/promises')).mkdir(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: !HEADED, viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length > 0; } catch { return false; } }, null, { timeout: 60000 });
await page.addScriptTag({ content: await readFile(SCRIPT, 'utf8') });
await page.waitForTimeout(1000);
await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#recordings"]'); if (a) a.click(); });
await page.waitForTimeout(800);
await page.evaluate(() => { try { window.__apolloEditor.showRecMirror(); } catch (e) {} });
await page.waitForSelector('#tc-recwrap .tc-rectbl', { timeout: 30000 });

const mediums = await page.evaluate(() => window.MB.releaseEditor.rootField.release().mediums().length);
const collapsedInit = await page.evaluate(() => ({
  collapsedRows: document.querySelectorAll('#tc-recwrap tr.tc-recmed-coll').length,
  expandBtns: document.querySelectorAll('#tc-recwrap .tc-recmed-exp').length,
  trackRows: document.querySelectorAll('#tc-recwrap tr.tc-recrow').length,
  nativeLoadBtnsVisible: [...document.querySelectorAll('#recordings button[data-click="loadTracks"]')].some(b => b.offsetParent !== null),
}));
await page.locator('#tc-recwrap').screenshot({ path: resolve(OUT, 'i149-collapsed.png') }).catch(() => {});

// Expand medium 0
await page.evaluate(() => document.querySelector('#tc-recwrap tr.tc-recmed-coll[data-mi="0"] .tc-recmed-exp').click());
await page.waitForFunction(() => document.querySelectorAll('#tc-recwrap tr.tc-recrow[data-mi="0"]').length > 0, null, { timeout: 30000 }).catch(() => {});
const afterFirst = await page.evaluate(() => ({
  m0rows: document.querySelectorAll('#tc-recwrap tr.tc-recrow[data-mi="0"]').length,
  stillCollapsed: document.querySelectorAll('#tc-recwrap tr.tc-recmed-coll').length,
}));

// Expand a SECOND medium (the bug: only the first expanded)
const secondMi = await page.evaluate(() => { const r = document.querySelector('#tc-recwrap tr.tc-recmed-coll'); return r ? +r.dataset.mi : -1; });
if (secondMi >= 0) {
  await page.evaluate((mi) => document.querySelector(`#tc-recwrap tr.tc-recmed-coll[data-mi="${mi}"] .tc-recmed-exp`).click(), secondMi);
  await page.waitForFunction((mi) => document.querySelectorAll(`#tc-recwrap tr.tc-recrow[data-mi="${mi}"]`).length > 0, secondMi, { timeout: 30000 }).catch(() => {});
}
const afterSecond = await page.evaluate((mi) => ({
  secondMi: mi,
  secondRows: mi >= 0 ? document.querySelectorAll(`#tc-recwrap tr.tc-recrow[data-mi="${mi}"]`).length : 0,
  totalTrackRows: document.querySelectorAll('#tc-recwrap tr.tc-recrow').length,
  distinctMediaWithRows: new Set([...document.querySelectorAll('#tc-recwrap tr.tc-recrow')].map(r => r.dataset.mi)).size,
}), secondMi);
await page.locator('#tc-recwrap').screenshot({ path: resolve(OUT, 'i149-expanded.png') }).catch(() => {});

console.log(JSON.stringify({ mediums, collapsedInit, afterFirst, afterSecond }, null, 2));
const pass = mediums >= 2 &&
             collapsedInit.collapsedRows === mediums && collapsedInit.expandBtns === mediums &&
             collapsedInit.trackRows === 0 && collapsedInit.nativeLoadBtnsVisible === false &&
             afterFirst.m0rows > 0 && afterSecond.secondRows > 0 && afterSecond.distinctMediaWithRows >= 2;
console.log(pass ? 'PASS' : 'FAIL');
if (!HEADED) await ctx.close();
process.exit(pass ? 0 : 1);
