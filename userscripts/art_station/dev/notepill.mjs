import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3500);

// edit-note: stage a retype, dry-run, check edit_note has "Art Station"
await page.evaluate(() => { const g = document.querySelector('.as-group'); if (g.checked) g.click(); });
await page.waitForTimeout(200);
await page.click('#as-root .as-card:not(:has(.as-pdfban)) .as-addtype');
await page.waitForTimeout(150);
await page.click('.as-pop input[value="Tray"]');
await page.waitForTimeout(200);
await page.mouse.click(5,5); await page.waitForTimeout(200);
await page.click('.as-commit'); await page.waitForTimeout(200);
await page.click('.as-cm-go'); await page.waitForTimeout(1500);
const note = await page.$$eval('.as-cm-payload', els => els.map(e => e.textContent).find(t => /edit-cover-art/.test(t)) || '');
console.log('[edit note] contains "Art Station":', /edit_note=.*Art Station/i.test(note.replace(/\n/g,' ')));
await page.click('.as-cm-cancel').catch(()=>{});
await page.keyboard.press('Escape').catch(()=>{});
await page.waitForTimeout(300);

// lightbox comment pill: open a no-comment cover -> pill present, click unrolls input
await page.click('#as-root .as-card:not(:has(.as-pdfban)) .as-thumb img');
await page.waitForTimeout(700);
const before = await page.evaluate(() => ({ pill: !!document.querySelector('.as-lb-cmtadd'), input: !!document.querySelector('.as-lb-cmt') }));
console.log('[lightbox] no-comment cover -> pill:', before.pill, '| input shown:', before.input);
if (before.pill) { await page.click('.as-lb-cmtadd'); await page.waitForTimeout(200); }
const after = await page.evaluate(() => ({ input: !!document.querySelector('.as-lb-cmt'), focused: document.activeElement?.classList.contains('as-lb-cmt') }));
console.log('[lightbox] after clicking pill -> input:', after.input, '| focused:', after.focused);
await ctx.close();
