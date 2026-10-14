// #742: the release artist field's ＋ (create the artist) sits at the right edge of the field, as in the
// Tracklist. MusicBrainz's own "#release-editor #information div.half-width button{margin:0}" won over the
// rule that pushes it there, so it stuck to the name.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

const seed = {
  name: 'Apollo 742', status: 'official', 'artist_credit.names.0.name': 'Zzq Nobody 742', 'mediums.0.format': 'Digital Media',
  'mediums.0.track.0.name': 'One', 'mediums.0.track.0.length': '200000', 'mediums.0.track.0.artist_credit.names.0.name': 'Zzq Nobody 742',
};

test.use({ gm: apolloGm() });

test('#742: the release artist\'s ＋ is at the right edge of its field', { tag: ['@sandbox', '@login', '@cosmetic'] }, async ({ page, inject }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await openApollo(page, inject, { seed });
  const at = () => page.evaluate(() => {
    const s = document.querySelector('#information .tc-ri-art .tc-search'), k = s && s.querySelector('.mk');
    if (!k || !k.offsetWidth) return null;
    const b = s.getBoundingClientRect(), r = k.getBoundingClientRect();
    return { gap: Math.round(b.right - r.right), box: Math.round(b.width) };
  });
  const m = await until(at, Boolean);
  console.log(JSON.stringify(m));
  check(m && m.gap <= 10, `＋ is at the right edge, not after the name (${JSON.stringify(m)})`);
  await page.locator('#information .tc-ri-art').screenshot({ path: 'test-results/apollo-742-ri-plus.png' });
});
