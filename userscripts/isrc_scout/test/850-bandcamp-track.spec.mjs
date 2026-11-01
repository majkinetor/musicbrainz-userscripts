import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

test('Bandcamp track release links are recognized for finding recording links', { tag: '@unit' }, async () => {
  const { matchProviderLink } = await loadFunctions('isrc_scout', ['matchProviderLink']);
  const link = matchProviderLink('https://artist.bandcamp.com/track/song?from=search');
  check(link?.k === 'bandcampUrl' && link.v === 'https://artist.bandcamp.com/track/song', `track release link: ${JSON.stringify(link)}`);
  check(matchProviderLink('https://artist.bandcamp.com/album/record')?.k === 'bandcampUrl', 'album links still work');
});
