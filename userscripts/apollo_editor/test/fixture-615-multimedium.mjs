// Creates a fresh 3-medium release on test.musicbrainz.org (the sanctioned sandbox)
// for #615's merge/split e2e: 2 + 2 + 3 tracks, artist Mocky (exists on the sandbox),
// every track a NEW recording. Prints the new release MBID. Sandbox only.
import { createRequire } from 'node:module';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const ARTIST = 'c321a13a-1c52-43c0-b60a-3a454cb7f9a2';   // Mocky, on the sandbox
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const MEDIA = [['Alpha', 'Bravo'], ['Charlie', 'Delta'], ['Echo', 'Foxtrot', 'Golf']];

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: !process.argv.includes('--headed'), viewport: { width: 1500, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://test.musicbrainz.org/', { waitUntil: 'domcontentloaded', timeout: 60000 });
const fields = {
  name: `Apollo 615 fixture ${stamp}`,
  'artist_credit.names.0.mbid': ARTIST, 'artist_credit.names.0.name': 'Mocky',
  status: 'official', type: 'album',
  edit_note: 'Apollo Editor #615 merge/split test fixture — test.musicbrainz.org sandbox',
};
MEDIA.forEach((tracks, mi) => {
  fields[`mediums.${mi}.format`] = 'Digital Media';
  tracks.forEach((t, ti) => { fields[`mediums.${mi}.track.${ti}.name`] = `${t} ${stamp}`; fields[`mediums.${mi}.track.${ti}.length`] = `${2 + ti}:0${mi}`; });
});
await page.evaluate(f => {
  const form = document.createElement('form'); form.method = 'POST'; form.action = '/release/add';
  for (const [k, v] of Object.entries(f)) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; form.appendChild(i); }
  document.body.appendChild(form); form.submit();
}, fields);
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(3000);
const confirm = await page.$('.confirm-seed button, form.confirm-seed button[type=submit]');
if (confirm) { await confirm.click(); await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(3000); }
await page.waitForFunction(() => window.MB && MB.releaseEditor && MB.releaseEditor.rootField && MB.releaseEditor.rootField.release(), null, { timeout: 60000 });
// the artist is seeded by MBID and loads async
await page.waitForFunction(() => { const n = MB.releaseEditor.rootField.release().artistCredit().names; return n && n[0] && n[0].artist && n[0].artist.id; }, null, { timeout: 30000 }).catch(() => console.log('artist did not resolve'));
await page.waitForTimeout(2000);
const state = await page.evaluate(() => ({ allows: MB.releaseEditor.allowsSubmission(), media: MB.releaseEditor.rootField.release().mediums().map(m => m.tracks().length), errors: [...document.querySelectorAll('.error:not([style*="display: none"])')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 8) }));
console.log('editor:', JSON.stringify(state));
if (!state.allows) { console.log('cannot submit'); await ctx.close(); process.exit(2); }
await page.evaluate(() => MB.releaseEditor.submitEdits());
await page.waitForURL(/\/release\/[0-9a-f-]{36}(\?|$|#)/, { timeout: 120000 });
const mbid = page.url().match(/\/release\/([0-9a-f-]{36})/)[1];
console.log('FIXTURE_RELEASE=' + mbid);
if (errs.length) console.log('page errors:', JSON.stringify(errs.slice(0, 3)));
await ctx.close();
