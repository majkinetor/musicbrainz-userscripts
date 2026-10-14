// #736: at Enter edit, Apollo asks the Wayback Machine to save the release's external links. The
// saves are fired at once and nothing waits for them. #739 (majkinetor): not the links the edit note
// mentions, and nothing written in the note: the archive menu by each link finds the snapshots.
//
// The submit spec makes a real release on test.musicbrainz.org; web.archive.org is answered by
// answerGm, so nothing is saved on archive.org. ARCHIVE_LIVE=1 lets one save through to archive.org
// instead and looks for its snapshot: that a save started at Enter edit finishes after the page leaves.
import { test, check, until, SANDBOX, answerGm, functionSource, settled } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

async function fns() {
  const src = await functionSource('apollo_editor', ['mbaShort', 'mbaSavable', 'arNorm', 'archiveUrls']);
  return new Function(src + '\nreturn { archiveUrls };')();
}

test('the release links to save', { tag: ['@unit', '@critical'] }, async () => {
  const { archiveUrls } = await fns();
  const rel = ['https://artist.bandcamp.com/album/x', 'https://open.spotify.com/album/abc', 'https://open.spotify.com/album/abc/', 'https://musicbrainz.org/x', 'https://web.archive.org/web/1/x'];
  const r = archiveUrls(rel, new Set());
  check(r.length === 2 && r[0] === 'https://artist.bandcamp.com/album/x' && /^https:\/\/open\.spotify\.com\/album\/abc\/?$/.test(r[1]), `each link once; no MusicBrainz or archive.org (${JSON.stringify(r)})`);
  // what First Contact archives (the page as the user had it, the API data) is left to it; the imported link
  // itself is saved, as the archive menu looks it up by that address (#739)
  const fc = archiveUrls(['https://www.deezer.com/album/6575789', 'https://www.discogs.com/release/1'], new Set(['deezer.com/en/album/6575789', 'api.discogs.com/releases/1']));
  check(JSON.stringify(fc) === JSON.stringify(['https://www.deezer.com/album/6575789']), `the canonical link is saved, what First Contact saved isn't (${JSON.stringify(fc)})`);
  // majkinetor's release 57daa732: discogs.com refuses archive.org (HTTP 403), so its API is saved
  const dg = archiveUrls(['https://www.discogs.com/release/34839779-Saimaa-Ja-Yona', 'https://www.discogs.com/master/12'], new Set());
  check(JSON.stringify(dg) === JSON.stringify(['https://api.discogs.com/releases/34839779', 'https://api.discogs.com/masters/12']), `Discogs as its API (${JSON.stringify(dg)})`);
  check(archiveUrls(['https://musicbrainz.org/x'], new Set()).length === 0, 'no links: nothing to do');
});

const ARTIST = 'c321a13a-1c52-43c0-b60a-3a454cb7f9a2';   // Mocky, on the sandbox
const LIVE = !!process.env.ARCHIVE_LIVE;

test.describe('Enter edit', () => {
  test.use({ gm: apolloGm(null, { xhr: 'node' }) });

  test("saves the release's links, not the note's, and leaves the note alone", { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {
    test.setTimeout(5 * 60_000);
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const source = `https://example.com/?mbu736=${stamp}`;
    const saves = [];
    answerGm(context, ({ url, method }) => {
      if (!/^https:\/\/web\.archive\.org\//.test(url)) return null;
      saves.push({ url, method });
      if (LIVE) return null;   // through to archive.org
      return { status: 200, url: url.replace('/save/', `/web/${stamp}/`), headers: 'content-type: text/html', body: '<html>snapshot</html>' };
    });
    const seed = {
      name: `Apollo 736 fixture ${stamp}`, 'artist_credit.names.0.mbid': ARTIST, 'artist_credit.names.0.name': 'Mocky', status: 'official', type: 'album',
      'mediums.0.format': 'Digital Media', 'mediums.0.track.0.name': `Archive ${stamp}`, 'mediums.0.track.0.length': '2:00',
      'urls.0.url': `https://www.discogs.com/release/${stamp.slice(4)}`, 'urls.1.url': `https://open.spotify.com/album/mbu736x${stamp}`, 'urls.2.url': `https://www.deezer.com/album/9${stamp.slice(6)}`,
      edit_note: `Apollo #736 archive test fixture (mb-userscripts test suite). Source: ${source} and ${SANDBOX}/artist/${ARTIST}`,
    };
    await openApollo(page, inject, { seed, submit: true });
    await settled(page);
    await page.evaluate(() => document.querySelector('[data-click="lastTab"]').click());
    await page.waitForFunction(() => !!document.getElementById('edit-note-text'));
    await page.evaluate(() => document.querySelector('[data-click="submitEdits"]').click());
    await page.waitForURL(/\/release\/[0-9a-f-]{36}(\?|$|#)/, { timeout: 120_000 });
    const mbid = page.url().match(/\/release\/([0-9a-f-]{36})/)[1];
    console.log('release', mbid, 'saves', JSON.stringify(saves));

    const urls = saves.map(s => s.url.replace(/^https:\/\/web\.archive\.org\/save\//, '')).sort();
    const want = [`https://api.discogs.com/releases/${stamp.slice(4)}`, seed['urls.1.url'], seed['urls.2.url']].sort();   // Discogs as its API: its site refuses archive.org
    check(JSON.stringify(urls) === JSON.stringify(want), `the three links (Discogs as its API) were sent; not the note's source, nothing on MusicBrainz (${JSON.stringify(urls)})`);
    check(saves.every(s => s.method === 'GET'), 'anonymous saves without keys');

    await page.goto(`${SANDBOX}/release/${mbid}/edits`, { waitUntil: 'domcontentloaded' });
    const note = await page.locator('.edit-notes').first().innerText();
    console.log('edit note:\n' + note);
    check(!/Archived|web\.archive\.org/.test(note), 'no archive lines in the note (#739)');

    if (LIVE) {
      // the page left seconds after the saves started: archive.org finishes them anyway
      const found = await until(async () => {
        const r = await fetch(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(seed['urls.1.url'])}&fl=timestamp,statuscode&output=json`).then(r => r.json()).catch(() => []);
        return r.length > 1 ? r.slice(1) : null;
      }, v => !!v, { timeout: 180_000, every: 10_000 });
      check(!!found, `archive.org has a snapshot of ${seed['urls.1.url']} (${JSON.stringify(found)})`);
    }
  });
});
