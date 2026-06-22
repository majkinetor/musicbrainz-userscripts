// Verifies #281: a transient Discogs API failure (429) no longer poisons the
// session — loadDiscogsMap retries / doesn't cache the failure, the badge shows a
// "retry" state instead of a misleading blank, and it recovers WITHOUT a reload.
//
// We intercept api.discogs.com and return 429 for the first N hits, then 200, so
// the first attempt fails and a later attempt (retry / auto-retry / click) wins —
// all within ONE page load. PASS = the "🔗 N links" badge appears with no reload.
//
//   node test/verify-281.mjs [--headed] [MBID]
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const ORIGIN = 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '627a37f2-6e95-4460-80db-84cdc1cb4a10';
const LOG_DIR = resolve(HERE, 'logs', 'verify-281');
const FAIL_FIRST = 2;   // 429 the first 2 Discogs API hits, then succeed

const main = async () => {
  await mkdir(LOG_DIR, { recursive: true });
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1000 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  const out = [];
  const say = (...a) => { const s = a.join(' '); out.push(s); console.log('[281]', s); };

  // Intercept the Discogs API: 429 the first FAIL_FIRST hits, then let it through.
  let hits = 0;
  await ctx.route('https://api.discogs.com/**', async route => {
    hits++;
    if (hits <= FAIL_FIRST) { say(`Discogs API hit #${hits} → forced 429`); return route.fulfill({ status: 429, headers: { 'retry-after': '1' }, body: '{"message":"rate limited"}' }); }
    say(`Discogs API hit #${hits} → pass through (real 200)`);
    return route.continue();
  });

  await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#tracklist"]'); if (a) a.click(); });
  await page.waitForSelector('.tc-discstat', { timeout: 30000 }).catch(() => {});

  // Poll the badge for up to ~20s (covers the in-call backoff retries + the 6s
  // auto-retry), WITHOUT reloading. Capture whether a retry state ever showed.
  let sawRetry = false, finalBadge = null, links = false;
  for (let i = 0; i < 22; i++) {
    await page.waitForTimeout(1000);
    const b = await page.$$eval('.tc-discstat', els => els.map(e => ({ t: e.textContent, cls: e.className }))).catch(() => []);
    finalBadge = b;
    const cls = (b[0] && b[0].cls) || '';
    if (/tc-disc-pend/.test(cls)) sawRetry = true;                     // retry/unreachable state
    if (/tc-disc-badge|tc-disc-ok/.test(cls)) { links = true; say(`recovered at +${i + 1}s → ${JSON.stringify(b)}`); break; }   // settled: links / all-OK
    if (i % 3 === 0) say(`@+${i + 1}s badge ${JSON.stringify(b)}`);
  }

  say('Discogs API total hits:', hits);
  say('saw retry/unreachable state at some point:', sawRetry);
  say('final badge:', JSON.stringify(finalBadge));

  const pass = links && hits > FAIL_FIRST;   // recovered to "N links" within the session, after the forced 429s
  say(pass ? 'PASS — recovered to links within the session despite the 429 (no reload, cache not poisoned)'
           : 'FAIL — badge never recovered to links without a reload');
  await page.screenshot({ path: resolve(LOG_DIR, 'final.png') }).catch(() => {});
  await writeFile(resolve(LOG_DIR, 'result.txt'), out.join('\n'));
  await ctx.close();
  process.exit(pass ? 0 : 1);
};
main().catch(e => { console.error(e); process.exit(2); });
