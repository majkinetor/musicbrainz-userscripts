// #467 (majkinetor) — review UX: per-item + bulk remove, expandable row detail,
// collapsed paste box (covered separately in verify-467-names.mjs's toggle usage),
// and the GM-storage-token ?falcon= transport that lets Harmony batches include
// recordings again without hitting a URL-length ceiling. Also covers "open in a
// real tab" — the same fillAndSubmit procedure, stopped short of clicking submit,
// so a human can review/complete/commit an item by hand (mirrors what Harmony
// itself does per-entity).
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

async function freshPage() {
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForTimeout(400);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.waitForSelector('#falcon-launcher', { timeout: 5000 });
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 5000 });
  return { page, errs };
}

// 1. parseUrlParam token scheme: a payload stashed in GM storage under a short
// token is found via ?falcon=<token>, parsed identically to the base64 scheme, and
// the stored entry is cleaned up afterward.
{
  const { page, errs } = await freshPage();
  const result = await page.evaluate(() => {
    const tuples = [
      { entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', url: 'https://myspace.com/tokentest', linkTypeId: null },
      { entityType: 'recording', mbid: 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7', url: 'https://tidal.com/track/1', linkTypeId: '979' },
    ];
    const token = window.__falconTest.makePendingToken();
    window.GM_setValue('falcon:pending:' + token, JSON.stringify(tuples));
    history.replaceState(null, '', '/?falcon=' + token);
    const parsed = window.__falconTest.parseUrlParam();
    const stillThere = window.GM_getValue('falcon:pending:' + token, null);
    return { token, parsed, stillThere };
  });
  console.log('token round-trip:', JSON.stringify(result));
  ck(result.parsed?.length === 2, `token-based payload parses back to both tuples (got ${result.parsed?.length})`);
  ck(result.parsed?.some(t => t.entityType === 'recording'), 'a recording tuple survives the token round-trip');
  ck(result.stillThere === null, 'the stored payload is deleted from GM storage once consumed (no orphaned entries)');

  // base64 scheme (the general "any external script" contract) still works alongside it.
  const base64Result = await page.evaluate(() => {
    const tuples = [{ entityType: 'label', mbid: '04201e6d-c430-4a53-a9a0-56170825fbde', url: 'https://example.com/x', linkTypeId: null }];
    const payload = window.__falconTest.encodeFalconPayload(tuples);
    history.replaceState(null, '', '/?falcon=' + encodeURIComponent(payload));
    return window.__falconTest.parseUrlParam();
  });
  ck(base64Result?.length === 1 && base64Result[0].entityType === 'label', `base64 scheme still parses correctly alongside the new token scheme (${JSON.stringify(base64Result)})`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// 2. Per-item remove: clicking a row's remove button deletes just that item.
{
  const { page, errs } = await freshPage();
  await page.evaluate(() => window.__falconTest.setQueue([
    { id: 'a', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/rm1', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
    { id: 'b', entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', urls: [{ url: 'https://myspace.com/rm2', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
  ]));
  await page.click('.falcon-row-remove[data-id="a"]');
  const remaining = await page.evaluate(() => window.__falconTest.getQueue().map(i => i.id));
  console.log('after removing "a":', remaining);
  ck(remaining.length === 1 && remaining[0] === 'b', `removing one row's ✕ leaves only the other item (got ${JSON.stringify(remaining)})`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// 3. Bulk select + remove: checking two rows and clicking "Remove selected" removes
// both, leaves the untouched third item, and an 'active' item can't be selected.
{
  const { page, errs } = await freshPage();
  await page.evaluate(() => window.__falconTest.setQueue([
    { id: 'x', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/bulk1', linkTypeId: null }], name: null, urlResults: null, status: 'queued', error: '' },
    { id: 'y', entityType: 'artist', mbid: '5441c29d-3602-4898-b1a1-b77fa23b8e50', urls: [{ url: 'https://myspace.com/bulk2', linkTypeId: null }], name: null, urlResults: null, status: 'failed', error: 'nope' },
    { id: 'z', entityType: 'artist', mbid: 'b31113ab-205d-461b-b431-5d5c52635117', urls: [{ url: 'https://myspace.com/bulk3', linkTypeId: null }], name: null, urlResults: null, status: 'active', error: '' },
  ]));
  const activeDisabled = await page.evaluate(() => document.querySelector('.falcon-row-check[data-id="z"]').disabled);
  ck(activeDisabled, 'an in-progress ("active") item cannot be selected for bulk removal');
  await page.check('.falcon-row-check[data-id="x"]');
  await page.check('.falcon-row-check[data-id="y"]');
  const selCountText = await page.textContent('#falcon-select-count');
  ck(/2 selected/.test(selCountText || ''), `select-count reflects the 2 checked rows ("${selCountText}")`);
  await page.click('#falcon-remove-selected');
  const remaining = await page.evaluate(() => window.__falconTest.getQueue().map(i => i.id));
  console.log('after bulk-remove:', remaining);
  ck(remaining.length === 1 && remaining[0] === 'z', `bulk remove deletes both checked items, leaves the active one untouched (got ${JSON.stringify(remaining)})`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// 4. Expandable row detail: clicking the ▸ toggle reveals each url (with per-url
// status once the item has urlResults), collapses again on a second click.
{
  const { page, errs } = await freshPage();
  await page.evaluate(() => window.__falconTest.setQueue([
    {
      id: 'd1', entityType: 'recording', mbid: 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7',
      urls: [{ url: 'https://www.deezer.com/track/1', linkTypeId: '268' }, { url: 'https://tidal.com/track/1', linkTypeId: '979' }],
      name: null, urlResults: [{ url: 'https://www.deezer.com/track/1', ok: true }, { url: 'https://tidal.com/track/1', ok: false, error: 'This URL is not allowed for recordings.' }],
      status: 'partial', error: 'tidal failed',
    },
  ]));
  const beforeExpand = await page.evaluate(() => document.querySelectorAll('#falcon-queue-list .falcon-row > div').length);
  await page.click('.falcon-row-expand[data-id="d1"]');
  const duringExpand = await page.evaluate(() => document.querySelectorAll('#falcon-queue-list .falcon-row > div').length);
  ck(duringExpand === beforeExpand + 2, `expanding adds one detail div per url — 2 urls (before=${beforeExpand}, expanded=${duringExpand})`);
  const detailText = await page.evaluate(() => document.getElementById('falcon-queue-list').textContent);
  console.log('detail text after expand:', detailText.replace(/\s+/g, ' ').trim());
  ck(detailText.includes('deezer.com/track/1') && detailText.includes('tidal.com/track/1'), 'expanding the row shows BOTH urls');
  ck(detailText.includes('type 268') && detailText.includes('type 979'), 'each url shows its linkTypeId');
  const errorTitle = await page.evaluate(() => [...document.querySelectorAll('#falcon-queue-list [title]')].map(el => el.title).find(t => /not allowed for recordings/.test(t)));
  ck(!!errorTitle, `the failed url's real MB error is shown on hover ("${errorTitle}")`);
  await page.click('.falcon-row-expand[data-id="d1"]');
  const afterCollapse = await page.evaluate(() => document.querySelectorAll('#falcon-queue-list .falcon-row > div').length);
  ck(afterCollapse === beforeExpand, `collapsing again removes the detail rows (before=${beforeExpand}, after=${afterCollapse})`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// 5. Open in a real tab: clicking ⇗ opens a genuine new tab at the entity's edit
// page, fills the SAME way fillAndSubmit does for workers, but never clicks submit
// — the human is expected to review and commit themselves.
{
  const { page, errs } = await freshPage();
  await page.evaluate(() => window.__falconTest.setQueue([
    { id: 'tab1', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/opentabtest', linkTypeId: null }], name: null, urlResults: null, status: 'failed', error: 'previously failed' },
  ]));
  const [popup] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 8000 }),
    page.click('.falcon-row-opentab[data-id="tab1"]'),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  console.log('opened tab url:', popup.url());
  ck(/\/artist\/d31f76d2-1d8e-4271-8027-148f375979d7\/edit/.test(popup.url()), `the new tab opens the entity's real edit page (${popup.url()})`);
  const statusAfterOpen = await page.evaluate(() => window.__falconTest.getQueue()[0].status);
  ck(statusAfterOpen === 'manual', `the queue item is marked 'manual' once opened for hand review (status=${statusAfterOpen})`);
  await popup.waitForFunction(() => {
    const rows = [...document.querySelectorAll('tr.external-link-item')];
    return rows.some(tr => (tr.querySelector('a[href]')?.getAttribute('href') || '') === 'https://myspace.com/opentabtest');
  }, null, { timeout: 12000 }).catch(() => {});
  const filled = await popup.evaluate(() => [...document.querySelectorAll('tr.external-link-item a[href]')].some(a => a.getAttribute('href') === 'https://myspace.com/opentabtest'));
  ck(filled, 'the url is filled into the tab exactly as fillAndSubmit does for worker iframes');
  const stillOnEditPage = /\/edit(?:[?#]|$)/.test(new URL(popup.url()).pathname);
  ck(stillOnEditPage, 'the tab is left on the edit page — nothing was auto-submitted, ready for the human to review and click Enter edit');
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await popup.close();
  await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
