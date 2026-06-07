// #154 — screenshot the Apollo-themed native medium headers (legend / collapse / format / "Medium title"
// / move-remove) on a 4-medium release, collapsed and with one medium expanded.
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '60e810ef-7ef1-4e90-8482-ab4653802786';
const OUT = resolve(HERE, 'logs', 'shots'); await mkdir(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 2 });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { console.error('not logged in'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length > 0; } catch { return false; } }, null, { timeout: 60000 });
await page.addScriptTag({ content: await readFile(SCRIPT, 'utf8') });
await page.waitForTimeout(1000);
await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#tracklist"]'); if (a) a.click(); });
await page.waitForTimeout(600);
await page.evaluate(() => window.__apolloEditor.showMirror());
await page.waitForSelector('fieldset.advanced-medium', { timeout: 20000 });
await page.waitForTimeout(800);

const clip = async (name) => {
  const box = await page.evaluate(() => {
    const fss = [...document.querySelectorAll('fieldset.advanced-medium')];
    if (!fss.length) return null;
    const first = fss[0].getBoundingClientRect();
    const last = fss[Math.min(fss.length - 1, 3)].getBoundingClientRect();
    return { x: Math.max(0, first.left - 6), y: Math.max(0, first.top - 6), width: Math.min(1480, first.width + 12), height: Math.min(1000, last.bottom - first.top + 12) };
  });
  if (box) await page.screenshot({ path: resolve(OUT, name), clip: box });
};

await clip('i154-after-collapsed.png');

// expand the first medium so the themed header sits above the Apollo table
await page.evaluate(() => { const b = document.querySelector('fieldset.advanced-medium button.icon.expand-medium'); if (b) b.click(); });
await page.waitForTimeout(1500);
await clip('i154-after-expanded.png');

console.log('shots ->', OUT);
await ctx.close();
