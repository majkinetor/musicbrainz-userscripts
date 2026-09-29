// Log the shared test profile (.pw-profile) in to MusicBrainz, once.
//
//   node dev/test/login.mjs            production and the sandbox
//   node dev/test/login.mjs prod       musicbrainz.org only
//   node dev/test/login.mjs sandbox    test.musicbrainz.org only
//   node dev/test/login.mjs sandbox --auto [--profile <dir>] [--firefox]
//
// Opens a visible browser at each login page and waits until you are signed in.
// The two sites have separate accounts. Cookies persist in .pw-profile/, which
// every spec reuses; a spec that needs a login it doesn't have is skipped, not failed.
//
// --auto signs in to the sandbox headless, with no one at the keyboard (CI). The
// sandbox account is public knowledge, so it needs no secret: majkinetor / mb,
// or SANDBOX_USER / SANDBOX_PASS. Production is never signed in to this way.
//
// --firefox signs in Firefox's profile instead (.pw-profile-ff unless --profile names
// another): Falcon's Firefox specs use it (#637).
import { chromium, firefox } from '@playwright/test';
import { resolve } from 'node:path';
import { PROFILE, REPO } from './harness.mjs';

const SITES = { prod: 'https://musicbrainz.org', sandbox: 'https://test.musicbrainz.org' };
const args = process.argv.slice(2);
const auto = args.includes('--auto');
const ff = args.includes('--firefox');
const at = args.indexOf('--profile');
const profile = at >= 0 ? args[at + 1] : ff ? resolve(REPO, '.pw-profile-ff') : PROFILE;
const named = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--profile');
const want = named.length ? named : Object.keys(SITES);
if (want.some(w => !SITES[w]) || (auto && want.some(w => w !== 'sandbox'))) {
  console.error('usage: node dev/test/login.mjs [prod|sandbox] [--firefox]  ·  node dev/test/login.mjs sandbox --auto [--profile <dir>] [--firefox]');
  process.exit(2);
}

const signedIn = page => page.waitForFunction(() => !!document.querySelector('a[href*="/logout"]'), null,
  { timeout: auto ? 60_000 : 5 * 60_000, polling: 1000 }).then(() => true, () => false);

const ctx = await (ff ? firefox : chromium).launchPersistentContext(profile, { headless: auto, viewport: { width: 1100, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
for (const w of want) {
  await page.goto(SITES[w] + '/login');
  if (auto) {
    // test.musicbrainz.org/login hands over to test.metabrainz.org's sign-in,
    // which comes straight back once signed in (or at once, if the profile still is)
    const form = await page.waitForSelector('#username', { timeout: 30_000 }).catch(() => null);
    if (form) {
      await page.fill('#username', process.env.SANDBOX_USER || 'majkinetor');
      await page.fill('#password', process.env.SANDBOX_PASS || 'mb');
      await page.check('#remember_me').catch(() => {});
      await page.press('#password', 'Enter');
      await page.waitForURL(u => u.hostname === 'test.musicbrainz.org', { timeout: 60_000 });
    }
  } else console.log(`Log in to ${SITES[w]} in the browser window (5 minutes)…`);
  const ok = await signedIn(page);
  console.log(ok ? `  signed in to ${SITES[w]}` : `  not signed in to ${SITES[w]} (${page.url()})`);
  if (!ok) process.exitCode = 1;
}
await ctx.close();
