// #500 (majkinetor) — "Harmony ISRC sending does not work when there are no
// links." When a release's recordings have zero "Link external IDs" actions
// (only a cover + ISRCs), scrapeHarmonyActions has no recording tuples to zip
// isrcs onto at all — they were silently dropped. Falls back to the release's
// own mbid + edit-note (both already in the same MagicISRC href) to resolve
// the real tracklist via MB's own API and place each ISRC on its actual
// recording, once the item is already queued (same shape as #494's cover
// candidates) — Falcon has no synchronous view of the tracklist otherwise.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

// majkinetor's own example, verbatim.
const RELEASE = '517e69e2-7669-4228-9f4d-b29a82f71519';
const MAGICISRC_HREF = `https://magicisrc.kepstin.ca/?isrc1=NLTH62000001&isrc2=NLTH62000002&isrc3=NLTH62000003&isrc4=NLTH62000004&musicbrainzid=${RELEASE}&edit-note=Import+ISRCs+from+https%3A%2F%2Fwww.deezer.com%2Falbum%2F132753742+to+https%3A%2F%2Fmusicbrainz.org%2Frelease%2F${RELEASE}`;

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// 1. harmonyIsrcFallback: parses mbid/isrcs/note straight off the MagicISRC href.
{
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.setContent(`<a href="${MAGICISRC_HREF}">Open with MagicISRC</a>`);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  const fallback = await page.evaluate(() => window.__falconTest.harmonyIsrcFallback());
  console.log('harmonyIsrcFallback:', JSON.stringify(fallback));
  ck(fallback && fallback.mbid === RELEASE, `release mbid parsed from musicbrainzid param (got ${fallback?.mbid})`);
  ck(fallback && fallback.isrcs.length === 4 && fallback.isrcs[0] === 'NLTH62000001', `all 4 isrcs parsed in order (got ${JSON.stringify(fallback?.isrcs)})`);
  ck(fallback && /Import ISRCs/.test(fallback.note), `edit-note carried through (got "${fallback?.note}")`);
}

// 2. resolveIsrcFallback: fetches the release's real tracklist (mocked) and
//    places each isrc on its actual recording, positionally.
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const recMbids = ['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000004'];
  await page.route(`**/ws/2/release/${RELEASE}?inc=recordings&fmt=json`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ media: [{ tracks: recMbids.slice(0, 2).map((id, i) => ({ position: i + 1, recording: { id } })) }, { tracks: recMbids.slice(2).map((id, i) => ({ position: i + 1, recording: { id } })) }] }),
  }));
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.evaluate(() => window.__falconTest.setQueue([]));
  await page.evaluate(({ release, isrcs, note }) => window.__falconTest.resolveIsrcFallback(release, isrcs, note),
    { release: RELEASE, isrcs: ['NLTH62000001', 'NLTH62000002', 'NLTH62000003', 'NLTH62000004'], note: 'test note' });
  await page.waitForTimeout(500);
  const queue = await page.evaluate(() => window.__falconTest.getQueue());
  console.log('resolved queue:', JSON.stringify(queue, null, 1));
  ck(queue.length === 4, `4 recording items created, one per isrc (got ${queue.length})`);
  ck(queue.every(i => i.entityType === 'recording' && i.urls.length === 0), 'every item is a url-less recording (isrc-only)');
  recMbids.forEach((mbid, i) => {
    const it = queue.find(q => q.mbid === mbid);
    ck(!!it && it.isrcs[0] === `NLTH6200000${i + 1}`, `recording ${mbid} (track ${i + 1}) gets isrc${i + 1} (got ${JSON.stringify(it?.isrcs)})`);
  });
  ck(queue.every(i => i.note === 'test note'), 'edit note carried onto every resolved item');
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// 3. End-to-end via ensureHarmonyButton: a Harmony page with ISRCs but ZERO
//    recording "Link external IDs" actions still gets picked up — count
//    includes the isrcs, and the stored payload carries a pendingIsrcs tuple.
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  // ensureHarmonyButton only ever runs when ON_HARMONY (hostname-gated) — a
  // real navigation first, then swap in exactly the anchors this test needs.
  await page.goto('https://harmony.pulsewidth.org.uk/release/actions', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.setContent(`
    <a href="https://musicbrainz.org/release/${RELEASE}">Open in MusicBrainz</a>
    <a href="${MAGICISRC_HREF}">Open with MagicISRC</a>
  `);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.waitForSelector('#falcon-harmony-btn', { timeout: 5000 });
  const info = await page.evaluate(() => ({
    btnText: document.getElementById('falcon-harmony-lbl')?.textContent,
    recCount: window.__falconTest.scrapeHarmonyActions().filter(t => t.entityType === 'recording').length,
  }));
  console.log('live-ish harmony state:', JSON.stringify(info));
  ck(info.recCount === 0, 'sanity: zero recording link-tuples on this page (the reported scenario)');
  ck(/Send 4 to Falcon/.test(info.btnText || ''), `button count includes the 4 isrcs even with no recording links (label="${info.btnText}")`);

  const clicked = await page.evaluate(() => new Promise(resolveClick => {
    const origOpen = window.open;
    window.open = url => { window.open = origOpen; resolveClick(url); return { closed: false }; };
    document.getElementById('falcon-harmony-btn').click();
  }));
  const token = new URL(clicked).searchParams.get('falcon');
  const stored = await page.evaluate(tok => JSON.parse(window.GM_getValue('falcon:pending:' + tok)), token);
  console.log('stored payload:', JSON.stringify(stored));
  const isrcTuple = stored.find(t => t.pendingIsrcs);
  ck(!!isrcTuple, 'a pendingIsrcs tuple is present in the stored Harmony payload');
  ck(isrcTuple && isrcTuple.pendingIsrcs.mbid === RELEASE, 'release mbid correct');
  ck(isrcTuple && isrcTuple.pendingIsrcs.isrcs.length === 4, 'all 4 isrcs carried into the payload');
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
