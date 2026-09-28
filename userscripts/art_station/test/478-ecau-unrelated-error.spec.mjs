// #478 (majkinetor): "Enhanced Cover Art Uploads" sometimes logs "Failed to add some
// provider import buttons: HTTP error 503" while a sourcing fetch is in flight, and that
// unrelated warning discarded the images being loaded.
//
// ECAU (ROpdebee/mb-userscripts, mb_enhanced_cover_art_uploads/index.ts) starts two
// independent operations at page load: processSeedingParameters() (the x_seed fetch Art
// Station waits on) and addImportButtons() (its own "Import from X" row). Both log into
// #ROpdebee_log_container, so ecauError() taking "the last error or warning" could
// return a button-row failure that says nothing about the seeded fetch.
//
// A stub cover-art page, no network: ecauError() is given each log shape directly.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', gm: { name: 'Art Station', xhr: 'none' } });

test("ECAU's unrelated import-button warning is not read as a sourcing failure", { tag: ['@unit'] }, async ({ page, context, inject }) => {
  // the script only runs on a cover-art or event-art URL
  const URL = 'https://musicbrainz.org/release/00000000-0000-0000-0000-000000000000/cover-art';
  await context.route(URL, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!DOCTYPE html><html><body></body></html>' }));
  await page.goto(URL);
  await inject('art_station', { waitFor: '__artStationTest' });

  const ecauError = html => page.evaluate(h => { document.body.innerHTML = h; return window.__artStationTest.ecauError(document); }, html);
  const WARN = '<span class="msg warning">Failed to add some provider import buttons: HTTP error 503</span>';
  const ERR = '<span class="msg error">Failed to fetch image: invalid URL</span>';
  const log = inner => `<div id="ROpdebee_log_container">${inner}</div>`;

  const alone = await ecauError(log(WARN));
  check(alone === null, `the import-buttons warning alone is not a sourcing failure (${JSON.stringify(alone)})`);
  const after = await ecauError(log(WARN + ERR));
  check(/failed to fetch image/i.test(after || ''), `a real seeding error after it is still surfaced (${JSON.stringify(after)})`);
  const before = await ecauError(log(ERR + WARN));
  check(/failed to fetch image/i.test(before || ''), `a real error before it is not masked by it (${JSON.stringify(before)})`);
  check(await ecauError('') === null, 'no log container at all: null');
});
