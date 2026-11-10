import { test, check, functionSource } from '../../../dev/test/harness.mjs';
import ArtistImage from '../../../dev/artimg/artist-image.js';

test('artist cycling uses first photo of each group with every source retained', { tag: '@unit' }, async () => {
    const source = await functionSource('event_horizon', ['dedupArtistImages']);
    const signatures = {
        first: [{ rgb: [.4, .4, .4], sd: .2, values: [-1, 1, -1, 1] }],
        copy: [{ rgb: [.4, .4, .4], sd: .2, values: [-1, 1, -1, 1] }],
        other: [{ rgb: [.4, .4, .4], sd: .2, values: [1, -1, 1, -1] }],
    };
    const dedup = new Function('ArtistImage', 'imageFingerprint', source + ';return dedupArtistImages;')(ArtistImage, async src => signatures[src]);
    const images = [{ src: 'first', key: 'discogs' }, { src: 'other', key: 'wikipedia' }, { src: 'copy', key: 'bandcamp' }];
    const result = await dedup(images);
    check(result.length === 2, 'two images for cycling and selection');
    check(result[0].src === 'first' && result[1].src === 'other', 'first photo in each group, in provider order');
    check(result[0].providers.map(p => p.key).join(',') === 'discogs,bandcamp', 'all source links retained on grouped image');
});
