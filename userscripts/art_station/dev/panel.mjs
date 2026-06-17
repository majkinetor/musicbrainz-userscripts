import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = 'b792340e-2c77-4dd1-9de4-6dc174440a33';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3000);
// no staged button present?
console.log('staged button gone:', await page.$('#as-root .as-staged') ? 'NO (still there)' : 'yes');
// make some changes: set comments on first 3 covers via Enter-advance
await page.evaluate(() => document.querySelector('#as-root .as-grid .as-card .as-pencil')?.click());
await page.waitForTimeout(150);
await page.keyboard.type('alpha'); await page.keyboard.press('Enter'); await page.waitForTimeout(120);
await page.keyboard.type('beta'); await page.keyboard.press('Enter'); await page.waitForTimeout(120);
await page.keyboard.type('gamma'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
console.log('enter-edit label:', await page.textContent('#as-root .as-commit'));
// open the commit panel
await page.click('#as-root .as-commit');
await page.waitForTimeout(300);
const panel = await page.evaluate(() => ({
  hasEditNoteLabel: [...document.querySelectorAll('#as-commit')].some(() => false) || document.querySelector('#as-commit')?.textContent.includes('Edit note'),
  voteInFooter: !!document.querySelector('#as-commit .as-cm-f .as-cm-vote'),
  ops: [...document.querySelectorAll('#as-commit .as-cm-lb')].map(e => e.textContent),
}));
console.log('panel: edit-note label present:', panel.hasEditNoteLabel, '| vote in footer:', panel.voteInFooter);
console.log('panel ops:', JSON.stringify(panel.ops));
const box = await (await page.$('#as-commit .as-cm-box')).boundingBox();
await page.screenshot({ path: 'userscripts/art_station/dev/panel.png', clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
// close panel, open bulk type pop to check 2 columns
await page.keyboard.press('Escape'); await page.click('body'); await page.waitForTimeout(200);
await page.evaluate(() => document.getElementById('as-commit')?.remove());
await page.click('#as-root .as-selall'); await page.waitForTimeout(150);
await page.click('#as-root .as-bk-type'); await page.waitForTimeout(200);
const grid = await page.$('.as-type-grid');
const cols = await page.evaluate(() => { const g = document.querySelector('.as-type-grid'); return g ? getComputedStyle(g).gridTemplateColumns : 'none'; });
const scrolls = await page.evaluate(() => { const p = document.querySelector('.as-pop'); return p ? p.scrollHeight > p.clientHeight : null; });
console.log('type-pop columns:', cols, '| scrolls:', scrolls);
const pb = await (await page.$('.as-pop')).boundingBox();
await page.screenshot({ path: 'userscripts/art_station/dev/typepop.png', clip: { x: pb.x - 2, y: pb.y - 2, width: pb.width + 4, height: pb.height + 4 } });
console.log('shots saved');
await ctx.close();
