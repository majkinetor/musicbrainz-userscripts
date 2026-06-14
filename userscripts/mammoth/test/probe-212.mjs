import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'mammoth.user.js');
const O = 'https://musicbrainz.org';
const LOG = resolve(HERE, 'logs', '212');
const log = (...a) => console.log('[probe-212]', ...a);

await mkdir(LOG, { recursive: true });
const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
// stub GM storage before anything
await page.addInitScript(() => {
  window.__gm = {};
  window.GM_getValue = (k, d) => (k in window.__gm ? window.__gm[k] : d);
  window.GM_setValue = (k, v) => { window.__gm[k] = v; };
});
await page.goto(O + '/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.goto(`${O}/artist/056e4f3e-d505-4dad-8ec1-d04f521cbb56/edit`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('textarea.edit-note', { timeout: 20000 });
await page.addScriptTag({ content: code });
await page.waitForTimeout(800);

const bars = await page.evaluate(() => document.querySelectorAll('.mmth-bar').length);
log('bars injected:', bars);

// type a note, save it
await page.evaluate(() => { const ta = document.querySelector('textarea.edit-note'); ta.value = 'Source: official website'; });
await page.click('.mmth-btn:has-text("Save current")');
await page.waitForTimeout(200);
const savedCount = await page.evaluate(() => (JSON.parse(window.__gm['mammoth:data'] || '{}').saved || []).length);
log('saved notes after Save current:', savedCount);

// clear field, open panel, click the saved row → should insert
await page.evaluate(() => { const ta = document.querySelector('textarea.edit-note'); ta.value = ''; });
await page.click('.mmth-btn:has-text("Notes")');
await page.waitForTimeout(200);
await page.screenshot({ path: resolve(LOG, 'panel.png') });
const rows = await page.evaluate(() => document.querySelectorAll('.mmth-row').length);
log('rows in panel:', rows);
await page.click('.mmth-row');
await page.waitForTimeout(150);
const inserted = await page.evaluate(() => document.querySelector('textarea.edit-note').value);
log('inserted value:', JSON.stringify(inserted));

// append behaviour: set base text, open, click row → appends on newline
await page.evaluate(() => { const ta = document.querySelector('textarea.edit-note'); ta.value = 'Existing line'; });
await page.click('.mmth-btn:has-text("Notes")'); await page.waitForTimeout(150);
await page.click('.mmth-row'); await page.waitForTimeout(150);
const appended = await page.evaluate(() => document.querySelector('textarea.edit-note').value);
log('appended value:', JSON.stringify(appended));

// submit capture: set value, fire submit event, check history
await page.evaluate(() => {
  const ta = document.querySelector('textarea.edit-note'); ta.value = 'Per CSG guidelines';
  const form = ta.closest('form'); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
});
await page.waitForTimeout(150);
const hist = await page.evaluate(() => (JSON.parse(window.__gm['mammoth:data'] || '{}').history || []).map(h => h.text));
log('history after submit:', JSON.stringify(hist));

await ctx.close();
