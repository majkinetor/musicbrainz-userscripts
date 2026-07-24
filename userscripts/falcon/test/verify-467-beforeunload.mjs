// #467 (majkinetor, production hang) — a worker whose FIRST item didn't cleanly
// submit (e.g. a duplicate/rejected url) leaves that iframe's MB form "dirty".
// Reassigning .src on that SAME iframe for round 2's item then triggers a native
// beforeunload confirm dialog, which freezes the whole tab until dismissed —
// exactly what surfaced as "MB taking 100% CPU" / "blocked" in production
// (github.com/majkinetor/musicbrainz-userscripts/issues/467#issuecomment-5073761183).
//
// Reproduces it directly: a real artist's edit page, dirty the form by typing a
// url and NOT submitting, then reassign .src the OLD way (fails — dialog fires,
// navigation aborts) vs the NEW way (remove + fresh iframe — succeeds, no dialog).
// Also runs the full 2-round worker flow with a genuinely-rejected round-1 url
// (an existing MB relationship) to prove the real worker loop no longer hangs.
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
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// 1. Baseline: confirm the OLD approach (reassigning .src on a dirtied iframe) DOES
// hit the beforeunload block, so the regression test below is meaningful.
{
  const page = ctx.pages()[0] || await ctx.newPage();
  let dialogCount = 0;
  page.on('dialog', async d => { dialogCount++; await d.dismiss(); });
  await page.goto('https://musicbrainz.org/search?query=x&type=artist', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const f = document.createElement('iframe'); f.id = 'baseline-worker';
    f.style.cssText = 'width:800px;height:600px;'; document.body.appendChild(f);
    f.src = 'https://musicbrainz.org/artist/d31f76d2-1d8e-4271-8027-148f375979d7/edit';
  });
  await page.waitForSelector('#baseline-worker');
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const doc = document.getElementById('baseline-worker').contentDocument;
    const w = document.getElementById('baseline-worker').contentWindow;
    const all = [...doc.querySelectorAll('input[type="text"], input[type="url"], input:not([type])')];
    const RE = /^(?:add (?:another )?link|add another url)$/i;
    const input = all.find(i => RE.test((i.placeholder || '').trim()) && !i.value);
    const setVal = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set;
    input.focus(); setVal.call(input, 'https://myspace.com/baselinedirty');
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    input.dispatchEvent(new w.Event('change', { bubbles: true }));
    input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    input.dispatchEvent(new w.KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    input.blur();
  });
  await page.waitForTimeout(800);
  const oldWayResult = await page.evaluate(() => new Promise(resolve => {
    const f = document.getElementById('baseline-worker');
    f.src = 'https://musicbrainz.org/artist/5441c29d-3602-4898-b1a1-b77fa23b8e50/edit';   // reassign .src on the SAME dirtied iframe
    let loaded = false;
    f.addEventListener('load', () => { loaded = true; resolve('loaded'); });
    setTimeout(() => resolve(loaded ? 'loaded' : 'never loaded (blocked)'), 4000);
  }));
  console.log('old approach (reassign .src on dirty iframe):', oldWayResult, 'dialogs:', dialogCount);
  ck(dialogCount > 0, `confirms the bug: reassigning .src on a dirty iframe DOES trigger a beforeunload dialog (${dialogCount})`);
  ck(oldWayResult !== 'loaded', `...and the navigation is blocked/never completes as a result ("${oldWayResult}")`);
  await page.evaluate(() => document.getElementById('baseline-worker')?.remove());
}

// 2. The fix: remove + fresh iframe instead of reassigning .src — 0 dialogs, loads clean.
{
  const page = ctx.pages()[0];
  let dialogCount = 0;
  const onDialog = async d => { dialogCount++; await d.dismiss(); };
  page.on('dialog', onDialog);
  await page.evaluate(() => {
    const f = document.createElement('iframe'); f.id = 'fixed-worker';
    f.style.cssText = 'width:800px;height:600px;'; document.body.appendChild(f);
    f.src = 'https://musicbrainz.org/artist/d31f76d2-1d8e-4271-8027-148f375979d7/edit';
  });
  await page.waitForSelector('#fixed-worker');
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const doc = document.getElementById('fixed-worker').contentDocument;
    const w = document.getElementById('fixed-worker').contentWindow;
    const all = [...doc.querySelectorAll('input[type="text"], input[type="url"], input:not([type])')];
    const RE = /^(?:add (?:another )?link|add another url)$/i;
    const input = all.find(i => RE.test((i.placeholder || '').trim()) && !i.value);
    const setVal = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set;
    input.focus(); setVal.call(input, 'https://myspace.com/fixeddirty');
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    input.dispatchEvent(new w.Event('change', { bubbles: true }));
    input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    input.dispatchEvent(new w.KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    input.blur();
  });
  await page.waitForTimeout(800);
  const newWayResult = await page.evaluate(() => new Promise(resolve => {
    document.getElementById('fixed-worker').remove();   // the fix: remove, don't reassign .src
    const fresh = document.createElement('iframe'); fresh.id = 'fixed-worker-2';
    fresh.style.cssText = 'width:800px;height:600px;';
    fresh.src = 'https://musicbrainz.org/artist/5441c29d-3602-4898-b1a1-b77fa23b8e50/edit';
    document.body.appendChild(fresh);
    fresh.addEventListener('load', () => resolve('loaded'));
    setTimeout(() => resolve('never loaded'), 4000);
  }));
  console.log('fixed approach (remove + fresh iframe):', newWayResult, 'dialogs:', dialogCount);
  ck(dialogCount === 0, `the fix avoids the dialog entirely (${dialogCount} fired)`);
  ck(newWayResult === 'loaded', `...and the next item's page loads cleanly ("${newWayResult}")`);
  page.off('dialog', onDialog);
  await page.evaluate(() => { document.getElementById('fixed-worker')?.remove(); document.getElementById('fixed-worker-2')?.remove(); });
}

// 3. Full worker loop, real Falcon code: round 1 has a genuinely-rejected url
// (already an existing relationship), round 2 must still complete (no hang).
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  let dialogsDuringRun = 0;
  page.on('dialog', async d => { dialogsDuringRun++; await d.dismiss(); });
  let posts = 0;
  await page.route('**/artist/*/edit', async (route, request) => {
    if (request.method() === 'POST') { posts++; const mbid = (request.url().match(/\/artist\/([0-9a-f-]{36})\/edit/) || [])[1]; return route.fulfill({ status: 302, headers: { Location: `https://musicbrainz.org/artist/${mbid}` } }); }
    return route.continue();
  });
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForTimeout(500);
  await page.addScriptTag({ content: code });
  await page.waitForSelector('#falcon-launcher', { timeout: 5000 });
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 5000 });
  await page.evaluate(() => {
    window.__falconTest.setQueue([
      // round 1, single worker: an ALREADY-EXISTING relationship — genuinely rejected,
      // leaves the form dirty without ever calling submit (committed: false).
      { id: 'r1', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://derzirkel.bandcamp.com/', linkTypeId: null }], urlResults: null, status: 'queued', error: '' },
      // round 2, same single worker: a fresh, valid url on a different artist.
      { id: 'r2', entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', urls: [{ url: 'https://myspace.com/round2test', linkTypeId: null }], urlResults: null, status: 'queued', error: '' },
    ]);
    window.__falconTest.cfg.workers = 1;   // forces the SAME worker to handle both, in sequence
  });
  const start = Date.now();
  await page.evaluate(() => window.__falconTest.start());
  const settled = await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 30000 }).then(() => true).catch(() => false);
  const elapsed = Date.now() - start;
  const finalQueue = await page.evaluate(() => window.__falconTest.getQueue());
  console.log('elapsed ms:', elapsed, 'settled:', settled, 'dialogs during run:', dialogsDuringRun);
  console.log(JSON.stringify(finalQueue.map(i => ({ id: i.id, status: i.status, error: i.error })), null, 1));
  ck(settled, `both rounds settle within 30s — no hang (elapsed ${elapsed}ms)`);
  ck(finalQueue[0]?.status === 'failed', `round 1's genuinely-duplicate url correctly reported as failed (status=${finalQueue[0]?.status})`);
  ck(finalQueue[1]?.status === 'done', `round 2 still completes despite round 1 leaving its iframe dirty (status=${finalQueue[1]?.status})`);
  ck(posts === 1, `exactly one real submit happened (round 2's) — round 1 never had anything valid to submit (got ${posts})`);
  ck(dialogsDuringRun === 0, `no beforeunload dialog fired during the real worker loop (${dialogsDuringRun})`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
