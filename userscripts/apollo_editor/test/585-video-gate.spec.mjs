// #585 (chaban-mb): "Apollo doesn't seem to care if a recording is a video" — a music
// video, sharing title, artist and length with the audio track, auto-linked onto a regular
// audio track. Undoing that is the expensive kind of mistake.
//
// The rule is MusicBrainz's own, from its cleanup report (Report/VideosInNonVideoMediums.pm):
// a video, not a data track, on a medium of a non-video format. Position is not part of
// it: every track of a DVD is a video, and a trailing run of videos breaks "videos come
// last".
import { readFileSync } from 'node:fs';
import { test, check, sourceOf } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });
const ours = () => [...((readFileSync(sourceOf('apollo_editor'), 'utf8').match(/const NON_VIDEO_FORMAT_IDS = new Set\(\[([\s\S]*?)\]\)/) || [])[1] || '').matchAll(/^\s*(\d+),/gm)].map(m => +m[1]);

test("the non-video formats are MusicBrainz's", { tag: '@web' }, async () => {
  const pm = await (await fetch('https://raw.githubusercontent.com/metabrainz/musicbrainz-server/master/lib/MusicBrainz/Server/Report/VideosInNonVideoMediums.pm')).text();
  check(/r\.video IS TRUE/.test(pm) && /t\.is_data_track IS FALSE/.test(pm) && /m\.format IN \(\$NON_VIDEO_FORMATS\)/.test(pm), 'the report still defines it as video + not a data track + a non-video format');
  const block = pm.slice(pm.indexOf('$NON_VIDEO_FORMATS'), pm.indexOf('sub query'));
  const mb = [...block.matchAll(/^\s*(\d+),\s*#/gm)].map(m => +m[1]), o = ours();
  check(o.length > 0, 'the script carries the set');
  const missing = mb.filter(i => !o.includes(i)), extra = o.filter(i => !mb.includes(i));
  check(!missing.length && !extra.length, `ours is MusicBrainz's exactly (missing ${JSON.stringify(missing)}, extra ${JSON.stringify(extra)})`);
});

test('a video is refused on an audio medium, and allowed where it belongs', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const submitted = await openApollo(page, inject, { release: '55530bc0-97ec-4256-97fc-e6058958c251' });   // an Enhanced CD; its last three are videos
  const p = await page.evaluate(() => {
    const A = window.__apolloEditor, med = MB.releaseEditor.rootField.release().mediums()[0], n = med.tracks().length;
    const read = () => A.videoBlockedHere(0, n - 1);
    const out = { size: A.NON_VIDEO_FORMAT_IDS.size, format: med.formatID() };
    out.audio = read();
    med.tracks()[n - 1].isDataTrack(true);
    out.dataTrack = read();
    med.tracks()[n - 1].isDataTrack(false);
    // the editor refuses a written format id, so the video-capable side is read off its own picker below
    med.formatID(null);
    out.unset = read();
    med.formatID(out.format);
    out.restored = med.formatID();
    out.formats = {};
    document.querySelectorAll('select[id^="medium-format"] option').forEach(o => { const t = (o.textContent || '').trim(); if (t && o.value) out.formats[t] = +o.value; });
    const c = { title: 'X', length: 100000, artist: 'Y' };
    out.pick = { video: A.recComboLevel({ name: 'X', length: 100000, artist: 'Y', video: true }, c), audio: A.recComboLevel({ name: 'X', length: 100000, artist: 'Y', video: false }, c) };
    return out;
  });
  const o = ours(), F = p.formats;
  check(p.size === o.length, `the whole set is in use (${p.size})`);
  check(p.audio === true, `refused on an audio-only medium (format ${p.format})`);
  check(p.dataTrack === false, "allowed in the medium's data section, where an Enhanced CD keeps its videos");
  check(p.unset === false, 'allowed while the format is unset: half-entered releases must still match');
  check(String(p.restored) === String(p.format), 'the format is put back');
  const video = ['DVD-Video', 'Blu-ray', 'VHS', 'Digital Media'].filter(n => F[n]), audio = ['CD', '12" Vinyl', 'Cassette', 'Enhanced CD'].filter(n => F[n]);
  check(video.length >= 3 && audio.length >= 3, "both kinds are in MusicBrainz's format picker");
  check(video.every(n => !o.includes(F[n])), `never refused on ${video.join(', ')}`);
  check(audio.every(n => o.includes(F[n])), `always on ${audio.join(', ')}`);
  check(p.pick.video === p.pick.audio, `the picker's scoring is untouched: a hand-picked video reads at its true confidence (${p.pick.video} vs ${p.pick.audio})`);
  check(submitted.length === 0, 'nothing submitted');
});
