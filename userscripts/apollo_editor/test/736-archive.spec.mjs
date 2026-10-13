// #736: at Enter edit, Apollo asks the Wayback Machine to save the release's external links and the
// links in the edit note, and says so in the edit note: one line for the release's links, one per
// link found only in the note. The saves are fired at once and nothing waits for them.
//
// The submit spec makes a real release on test.musicbrainz.org; web.archive.org is answered by
// answerGm, so nothing is saved on archive.org. ARCHIVE_LIVE=1 lets one save through to archive.org
// instead and looks for its snapshot: that a save started at Enter edit finishes after the page leaves.
import { test, check, until, SANDBOX, answerGm, functionSource, settled } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

const TS = '20261013120000';
// AL_URL_RE is read from the script by hand: its character class has brackets functionSource can't count
async function fns() {
  const code = (await import('node:fs')).readFileSync(new URL('../apollo_editor.user.js', import.meta.url), 'utf8');
  const re = code.match(/const AL_URL_RE = (\/.*\/gi);/)[1];
  const src = `const AL_URL_RE = ${re};\n` + await functionSource('apollo_editor', ['alExtractUrls', 'mbaShort', 'mbaSnapshot', 'AR_LINE', 'arNorm', 'archiveNote']);
  return new Function(src + '\nreturn { archiveNote };')();
}

test('the edit note: one line for the release links, one per link only in the note', { tag: ['@unit', '@critical'] }, async () => {
  const { archiveNote } = await fns();
  const rel = ['https://www.discogs.com/release/1', 'https://open.spotify.com/album/abc', 'https://musicbrainz.org/release/x', 'https://web.archive.org/web/1/x'];
  const note = 'Source: https://www.example.com/press/736 and https://open.spotify.com/album/abc\n\nFirst Contact v2026.10.13 by majkinetor - https://github.com/majkinetor/musicbrainz-userscripts';
  const r = archiveNote(note, rel, new Set(), TS);
  check(JSON.stringify(r.urls) === JSON.stringify(['https://www.discogs.com/release/1', 'https://open.spotify.com/album/abc', 'https://www.example.com/press/736']), `the release's links, then the note's own; no MusicBrainz, archive.org or credit links (${JSON.stringify(r.urls)})`);
  check(r.note.endsWith(`\n\nArchived on the Wayback Machine, 2026-10-13: 2 external links (web.archive.org/web/${TS}/ + link)\nArchived link: https://web.archive.org/web/${TS}/example.com/press/736`), `the lines, after the note\n${r.note}`);
  check(r.note.startsWith(note), 'the note itself is kept');

  const one = archiveNote('', ['https://www.discogs.com/release/1'], new Set(), TS);
  check(one.note === `Archived link: https://web.archive.org/web/${TS}/discogs.com/release/1`, `a single release link gets its own line (${one.note})`);

  const again = archiveNote(r.note + '\n\nApollo Editor v1 by majkinetor - https://x.y/z', rel, new Set(), TS.replace('12', '13'));
  check((again.note.match(/^Archived/gm) || []).length === 2 && !/Apollo Editor v1/.test(again.note), `a second Enter edit replaces the lines, and the credit goes back after them\n${again.note}`);

  const fc = archiveNote('Imported from Deezer: https://www.deezer.com/album/6575789', ['https://www.deezer.com/album/6575789', 'https://www.discogs.com/release/1'], new Set(['deezer.com/album/6575789']), TS);
  check(JSON.stringify(fc.urls) === JSON.stringify(['https://www.discogs.com/release/1']), `what First Contact archives is left to it (${JSON.stringify(fc.urls)})`);

  check(archiveNote('nothing here', ['https://musicbrainz.org/x'], new Set(), TS) === null, 'no links: nothing to do');
});

const ARTIST = 'c321a13a-1c52-43c0-b60a-3a454cb7f9a2';   // Mocky, on the sandbox
const LIVE = !!process.env.ARCHIVE_LIVE;

test.describe('Enter edit', () => {
  test.use({ gm: apolloGm(null, { xhr: 'node' }) });

  test('saves the links and the edit note says so', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {
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
      'urls.0.url': `https://www.discogs.com/release/${stamp.slice(4)}`, 'urls.1.url': `https://open.spotify.com/album/mbu736x${stamp}`,
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
    const want = [seed['urls.0.url'], seed['urls.1.url'], source].sort();
    check(JSON.stringify(urls) === JSON.stringify(want), `the two links and the note's source were sent, and nothing on MusicBrainz (${JSON.stringify(urls)})`);
    check(saves.every(s => s.method === 'GET'), 'anonymous saves without keys');

    await page.goto(`${SANDBOX}/release/${mbid}/edits`, { waitUntil: 'domcontentloaded' });
    const note = await page.locator('.edit-notes').first().innerText();
    console.log('edit note:\n' + note);
    check(/Archived on the Wayback Machine, \d{4}-\d\d-\d\d: 2 external links \(web\.archive\.org\/web\/\d{14}\/ \+ link\)/.test(note), 'the line for the release\'s links');
    check(note.includes('Archived link: https://web.archive.org/web/') && note.includes(`/example.com/?mbu736=${stamp}`), 'the note\'s source has its own line');
    check(/Apollo Editor v/.test(note), 'Apollo is credited');

    if (LIVE) {
      // the page left seconds after the saves started: archive.org finishes them anyway
      const found = await until(async () => {
        const r = await fetch(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(source)}&fl=timestamp,statuscode&output=json`).then(r => r.json()).catch(() => []);
        return r.length > 1 ? r.slice(1) : null;
      }, v => !!v, { timeout: 180_000, every: 10_000 });
      check(!!found, `archive.org has a snapshot of ${source} (${JSON.stringify(found)})`);
    }
  });
});
