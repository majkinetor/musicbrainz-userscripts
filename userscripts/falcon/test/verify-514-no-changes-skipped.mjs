// #514 (majkinetor, live, with a saved copy of the real MB response
// attached): a field change (ISRC/disambiguation) Falcon can't always tell
// already matches what's stored — unlike a relationship row, there's no
// clean "pending" DOM state to diff beforehand — so Falcon submits it, and
// MB's own server-side validation rejects the redundant edit with
// `<div class="banner warning-header"><p>The data you have submitted does
// not make any changes to the data already present.</p></div>`, re-
// rendering /edit itself instead of redirecting away. Falcon used to treat
// "never left /edit" as a hard failure regardless of why — sitting through
// the full 25s×2 retry timeout AND landing on 'failed'. Should be 'skipped'
// (nothing was wrong, nothing needed to change), same as the existing
// pre-submit "MB shows no pending change" noop path.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');
const RECORDING = 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7';

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});

// 1. findNoChangesWarning() detects the real banner MB actually sends —
// verbatim excerpt from majkinetor's saved page.
{
  const page = await ctx.newPage();
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.setContent(`<html><body>
    <div class="banner warning-header">
      <p>The data you have submitted does not make any changes to the data already present.</p>
    </div>
  </body></html>`);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  const found = await page.evaluate(() => window.__falconTest.findNoChangesWarning(document));
  ck(found === true, `findNoChangesWarning() recognizes the real MB banner (got ${found})`);
  const notFound = await page.evaluate(() => window.__falconTest.findNoChangesWarning(document.implementation.createHTMLDocument()));
  ck(notFound === false, `and correctly returns false when the banner isn't present`);
}

// 2. end-to-end: fillAndSubmit() on a real recording /edit page, POST
// intercepted to respond exactly like MB does for this case (200, still on
// /edit, banner shown — not a redirect) — must return noop:true, not throw.
// Real worker/iframe pipeline (not fillAndSubmit called directly on the top
// window) — a mocked 200 response to the SAME /edit URL is a genuine
// navigation, which would destroy fillAndSubmit's own execution context if
// it were running in the page doing the evaluate() call. Production always
// runs it against a worker IFRAME for exactly this reason; match that here.
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(`**/recording/${RECORDING}/edit*`, async (route, request) => {
    if (request.method() === 'POST') {
      return route.fulfill({
        status: 200, contentType: 'text/html',
        body: `<html><body>
          <div class="banner warning-header"><p>The data you have submitted does not make any changes to the data already present.</p></div>
          <form><table><tbody></tbody></table><button type="submit">Enter edit</button></form>
        </body></html>`,
      });
    }
    return route.continue();
  });
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForTimeout(400);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  // spawnWorkerCard() needs the panel's own #falcon-workers strip to exist.
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 5000 });

  const started = Date.now();
  await page.evaluate((RECORDING) => {
    const t = window.__falconTest;
    t.addToQueue([{ entityType: 'recording', mbid: RECORDING, isrc: 'USRC17607839' }]);
    t.start();
  }, RECORDING);
  await page.waitForFunction(() => window.__falconTest.getQueue()[0]?.status !== 'queued' && window.__falconTest.getQueue()[0]?.status !== 'active', null, { timeout: 20000 }).catch(() => {});
  const elapsed = Date.now() - started;
  const item = await page.evaluate(() => window.__falconTest.getQueue()[0]);
  console.log('item after the run:', JSON.stringify(item));
  console.log('elapsed:', elapsed, 'ms');
  ck(item?.status === 'skipped', `the item is marked skipped, not failed, when MB says nothing changed (got "${item?.status}", error="${item?.error}")`);
  ck(item?.error === '', `no error attached — this is an intentional, successful no-op (got "${item?.error}")`);
  ck(elapsed < 20000, `resolves fast, not after the full 25s×2 retry timeout per attempt (got ${elapsed}ms)`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
