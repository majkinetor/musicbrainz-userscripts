import { test } from 'node:test';
import assert from 'node:assert/strict';
const { default: ArtistImage } = await import(process.env.ARTIMG_SRC || './artist-image.js');

const photo = 'https://f4.bcbits.com/img/0038522370_21.jpg';
const youtube = 'https://yt3.googleusercontent.com/artist=w544-h544-l90-rj';
const urls = ['https://mocky.bandcamp.com/', 'https://music.youtube.com/channel/UCIZgzeDDYvvqBNI2gheMqDg'];
const html = '<meta property="og:image" content="https://f4.bcbits.com/img/a2873093934_5.jpg"><img src="' + photo + '" class="band-photo" alt="Mocky image">';
const response = body => ({ ok: true, text: async () => body });

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
