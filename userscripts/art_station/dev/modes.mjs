import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const script = readFileSync('userscripts/art_station/art_station.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 900 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'networkidle' });
await page.addScriptTag({ content: script });
await page.waitForTimeout(3500);
// ensure ungrouped (Position) mode
await page.evaluate(() => { const g = document.querySelector('.as-group'); if (g.checked) g.click(); });
await page.waitForTimeout(300);
// add a new image
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.as-add')]);
await chooser.setFiles('userscripts/art_station/poc-select.png');
await page.waitForTimeout(700);

const pos = await page.evaluate(() => ({
  hasNewSection: [...document.querySelectorAll('.as-sec h3')].some(h => h.textContent.includes('New uploads')),
  newCardDraggable: document.querySelector('.as-card.new')?.getAttribute('draggable'),
  anyDraggable: !!document.querySelector('.as-card[draggable="true"]'),
  sections: [...document.querySelectorAll('#as-root .as-sec h3')].map(h => h.textContent),
}));
console.log('[Position mode] New uploads section:', pos.hasNewSection, '| new card draggable:', pos.newCardDraggable, '| any draggable:', pos.anyDraggable);
console.log('  sections:', JSON.stringify(pos.sections));

// switch to group mode
await page.evaluate(() => document.querySelector('.as-group').click());
await page.waitForTimeout(400);
const grp = await page.evaluate(() => ({
  hasNewSection: [...document.querySelectorAll('.as-sec h3')].some(h => h.textContent.includes('New uploads')),
  anyDraggable: !!document.querySelector('.as-card[draggable="true"]'),
}));
console.log('[Group mode] New uploads section:', grp.hasNewSection, '| any draggable:', grp.anyDraggable);
await ctx.close();
