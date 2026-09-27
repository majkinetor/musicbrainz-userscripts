// A slow lookup holds nothing else up.
//
// Rows (majkinetor): "While PC search is ongoing, discogs and bandcamp are unclickable
//   rows, while bottom icons are clickable. We should be able to click those 2 too (goes
//   to search)." and then "still can't click first 2 rows in PC but only on initial load".
//   The rows were wired only once their scan reported, and later only once the search
//   URLs were seeded — after the release-group lookup and the Wikidata query. The artist
//   and album come from the page, so the rows are wired at once now: clickable while the
//   scans run, and before any slow lookup answers.
// Wikidata (majkinetor): "wikidata now often blocks (15s wait seem to be frequent)". Every
//   provider waited for the Wikidata query; now only the ones that use its answer do
//   (Spotify, Apple, Tidal, Beatport), and the rest start at once.
//
// test.musicbrainz.org. Every request is answered by the test: the release-group lookup
// in 2.5 s, Wikidata in 6 s, and no provider ever — so the panel stays mid-scan.
import { test, check, answerGm } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Platform Check' } });
const SLOW = 2500, WIKIDATA = 6000;

test('rows are clickable at once, and providers start without waiting for Wikidata', { tag: ['@sandbox', '@critical'] }, async ({ page, context, inject }) => {
  const asked = [];
  answerGm(context, ({ url }) => {
    const at = Date.now(); asked.push({ at, url });
    const after = /query\.wikidata\.org/.test(url) ? WIKIDATA : /\/ws\/2\/release-group\/|wallstream/.test(url) ? SLOW : null;
    if (after === null) return new Promise(() => {});   // a provider: never answers
    return new Promise(r => setTimeout(() => r({ status: 200, body: /wikidata/.test(url) ? '{"results":{"bindings":[]}}' : '{}' }), after));
  });
  await page.goto('https://test.musicbrainz.org/release/aa6c4473-3528-41c2-b55b-d9e18bdba4ff', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('pc:')).forEach(k => localStorage.removeItem(k)));
  await inject('platform_check');
  await page.waitForSelector('#row-discogs', { state: 'attached' });

  // the first two rows, from the moment the panel exists
  const t0 = Date.now();
  const state = () => page.evaluate(() => Object.fromEntries(['discogs', 'bandcamp'].map(p => {
    const r = document.getElementById('row-' + p), a = document.getElementById('mb-online-' + p);
    return [p, { click: typeof r.onclick === 'function', menu: typeof r.oncontextmenu === 'function', cursor: r.style.cursor, search: a && a.dataset.searchUrl || null, resolved: r.classList.contains('pc-st-match'), compacted: r.classList.contains('pc-compacted') }];
  })));
  let s, wiredAt = null;
  for (let i = 0; i < 100 && wiredAt === null; i++) {
    s = await state();
    if (s.discogs.click && s.bandcamp.click && s.discogs.search && s.bandcamp.search) wiredAt = Date.now() - t0;
    else await page.waitForTimeout(50);
  }
  check(wiredAt !== null && wiredAt <= 1200, `both rows are wired before the slow lookups answer (${wiredAt} ms; they take ${SLOW} ms)`);
  for (const p of ['discogs', 'bandcamp']) {
    check(!s[p].resolved && !s[p].compacted, `${p}: measured mid-scan, a full unresolved row (${JSON.stringify(s[p])})`);
    check(s[p].menu && s[p].cursor === 'pointer', `${p}: right-click is wired, and the cursor says it's clickable`);
  }
  const opened = await page.evaluate(() => {
    const out = []; window.open = u => { out.push(String(u)); return null; };
    for (const p of ['discogs', 'bandcamp']) document.getElementById('val-' + p).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return out;
  });
  check(opened.some(u => /discogs\.com\/search/.test(u)) && opened.some(u => /bandcamp\.com\/search/.test(u)), `a click opens each one's search (${opened.join(', ')})`);

  // who waited for Wikidata
  await page.waitForTimeout(WIKIDATA + 2500);
  const wd = asked.find(r => /query\.wikidata\.org/.test(r.url));
  const first = re => asked.find(r => re.test(r.url));
  check(!!wd, 'Wikidata is asked');
  const indep = { deezer: first(/deezer\.com/), discogs: first(/discogs\.com/), bandcamp: first(/bandcamp\.com/) };
  const started = Object.entries(indep).filter(([, r]) => r);
  check(started.length === 3 && started.every(([, r]) => r.at - wd.at < 2000), `Deezer, Discogs and Bandcamp start without waiting for Wikidata (${started.map(([p, r]) => `${p} +${r.at - wd.at} ms`).join(', ')})`);
  const dep = [first(/apple\.com/), first(/tidal\.com/)].filter(Boolean);
  check(dep.length > 0 && dep.every(r => r.at >= wd.at + WIKIDATA - 50), `Apple and Tidal wait for its answer (${dep.map(r => `+${r.at - wd.at} ms`).join(', ')})`);
});
