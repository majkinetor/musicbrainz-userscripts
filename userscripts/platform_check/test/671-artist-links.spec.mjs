// #671: the artist and label pages a platform's album names, kept with its match and
// paired with the release's MusicBrainz artists and labels for Falcon.
import { gunzipSync } from 'node:zlib';
import { readFileSync, readdirSync } from 'node:fs';
import { test, check, loadFunctions, functionSource } from '../../../dev/test/harness.mjs';

const NAMES = ['VA_MBID', 'VA_NAME_RE', 'qzDec', 'ytmWalk', 'pcUrlKey', 'pcSameUrl', 'pcCr', 'pcCredits', 'pcCreditsSummary', 'pcDiscogsName',
  'pcCreditsDiscogs', 'pcCreditsDeezer', 'pcCreditsApple', 'pcSlug', 'pcCreditsQobuzApi', 'pcCreditsQobuzPage', 'pcCreditsBandcamp', 'pcCreditsBeatport',
  'pcCreditsYtm', 'pcCreditsSoundcloud', 'pcCreditsAudiomack', 'pcNameKey', 'pcPairCredits', 'pcLinkRows', 'pcMarkCell', 'PC_ENTITY_LINK_TYPE', 'pcLinkTypeFor', 'pcFalconJson', 'pcFalconPayload'];
// every reply the fixtures recorded, keyed by URL
const dir = new URL('./fixtures/', import.meta.url);
const replies = {};
for (const n of readdirSync(dir).filter(n => n.startsWith('fx-'))) Object.assign(replies, JSON.parse(gunzipSync(readFileSync(new URL(n, dir))).toString('utf8')));
const reply = key => { const v = replies[key]; return v && typeof v === 'object' ? v.body : v; };

test('each platform\'s album names its artist and label pages', { tag: '@unit' }, async () => {
  const f = await loadFunctions('platform_check', NAMES);

  const dg = f.pcCreditsDiscogs(JSON.parse(reply('https://api.discogs.com/releases/17601142')));
  check(dg.artists.length === 1 && dg.artists[0].url === 'https://www.discogs.com/artist/669988' && dg.artists[0].name === 'Menahan Street Band', `Discogs: the album's artist (${JSON.stringify(dg.artists)})`);
  check(dg.labels.map(l => l.name).join() === 'Dunham,Daptone Records' && dg.labels.every(l => /^https:\/\/www\.discogs\.com\/label\/\d+$/.test(l.url)), `…its labels (${JSON.stringify(dg.labels)})`);
  check(dg.tracks.length === 14, `…and its 14 tracks, none naming an artist of its own (${dg.tracks.length})`);
  const va = f.pcCreditsDiscogs(JSON.parse(reply('https://api.discogs.com/releases/8688045')));
  check(va.artists.length === 0, `a compilation's "Various" is no artist (${JSON.stringify(va.artists)})`);
  check(va.tracks.length === 15 && va.tracks.every(t => t.length && t.every(a => /^https:\/\/www\.discogs\.com\/artist\/\d+$/.test(a.url))), 'each of its tracks names its own artists');
  check(f.pcCreditsDiscogs({ artists: [{ id: 5, name: 'John Smith (2)', anv: 'J. Smith' }] }).artists[0].name === 'John Smith', 'Discogs\' "(2)" is dropped from the name');
  check(f.pcCreditsDiscogs({ artists: [{ id: 5, name: 'John Smith (2)', anv: 'J. Smith' }] }).artists[0].alt === 'J. Smith', '…and the credited name kept to match on');

  const dz = f.pcCreditsDeezer(JSON.parse(reply('https://api.deezer.com/album/509903831')));
  check(dz.artists[0].url === 'https://www.deezer.com/artist/' + JSON.parse(reply('https://api.deezer.com/album/509903831')).artist.id && dz.artists[0].name === 'Om Unit', `Deezer: the album's artist (${JSON.stringify(dz.artists)})`);
  check(dz.tracks.length === 15 && dz.tracks.every(t => t.length === 1), `…and each track's (${dz.tracks.length})`);
  check(f.pcCreditsDeezer({ artist: { id: 1, name: 'A' }, nb_tracks: 30, tracks: { data: [{ artist: { id: 1, name: 'A' } }] } }).tracks === null, 'a cut-short tracklist gives no track artists');

  const ap = f.pcCreditsApple(JSON.parse(reply('https://amp-api.music.apple.com/v1/catalog/us/albums/1500566626?l=en-US')).data[0], 'us');
  check(ap.artists.length === 1 && ap.artists[0].url === 'https://music.apple.com/us/artist/347126170' && ap.artists[0].name === 'Om Unit', `Apple: the album's artist, by id (${JSON.stringify(ap.artists)})`);
  const two = f.pcCreditsApple({ attributes: { artistName: 'A & B' }, relationships: { artists: { data: [{ id: '1' }, { id: '2' }] } } }, 'gb');
  check(two.artists.map(a => a.name).join('|') === 'A|B' && two.artists[1].url === 'https://music.apple.com/gb/artist/2', `two artists: the credit split by them (${JSON.stringify(two.artists)})`);

  const qPage = Object.keys(replies).find(k => /qobuz\.com\/us-en\/album\/philip-cohran/.test(k));
  const qb = f.pcCreditsQobuzPage(reply(qPage));
  check(qb.artists.length === 1 && qb.artists[0].url === 'https://www.qobuz.com/us-en/interpreter/philip-cohran-and-the-artistic-heritage-ensemble/3178234', `Qobuz's page: the artist (${JSON.stringify(qb.artists)})`);
  check(qb.labels.length === 1 && qb.labels[0].name === 'Katalyst' && qb.labels[0].url === 'https://www.qobuz.com/us-en/label/katalyst/download-streaming-albums/298083', `…and the label (${JSON.stringify(qb.labels)})`);
  const qa = f.pcCreditsQobuzApi({ id: 'x', tracks_count: 1, artist: { id: 7, name: 'Some Body', slug: 'some-body' }, label: { id: 9, name: 'Lbl & Co' }, tracks: { items: [{ performer: { id: 8, name: 'Guest' } }] } });
  check(qa.artists[0].url === 'https://www.qobuz.com/us-en/interpreter/some-body/7' && qa.labels[0].url === 'https://www.qobuz.com/us-en/label/lbl-co/download-streaming-albums/9' && qa.tracks[0][0].url === 'https://www.qobuz.com/us-en/interpreter/guest/8', `Qobuz's API: artist, label and track performers (${JSON.stringify(qa)})`);

  const bc = f.pcCreditsBandcamp(reply('https://analogafrica.bandcamp.com/album/space-echo-the-mystery-behind-the-cosmic-sound-of-cabo-verde-finally-revealed-analog-africa-nr-20'));
  check(bc.artists[0].url === 'https://analogafrica.bandcamp.com/' && bc.artists[0].uncertain && bc.labels[0].url === bc.artists[0].url, `Bandcamp: the account, offered as artist or label, uncertain (${JSON.stringify(bc)})`);

  const bp = f.pcCreditsBeatport({ artists: [{ id: 3, name: 'DJ X', slug: 'dj-x' }], label: { id: 4, name: 'Lab', slug: 'lab' } });
  check(bp.artists[0].url === 'https://www.beatport.com/artist/dj-x/3' && bp.labels[0].url === 'https://www.beatport.com/label/lab/4', `Beatport (${JSON.stringify(bp)})`);

  const ytmKey = Object.keys(replies).find(k => /youtubei\/v1\/browse/.test(k) && /Om Unit|UC_SaGOmzb9_WXNaHZeuGfCg/.test(reply(k) || ''));
  const yt = f.pcCreditsYtm(JSON.parse(reply(ytmKey)));
  check(yt.artists[0].url === 'https://music.youtube.com/channel/UC_SaGOmzb9_WXNaHZeuGfCg' && yt.artists[0].name === 'Om Unit', `YouTube Music: the header's artist channel (${JSON.stringify(yt.artists)})`);

  const sc = f.pcCreditsSoundcloud({ user: { username: 'Lab', permalink_url: 'https://soundcloud.com/lab' } });
  check(sc.artists[0].uncertain && sc.labels[0].url === 'https://soundcloud.com/lab', 'SoundCloud: the uploader, as artist or label');
  check(f.pcCreditsAudiomack({ uploader: { url_slug: 'some-one', name: 'Some One' } }).artists[0].url === 'https://audiomack.com/some-one', 'Audiomack: the uploader');
  check(f.pcCreditsDeezer({ artist: { id: 5080, name: 'Various Artists' } }) === null, 'nothing named: no credits at all');
});

test('platform artists pair with MusicBrainz artists by name, then by position', { tag: '@unit' }, async () => {
  const f = await loadFunctions('platform_check', NAMES);
  check(f.pcNameKey('Simon & Garfunkel') === f.pcNameKey('simon and garfunkel'), '"&" and "and" are one');
  check(f.pcNameKey('Björk') === f.pcNameKey('BJORK'), 'case and accents don\'t count');

  const mb = [{ mbid: 'a', name: 'Alpha' }, { mbid: 'b', name: 'Beta' }];
  let r = f.pcPairCredits(mb, [{ name: 'beta', url: 'u2' }, { name: 'ALPHA', url: 'u1' }]);
  check(r.pairs.map(p => `${p.plat.url}>${p.mb.mbid}:${p.by}`).join() === 'u2>b:name,u1>a:name', `by name, whatever the order (${JSON.stringify(r.pairs.map(p => p.mb.mbid))})`);
  r = f.pcPairCredits(mb, [{ name: 'Alpha', url: 'u1' }, { name: 'Βήτα', url: 'u2' }]);
  check(r.pairs.length === 2 && r.pairs[1].mb.mbid === 'b' && r.pairs[1].by === 'position', 'an unmatched name, with as many artists on each side: by position');
  r = f.pcPairCredits(mb, [{ name: 'Gamma', url: 'u3' }]);
  check(!r.pairs.length && r.left.length === 1 && /differ in length/.test(r.left[0].why), `otherwise left out, saying why (${JSON.stringify(r.left)})`);
  r = f.pcPairCredits([{ mbid: 'a', name: 'Alpha' }], [{ name: 'A Label', url: 'b', uncertain: true }]);
  check(!r.pairs.length && /name only/.test(r.left[0].why), 'an account that may be the label is never paired by position');
});

test('the table: one row per MusicBrainz artist or label, links merged across tracks', { tag: '@unit' }, async () => {
  const f = await loadFunctions('platform_check', NAMES);
  const VA = '89ad4ac3-39f7-470e-963a-56509c546377';
  const mb = {
    artists: [{ mbid: VA, name: 'Various Artists' }],
    labels: [{ mbid: 'L', name: 'Analog Africa' }],
    tracks: [[{ mbid: 'x', name: 'Ernest Honny' }], [{ mbid: 'y', name: 'Joe Bone' }], [{ mbid: 'x', name: 'Ernest Honny' }]],
    va: true,
  };
  const byProvider = {
    discogs: { artists: [], labels: [{ name: 'Analog Africa', url: 'https://www.discogs.com/label/1' }],
      tracks: [[{ name: 'Ernest Honny', url: 'https://www.discogs.com/artist/10' }], [{ name: 'Joe Bone', url: 'https://www.discogs.com/artist/11' }], [{ name: 'Ernest Honny', url: 'https://www.discogs.com/artist/10' }]] },
    bandcamp: { artists: [{ name: 'Analog Africa', url: 'https://analogafrica.bandcamp.com/', uncertain: true }], labels: [{ name: 'Analog Africa', url: 'https://analogafrica.bandcamp.com/', uncertain: true }], tracks: null },
    deezer: { artists: [], labels: [], tracks: [[{ name: 'E. Honny', url: 'https://www.deezer.com/artist/1' }], [{ name: 'Joe Bone', url: 'https://www.deezer.com/artist/2' }]] },
  };
  const { rows, notes } = f.pcLinkRows(mb, byProvider);
  const by = Object.fromEntries(rows.map(r => [`${r.type}:${r.mbid}`, r]));
  check(rows.length === 3, `Ernest Honny, Joe Bone and the label (${rows.map(r => r.name).join(', ')})`);
  check(by['artist:x'].cells.discogs.length === 1, 'an artist on two tracks is one row, its link once');
  check(by['label:L'].cells.bandcamp && by['label:L'].cells.bandcamp[0].uncertain, 'the Bandcamp account lands on the label of its name, uncertain');
  check(!rows.some(r => r.mbid === VA), 'Various Artists gets no row');
  check(!by['artist:x'].cells.deezer && notes.some(n => /deezer: track artists not paired — 2 track/.test(n)), `a platform with another track count pairs no track artists, and says so (${notes.join(' | ')})`);
  check(rows[rows.length - 1].type === 'label', 'artists first, then labels');

  const solo = f.pcLinkRows({ artists: [{ mbid: 'a', name: 'Om Unit' }], labels: [], tracks: [null, null], va: false },
    { deezer: { artists: [{ name: 'Om Unit', url: 'https://www.deezer.com/artist/9' }], labels: [], tracks: [[{ name: 'Om Unit', url: 'https://www.deezer.com/artist/9' }], [{ name: 'Om Unit', url: 'https://www.deezer.com/artist/9' }]] } });
  check(solo.rows.length === 1 && solo.rows[0].cells.deezer.length === 1, 'a track with no credit of its own is the release artist\'s');
});

test('existing links, the Falcon batch and the seeded edit page', { tag: '@unit' }, async () => {
  const f = await loadFunctions('platform_check', NAMES);
  const row = { type: 'artist', mbid: 'a' };
  const linked = new Map([
    [f.pcUrlKey('https://www.deezer.com/artist/1'), [{ type: 'artist', mbid: 'a', name: 'A' }]],
    [f.pcUrlKey('https://www.discogs.com/artist/2'), [{ type: 'artist', mbid: 'z', name: 'Zed' }]],
  ]);
  const st = f.pcMarkCell(row, [{ url: 'https://deezer.com/artist/1' }, { url: 'https://www.discogs.com/artist/2' }, { url: 'https://x.bandcamp.com/', uncertain: true }, { url: 'https://www.discogs.com/artist/3' }], linked).map(c => c.state);
  check(st.join() === 'linked,other,unsure,new', `✓ already linked, ⚠ someone else's, +? uncertain, + new (${st.join()})`);

  const b64 = f.pcFalconPayload([{ type: 'artist', mbid: 'a', name: 'Björk', urls: ['https://u/1', 'https://u/2'] }, { type: 'label', mbid: 'l', name: 'L', urls: ['https://u/3'] }], 'from Platform Check — “x”');
  const back = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0))));
  check(back.note === 'from Platform Check — “x”' && back.items.length === 2, `Falcon's JSON model, { note, items }, UTF-8 intact (${JSON.stringify(back)})`);
  check(back.items[0].entityType === 'artist' && back.items[0].mbid === 'a' && back.items[0].name === 'Björk' && back.items[0].urls.map(u => u.url).join() === 'https://u/1,https://u/2' && back.items[0].urls[0].linkTypeId === null && back.items[1].entityType === 'label',
    'one item per artist or label, its links in urls[]');
  const typed = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(f.pcFalconPayload([
    { type: 'artist', mbid: 'a', name: 'A', urls: ['https://www.qobuz.com/us-en/interpreter/miami-nights-1984/972118', 'https://music.apple.com/us/artist/1', 'https://www.deezer.com/artist/1'] },
    { type: 'label', mbid: 'l', name: 'L', urls: ['https://www.qobuz.com/us-en/label/x/download-streaming-albums/1'] }], 'n')), c => c.charCodeAt(0))));
  check(typed.items[0].urls.map(u => u.linkTypeId).join() === '176,978,' && typed.items[1].urls[0].linkTypeId === 959,
    `a link type where MusicBrainz can't pick one (Qobuz, Apple Music), none where it can (${JSON.stringify(typed.items.map(i => i.urls.map(u => u.linkTypeId)))})`);

  const seeded = new Function('const MB_ORIGIN = "https://musicbrainz.org";\n' + await functionSource('platform_check', ['PC_ENTITY_LINK_TYPE', 'pcLinkTypeFor', 'pcSeededEditUrl']) + '\nreturn pcSeededEditUrl;')();
  const u = new URL(seeded('label', 'l', ['https://a/1', 'https://b/2'], 'note'));
  check(u.pathname === '/label/l/edit' && u.searchParams.get('edit-label.url.0.text') === 'https://a/1' && u.searchParams.get('edit-label.url.1.text') === 'https://b/2' && u.searchParams.get('edit-label.edit_note') === 'note', `the edit page, seeded (${u})`);
  const here = new Function('document', await functionSource('platform_check', ['pcSendToFalconHere']) + '\nreturn pcSendToFalconHere;');
  const doc = new EventTarget();
  check(here(doc)('{}', true) === false, 'no Falcon on the page: not handed over (a tab opens instead)');
  let got = null;
  doc.addEventListener('falcon:import', e => { got = e.detail; doc.dispatchEvent(new CustomEvent('falcon:import-ok')); });
  check(here(doc)('{"items":[]}') === true && got === '{"items":[]}', 'Falcon on the page takes the JSON in place');
  let ran = null;
  doc.addEventListener('falcon:run', e => { ran = e.detail; doc.dispatchEvent(new CustomEvent('falcon:import-ok')); });
  got = null;
  check(here(doc)('{"items":[1]}', true) === true && ran === '{"items":[1]}' && got === null, 'Run asks Falcon to run (falcon:run), Send only just to queue');
  const q = new URL(seeded('artist', 'a', ['https://www.deezer.com/artist/1', 'https://www.qobuz.com/us-en/interpreter/x/2'], 'n'));
  check(!q.searchParams.has('edit-artist.url.0.link_type_id') && q.searchParams.get('edit-artist.url.1.link_type_id') === '176', `…the Qobuz link typed (${q})`);
});
