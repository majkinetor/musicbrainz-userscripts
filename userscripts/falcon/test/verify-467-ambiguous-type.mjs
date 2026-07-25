// #467 (majkinetor, real production failure): a batch of 11 recordings mostly
// failed with "submit button disabled (form invalid?)". Root cause, confirmed
// live: an AMBIGUOUS url (a Bandcamp track is the common case — could be
// "purchase for download", "download for free", "stream for free", etc.) renders
// a REQUIRED relationship-type <select> that starts blank. Left blank (no
// linkTypeId given), that ONE row invalidates the WHOLE form — not just itself —
// disabling the submit button for the entire group of urls, with no indication
// of which url or why. fillAndSubmit now detects this at add-time, removes the
// unresolvable row (so it can't block the rest of the group), and reports it as
// a specific, actionable failure instead of a bare "form invalid?" on submit.
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

// 1. An ambiguous url with NO linkTypeId, alone in its group: reported as a clean,
// specific failure (not a generic "form invalid?"); nothing gets submitted (there
// was nothing else valid to save), and no exception escapes fillAndSubmit.
{
  const page = ctx.pages()[0] || await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('https://musicbrainz.org/recording/e42f8e08-3150-4c6c-be5b-4030c29b1bf7/edit', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForTimeout(500);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  const result = await page.evaluate(async () => {
    // fillAndSubmit accepts a plain window handle just as readily as an iframe
    // (frameDoc/frameWin fall back to target.document/target itself) — the top
    // page's own window works directly here.
    return await window.__falconTest.fillAndSubmit(window, {
      urls: [{ url: 'https://sagason.bandcamp.com/track/ambiguous-test-1', linkTypeId: null }],
      note: '',
    });
  });
  console.log('ambiguous-alone result:', JSON.stringify(result, null, 1));
  ck(result.committed === false, `nothing submitted — the only url in the group was unresolvable (committed=${result.committed})`);
  ck(result.results?.[0]?.ok === false, 'the ambiguous url is reported as a failure, not silently ok');
  ck(/ambiguous relationship type/.test(result.results?.[0]?.error || ''), `the error clearly names the real cause, not a generic "form invalid?" (got "${result.results?.[0]?.error}")`);
  ck(/open in tab/.test(result.results?.[0]?.error || ''), `the error points at the actionable next step (got "${result.results?.[0]?.error}")`);
  const rowStillThere = await page.evaluate(() => [...document.querySelectorAll('tr.external-link-item a[href]')].some(a => a.getAttribute('href') === 'https://sagason.bandcamp.com/track/ambiguous-test-1'));
  ck(!rowStillThere, 'the unresolvable row is removed from the page rather than left dangling');
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// 2. An ambiguous url alongside a normal, unambiguous one in the SAME group: the
// ambiguous one fails and is removed, but that must NOT block the other url from
// committing — this is the actual production scenario (most of an 11-item batch
// failing outright because ONE bad row poisoned the whole form).
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  let posts = 0;
  await page.route('**/recording/*/edit*', async (route, request) => {
    if (request.method() === 'POST') { posts++; const mbid = (request.url().match(/\/recording\/([0-9a-f-]{36})\/edit/) || [])[1]; return route.fulfill({ status: 302, headers: { Location: `https://musicbrainz.org/recording/${mbid}` } }); }
    return route.continue();
  });
  await page.goto('https://musicbrainz.org/recording/e42f8e08-3150-4c6c-be5b-4030c29b1bf7', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.waitForSelector('#falcon-launcher', { timeout: 5000 });
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 5000 });
  await page.evaluate(() => {
    window.__falconTest.setQueue([{
      id: 'mix', entityType: 'recording', mbid: 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7',
      urls: [
        { url: 'https://sagason.bandcamp.com/track/ambiguous-test-2', linkTypeId: null },   // ambiguous, no type given
        { url: 'https://tidal.com/track/999999999', linkTypeId: null },                       // unambiguous — MB auto-classifies it
      ],
      note: '', urlResults: null, status: 'queued', error: '',
    }]);
  });
  await page.evaluate(() => window.__falconTest.start());
  await page.waitForFunction(() => window.__falconTest.getQueue()[0]?.status !== 'queued' && window.__falconTest.getQueue()[0]?.status !== 'active', null, { timeout: 25000 }).catch(() => {});
  const result = await page.evaluate(() => window.__falconTest.getQueue()[0]);
  console.log('mixed group result:', JSON.stringify(result, null, 1));
  ck(result?.status === 'partial', `the group commits PARTIALLY — one good url saved despite the other being ambiguous (status=${result?.status})`);
  const tidalResult = result?.urlResults?.find(r => r.url.includes('tidal'));
  const bandcampResult = result?.urlResults?.find(r => r.url.includes('bandcamp'));
  ck(tidalResult?.ok === true, `the unambiguous url still commits (${JSON.stringify(tidalResult)})`);
  ck(bandcampResult?.ok === false && /ambiguous/.test(bandcampResult?.error || ''), `the ambiguous url is cleanly reported as failed, not silently dropped (${JSON.stringify(bandcampResult)})`);
  ck(posts === 1, `exactly one real submit happened, carrying the one good url (got ${posts})`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
