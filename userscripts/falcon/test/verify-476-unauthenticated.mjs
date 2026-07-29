// #476 (majkinetor): "If there is no authenticated user the queue still runs
// and workers show unhelpful message" — screenshot showed a worker stuck on
// "edit page never loaded" while the iframe itself rendered Firefox's native
// "Can't Open This Page" chrome. Root cause: with no session, MB redirects
// /edit to its login page, and — unlike the edit page — the login page
// refuses to be framed, so every worker times out the same way at once.
//
// Fix: start() now checks isLoggedIn() up front (reading the panel's own
// un-framed tab, which always shows a "Log in" link when logged out) and
// refuses to spin up any workers, with a clear alert instead of N silent
// 15s timeouts.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const dialogs = [];
page.on('dialog', async d => { dialogs.push(d.message()); await d.dismiss(); });
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(400);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 10000 });
await page.click('#falcon-launcher');

// This profile happens to be logged OUT right now (a known recurring state —
// see reference_beta_test_login memory) which is exactly the scenario #476
// is about, so exercise the real page as-is rather than faking it.
const loggedOutReal = await page.evaluate(() => window.__falconTest.isLoggedIn());
const hasLoginLink = await page.evaluate(() => !!document.querySelector('a[href^="/login"]'));
console.log('real page state: isLoggedIn()=' + loggedOutReal + ' hasLoginLink=' + hasLoginLink);
ck(hasLoginLink, 'sanity: this profile is really logged out right now (a "Log in" link is present)');
ck(loggedOutReal === false, 'isLoggedIn() correctly reports false on a logged-out page');

// start() must refuse and alert, spawning zero workers.
await page.evaluate(() => window.__falconTest.setQueue([
  { id: 'x1', entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', urls: [{ url: 'https://myspace.com/x' }], status: 'queued', name: null, urlResults: null, error: '' },
]));
await page.evaluate(() => window.__falconTest.start());
await page.waitForTimeout(200);
const workersAfterRefusal = await page.evaluate(() => document.querySelectorAll('.falcon-worker-card').length);
console.log('dialogs shown:', JSON.stringify(dialogs));
ck(dialogs.length === 1 && /not logged into MusicBrainz/i.test(dialogs[0]), `a clear alert explains the problem (got: ${JSON.stringify(dialogs[0])})`);
ck(workersAfterRefusal === 0, `no worker cards were spawned for an unauthenticated run (found ${workersAfterRefusal})`);

// Simulate a logged-in page (remove the login link) — the guard must get out
// of the way and let start() proceed to its normal checks.
await page.evaluate(() => document.querySelectorAll('a[href^="/login"]').forEach(a => a.remove()));
const loggedInSim = await page.evaluate(() => window.__falconTest.isLoggedIn());
ck(loggedInSim === true, 'isLoggedIn() flips to true once the login link is gone (simulating a real session)');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
