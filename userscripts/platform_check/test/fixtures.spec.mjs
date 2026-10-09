// The search-quality fixtures (fixtures.json): on each release, Platform Check finds the
// links the fixture expects — a Spotify album among several editions, a Discogs release
// by format, a Bandcamp album with no link to go on, the Discogs master from the release
// group — and reads the release year right.
//
// test.musicbrainz.org (the release, or a copy of it), with production's data and every
// provider's answers replayed from fixtures/fx-<n>.json.gz: Spotify, Discogs, Bandcamp,
// the search engines. RECORD_WS=1 re-records them from the live sites; a result that
// changes then is the web's, and fixtures.json's `notes` say what each fixture is for.
import { readFileSync } from 'node:fs';
import { test, check, attachShot } from '../../../dev/test/harness.mjs';
import { openPc, row, cached } from './pc.mjs';

const FIXTURES = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
test.use({ gm: { name: 'Platform Check' } });

FIXTURES.forEach((f, i) => {
  const tags = (f.tags || '').split(/\s+/).filter(Boolean).map(t => '@' + t);
  test(f.name, { tag: ['@fixture', '@sandbox', ...tags] }, async ({ page, inject }, testInfo) => {
    const ws = await openPc(page, inject, { release: f.mbid, replay: new URL(`./fixtures/fx-${i + 1}.json.gz`, import.meta.url) });
    const e = f.expect || {};
    for (const p of ['spotify', 'discogs', 'bandcamp', 'ytmusic', 'amazonmusic']) {
      // null: the platform has no such album, and a near miss (same artist, same song count) isn't taken
      if (e[p] === null) { const r = await row(page, p); check(!/\/albums?\//.test(r.url || ''), `${p}: nothing (found ${r.url})`); continue; }
      const want = e[p] ? [e[p]] : e[p + 'OneOf'];
      if (!want) continue;
      const r = await row(page, p);
      check(want.some(w => (r.url || '').includes(w)), `${p}: ${want.join(' or ')} (found ${r.url})`);
    }
    if (e.discogsMaster) {
      // the slot names the master when it is new; one already on the release group is just ✓
      const r = await row(page, 'discogs'), c = await cached(page, 'discogs');
      const found = r.master.includes(e.discogsMaster) ? r.master : ((c && c.masterUrl) || '');
      check(found.includes(e.discogsMaster), `the Discogs master: ${e.discogsMaster} (found "${found || r.master}")`);
    }
    if (e.headerYear) {
      const year = await page.evaluate(() => document.getElementById('mb-mb-year')?.title);   // shown as '21, in full on hover
      check(year === e.headerYear, `the header's year: ${e.headerYear} (shows "${year}")`);
    }
    if (i === 0) {
      // the log's platform filter, for a platform with a space in its name: picking Beatport hides
      // YouTube Music's lines too (#452, #697: each line's platform is its category in the shared log)
      const shown = await page.evaluate(() => {
        document.getElementById('mb-log-open-btn').click();
        const pick = () => document.querySelector('#mbu-logpop .mbu-log-fb[data-cat="Beatport"]').click();
        pick();
        const rows = c => [...document.querySelectorAll('#mbu-logpop .mbu-log-li')].filter(d => d.querySelector('.mbu-log-c')?.textContent === c);
        const vis = c => rows(c).filter(d => getComputedStyle(d).display !== 'none').length;
        const r = { ytm: vis('YouTube Music'), ytmAll: rows('YouTube Music').length, beatport: vis('Beatport') };
        pick();   // and off again
        document.getElementById('mb-log-open-btn').click();
        return r;
      });
      check(shown.ytmAll > 0 && shown.ytm === 0 && shown.beatport > 0, `the Beatport filter hides YouTube Music's lines (${shown.ytm} of ${shown.ytmAll} still shown, ${shown.beatport} Beatport)`);
    }
    await attachShot(testInfo, page.locator('#mb-pc-panel'), 'panel');
    await ws.done();
  });
});
