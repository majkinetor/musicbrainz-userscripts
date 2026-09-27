// #183: Bandcamp albums can hide download-only tracks from the stream. On Jam2go's
// "Crash Test", Bandcamp streams 11 tracks but the download has 15 ("15 track album"), so
// Platform Check reports the true total, 15, flags the 4 hidden ones, and marks the count.
//
// test.musicbrainz.org (a copy of the release), with its Bandcamp link put on the page
// and Bandcamp's answers replayed from fixtures/ws-183.json.gz (RECORD_WS=1 re-records).
import { test, check } from '../../../dev/test/harness.mjs';
import { openPc, row, logText } from './pc.mjs';

test.use({ gm: { name: 'Platform Check' } });

test('the true track count, with the hidden tracks flagged', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  const ws = await openPc(page, inject, {
    release: '3be1b732-9331-477d-9878-734c31a4704b',
    links: { add: ['https://jam2go.bandcamp.com/album/crash-test'] },
    replay: new URL('./fixtures/ws-183.json.gz', import.meta.url),
  });
  const log = await logText(page), bc = await row(page, 'bandcamp');
  check(/tracks=15/.test(log), 'the true total: 15');
  check(/4 download-only track\(s\) hidden|11 streaming \+ 4 download-only hidden/.test(log), 'the 4 hidden tracks are found');
  check(/15ⁿ/.test(bc.value) && /hidden from streaming/i.test(bc.valueTitle), `the count is marked, and says why (${bc.value}: "${bc.valueTitle}")`);
  await ws.done();
});
