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
// and Wikidata only when the test lets them, and no provider ever — so the panel stays
// mid-scan. Holding the slow answers back, not timing them, is what makes "before they
// answer" and "without waiting for Wikidata" hold on any machine.
import { test, check, until, answerGm } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Platform Check' } });
const gate = () => { let open; const held = new Promise(r => { open = r; }); return { held, open }; };

test('rows are clickable at once, and providers start without waiting for Wikidata', { tag: ['@sandbox', '@critical'] }, async ({ page, context, inject }) => {
  const asked = [], slow = gate(), wikidata = gate();
  answerGm(context, ({ url }) => {
    asked.push({ url });
    if (/query\.wikidata\.org/.test(url)) return wikidata.held.then(() => ({ status: 200, body: '{"results":{"bindings":[]}}' }));
    if (/\/ws\/2\/release-group\/|wallstream/.test(url)) return slow.held.then(() => ({ status: 200, body: '{}' }));
    return new Promise(() => {});   // a provider: never answers
  });
  await page.goto('https://test.musicbrainz.org/release/aa6c4473-3528-41c2-b55b-d9e18bdba4ff', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('pc:')).forEach(k => localStorage.removeItem(k)));
  await inject('platform_check');
  await page.waitForSelector('#row-discogs', { state: 'attached' });

  // the first two rows, while the slow lookups are still held back
  const state = () => page.evaluate(() => Object.fromEntries(['discogs', 'bandcamp'].map(p => {
    const r = document.getElementById('row-' + p), a = document.getElementById('mb-online-' + p);
    return [p, { click: typeof r.onclick === 'function', menu: typeof r.oncontextmenu === 'function', cursor: r.style.cursor, search: a && a.dataset.searchUrl || null, resolved: r.classList.contains('pc-st-match'), compacted: r.classList.contains('pc-compacted') }];
  })));
  const s = await until(state, s => s.discogs.click && s.bandcamp.click && s.discogs.search && s.bandcamp.search);
  check(s.discogs.click && s.bandcamp.click && s.discogs.search && s.bandcamp.search, `both rows are wired before the slow lookups answer (${JSON.stringify(s)})`);
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

  // who waited for Wikidata: the release-group lookup answers, Wikidata still doesn't
  slow.open();
  const first = re => asked.find(r => re.test(r.url));
  const INDEP = { deezer: /deezer\.com/, discogs: /discogs\.com/, bandcamp: /bandcamp\.com/ };
  await until(() => !!first(/query\.wikidata\.org/) && Object.values(INDEP).every(re => first(re)));
  check(!!first(/query\.wikidata\.org/), 'Wikidata is asked');
  const started = Object.keys(INDEP).filter(p => first(INDEP[p]));
  check(started.length === 3, `Deezer, Discogs and Bandcamp start without waiting for Wikidata (${started.join(', ')})`);
  const early = [/apple\.com/, /tidal\.com/].filter(re => first(re)).map(String);
  check(early.length === 0, `Apple and Tidal are not asked while Wikidata has not answered (${early.join(', ') || 'none'})`);
  wikidata.open();
  const dep = await until(() => [first(/apple\.com/), first(/tidal\.com/)].filter(Boolean), d => d.length > 0);
  check(dep.length > 0, `…and are, once it has (${dep.map(r => r.url.split('/')[2]).join(', ')})`);
});
