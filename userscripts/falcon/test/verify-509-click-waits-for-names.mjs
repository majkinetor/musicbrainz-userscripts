// #509 follow-up (majkinetor, live): Harmony renders each row's icon+name
// pill via its OWN async per-entity MB-match lookup, separate from (and
// slower than) the action list itself — on a big release it can still be
// resolving when the button is clicked. The click handler now gives that a
// bounded second chance (polling up to 5s) before finalizing the payload,
// instead of shipping whatever it found on the very first synchronous read.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const REC1 = 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7';
// the name pill starts MISSING — a script on the page adds it 1s later,
// simulating Harmony's own async per-entity resolution finishing late.
const HTML = `<html><body>
<div class="action" id="row1">
  <div><p>
    <a href="https://musicbrainz.org/recording/${REC1}/edit?edit-recording.url.0.text=https%3A%2F%2Fwww.deezer.com%2Ftrack%2F370242433&edit-recording.url.0.link_type_id=268&edit-recording.edit_note=Matched">Link external IDs</a> of
    <span class="entity-links" id="links1">
      <a href="https://www.deezer.com/track/370242433"><span class="deezer"></span></a>
    </span> to MusicBrainz
  </p></div>
</div>
<script>
setTimeout(() => {
  const a = document.createElement('a');
  a.href = 'https://musicbrainz.org/recording/${REC1}';
  a.innerHTML = '<span class="musicbrainz"></span>Dusk';
  document.getElementById('links1').appendChild(a);
}, 1000);
</script>
</body></html>`;

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => {
  window.__gmWrites = [];
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => { store.set(k, v); window.__gmWrites.push([k, v]); };
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
  window.open = () => null;
});
await page.route('https://harmony.pulsewidth.org.uk/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: HTML }));
await page.goto('https://harmony.pulsewidth.org.uk/release/actions', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page.waitForSelector('#falcon-harmony-btn', { timeout: 5000 });

// click IMMEDIATELY — before the 1s setTimeout above has added the name pill.
const clickTime = Date.now();
await page.click('#falcon-harmony-btn');
// the label should switch to "Resolving names…" while it waits
await page.waitForFunction(() => document.getElementById('falcon-harmony-lbl')?.textContent === 'Resolving names…', { timeout: 2000 }).catch(() => {});
const midLabel = await page.evaluate(() => document.getElementById('falcon-harmony-lbl')?.textContent);
console.log('label while waiting:', midLabel);
ck(midLabel === 'Resolving names…', `the button shows it's waiting, not silently stuck (got "${midLabel}")`);

await page.waitForFunction(() => window.__gmWrites.some(([k]) => k.startsWith('falcon:pending:')), { timeout: 8000 });
const elapsed = Date.now() - clickTime;
console.log('elapsed until payload written:', elapsed, 'ms');
ck(elapsed >= 900, `it actually waited for the pill to render, not send instantly (got ${elapsed}ms)`);
ck(elapsed < 5500, `and didn't wait needlessly past when the name arrived (got ${elapsed}ms, cap is 5000ms)`);

const write = await page.evaluate(() => window.__gmWrites.find(([k]) => k.startsWith('falcon:pending:')));
const stored = JSON.parse(write[1]);
console.log('final stored payload:', JSON.stringify(stored));
ck(stored.length === 1 && stored[0].name === 'Dusk', `the late-arriving name made it into the payload (got ${JSON.stringify(stored)})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
