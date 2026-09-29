// #626 (majkinetor): "Another case for this is localization. In this case, Recordings matcher
// found 0 matches as seed is on english and RG is japanese". Hiroshi Sato's Orient (UPGY-6004),
// copied to the sandbox: its release group holds the Japanese edition. A new release is seeded
// into that group with the English titles an importer brings ("Kalimba Night" for カリンバナイト)
// and their lengths, a second or three off. Nothing is submitted.
//
// A title in another script can't be compared, so the position counts when the edition's whole
// medium lines up: as many tracks, every length within the tolerance. Then every track links to
// the recording at its position. A medium that doesn't line up links nothing (checked by
// seeding one track short).
import { test, check, until, settled } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm({ autoMatchRec: true, discogsUrlMatch: false }) });

const RG = 'aa2ffdb2-5eb9-4a73-be61-b26b6729c9f3';        // the sandbox copy's release group
const ARTIST = '9dd853aa-12ee-465b-8ff6-b604f89112fd';    // 佐藤博 / Hiroshi Sato on the sandbox
// seeded (English) → the copy's recording at that position
const TRACKS = [
  ['Kalimba Night', '4:25', '0f34810f-037d-44ee-b1c9-52bcf7df7cee'],
  ['Son Go Kuw', '4:18', 'c660d3db-b669-4301-8c89-a745de47e59a'],
  ['Tsuki No Ko No Namae Wa Leo', '4:14', '266b690b-c767-4c5d-a5fe-5d1fcf6f162a'],
  ['Doncama', '2:39', '7e15396c-f075-4870-8409-6a8d8ecb85d2'],
  ['Jo-Do', '4:53', '8ced08ed-6c22-407f-8a76-1dbee8958a17'],
  ['Sora Tobu Jutan', '3:35', '3a534d6a-59e2-4c65-b761-775e4237a3c4'],
  ['Picnic', '3:43', 'bc7e1a74-7c25-438a-ba85-b8ac36a2b252'],
  ['Hikaru Kaze', '3:39', '7460bf7a-5277-4c56-8af3-e0df3dbf19cb'],
];
const ms = t => { const [m, s] = t.split(':').map(Number); return String((m * 60 + s) * 1000); };
function seed(tracks) {
  const o = { name: 'Orient', release_group: RG, 'artist_credit.names.0.mbid': ARTIST, 'artist_credit.names.0.name': 'Hiroshi Sato', 'mediums.0.format': 'CD' };
  tracks.forEach(([name, len], i) => {
    o[`mediums.0.track.${i}.name`] = name;
    o[`mediums.0.track.${i}.length`] = ms(len);
    o[`mediums.0.track.${i}.artist_credit.names.0.mbid`] = ARTIST;
    o[`mediums.0.track.${i}.artist_credit.names.0.name`] = 'Hiroshi Sato';
  });
  return o;
}

async function recordingsPass(page) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')].find(x => x.textContent.trim().toLowerCase().startsWith('recording'));
    if (b) b.click();
  });
  await page.waitForSelector('#tc-recwrap tbody tr.tc-recrow', { state: 'attached', timeout: 60000 });
  await until(() => page.evaluate(() => (document.querySelector('#tc-recwrap .tc-rec-amstatus') || {}).textContent || ''), t => /linked \d+ of \d+|nothing to|stopped|failed/i.test(t), { timeout: 120000 });
  await settled(page);
  return page.evaluate(() => ({
    rows: window.__apolloEditor.readRecordings().map(r => ({ title: r.title, recGid: r.recGid || null })),
    status: (document.querySelector('#tc-recwrap .tc-rec-amstatus') || {}).textContent.trim(),
  }));
}

test('English titles link to the Japanese edition by position, when the whole medium lines up', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const submitted = await openApollo(page, inject, { seed: seed(TRACKS) });
  const r = await recordingsPass(page);
  console.log(r.status, JSON.stringify(r.rows));
  const right = r.rows.filter((x, i) => x.recGid === TRACKS[i][2]).length;
  check(right === TRACKS.length, `every track links to the recording at its position on the Japanese edition (${right} of ${TRACKS.length}: ${r.status})`);
  check(submitted.length === 0, 'nothing submitted');
});

test('a medium that does not line up links nothing by position', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const submitted = await openApollo(page, inject, { seed: seed(TRACKS.slice(0, 7)) });   // one track short
  const r = await recordingsPass(page);
  console.log(r.status, JSON.stringify(r.rows));
  const linked = r.rows.filter(x => x.recGid).length;
  check(linked === 0, `seven tracks against an eight-track edition: no title can be compared, and nothing links (${linked} linked: ${r.status})`);
  check(submitted.length === 0, 'nothing submitted');
});
