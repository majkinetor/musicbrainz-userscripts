import { test } from 'node:test';
import assert from 'node:assert/strict';
const { default: ArtistImage } = await import(process.env.ARTIMG_SRC || './artist-image.js');

const photo = 'https://f4.bcbits.com/img/0038522370_21.jpg';
const youtube = 'https://yt3.googleusercontent.com/artist=w544-h544-l90-rj';
const urls = ['https://mocky.bandcamp.com/', 'https://music.youtube.com/channel/UCIZgzeDDYvvqBNI2gheMqDg'];
const html = '<meta property="og:image" content="https://f4.bcbits.com/img/a2873093934_5.jpg"><img src="' + photo + '" class="band-photo" alt="Mocky image">';
const response = body => ({ ok: true, text: async () => body });

test('matching photo groups retain every provider and keep distinct photos separate', () => {
    const sample = values => [{ rgb: [.4, .4, .4], sd: .2, values }];
    const a = sample([-1, 1, -1, 1]), resized = sample([-.98, .98, -1.02, 1.02]), other = sample([1, -1, 1, -1]);
    const images = [{ src: 'discogs' }, { src: 'bandcamp' }, { src: 'deezer' }, { src: 'youtube' }];
    assert.deepEqual(ArtistImage.groups(images, [a, resized, other, a]), [[0, 1, 3], [2]]);
    assert.deepEqual(ArtistImage.groups(images, [null, null, other, null]), [[0], [1], [2], [3]]);
    assert.deepEqual(ArtistImage.groups([{ src: 'same' }, { src: 'same' }], []), [[0, 1]]);
    assert.equal(ArtistImage.sameImage(sample([0, 0, 0, 0]).map(x => ({ ...x, sd: 0 })), sample([0, 0, 0, 0])), false);
});

test('Tidal branding is rejected while real artist photos remain', async () => {
    let src = 'https://tidal.com/img/FB_1200x627.png';
    const ai = new ArtistImage({}, { http: async () => response('<meta property="og:image" content="' + src + '">') });
    const url = 'https://tidal.com/artist/11993770';
    assert.equal(await ai.find(null, [url]), null);
    src = 'https://resources.tidal.com/images/real/artist/750x750.jpg';
    assert.equal((await ai.find(null, [url])).src, src);
});

test('cached Tidal branding is skipped immediately, preserving other pictures', () => {
    const all = [
        { key: 'tidal', src: 'https://tidal.com/img/FB_1200x627.png' },
        { key: 'bandcamp', src: photo },
    ];
    const ai = new ArtistImage({ get: () => ({ mocky: { all, t: Date.now() } }) });
    assert.deepEqual(ai.cachedAll('mocky'), [all[1]]);
});

test('Bandcamp uses the profile photo even on an album landing page', async () => {
    const ai = new ArtistImage({}, { http: async () => response(html) });
    assert.equal((await ai.find(null, [urls[0]])).src, photo.replace('_21', '_10'));
    assert.equal((await ai.find(null, ['https://mocky.bandcamp.com'])).src, photo.replace('_21', '_10'));
    assert.equal(await ai.find(null, ['https://mocky.bandcamp.com/album/album']), null);
});

test('Bandcamp without a photo never substitutes album art', async () => {
    const ai = new ArtistImage({}, { http: async () => response('<meta property="og:image" content="https://f4.bcbits.com/img/a2873093934_5.jpg">') });
    assert.equal(await ai.find(null, [urls[0]]), null);
});

test('YouTube Music accepts a channel avatar and rejects a video thumbnail', async () => {
    let src = youtube;
    const ai = new ArtistImage({}, { http: async () => response('<meta property="og:image" content="' + src + '">') });
    assert.equal((await ai.find(null, [urls[1]])).src, youtube);
    src = 'https://i.ytimg.com/vi/video/hqdefault.jpg';
    assert.equal(await ai.find(null, [urls[1]]), null);
    assert.equal(await ai.find(null, ['https://music.youtube.com/watch?v=video']), null);
});

test('an older cache discovers new providers once, then reuses the results', async () => {
    let cache = { mocky: { all: [], t: Date.now() } }, calls = 0;
    const ai = new ArtistImage({ get: () => cache, set: (key, value) => { cache = value; } }, { http: async u => {
        calls++;
        return response(u.includes('bandcamp') ? html : '<meta property="og:image" content="' + youtube + '">');
    } });
    assert.equal((await ai.findAll('mocky', urls)).length, 2);
    assert.equal((await ai.findAll('mocky', urls)).length, 2);
    assert.equal(calls, 2);
});
