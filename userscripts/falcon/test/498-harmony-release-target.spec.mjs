// #498 (chaban-mb via majkinetor) — after a release is added to MB FROM
// Harmony, Harmony's own actions page carries that release's mbid in its own
// query string (`?...&release_mbid=<mbid>`). "Send to Falcon" should open
// Falcon's panel on THAT release's own page (not its relationship editor —
// chaban-mb's own correction: provider links/tagging/collection all happen
// from the plain release page, none of it from inside the rel editor)
// instead of MB's bare homepage.
import { readFile } from 'node:fs/promises';
import { harmonyReplay } from './fc.mjs';
import { test, check, requireLogin, sourceOf, idle, frames } from '../../../dev/test/harness.mjs';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("#498: harmony release target", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');

  const RELEASE_MBID = '459eb9bd-f894-4e5a-b151-4cb8cfacca12';   // from majkinetor's own example

  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const ck = check;

  // 1. Harmony URL carrying a real release_mbid — the button must open the
  //    panel on that release's own page, not the bare homepage.
  {
    const page = await context.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    const hw = await harmonyReplay(page, '498-by-mbid');
    await page.goto(`https://harmony.pulsewidth.org.uk/release/actions?deezer=873204812&spotify=1SzNfUgYfuebR9knynZSqz&qobuz=g1zmwqqsmmbeq&gtin=199945053117&itunes=&tidal=&region=GB&release_mbid=${RELEASE_MBID}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await idle(page);
    await page.addScriptTag({ content: code });
    await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
    await frames(page);
    const clicked = await page.evaluate(() => new Promise(resolveClick => {
      const origOpen = window.open;
      window.open = url => { window.open = origOpen; resolveClick(url); return { closed: false }; };
      document.getElementById('falcon-harmony-btn').click();
    }));
    console.log('captured window.open target:', clicked);
    ck(clicked.startsWith(`https://musicbrainz.org/release/${RELEASE_MBID}?falcon=`), `opens the release's own plain page with the token still attached, not the relationship editor (got "${clicked}")`);
    ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
    await hw.done();
    await page.close();
  }

  // 2. release_mbid given as a full release URL (seen on real Harmony pages): its mbid
  //    is read out of it too.
  {
    const page = await context.newPage();
    const hw2 = await harmonyReplay(page, '498-url-form');
    await page.goto('https://harmony.pulsewidth.org.uk/release/actions?release_mbid=https%3A%2F%2Fmusicbrainz.org%2Frelease%2F20b03c7d-9e8a-42b9-8a96-bcc9564de034', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await idle(page);
    await page.addScriptTag({ content: code });
    await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
    await frames(page);
    const clicked = await page.evaluate(() => new Promise(resolveClick => {
      const origOpen = window.open;
      window.open = url => { window.open = origOpen; resolveClick(url); return { closed: false }; };
      document.getElementById('falcon-harmony-btn').click();
    }));
    console.log('captured window.open target (non-mbid release_mbid value):', clicked);
    // a full URL as the value (seen on real Harmony pages) is read for its mbid too, since harmonyReleaseMbid learned it
    ck(clicked.startsWith('https://musicbrainz.org/release/20b03c7d-9e8a-42b9-8a96-bcc9564de034?falcon='), `a release_mbid given as a full release URL still opens that release's page (got "${clicked}")`);
    await hw2.done();
    await page.close();
  }
});
