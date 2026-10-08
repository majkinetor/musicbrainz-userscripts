// #690: a YouTube Music track link must be the album's own track, never its music video.
// Read logged out, YouTube Music's album page swaps in the music video (MUSIC_VIDEO_TYPE_OMV)
// for a track that has one: Gallina's "Uberi ruki" got Moon Records' MV. The album's OLAK5uy_
// playlist, as YouTube's own client (WEB) lists it, holds only the album's tracks; the album
// page is the fallback, and there only official audio (ATV) counts.
//
// test.musicbrainz.org, read-only. YouTube's answers are faked: the release's first track
// has a music video on the album page, every track its own audio in the playlist.
import { test, check, answerGm } from '../../../dev/test/harness.mjs';
import { openScout, logText } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

const LIST = 'OLAK5uy_fake690fake690fake690fake690fake6';
const ALBUM = 'MPREb_fake690';
const vid = (kind, i) => (kind + String(i).padStart(2, '0')).padEnd(11, 'x');   // aud00xxxxxx, mvv00xxxxxx
const mmss = ms => Math.floor(Math.round(ms / 1000) / 60) + ':' + String(Math.round(ms / 1000) % 60).padStart(2, '0');

// YouTube Music's album page, logged out: track 1 is its music video
const albumPage = tracks => ({
  header: { musicResponsiveHeaderRenderer: { title: { runs: [{ text: 'Fake Album' }] } } },
  microformat: { microformatDataRenderer: { urlCanonical: 'https://music.youtube.com/playlist?list=' + LIST } },
  contents: { musicShelfRenderer: { contents: tracks.map((t, i) => {
    const v = i === 0 ? vid('mvv', i) : vid('aud', i);
    return { musicResponsiveListItemRenderer: {
      playlistItemData: { videoId: v },
      flexColumns: [
        { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: t.title, navigationEndpoint: { watchEndpoint: { videoId: v,
          watchEndpointMusicSupportedConfigs: { watchEndpointMusicConfig: { musicVideoType: i === 0 ? 'MUSIC_VIDEO_TYPE_OMV' : 'MUSIC_VIDEO_TYPE_ATV' } } } } }] } } },
        { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: 'Some Artist' }] } } },
      ],
      fixedColumns: [{ musicResponsiveListItemFixedColumnRenderer: { text: { runs: [{ text: mmss(t.length) }] } } }],
    } };
  }) } },
});
// the album's playlist as YouTube's WEB client lists it: the album's own tracks only
const playlist = tracks => ({
  metadata: { playlistMetadataRenderer: { title: 'Album - Fake Album' } },
  contents: { playlistVideoListRenderer: { contents: tracks.map((t, i) => ({ playlistVideoRenderer: {
    videoId: vid('aud', i), title: { runs: [{ text: t.title }] }, shortBylineText: { runs: [{ text: 'Some Artist - Topic' }] },
    lengthSeconds: String(Math.round(t.length / 1000)), isPlayable: true,
  } })) } },
});

async function run(page, context, inject, { link, web = 200 }) {
  const tracks = [];
  const calls = { web: 0, remix: [] };
  answerGm(context, ({ url, data }) => {
    if (/^https:\/\/www\.youtube\.com\/youtubei\/v1\/browse/.test(url)) {
      calls.web++;
      return web === 200 ? { status: 200, body: JSON.stringify(playlist(tracks)) } : { status: web, body: '' };
    }
    if (/^https:\/\/music\.youtube\.com\/youtubei\/v1\/browse/.test(url)) {
      const id = JSON.parse(data || '{}').browseId;
      calls.remix.push(id);
      if (id === 'VL' + LIST) return { status: 200, body: JSON.stringify({ x: { browseId: ALBUM } }) };
      if (id === ALBUM) return { status: 200, body: JSON.stringify(albumPage(tracks)) };
    }
    return null;
  });
  await openScout(page, inject, {
    edit: j => {
      tracks.length = 0;   // the release is read more than once
      (j.media || []).forEach(md => (md.tracks || []).forEach(tk => tracks.push({ title: tk.title, length: tk.length || tk.recording?.length })));
      (j.relations = j.relations || []).push({ type: 'free streaming', url: { resource: link } });
    },
  });
  await page.waitForFunction(() => !!window.__isrcScoutTest466, null, { timeout: 5000 });
  const urls = await page.evaluate(async ts => {
    const yt = window.__isrcScoutTest466.PROV.find(p => p.code === 'yt');
    const out = [];
    for (let i = 0; i < ts.length; i++) out.push(await yt.resolve(null, { title: ts[i].title, dur: ts[i].dur }, i));
    return out;
  }, tracks.slice(0, 3).map(t => ({ title: t.title, dur: mmss(t.length) })));
  const log = (await logText(page)).split('\n').filter(l => /YouTube/.test(l));
  console.log(JSON.stringify({ urls, calls, log }, null, 1));
  return { urls, calls, log };
}

test('#690: the album\'s tracks come from its playlist, not the music video on the album page', { tag: ['@sandbox'] }, async ({ page, context, inject }) => {
  const { urls, calls, log } = await run(page, context, inject, { link: 'https://music.youtube.com/playlist?list=' + LIST });
  check(urls[0] === 'https://music.youtube.com/watch?v=' + vid('aud', 0), `track 1 is the album's own track, not the music video (${urls[0]})`);
  check(urls.every((u, i) => u === 'https://music.youtube.com/watch?v=' + vid('aud', i)), `every track resolves from the playlist (${urls.join(', ')})`);
  check(calls.web === 1, `the playlist is read once (${calls.web})`);
  check(calls.remix.length === 0, `the YouTube Music album page isn't needed (${calls.remix.join(', ')})`);
  check(log.some(l => /YouTube Music album "Fake Album" \(OLAK5uy_fake690/.test(l)), 'the log names the album and its playlist');
});

test('#690: a link to the album page only — the page names the playlist, which gives the tracks', { tag: ['@sandbox'] }, async ({ page, context, inject }) => {
  const { urls, calls } = await run(page, context, inject, { link: 'https://music.youtube.com/browse/' + ALBUM });
  check(urls[0] === 'https://music.youtube.com/watch?v=' + vid('aud', 0), `track 1 is the album's own track (${urls[0]})`);
  check(calls.remix.join() === ALBUM && calls.web === 1, `the album page once, for its playlist, then the playlist (${calls.remix.join(', ')}; web ${calls.web})`);
});

test('#690: without the playlist, the album page\'s music video is skipped', { tag: ['@sandbox'] }, async ({ page, context, inject }) => {
  const { urls, log } = await run(page, context, inject, { link: 'https://music.youtube.com/playlist?list=' + LIST, web: 500 });
  check(urls[0] === null, `track 1, a music video on the album page, gets no link (${urls[0]})`);
  check(urls[1] === 'https://music.youtube.com/watch?v=' + vid('aud', 1) && urls[2] === 'https://music.youtube.com/watch?v=' + vid('aud', 2), `the other tracks still resolve (${urls.slice(1).join(', ')})`);
  check(log.some(l => /not official audio \(OMV\)/.test(l)), 'the log says why track 1 was skipped');
});
