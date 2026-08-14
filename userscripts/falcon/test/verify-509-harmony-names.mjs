// #509 (majkinetor) — "Since Harmony already resolves names, we could just
// fetch and use them instead of bombing MB. JSON already supports `name`
// attribute." Each Harmony action row already shows the resolved entity as
// an icon+name pill (musicbrainz icon + "Dusk") next to the provider icons —
// scrapeHarmonyActions should pick that up so addToQueue never needs its own
// MB round-trip for Harmony-sourced items. Row HTML below is a trimmed copy
// of a real one captured live from harmony.pulsewidth.org.uk.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const REC1 = 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7';
const REC2 = '5355d372-6d79-45df-bfc6-6a113756fb14';
const HTML = `
<div class="action">
  <div><p>
    <a href="https://musicbrainz.org/recording/${REC1}/edit?edit-recording.url.0.text=https%3A%2F%2Fwww.deezer.com%2Ftrack%2F370242433&edit-recording.url.0.link_type_id=268&edit-recording.edit_note=Matched">Link external IDs</a> of
    <span class="entity-links">
      <a href="https://www.deezer.com/track/370242433"><span class="deezer">D</span></a>
      <a href="https://musicbrainz.org/recording/${REC1}"><span class="musicbrainz"></span>Dusk</a>
    </span> to MusicBrainz
  </p></div>
</div>
<div class="action">
  <div><p>
    <a href="https://musicbrainz.org/recording/${REC2}/edit?edit-recording.url.0.text=https%3A%2F%2Fwww.deezer.com%2Ftrack%2F773599202&edit-recording.url.0.link_type_id=268&edit-recording.edit_note=Matched">Link external IDs</a> of
    <span class="entity-links">
      <a href="https://www.deezer.com/track/773599202"><span class="deezer">D</span></a>
      <a href="https://musicbrainz.org/recording/${REC2}"><span class="musicbrainz"></span>Spirit Remains</a>
    </span> to MusicBrainz
  </p></div>
</div>`;

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const errs = []; const page = await ctx.newPage();
page.on('pageerror', e => errs.push(e.message));

// harmony.pulsewidth.org.uk is one of the script's @match hosts — matters for
// MB_TARGET resolving to https://musicbrainz.org (not location.origin).
await page.route('https://harmony.pulsewidth.org.uk/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: `<html><body>${HTML}</body></html>` }));
// fail the test hard if Falcon ever actually hits MB's API — the whole point
// of #509 is that a Harmony-sourced name must NOT trigger this.
let mbApiHit = false;
// fetchEntityName runs off MB_ORIGIN (location.origin) — on the Harmony page
// itself that's harmony.pulsewidth.org.uk, not musicbrainz.org (in real
// usage this call happens after the cross-tab handoff, on the actual MB
// tab) — match /ws/2/ on any origin so the assertion holds regardless.
await page.route('**/ws/2/**', route => { mbApiHit = true; route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });

await page.goto('https://harmony.pulsewidth.org.uk/release/actions', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });

const tuples = await page.evaluate(() => window.__falconTest.scrapeHarmonyActions());
console.log('scraped tuples:', JSON.stringify(tuples.map(t => ({ mbid: t.mbid, name: t.name }))));
ck(tuples.length === 2, `both action rows scraped (got ${tuples.length})`);
ck(tuples.every(t => t.name), `every tuple carries a name (got ${JSON.stringify(tuples.map(t => t.name))})`);
const rec1 = tuples.find(t => t.mbid === REC1);
const rec2 = tuples.find(t => t.mbid === REC2);
ck(rec1 && rec1.name === 'Dusk', `first recording's name scraped correctly (got "${rec1?.name}")`);
ck(rec2 && rec2.name === 'Spirit Remains', `second recording's name scraped correctly (got "${rec2?.name}")`);

// addToQueue must adopt the scraped name directly, with no MB fetch at all.
const queued = await page.evaluate((tuples) => {
  window.__falconTest.addToQueue(tuples);
  return window.__falconTest.getQueue().map(i => ({ mbid: i.mbid, name: i.name }));
}, tuples);
console.log('queued items:', JSON.stringify(queued));
ck(queued.length === 2, `both items queued (got ${queued.length})`);
ck(queued.every(i => i.name), `every queued item has a name populated synchronously (got ${JSON.stringify(queued)})`);
await page.waitForTimeout(300); // give any stray async fetchEntityName a chance to fire
ck(!mbApiHit, 'no MB API round-trip was made — the Harmony-scraped name was used directly, not re-fetched');

// sanity: a tuple with NO name (e.g. from a `?falcon=` URL or paste) still
// falls back to Falcon's own fetchEntityName, unaffected by #509.
mbApiHit = false;
await page.evaluate(() => {
  window.__falconTest.addToQueue([{ entityType: 'artist', mbid: 'aaaaaaaa-0000-0000-0000-000000000099', url: 'https://example.com/a' }]);
});
await page.waitForTimeout(300);
ck(mbApiHit, 'a nameless tuple (non-Harmony source) still falls back to fetchEntityName');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
