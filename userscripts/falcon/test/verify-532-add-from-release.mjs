// #532 (majkinetor): "When falcon is started on release page, it is empty. We
// could have an Add button that can add related entities so we could edit
// supported fields. I am interested in recordings disambiguation now. It could
// also serve as a way to produce JSON that person can fill up later."
//
// So the button seeds the queue with the release's own entities as EMPTY,
// editable rows — not as work to submit. That makes two things load-bearing,
// and both are asserted here:
//   * the rows arrive named and typed, so a disambiguation can be typed in;
//   * pressing Start with rows still blank SKIPS them instead of opening an
//     edit page per untouched row and submitting nothing.
//
// Runs against the sandbox and never submits: every POST to /edit is aborted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';   // sandbox release used by the GT tests
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 950 } });
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

let posts = 0;
await page.route('**/*', route => {
  const r = route.request();
  if (r.method() === 'POST' && /\/edit/.test(r.url())) { posts++; return route.abort(); }
  return route.continue();
});

for (let a = 1; ; a++) {
  try { await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 3) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
}
await page.waitForTimeout(1200);
await page.addScriptTag({ content: code });
await page.waitForTimeout(600);

// ── the button only exists where there is something to add ──────────────────
const ctxSeen = await page.evaluate(() => window.__falconTest.pageEntityContext());
console.log('page context: ' + JSON.stringify(ctxSeen));
ck(ctxSeen && ctxSeen.kind === 'release' && ctxSeen.mbid === '3a37a35f-1e06-457f-9b2a-46155c5c03ce', 'a release page is recognised');

// ── the graph → tuples mapping ──────────────────────────────────────────────
const t = await page.evaluate(async (mbid) => {
  const j = await window.__falconTest.fetchReleaseGraph(mbid);
  const recs = window.__falconTest.releaseGraphTuples(j, { recording: true }, '');
  const all = window.__falconTest.releaseGraphTuples(j, { recording: true, release: true, release_group: true, artist: true, label: true }, '');
  return {
    title: j && j.title,
    trackCount: (j.media || []).reduce((a, m) => a + (m.tracks || []).length, 0),
    recs: recs.length,
    recNamed: recs.filter(x => x.name).length,
    recTypes: [...new Set(recs.map(x => x.entityType))],
    allTypes: [...new Set(all.map(x => x.entityType))].sort(),
    dupes: all.length - new Set(all.map(x => x.entityType + ':' + x.mbid)).size,
  };
}, RELEASE);
console.log('tuples: ' + JSON.stringify(t));
ck(t.recs > 0 && t.recs === t.trackCount, `every track became a recording row (${t.recs}/${t.trackCount})`);
ck(t.recNamed === t.recs, 'each row carries its title, so no follow-up name lookup is needed');
ck(t.recTypes.join() === 'recording', 'asking for recordings yields only recordings');
ck(t.allTypes.includes('release') && t.allTypes.includes('release_group') && t.allTypes.includes('artist'), 'the other types are available too — ' + t.allTypes.join(', '));
ck(t.dupes === 0, 'entities repeated across tracks are deduped');

// ── the UI: open the panel, use the menu ────────────────────────────────────
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-add-page', { timeout: 15000 });
ck(await page.locator('#falcon-add-page').isVisible(), 'the Add button is shown on a release page');
await page.click('#falcon-add-page');
await page.waitForSelector('.falcon-addmenu', { timeout: 5000 });
await page.click('.falcon-addmenu [data-a="ok"]');            // recordings are pre-ticked
await page.waitForFunction(() => window.__falconTest.getQueue().length > 0, null, { timeout: 30000 });
await page.waitForTimeout(500);
const q = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ t: i.entityType, n: i.name, u: i.urls.length, d: i.disambiguation, s: i.status })));
console.log('queued: ' + q.length + ' — ' + JSON.stringify(q.slice(0, 3)));
ck(q.length === t.recs, `every recording landed in the queue (${q.length})`);
ck(q.every(x => x.t === 'recording'), 'all typed as recordings');
ck(q.every(x => x.n), 'all named in the queue');
ck(q.every(x => x.u === 0 && !x.d), 'and all EMPTY — these are rows to edit, not work to submit');

// ── Start with blank rows must skip, not fail ───────────────────────────────
// Fill a disambiguation on exactly one row, leave the rest blank.
await page.evaluate(() => {
  const qq = window.__falconTest.getQueue();
  qq[0].disambiguation = 'live';
  window.__falconTest.setQueue(qq);
});
await page.evaluate(() => window.__falconTest.start());
await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 120000 }).catch(() => {});
const after = await page.evaluate(() => {
  const qq = window.__falconTest.getQueue();
  return { skipped: qq.filter(i => i.status === 'skipped').length, failed: qq.filter(i => i.status === 'failed').length, total: qq.length,
           firstStatus: qq[0].status, sample: qq.find(i => i.status === 'skipped')?.error };
});
console.log('after start: ' + JSON.stringify(after) + `  (POSTs attempted: ${posts})`);
ck(after.skipped === after.total - 1, `every untouched row was skipped (${after.skipped} of ${after.total - 1})`);
ck(/nothing to submit/i.test(after.sample || ''), 'and says why');
ck(after.firstStatus !== 'skipped', 'the row that WAS filled in is NOT skipped — it has work to do');
// The filled row genuinely tries to submit; this harness aborts every POST to
// /edit, so it necessarily ends up 'failed'. That is the test blocking it, not
// a defect — the property that matters is that the BLANK rows never reach MB.
ck(posts === 1, `only the one filled row attempted a submit (${posts} POST(s) — the blank rows never touched MusicBrainz)`);
ck(after.failed === 1, 'and it is the only non-skipped outcome (its POST was aborted by this test)');
// ── #533 follow-up (majkinetor): "Add from group should have releases" ──────
// On a release-group page the menu only ever offered the group itself. The
// count is checked against MB's own release-count for the group, so a paging
// bug that silently dropped releases would fail here rather than look like a
// group that just has fewer releases.
{
    const rgid = await page.evaluate(async (mbid) => {
        const j = await window.__falconTest.fetchReleaseGraph(mbid);
        return j['release-group'].id;
    }, RELEASE);
    for (let a = 1; ; a++) {
        try { await page.goto(`https://test.musicbrainz.org/release-group/${rgid}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
        catch (e) { if (a >= 3) throw e; await page.waitForTimeout(4000); }
    }
    await page.waitForTimeout(1000);
    await page.addScriptTag({ content: code });
    await page.waitForTimeout(500);
    const rgCtx = await page.evaluate(() => window.__falconTest.pageEntityContext());
    ck(rgCtx && rgCtx.kind === 'release-group', 'a release-group page is recognised');

    await page.click('#falcon-launcher');
    await page.waitForSelector('#falcon-add-page', { timeout: 15000 });
    ck((await page.locator('#falcon-add-page .falcon-bt').textContent()) === 'Add from group', 'the button says "Add from group" there');
    await page.click('#falcon-add-page');
    await page.waitForSelector('.falcon-addmenu', { timeout: 5000 });
    const opts = await page.evaluate(() => [...document.querySelectorAll('.falcon-addmenu label')].map(l => ({ w: l.querySelector('input').dataset.w, checked: l.querySelector('input').checked })));
    console.log('release-group menu: ' + JSON.stringify(opts));
    ck(opts.some(o => o.w === 'release'), "the menu offers the group's releases (#533)");
    ck(opts.find(o => o.w === 'release_group')?.checked === true, 'and the group itself is still the pre-ticked default');

    await page.evaluate(() => window.__falconTest.setQueue([]));
    await page.check('.falcon-addmenu input[data-w="release"]');
    await page.click('.falcon-addmenu [data-a="ok"]');
    await page.waitForFunction(() => window.__falconTest.getQueue().length > 1, null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(800);
    const rgq = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ t: i.entityType, n: i.name })));
    const expected = await page.evaluate(async (id) => {
        const j = await window.__falconTest.mbThrottle.fetchJson(`https://test.musicbrainz.org/ws/2/release?release-group=${id}&limit=1&fmt=json`, undefined, true);
        return j['release-count'];
    }, rgid);
    const got = rgq.filter(x => x.t === 'release').length;
    console.log(`queued from group: ${got} release(s) + ${rgq.filter(x => x.t === 'release_group').length} group; MB says the group has ${expected}`);
    ck(got === expected, `every release in the group was queued (${got}/${expected})`);
    ck(rgq.filter(x => x.t === 'release_group').length === 1, 'along with the group itself');
    ck(rgq.filter(x => x.t === 'release').every(x => x.n), 'each release row arrives named');
}

ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
