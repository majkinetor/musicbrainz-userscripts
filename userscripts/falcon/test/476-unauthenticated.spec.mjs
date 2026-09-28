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
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, idle, frames, mbNoise } from '../../../dev/test/harness.mjs';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false, profile: 'fresh' });   // a profile that is logged out, which is what #476 is about

test("#476: unauthenticated", { tag: ['@sandbox'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');

  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const ck = check;

  const errs = []; page.on('pageerror', e => { if (!mbNoise(e.message)) errs.push(e.message); });
  const dialogs = [];
  page.on('dialog', async d => { dialogs.push(d.message()); await d.dismiss(); });
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'load' });
  await idle(page);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 10000 });
  await page.click('#falcon-launcher');

  // a fresh profile: logged out, the scenario #476 is about
  const loggedOutReal = await page.evaluate(() => window.__falconTest.isLoggedIn());
  const hasLoginLink = await page.evaluate(() => !!document.querySelector('a[href^="/login"]'));
  console.log('real page state: isLoggedIn()=' + loggedOutReal + ' hasLoginLink=' + hasLoginLink);
  ck(hasLoginLink, 'sanity: logged out (a "Log in" link is present)');
  ck(loggedOutReal === false, 'isLoggedIn() correctly reports false on a logged-out page');

  // start() must refuse and alert, spawning zero workers.
  await page.evaluate(() => window.__falconTest.setQueue([
    { id: 'x1', entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', urls: [{ url: 'https://myspace.com/x' }], status: 'queued', name: null, urlResults: null, error: '' },
  ]));
  await page.evaluate(() => window.__falconTest.start());
  await frames(page);
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
});
