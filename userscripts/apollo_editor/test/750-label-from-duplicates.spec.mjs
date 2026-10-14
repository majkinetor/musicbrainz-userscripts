// #750: a label name more than one MusicBrainz label carries is linked by the Duplicates tab
// when the similar releases MusicBrainz lists credit exactly one label of that name.
//
// Sandbox data: two labels are named "Warp", the UK one and an Australian one, so the name
// alone is ambiguous. "Dextrous" by Nightmares on Wax is on the UK Warp, and is the one
// similar release MusicBrainz finds for a new release of that title and artist.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

const WARP_UK = '46f0f4cd-8aab-4b33-b698-f459faf64190';
const NOW = 'b8c5cc4f-239f-4e02-b46f-b040b77c2030';
const seed = { name: 'Dextrous', 'artist_credit.names.0.mbid': NOW, 'artist_credit.names.0.name': 'Nightmares on Wax', 'labels.0.name': 'Warp', 'mediums.0.format': 'Digital Media', 'mediums.0.track.0.name': 'Dextrous' };
const state = page => page.evaluate(() => {
  const re = window.MB.releaseEditor, l = re.rootField.release().labels()[0].label();
  const host = document.getElementById('label-0').closest('span.autocomplete');
  return { sims: re.similarReleases().length, gid: (l && l.gid) || null, badge: ((host && host.querySelector('.tc-ri-lab .tc-badge')) || {}).textContent || '' };
});

test.describe('label from duplicates', () => {
  test.use({ gm: apolloGm({ autoMatchLabel: true }) });

  test('an ambiguous label name is linked by the one label the similar releases credit', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openApollo(page, inject, { seed });
    const s = await until(() => state(page), v => v.gid === WARP_UK, { timeout: 60000 });
    console.log(JSON.stringify(s));
    check(s.sims > 0, `MusicBrainz listed similar releases: ${JSON.stringify(s)}`);
    check(s.gid === WARP_UK, `the label is the UK Warp, the duplicate's: ${JSON.stringify(s)}`);
    check(s.badge === 'dup', `its badge says dup: ${JSON.stringify(s)}`);
  });
});
