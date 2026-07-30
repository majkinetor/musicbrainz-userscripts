// #478 (majkinetor): "Enhanced Cover Art Uploads" sometimes logs "Failed to add
// some provider import buttons: HTTP error 503" while a sourcing fetch is
// in-flight, and that unrelated warning was discarding the images currently
// being loaded.
//
// Checked ECAU's own source (ROpdebee/mb-userscripts src/
// mb_enhanced_cover_art_uploads/index.ts): at page load it kicks off TWO
// independent operations — app.processSeedingParameters() (the x_seed-driven
// fetch Art Station actually waits on) and app.addImportButtons() (populates
// ECAU's own "Import from X" button row from the release's existing external
// links — unrelated to a seeded fetch). Both log into the same
// #ROpdebee_log_container, so ecauError() picking "the last error/warning"
// could return a button-row failure that has nothing to do with whether the
// seeded fetch succeeded.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'art_station.user.js'), 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { window.GM = { xmlHttpRequest: () => {}, info: { script: { version: 't' } } }; window.GM_xmlhttpRequest = () => {}; });
// the script bails out at the very top unless location.pathname matches a
// cover-art/event-art URL — route a fake same-shaped URL to a blank page so
// it actually runs, with no real network access needed.
const FAKE_URL = 'https://musicbrainz.org/release/00000000-0000-0000-0000-000000000000/cover-art';
await page.route(FAKE_URL, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!DOCTYPE html><html><body></body></html>' }));
await page.goto(FAKE_URL);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__artStationTest, null, { timeout: 10000 });

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// case 1: ONLY the unrelated "import buttons" warning present (this exact
// scenario from the bug report) — must be ignored, not surfaced as a failure
const case1 = await page.evaluate(() => {
  document.body.innerHTML = `<div id="ROpdebee_log_container">
    <span class="msg warning">Failed to add some provider import buttons: HTTP error 503</span>
  </div>`;
  return window.__artStationTest.ecauError(document);
});
ck(case1 === null, `an unrelated "import buttons" warning alone is NOT treated as a sourcing failure (got ${JSON.stringify(case1)})`);

// case 2: the unrelated warning appears, but a REAL seeding failure comes
// after it — the real one must still be surfaced (it's the last relevant one)
const case2 = await page.evaluate(() => {
  document.body.innerHTML = `<div id="ROpdebee_log_container">
    <span class="msg warning">Failed to add some provider import buttons: HTTP error 503</span>
    <span class="msg error">Failed to fetch image: invalid URL</span>
  </div>`;
  return window.__artStationTest.ecauError(document);
});
ck(/failed to fetch image/i.test(case2 || ''), `a genuine seeding error is still surfaced even alongside the unrelated warning (got ${JSON.stringify(case2)})`);

// case 3: the unrelated warning appears AFTER a real error — real error must
// still win (the unrelated one shouldn't mask an earlier real failure by
// simply not being the literal last node once filtered)
const case3 = await page.evaluate(() => {
  document.body.innerHTML = `<div id="ROpdebee_log_container">
    <span class="msg error">Failed to fetch image: invalid URL</span>
    <span class="msg warning">Failed to add some provider import buttons: HTTP error 503</span>
  </div>`;
  return window.__artStationTest.ecauError(document);
});
ck(/failed to fetch image/i.test(case3 || ''), `a real error before the unrelated warning is still returned, not masked (got ${JSON.stringify(case3)})`);

// case 4: no ECAU log container at all → null, unchanged from before
const case4 = await page.evaluate(() => { document.body.innerHTML = ''; return window.__artStationTest.ecauError(document); });
ck(case4 === null, 'no log container at all still returns null');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await browser.close();
process.exit(fail ? 1 : 0);
