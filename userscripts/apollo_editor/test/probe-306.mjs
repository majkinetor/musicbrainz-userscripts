// #306 — special-purpose artists must never get a Discogs "add link" icon.
// Loads apollo on a release that credits special-purpose artists and has a
// Discogs link, runs the Discogs match, and reports discogs icons on
// special-purpose rows (must be 0).
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const ORIGIN = 'https://musicbrainz.org';
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '8189a854-f1f5-4700-a580-c15ee43b0976';
const SPECIAL = new Set(['125ec42a-7229-4250-afc5-e057484327fe','f731ccc4-e22a-43af-a747-64213329e088','33cf029c-63b0-41a0-9855-be2a3665fb3b','314e1c25-dde7-4e4d-b2f4-0a7b9f7c56dc','eec63d3c-3b81-4ad4-b1e4-7c147d4d2b61','9be7f096-97ec-4615-8957-8d40b5dcbc41','89ad4ac3-39f7-470e-963a-56509c546377','7e84f845-ac16-41fe-9ff8-df12eb32af55','66ea0139-149f-4a0c-8fbf-5ea9ec4a6e49','a0ef7e1d-44ff-4039-9435-7d5fefdeecc9','90068d37-bae7-4292-be4a-704c145bd616','80a8851f-444c-4539-892b-ad2a49292aa9']);

const main = async () => {
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1500, height: 1100 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#tracklist"]'); if (a) a.click(); });
  await page.waitForSelector('.tc-toolbtns', { timeout: 30000 }).catch(() => {});
  // give the Discogs match pass time to load the release + tag slots
  await page.waitForTimeout(12000);

  const info = await page.evaluate((specialArr) => {
    const SP = new Set(specialArr);
    const icons = [...document.querySelectorAll('.tc-tic.discogs-add, .tc-tic.discogs-warn')];
    let onSpecial = 0; const spHit = [];
    icons.forEach(ic => {
      const row = ic.closest('tr') || ic.closest('.tc-track-row');
      if (!row) return;
      const gids = [...row.querySelectorAll('a[href*="/artist/"]')].map(a => (a.getAttribute('href') || '').match(/\/artist\/([0-9a-f-]{36})/)).filter(Boolean).map(m => m[1]);
      if (gids.some(g => SP.has(g))) { onSpecial++; spHit.push(gids.find(g => SP.has(g))); }
    });
    // count distinct special-purpose artists present in the tracklist
    const spPresent = new Set();
    document.querySelectorAll('a[href*="/artist/"]').forEach(a => { const m = (a.getAttribute('href') || '').match(/\/artist\/([0-9a-f-]{36})/); if (m && SP.has(m[1])) spPresent.add(m[1]); });
    return { totalIcons: icons.length, onSpecial, spHit: spHit.slice(0, 5), spPresent: spPresent.size };
  }, [...SPECIAL]);

  console.log('[306] special-purpose artists present in tracklist:', info.spPresent);
  console.log('[306] total Discogs add/warn icons on page:', info.totalIcons);
  console.log('[306] icons sitting on a special-purpose row:', info.onSpecial, '(must be 0)', info.spHit.length ? JSON.stringify(info.spHit) : '');
  console.log('[306] console errors:', errs.length ? JSON.stringify(errs.slice(0, 5)) : 'none');
  await ctx.close();
};
main().catch(e => { console.error(e); process.exit(2); });
