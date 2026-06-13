// One-time MusicBrainz login for headless tests.
//
// Run this once after `pnpm install`:
//     node test/login.mjs
//
// What it does:
//   1. Launches a headed Chromium with a persistent profile at .pw-profile/
//   2. Opens https://musicbrainz.org/login
//   3. Waits for you to log in and confirms you're authenticated
//   4. Closes the browser. Your cookies + IndexedDB persist in .pw-profile/.
//
// Subsequent `pnpm test` runs reuse that profile, so they're already logged in
// and the IDB entity cache survives between runs (first run slow, later fast).

import { chromium }           from 'playwright';
import { fileURLToPath }      from 'node:url';
import { dirname, resolve }   from 'node:path';
import { mkdir }              from 'node:fs/promises';

const HERE         = dirname(fileURLToPath(import.meta.url));
// Shared repo-level Playwright profile, reused by every userscript test harness.
const PROFILE_DIR  = resolve(HERE, '..', '..', '..', '.pw-profile');
const LOGIN_URL    = 'https://musicbrainz.org/login';
const SUCCESS_URL  = 'https://musicbrainz.org/user/';   // post-login redirect lands under /user/<name>

await mkdir(PROFILE_DIR, { recursive: true });

console.log('Launching Chromium with persistent profile at:', PROFILE_DIR);
const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1100, height: 800 },
});

const page = await context.newPage();
await page.goto(LOGIN_URL);
console.log('\n──────────────────────────────────────────────');
console.log(' Log in to MusicBrainz in the opened window.');
console.log(' This script auto-closes once you are signed in.');
console.log('──────────────────────────────────────────────\n');

// Poll for login by checking for the "Logged in as" indicator in the header.
// MB's logged-in state shows /user/<name> in the top nav.
const TIMEOUT_MS = 5 * 60 * 1000;   // 5 min — generous
const POLL_MS    = 1000;
const deadline   = Date.now() + TIMEOUT_MS;

while (Date.now() < deadline) {
    const userLink = await page.locator('a[href^="/user/"]').first().getAttribute('href').catch(() => null);
    if (userLink && userLink.startsWith('/user/')) {
        console.log(`Detected login: ${userLink}`);
        break;
    }
    await new Promise(r => setTimeout(r, POLL_MS));
}

if (Date.now() >= deadline) {
    console.error('Timed out waiting for login. Re-run when ready.');
    await context.close();
    process.exit(1);
}

console.log('Login saved. Closing browser. You can now run `pnpm test`.');
await context.close();
process.exit(0);
