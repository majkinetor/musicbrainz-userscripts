// #508 follow-up (majkinetor): "Add new option - [x] Open from Harmony in
// new tab (on by default). 'On' is what we do today. Implement 'Off' option
// that doesn't open new tab but opens MB in existing one." — the "existing
// one" being the Harmony tab itself, navigated away to MusicBrainz instead
// of a new window.open()'d tab.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, frames } from '../../../dev/test/harness.mjs';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("#508: open new tab option", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  const REC1 = 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7';
  const HTML = `<html><body>
  <div class="action">
    <div><p>
      <a href="https://musicbrainz.org/recording/${REC1}/edit?edit-recording.url.0.text=https%3A%2F%2Fwww.deezer.com%2Ftrack%2F370242433&edit-recording.url.0.link_type_id=268&edit-recording.edit_note=Matched">Link external IDs</a> of
      <span class="entity-links">
        <a href="https://www.deezer.com/track/370242433"><span class="deezer"></span></a>
        <a href="https://musicbrainz.org/recording/${REC1}"><span class="musicbrainz"></span>Dusk</a>
      </span> to MusicBrainz
    </p></div>
  </div>
  </body></html>`;

  const ck = check;

  async function clickHarmonyButton({ openInNewTab }) {
    const page = await context.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    const openedUrls = [];
    await page.exposeFunction('__recordOpen', (url) => openedUrls.push(url));
    await page.addInitScript((openInNewTab) => {
      const store = new Map();
      store.set('falcon:openHarmonyInNewTab', openInNewTab);
      window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
      window.GM_setValue = (k, v) => store.set(k, v);
      window.GM_deleteValue = k => store.delete(k);
      window.GM_info = { script: { name: 'Falcon', version: 't' } };
      const realOpen = window.open.bind(window);
      window.open = (url, ...rest) => { window.__recordOpen(url); return { closed: false }; };   // opened (null reads as a blocked popup)
    }, openInNewTab);
    await page.route('https://harmony.pulsewidth.org.uk/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: HTML }));
    // Harmony's target is production MusicBrainz: the navigation is answered here, never sent
    await page.route(/^https:\/\/musicbrainz\.org\//, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>MusicBrainz (stand-in)</body></html>' }));
    await page.goto('https://harmony.pulsewidth.org.uk/release/actions', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ content: code });
    await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
    await page.waitForSelector('#falcon-harmony-btn', { timeout: 5000 });
    await page.click('#falcon-harmony-btn');
    await frames(page);
    const finalUrl = page.url();
    await page.close();
    return { openedUrls, finalUrl, errs };
  }

  // 1. default (on): opens a new tab via window.open, current tab untouched.
  const onResult = await clickHarmonyButton({ openInNewTab: true });
  console.log('default (on):', JSON.stringify(onResult));
  ck(onResult.openedUrls.length === 1 && /musicbrainz\.org.*falcon=/.test(onResult.openedUrls[0]), `default behavior: window.open() called with the MB target (got ${JSON.stringify(onResult.openedUrls)})`);
  ck(onResult.finalUrl.includes('harmony.pulsewidth.org.uk'), 'the Harmony tab itself is untouched — still on Harmony');
  ck(onResult.errs.length === 0, 'no page errors: ' + JSON.stringify(onResult.errs.slice(0, 3)));

  // 2. off: navigates the CURRENT tab instead — no window.open() call at all.
  const offResult = await clickHarmonyButton({ openInNewTab: false });
  console.log('off:', JSON.stringify(offResult));
  ck(offResult.openedUrls.length === 0, `option off: window.open() is never called (got ${JSON.stringify(offResult.openedUrls)})`);
  ck(/musicbrainz\.org.*falcon=/.test(offResult.finalUrl), `option off: the SAME tab navigates to the MB target instead (got "${offResult.finalUrl}")`);
  ck(offResult.errs.length === 0, 'no page errors: ' + JSON.stringify(offResult.errs.slice(0, 3)));
});
