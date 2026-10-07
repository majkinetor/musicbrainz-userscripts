// #684: an Apple album with tracks the storefront doesn't offer. Eddie Harris, "Artist's Choice"
// (gb/852547) has 24 tracks; amp-api gives 20 (1.9, 2.1, 2.4 and 2.6 are not offered) and the album's
// trackCount, 24. The row's count is what's offered, followed by the album's own: "20/24".
import { test, check } from '../../../dev/test/harness.mjs';
import { openPc } from './pc.mjs';

test.use({ gm: { name: 'Platform Check' } });
const RELEASE = 'ec116461-5b0d-4c98-bb44-a4de5de63076';   // any sandbox release: the page only hosts the script

test('Apple: tracks the storefront does not offer show beside the count', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  await openPc(page, inject, { release: RELEASE, settle: false });
  await page.waitForFunction(() => !!window.__pcTest627, null, { timeout: 30000 });
  const r = await page.evaluate(async () => {
    const j = await window.__pcTest627.appleAmp('gb/albums/852547');
    const m = window.__pcTest627.appleAlbumMeta(j.data[0]);
    window.__pcTest627.updateRow('apple', { url: m.url, mbTracks: 20, remoteTracks: m.tracks, unoffered: m.unoffered, source: 'test' });
    const v = document.getElementById('val-apple');
    return { tracks: m.tracks, unoffered: m.unoffered, note: m.tracksNote, text: v.textContent, title: v.title, ico: document.getElementById('ico-apple').textContent };
  });
  console.log(JSON.stringify(r));
  check(r.tracks === 20 && r.unoffered === 4, `20 offered, 4 not (${r.tracks}, ${r.unoffered})`);
  check(r.text === '20/24', `the row reads 20/24 ("${r.text}")`);
  check(r.ico === '✓' && /The album has 24 tracks: 4 not offered/.test(r.title), `matches MB's 20, and says why there are 24 ("${r.title}")`);
  check(/4 more the storefront doesn't offer/.test(r.note), 'the log line says so');
});
