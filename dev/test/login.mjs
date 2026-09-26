// Log the shared test profile (.pw-profile) in to MusicBrainz, once.
//
//   node dev/test/login.mjs            production and the sandbox
//   node dev/test/login.mjs prod       musicbrainz.org only
//   node dev/test/login.mjs sandbox    test.musicbrainz.org only
//
// Opens a visible browser at each login page and waits until you are signed in.
// The two sites have separate accounts. Cookies persist in .pw-profile/, which
// every spec reuses; a spec that needs a login it doesn't have is skipped, not failed.
import { chromium } from '@playwright/test';
import { PROFILE } from './harness.mjs';

const SITES = { prod: 'https://musicbrainz.org', sandbox: 'https://test.musicbrainz.org' };
const want = process.argv[2] ? [process.argv[2]] : Object.keys(SITES);
if (want.some(w => !SITES[w])) { console.error('usage: node dev/test/login.mjs [prod|sandbox]'); process.exit(2); }

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: false, viewport: { width: 1100, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
for (const w of want) {
  await page.goto(SITES[w] + '/login');
  console.log(`Log in to ${SITES[w]} in the browser window (5 minutes)…`);
  const ok = await page.waitForFunction(() => !!document.querySelector('a[href*="/logout"]'), null, { timeout: 5 * 60_000, polling: 1000 }).then(() => true, () => false);
  console.log(ok ? `  signed in to ${SITES[w]}` : `  timed out on ${SITES[w]}`);
  if (!ok) process.exitCode = 1;
}
await ctx.close();
