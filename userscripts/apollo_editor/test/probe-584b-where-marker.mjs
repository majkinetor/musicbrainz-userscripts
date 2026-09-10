// #584 follow-up ("also show in recording table") — where does the video marker
// actually render today? Installs Apollo on the release with three video
// recordings and screenshots the Tracklist and Recordings tabs. Read-only.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.AE_SRC || resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const MBID = process.env.MBID || '55530bc0-97ec-4256-97fc-e6058958c251';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Apollo Editor', version: 't' } };
  window.GM_xmlhttpRequest = () => {};
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route(/\/ws\/js\/edit\/|\/relationship-editor|\/edit\/create/i, r => r.abort());
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(5000);
await page.addScriptTag({ content: code });
await page.waitForTimeout(3000);

const clickTab = async name => {
  // Apollo replaces MB's step tabs with its own compact nav pills (#tc-nav-bar)
  await page.evaluate(n => {
    const all = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a, .tabs a, ul.tabs li a')];
    const a = all.find(x => x.textContent.trim().toLowerCase().startsWith(n));
    if (a) a.click();
  }, name);
  await page.waitForTimeout(4000);
};

await clickTab('tracklist');
await page.screenshot({ path: resolve(HERE, 'logs', 'i584-tracklist.png'), fullPage: false });
const tl = await page.evaluate(() => ({
  mirror: !!document.querySelector('.tc-mirror'),
  videoMarks: document.querySelectorAll('.tc-mirror .tc-rec-video').length,
  dtButtons: document.querySelectorAll('.tc-mirror .tc-dtmv').length,
}));
console.log('TRACKLIST:', JSON.stringify(tl));

await clickTab('recordings');
await page.screenshot({ path: resolve(HERE, 'logs', 'i584-recordings.png'), fullPage: false });
const rec = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#tc-recwrap tbody tr.tc-recrow')];
  return {
    wrap: !!document.getElementById('tc-recwrap'),
    rows: rows.length,
    videoMarks: document.querySelectorAll('#tc-recwrap .tc-rec-video').length,
    leadMarks: document.querySelectorAll('#tc-recwrap .tc-rec-video.lead').length,
    selCells: document.querySelectorAll('#tc-recwrap .tc-recselcell').length,
    sample: rows.slice(10, 13).map(r => r.querySelector('.tc-recname')?.innerHTML.slice(0, 180)),
  };
});
console.log('RECORDINGS:', JSON.stringify(rec, null, 1));
console.log('page errors:', errs.slice(0, 3));
await ctx.close();
