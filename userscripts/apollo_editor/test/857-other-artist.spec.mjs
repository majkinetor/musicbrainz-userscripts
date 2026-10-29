// #857: Jedi & Emily B's new "Butterfly" got 倖田來未's 2005 "Butterfly" auto-linked. The
// duplicate-edition search found nothing by title + artist, fell back to title only (#440),
// and the recording at the same position matched on title and on length within the
// tolerance; the artist was only ONE difference, so it scored "near" and linked. A
// candidate now has to share an artist with the track: the same entity, or one credited
// name inside the other as whole words ("X" and "X and His Orchestra").
//
// The sandbox carries "Tokyo Love (東京情歌)", a compilation with 倖田來未's Butterfly at
// 2.4. A new release of that title by Jedi is seeded with a "Butterfly" of the same length
// at 2.4: the title-only search finds the compilation and offers that recording.
import { test, check, until, settled } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm({ autoMatchRec: true, discogsUrlMatch: false }) });

const JEDI = '2e33accd-4b18-42b3-be5f-73a94a8ca8d4';
const KODA_BUTTERFLY = '960a8110-c16f-43bc-b7ad-5d3ec449a72b';
function seed() {
  const o = { name: 'Tokyo Love (東京情歌)', 'artist_credit.names.0.mbid': JEDI, 'artist_credit.names.0.name': 'Jedi', 'mediums.0.format': 'Digital Media', 'mediums.1.format': 'Digital Media' };
  const tracks = [[0, 'Qzv Intro Nine', 200000], [1, 'Qzv One Two', 211000], [1, 'Qzv Three Four', 222000], [1, 'Qzv Five Six', 233000], [1, 'Butterfly', 263000]];
  const n = [0, 0];
  tracks.forEach(([m, name, len]) => {
    const i = n[m]++, p = `mediums.${m}.track.${i}.`;
    o[p + 'name'] = name; o[p + 'length'] = String(len);
    o[p + 'artist_credit.names.0.mbid'] = JEDI; o[p + 'artist_credit.names.0.name'] = 'Jedi';
  });
  return o;
}

test('a recording by an unrelated artist is not auto-linked', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const submitted = await openApollo(page, inject, { seed: seed() });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')].find(x => x.textContent.trim().toLowerCase().startsWith('recording'));
    if (b) b.click();
  });
  await page.waitForSelector('#tc-recwrap tbody tr.tc-recrow', { state: 'attached', timeout: 60000 });
  await until(() => page.evaluate(() => (document.querySelector('#tc-recwrap .tc-rec-amstatus') || {}).textContent || ''), t => /linked \d+ of \d+|nothing to|stopped|failed/i.test(t), { timeout: 120000 });
  await settled(page);
  const r = await page.evaluate(() => ({
    rows: window.__apolloEditor.readRecordings().map(x => ({ title: x.title, recGid: x.recGid || null })),
    status: (document.querySelector('#tc-recwrap .tc-rec-amstatus') || {}).textContent.trim(),
  }));
  console.log(r.status, JSON.stringify(r.rows));
  const bf = r.rows.find(x => x.title === 'Butterfly');
  check(bf && bf.recGid !== KODA_BUTTERFLY, `Jedi's Butterfly is not linked to 倖田來未's (${bf && bf.recGid})`);
  check(bf && !bf.recGid, 'it is left unset');
  check(/1 different artist/.test(r.status), `the status says why (${r.status})`);
  check(submitted.length === 0, 'nothing submitted');
});

test('a shared artist is an entity or a name inside the other', { tag: ['@unit', '@critical'] }, async ({ page, inject }) => {
  await page.setContent('<!DOCTYPE html><html><body></body></html>');
  await inject('apollo_editor', { waitFor: '__apolloEditor' });
  const r = await page.evaluate(() => {
    const shares = window.__apolloEditor.recSharesArtist;
    const ws = (...names) => names.map((n, i) => ({ name: n, joinphrase: i < names.length - 1 ? ' & ' : '', artist: { id: 'g-' + n, name: n } }));
    const track = (gids, names) => ({ title: 'Butterfly', artistGids: gids, artistNames: names });
    return {
      unrelated: shares({ name: 'Butterfly', ac: ws('倖田來未'), artistGids: ['g-倖田來未'] }, track(['g-Jedi', 'g-Emily B'], ['jedi', 'emily b', 'jedi emily b'])),
      sameEntity: shares({ name: 'X', ac: ws('Kumi Koda'), artistGids: ['g-koda'] }, track(['g-koda'], ['倖田來未'])),
      orchestra: shares({ name: 'X', ac: ws('Glenn Miller and His Orchestra'), artistGids: ['g-gmo'] }, track(['g-gm'], ['glenn miller'])),
      oneOfTwo: shares({ name: 'X', ac: ws('Emily B'), artistGids: ['g-eb2'] }, track(['g-Jedi', 'g-eb1'], ['jedi', 'emily b', 'jedi emily b'])),
      accents: shares({ name: 'X', artist: 'Beyoncé' }, track([], ['beyonce'])),
      partWord: shares({ name: 'X', ac: ws('Jedimaster'), artistGids: ['g-jm'] }, track(['g-Jedi'], ['jedi'])),
      unknown: shares({ name: 'X' }, track(['g-Jedi'], ['jedi'])),
    };
  });
  check(r.unrelated === false, '倖田來未 shares no artist with Jedi & Emily B');
  check(r.sameEntity === true, 'the same entity under another name is shared');
  check(r.orchestra === true, '"Glenn Miller" is inside "Glenn Miller and His Orchestra"');
  check(r.oneOfTwo === true, 'one credited artist of two is enough');
  check(r.accents === true, 'accents and case are folded');
  check(r.partWord === false, 'a name inside a longer word does not count');
  check(r.unknown === true, 'a candidate with no artist is not refused');
});
