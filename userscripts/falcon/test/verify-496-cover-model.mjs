// #496 (majkinetor, follow-up on the field-usage docs): "Lets not use `comment`
// for two unrelated things. On entity, use `disambiguation` instead. Cover
// comment should go into `cover` object... proper cover object [as an array,
// since a release can have multiple covers and we want Falcon to eventually
// support that]... Falcon UI for cover, add UI field for type and support
// array." This test covers the parts of that spec Falcon's own UI/storage is
// responsible for (Harmony's own wire format is untouched, per "do not
// implement anything other than use this schema" on that side):
//   1. a release item's cover is an array; the UI renders one row PER entry
//      (type <select> + comment input + url input), not just one row total.
//   2. the type <select> and per-entry comment input actually write back into
//      the right cover[idx] entry, not into item.disambiguation.
//   3. importing a pre-#496 export (single-object `cover`, item-level
//      `comment`) still works — upgraded in memory to the new shapes.
//   4. runCoverItem resolves add-cover-art.type_id from the entry's OWN
//      `type`, not always "front" regardless of what was asked for.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});

// --- 1/2. UI: cover[] with TWO entries renders two rows, each with its own
//     url/type-select/comment inputs, and editing one doesn't touch the other. ---
{
  const page = ctx.pages()[0] || await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 5000 });
  await page.evaluate(() => window.__falconTest.setQueue([
    { id: 'r1', entityType: 'release', mbid: 'aaaaaaaa-2222-0000-0000-000000000000', urls: [], note: '', disambiguation: '', isrcs: [], coverExistingCount: null, name: null, urlResults: null, status: 'queued', error: '',
      cover: [
        { url: 'https://example.invalid/front.jpg', comment: 'front comment', type: 'Front', candidates: [] },
        { url: 'https://example.invalid/back.jpg', comment: 'back comment', type: 'Back', candidates: [] },
      ] },
  ]));
  await page.click('.falcon-row-expand[data-id="r1"]');

  const rows = await page.evaluate(() => [...document.querySelectorAll('.falcon-cover-input')].map(inp => ({
    idx: inp.dataset.idx, url: inp.value,
    type: document.querySelector(`.falcon-cover-type[data-id="r1"][data-idx="${inp.dataset.idx}"]`)?.value,
    comment: document.querySelector(`.falcon-cover-comment-input[data-id="r1"][data-idx="${inp.dataset.idx}"]`)?.value,
  })));
  console.log('cover rows rendered:', JSON.stringify(rows));
  ck(rows.length === 2, `both cover[] entries get their own row (got ${rows.length})`);
  ck(rows[0].url === 'https://example.invalid/front.jpg' && rows[0].type === 'Front' && rows[0].comment === 'front comment', `entry 0 renders correctly (got ${JSON.stringify(rows[0])})`);
  ck(rows[1].url === 'https://example.invalid/back.jpg' && rows[1].type === 'Back' && rows[1].comment === 'back comment', `entry 1 renders correctly, independent of entry 0 (got ${JSON.stringify(rows[1])})`);

  // edit entry 1's type and comment — entry 0 must be untouched.
  await page.selectOption('.falcon-cover-type[data-id="r1"][data-idx="1"]', 'Booklet');
  await page.fill('.falcon-cover-comment-input[data-id="r1"][data-idx="1"]', 'now a booklet page');
  await page.locator('.falcon-cover-comment-input[data-id="r1"][data-idx="1"]').blur();
  const afterEdit = await page.evaluate(() => window.__falconTest.getQueue().find(i => i.id === 'r1').cover);
  console.log('cover[] after editing entry 1:', JSON.stringify(afterEdit));
  ck(afterEdit[1].type === 'Booklet' && afterEdit[1].comment === 'now a booklet page', `entry 1's own fields updated (got ${JSON.stringify(afterEdit[1])})`);
  ck(afterEdit[0].type === 'Front' && afterEdit[0].comment === 'front comment', `entry 0 untouched by editing entry 1 (got ${JSON.stringify(afterEdit[0])})`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
}

// --- 3. importing a pre-#496 export (single-object cover, item-level
//     `comment`) upgrades cleanly to the new shapes. ---
{
  const page = ctx.pages()[0];
  const legacyJson = JSON.stringify({ items: [
    { entityType: 'release', mbid: 'bbbbbbbb-2222-0000-0000-000000000000', urls: [], comment: 'legacy image comment', cover: { url: 'https://example.invalid/legacy.jpg', candidates: [] }, status: 'queued' },
    { entityType: 'recording', mbid: 'cccccccc-2222-0000-0000-000000000000', urls: [], comment: 'legacy disambiguation', isrcs: ['USRC17607839'], status: 'queued' },
  ] });
  const res = await page.evaluate((text) => window.__falconTest.importQueueJson(text, 'legacy-import'), legacyJson);
  console.log('legacy import result:', JSON.stringify(res));
  ck(res.added === 2, `both legacy-shaped rows are accepted (added=${res.added}, skipped=${res.skipped || 0})`);
  const queue = await page.evaluate(() => window.__falconTest.getQueue());
  const rel = queue.find(i => i.mbid === 'bbbbbbbb-2222-0000-0000-000000000000');
  const rec = queue.find(i => i.mbid === 'cccccccc-2222-0000-0000-000000000000');
  ck(rel && Array.isArray(rel.cover) && rel.cover[0]?.url === 'https://example.invalid/legacy.jpg', `legacy single-object cover upgrades to cover[0] (got ${JSON.stringify(rel?.cover)})`);
  ck(rel && rel.cover[0]?.comment === 'legacy image comment', `legacy item-level comment lands on cover[0].comment for a release row (got "${rel?.cover?.[0]?.comment}")`);
  ck(rec && rec.disambiguation === 'legacy disambiguation', `legacy item-level comment lands on disambiguation for a recording row (got "${rec?.disambiguation}")`);
}

// --- 4. runCoverItem resolves type_id from the entry's own `type`, not
//     hardcoded "front". ---
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const calls = [];
  await page.route('**/ws/js/cover-art-upload/**', route => { calls.push('sign'); route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ action: 'https://fake-archive.invalid/upload3', image_id: 42, nonce: 'n3', formdata: {} }) }); });
  await page.route('https://fake-archive.invalid/upload3', route => { calls.push('upload'); route.fulfill({ status: 200, body: 'ok' }); });
  await page.route('**/release/*/add-cover-art', route => {
    if (route.request().method() === 'GET') {
      calls.push('form-get');
      route.fulfill({ status: 200, contentType: 'text/html', body: `<form method="POST" action="/x">
        <label><input type="checkbox" name="add-cover-art.type_id" value="1">Front</label>
        <label><input type="checkbox" name="add-cover-art.type_id" value="3">Booklet</label>
      </form>` });
    } else {
      calls.push({ kind: 'form-post', body: route.request().postData() });
      route.fulfill({ status: 200, body: 'ok' });
    }
  });
  await page.route('**/fake-booklet.jpg', route => route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: Buffer.from('89504e470d0a1a0a', 'hex') }));
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  // gmFetch needs GM_xmlhttpRequest — the ctx-level addInitScript above only
  // covers GM_getValue/setValue/deleteValue/info; shim it here too (plain
  // fetch, since every URL involved is already intercepted via page.route).
  await page.evaluate(() => {
    window.GM_xmlhttpRequest = (opts) => {
      fetch(opts.url).then(async r => {
        if (!r.ok) return opts.onerror && opts.onerror();
        const blob = await r.blob();
        opts.onload({ status: r.status, response: blob });
      }).catch(() => opts.onerror && opts.onerror());
    };
  });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  const result = await page.evaluate(async () => {
    const item = { mbid: 'dddddddd-2222-0000-0000-000000000000', note: '', cover: [{ url: 'https://musicbrainz.org/fake-booklet.jpg', comment: 'a booklet page', type: 'Booklet', candidates: [] }] };
    await window.__falconTest.runCoverItem(item, '[test]', { querySelector: () => null, dataset: {} });
    return { status: item.status, error: item.error };
  });
  console.log('type-resolution result:', JSON.stringify(result));
  ck(result.status === 'done', `item finishes done (got ${JSON.stringify(result)})`);
  const postCall = calls.find(c => c && c.kind === 'form-post');
  const body = postCall && new URLSearchParams(postCall.body);
  ck(!!body, 'the form-post call was captured');
  ck(body && body.get('add-cover-art.type_id') === '3', `type_id resolved to Booklet's own value (3), not Front's (1) (got ${body?.get('add-cover-art.type_id')})`);
  ck(body && body.get('add-cover-art.comment') === 'a booklet page', 'the entry\'s own comment carried through to the submit');
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
