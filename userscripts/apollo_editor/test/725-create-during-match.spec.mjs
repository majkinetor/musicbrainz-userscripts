// #725: a release artist created with ＋ while the release-artist match pass is still running came
// back to a cell that pass had since rebuilt: the created artist was dropped (while the log said
// "inserted"). The create's pick must find the rebuilt cell's line and land there.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

const DAFT_PUNK = '056e4f3e-d505-4dad-8ec1-d04f521cbb56';
const seed = {
  name: 'Apollo 725 create during match', status: 'official',
  'artist_credit.names.0.name': 'Daft Punk', 'artist_credit.names.0.join_phrase': ' & ',
  'artist_credit.names.1.name': 'Zzq Nobody 725',
  'mediums.0.format': 'Digital Media',
  'mediums.0.track.0.name': 'One', 'mediums.0.track.0.length': '200000', 'mediums.0.track.0.artist_credit.names.0.name': 'Daft Punk',
};

test.describe('release artist created during matching', () => {
  test.use({ gm: apolloGm() });

  test('the created artist lands though the match pass rebuilt the cell', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openApollo(page, inject, { seed });
    await until(() => page.evaluate(() => (window.__apolloEditor.riArt || [])[0]?.committed), Boolean, { timeout: 60000 });
    const r = await page.evaluate(async gid => {
      const ap = window.__apolloEditor;
      const held = ap.riArt[1];             // what ＋ hands the create
      await ap.matchReleaseArtist(true);    // the pass finishes: every line is a new object
      const rebuilt = !ap.riArt.includes(held);
      const ent = await ap.fetchEntity(gid);
      const landed = await held._onPick(ent);   // the create's postback
      const names = window.MB.releaseEditor.rootField.release().artistCredit().names;
      return { rebuilt, landed, credit: names.map(n => ({ name: n.name, gid: n.artist && n.artist.gid })) };
    }, DAFT_PUNK);
    console.log(JSON.stringify(r));
    check(r.rebuilt, 'the match pass replaced the line the create was holding');
    check(r.landed === true, `the pick reports it landed (${r.landed})`);
    check(r.credit[1] && r.credit[1].gid === DAFT_PUNK && r.credit[1].name === 'Zzq Nobody 725', `the created artist is on the second line, keeping its credited name: ${JSON.stringify(r.credit)}`);
  });
});
