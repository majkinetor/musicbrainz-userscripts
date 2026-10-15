// #757: Apple's album is read with each song's artists, so Artists & labels has a compilation's
// track artists. Live, on Antiyano Progresivo (Soundway, 16 tracks, every one by another artist):
// before, Apple gave PC no artist at all for it.
// On the sandbox, a release page, so the script and its hook are in; Apple is read, nothing else.
import { test, check } from '../../../dev/test/harness.mjs';
import { openPc } from './pc.mjs';

test.use({ gm: { name: 'Platform Check' } });
const RELEASE = 'ec116461-5b0d-4c98-bb44-a4de5de63076';   // any sandbox release: the page only hosts the script

test('Apple: a compilation\'s track artists', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  await openPc(page, inject, { release: RELEASE, settle: false });
  await page.waitForFunction(() => !!window.__pcTest627, null, { timeout: 30000 });
  const cr = await page.evaluate(async () => {
    const A = window.__pcTest627;
    const a = ((await A.appleAmp(`us/albums/6820726068${A.APPLE_ALBUM_INC ? '?' + A.APPLE_ALBUM_INC : ''}`)).data || [])[0];
    return A.appleAlbumMeta(a).credits;
  });
  console.log(JSON.stringify(cr));
  const tr = (cr && cr.tracks) || [];
  check(tr.length === 16 && tr.every(t => t.length >= 1), `16 tracks, each with its artist (${tr.length})`);
  check(tr[0] && tr[0][0].name === 'Quinteto Winoe' && tr[0][0].url === 'https://music.apple.com/us/artist/6796549074', `track 1: Quinteto Winoe's page (${JSON.stringify(tr[0])})`);
  check(tr[1] && tr[1][0].name === 'Los Dangers' && tr[1][0].url === 'https://music.apple.com/us/artist/1274265210', `track 2: Los Dangers' page (${JSON.stringify(tr[1])})`);
});

// The same release, copied to the sandbox, scanned live: Artists & labels offers the track
// artists' Apple Music pages (before, it had none of them).
test('Apple: Artists & labels offers a compilation\'s track artists', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  await openPc(page, inject, { release: '51ee65f6-5c5b-4121-86d3-2ddd6fa62f52' });
  await page.locator('#mb-links-btn').click();
  await page.waitForSelector('#pc-links-ov .mbu-ov-body table', { timeout: 30000 });
  await page.waitForFunction(() => !/Checking MusicBrainz/.test(document.querySelector('#pc-links-ov .pc-lk-status')?.textContent || ''), null, { timeout: 30000 });
  const t = await page.evaluate(() => {
    const ov = document.getElementById('pc-links-ov');
    return { html: ov.innerHTML, rows: [...ov.querySelectorAll('tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim()) };
  });
  console.log(t.rows.join('\n'));
  const apple = (t.html.match(/music\.apple\.com\/[a-z]{2}\/artist\/\d+/g) || []);
  check(new Set(apple).size >= 10, `Apple Music pages for the track artists (${new Set(apple).size})`);
  check(/music\.apple\.com\/[a-z]{2}\/artist\/6796549074/.test(t.html) && /music\.apple\.com\/[a-z]{2}\/artist\/1274265210/.test(t.html), 'Quinteto Winoe\'s and Los Dangers\' among them');
});
