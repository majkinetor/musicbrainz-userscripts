// #799: harmony.mybrainz.dev is another instance of the same Harmony; Falcon's Send N to Falcon
// shows there as on harmony.pulsewidth.org.uk. The Harmony page is a routed stand-in, no network.
import { readFile } from 'node:fs/promises';
import { test, check, sourceOf, mbNoise } from '../../../dev/test/harness.mjs';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test('#799: Send to Falcon on harmony.mybrainz.dev', { tag: ['@unit'] }, async ({ page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  const REC = 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7';
  const HTML = `<html><body><div class="action"><div><p>
    <a href="https://musicbrainz.org/recording/${REC}/edit?edit-recording.url.0.text=https%3A%2F%2Fwww.deezer.com%2Ftrack%2F370242433&edit-recording.url.0.link_type_id=268&edit-recording.edit_note=Matched">Link external IDs</a> of
    <span class="entity-links"><a href="https://musicbrainz.org/recording/${REC}"><span class="musicbrainz"></span>Dusk</a></span> to MusicBrainz
  </p></div></div></body></html>`;
  const errs = []; page.on('pageerror', e => { if (!mbNoise(e.message)) errs.push(e.message); });
  await page.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  await page.route('https://harmony.mybrainz.dev/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: HTML }));
  await page.goto('https://harmony.mybrainz.dev/release/actions', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  const shown = await page.waitForSelector('#falcon-harmony-btn', { timeout: 5000 }).then(() => true, () => false);
  check(shown, 'the Send to Falcon button is on a harmony.mybrainz.dev actions page');
  const label = await page.evaluate(() => document.getElementById('falcon-harmony-lbl')?.textContent);
  check(/Send 1 to Falcon/.test(label || ''), `it counts the action: ${label}`);
  check(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
});
