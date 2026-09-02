// One-time MusicBrainz login for the script-metrics collector.
//
//     node login.mjs           (or: npm run login)
//
// Opens a headed Chromium on the shared repo profile (.pw-profile/), navigates
// to the MB login page, and waits until you're signed in. The session cookie
// persists in the profile, so `npm run collect` runs headless afterwards.
//
// The same profile is shared with the userscript test harnesses, so if those
// are already logged in to production MB you may not need this at all.

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '.pw-profile'); // repo-root /.pw-profile
const LOGIN_URL = 'https://musicbrainz.org/login';

await mkdir(PROFILE_DIR, { recursive: true });
console.log('Profile:', PROFILE_DIR);
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: false, viewport: { width: 1100, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(LOGIN_URL);
console.log('\n  Log in to MusicBrainz in the window. Auto-closes once signed in.\n');

const deadline = Date.now() + 5 * 60 * 1000;
let who = null;
while (Date.now() < deadline) {
  who = await page.locator('a[href^="/user/"]').first().getAttribute('href').catch(() => null);
  if (who && who.startsWith('/user/')) break;
  await new Promise(r => setTimeout(r, 1000));
}
if (who) console.log('Logged in:', decodeURIComponent(who));
else { console.error('Timed out waiting for login.'); await ctx.close(); process.exit(1); }
await ctx.close();
console.log('Session saved. You can now run: npm run collect');
