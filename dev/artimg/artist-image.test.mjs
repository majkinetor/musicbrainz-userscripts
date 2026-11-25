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

test('Apple Music\'s logo card for an artist without a photo is rejected, live and cached', async () => {
    let src = 'https://music.apple.com/assets/meta/apple-music.png';
    const ai = new ArtistImage({}, { http: async () => response('<meta property="og:image" content="' + src + '">') });
    const url = 'https://music.apple.com/bj/artist/323014105';
    assert.equal(await ai.find(null, [url]), null);
    src = 'https://is1-ssl.mzstatic.com/image/thumb/AMCArtistImages211/v4/8a/x.png/1200x630cw.png';
    assert.equal((await ai.find(null, [url])).src, 'https://is1-ssl.mzstatic.com/image/thumb/AMCArtistImages211/v4/8a/x.png/500x500bb.jpg');
    const all = [{ key: 'apple', src: 'https://music.apple.com/assets/meta/500x500bb.jpg' }, { key: 'bandcamp', src: photo }];
    const cache = new ArtistImage({ get: () => ({ mocky: { all, t: Date.now() } }) });
    assert.deepEqual(cache.cachedAll('mocky'), [all[1]]);
});

test('Deezer skips a size its CDN redirects to the placeholder, live and cached', async () => {
    const pic = s => 'https://cdn-images.dzcdn.net/images/artist/c05463254fd10963984830d2db72128b/' + s + '-000000-80-0-0.jpg';
    const empty = 'https://cdn-images.dzcdn.net/images/artist/d41d8cd98f00b204e9800998ecf8427e/1000x1000-000000-80-0-0.jpg';
    const ai = new ArtistImage({}, { http: async u => u.includes('api.deezer.com')
        ? { ok: true, json: async () => ({ picture_xl: pic('1000x1000'), picture_big: pic('500x500'), picture_medium: pic('250x250') }) }
        : { ok: true, url: u.includes('1000x1000') ? empty : u } });
    const url = 'https://www.deezer.com/en/artist/14396405';
    assert.equal((await ai.find(null, [url])).src, pic('500x500'));
    const none = new ArtistImage({}, { http: async u => u.includes('api.deezer.com')
        ? { ok: true, json: async () => ({ picture_big: 'https://cdn-images.dzcdn.net/images/artist//500x500-000000-80-0-0.jpg' }) } : { ok: true } });
    assert.equal(await none.find(null, [url]), null);
    const all = [{ key: 'deezer', src: empty }, { key: 'bandcamp', src: photo }];
    const cache = new ArtistImage({ get: () => ({ mocky: { all, t: Date.now() } }) });
    assert.deepEqual(cache.cachedAll('mocky'), [all[1]]);
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
