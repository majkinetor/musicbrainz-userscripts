// #495 (majkinetor) — "enable Falcon to add links to RG and release." Two new
// wrinkles vs artist/label/recording: MB's URL path for release_group is
// 'release-group' (hyphen) even though the internal entityType/seed-param
// prefix stays 'release_group' (underscore, MB's own inconsistency — verified
// live), and the release editor is TABBED — its own "Enter edit" button lives
// inside a display:none "Edit note" panel until that tab is genuinely
// activated (a bare .click() doesn't trigger jQuery UI's handler; a real
// dispatched MouseEvent does — verified live, see activateReleaseEditNoteTab).
// A release item can carry urls[] AND cover (#494) at once — two independent
// MB edits on the same entity (see runCoverItem's priorLinks merge).
//
// majkinetor: "I don't have external seeder right now so we will test it on
// test.musicbrainz" — the live submit checks below run against
// test.musicbrainz.org (sanctioned sandbox, real submits are fine there),
// never production.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

// Real ids off test.musicbrainz.org's own dataset (found live via /ws/2/release?query=*).
const TEST_RELEASE = '3d2edcfc-d823-4e04-abc6-1dca9702af94';
const TEST_RG = 'bff3d538-eb21-450f-9f38-eafcf47dfa07';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
  window.GM_xmlhttpRequest = (opts) => {
    fetch(opts.url).then(async r => {
      if (!r.ok) return opts.onerror && opts.onerror();
      opts.onload({ status: r.status, response: await r.blob() });
    }).catch(() => opts.onerror && opts.onerror());
  };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// 1. Pure logic: entityUrlSegment + buildSeedEditUrl path/prefix split.
{
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  const seg = await page.evaluate(() => ({
    rg: window.__falconTest.entityUrlSegment('release_group'),
    rel: window.__falconTest.entityUrlSegment('release'),
    art: window.__falconTest.entityUrlSegment('artist'),
  }));
  console.log('entityUrlSegment:', JSON.stringify(seg));
  ck(seg.rg === 'release-group', `release_group maps to the hyphenated URL path (got "${seg.rg}")`);
  ck(seg.rel === 'release' && seg.art === 'artist', 'everything else maps to itself');

  const seedUrl = await page.evaluate((mbid) => window.__falconTest.buildSeedEditUrl({
    entityType: 'release_group', mbid, urls: [{ url: 'https://example.com/rg-link', linkTypeId: '89' }], note: 'n', comment: '', isrcs: [],
  }), TEST_RG);
  console.log('RG seed url:', seedUrl);
  ck(seedUrl.includes(`/release-group/${TEST_RG}/edit?`), 'seed URL path uses the hyphenated release-group segment');
  ck(seedUrl.includes('edit-release_group.url.0.text='), 'seed param prefix uses the underscored release_group (matches MB\'s own scheme)');
}

// 2. Live, read-only: release editor tab-activation reveals its own submit
//    button, without ever clicking it — production is fine to READ from.
{
  const page = await ctx.newPage();
  await page.goto('https://musicbrainz.org/release/3b60d941-e4c7-4dca-9b4d-7a11d0268383/edit', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.log('NOT LOGGED IN (production)'); await ctx.close(); process.exit(3); }
  await page.waitForTimeout(1500);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  const before = await page.evaluate(() => { const b = document.querySelector('#enter-edit'); return b ? getComputedStyle(b).display : null; });
  const activated = await page.evaluate(() => window.__falconTest.activateReleaseEditNoteTab(document));
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => { const b = document.querySelector('#enter-edit'); return b ? { display: getComputedStyle(b).display, visible: b.offsetParent !== null } : null; });
  console.log('tab activation:', JSON.stringify({ before, activated, after }));
  ck(before === 'none', `sanity: the submit button starts hidden on the release editor's default tab (got "${before}")`);
  ck(activated === true, 'activateReleaseEditNoteTab found and clicked the real tab link');
  ck(after && after.visible === true, `the submit button is visible after activation (got ${JSON.stringify(after)})`);
  await page.close();
}

// 3. Live, real submit on test.musicbrainz.org (sanctioned sandbox — majkinetor's
//    own instruction for this issue): add a url to a real release AND its
//    release-group through Falcon's actual queue/worker pipeline, end to end,
//    including the tab-switch for the release. Both real submits are fine
//    here — this is exactly what the sandbox is for.
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const marker = 'falcon495-' + Date.now();
  await page.goto(`https://test.musicbrainz.org/release/${TEST_RELEASE}`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.log('NOT LOGGED IN (test.musicbrainz.org)'); await ctx.close(); process.exit(3); }
  await page.waitForTimeout(500);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 5000 });
  // Wikidata auto-classifies unambiguously for release_group. A release has
  // MORE than one valid type for a bare wikidata url (ambiguous — needs an
  // explicit type), so it gets a Discogs release-page url instead, which
  // release entities classify unambiguously as "discogs". Both sidestep MB's
  // "that's just an example" placeholder-domain rejection (example.com).
  await page.evaluate(({ rel, rg, marker }) => window.__falconTest.setQueue([
    { id: 'rel1', entityType: 'release', mbid: rel, urls: [{ url: `https://www.discogs.com/release/${marker}1`, linkTypeId: null }], note: 'falcon #495 test — safe to ignore/revert', comment: '', isrcs: [], cover: { url: '', candidates: [] }, name: null, urlResults: null, status: 'queued', error: '' },
    { id: 'rg1', entityType: 'release_group', mbid: rg, urls: [{ url: `https://www.wikidata.org/wiki/Q${marker}2`, linkTypeId: null }], note: 'falcon #495 test — safe to ignore/revert', comment: '', isrcs: [], cover: { url: '', candidates: [] }, name: null, urlResults: null, status: 'queued', error: '' },
  ]), { rel: TEST_RELEASE, rg: TEST_RG, marker: marker.replace(/\D/g, '') });
  await page.evaluate(() => window.__falconTest.start());
  await page.waitForFunction(() => {
    const q = window.__falconTest.getQueue();
    return q.every(i => i.status !== 'queued' && i.status !== 'active');
  }, null, { timeout: 40000 }).catch(() => {});
  const result = await page.evaluate(() => window.__falconTest.getQueue());
  console.log('test.musicbrainz.org result:', JSON.stringify(result, null, 1));
  const relResult = result.find(i => i.id === 'rel1');
  const rgResult = result.find(i => i.id === 'rg1');
  ck(relResult?.status === 'done', `release link submitted successfully on test.musicbrainz.org (status=${relResult?.status}, error=${relResult?.error})`);
  ck(rgResult?.status === 'done', `release-group link submitted successfully on test.musicbrainz.org (status=${rgResult?.status}, error=${rgResult?.error})`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// 4. Dual-path merge logic: a release item can have BOTH urls[] (submitted
//    via the iframe/form pipeline) and cover (via runCoverItem's separate API
//    flow) — runCoverItem's `priorLinks` argument folds the two independent
//    outcomes into one final status/error. Exercised directly (mocked
//    sign/upload/register, same pattern as #494's own runCoverItem test) —
//    no need to redo a live iframe run just to prove the merge arithmetic.
{
  const page = await ctx.newPage();
  await page.route('**/ws/js/cover-art-upload/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ action: 'https://fake-archive.invalid/upload', image_id: 1, nonce: 'n', formdata: {} }) }));
  await page.route('https://fake-archive.invalid/upload', route => route.fulfill({ status: 200, body: 'ok' }));
  let registerShouldFail = false;
  await page.route('**/release/*/add-cover-art', route => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'text/html', body: '<form method="POST" action="/x"></form>' });
    return route.fulfill({ status: registerShouldFail ? 500 : 200, contentType: 'text/html', body: 'ok' });
  });
  await page.route('**/fake-cover-merge.jpg', route => route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: Buffer.from('89504e470d0a1a0a', 'hex') }));
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });

  const cases = [
    { priorStatus: 'done', priorError: '', coverFails: false, expect: 'done' },
    { priorStatus: 'done', priorError: '', coverFails: true, expect: 'partial' },
    { priorStatus: 'failed', priorError: 'link rejected', coverFails: false, expect: 'partial' },
    { priorStatus: 'failed', priorError: 'link rejected', coverFails: true, expect: 'failed' },
  ];
  for (const c of cases) {
    registerShouldFail = c.coverFails;
    const outcome = await page.evaluate(async ({ priorStatus, priorError }) => {
      const item = { mbid: 'dddddddd-2222-0000-0000-000000000000', comment: '', note: '', cover: { url: 'https://musicbrainz.org/fake-cover-merge.jpg', candidates: [] } };
      await window.__falconTest.runCoverItem(item, '[test]', { querySelector: () => null, dataset: {} }, { status: priorStatus, error: priorError });
      return { status: item.status, error: item.error };
    }, { priorStatus: c.priorStatus, priorError: c.priorError });
    ck(outcome.status === c.expect, `links=${c.priorStatus}${c.coverFails ? '+cover fails' : '+cover ok'} -> ${c.expect} (got ${outcome.status}, error="${outcome.error}")`);
  }
  await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
