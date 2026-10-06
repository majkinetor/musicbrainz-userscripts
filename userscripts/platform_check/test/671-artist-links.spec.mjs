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
  check(!('closeWhenDone' in back), 'no closeWhenDone unless asked');
  const closing = JSON.parse(f.pcFalconJson([{ type: 'artist', mbid: 'a', name: 'A', urls: ['https://u/1'] }], 'n', 'nm', true));
  check(closing.closeWhenDone === true && closing.name === 'nm' && closing.items.length === 1, `"Close Falcon after a successful import": closeWhenDone at the root (${JSON.stringify(closing)})`);
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

test('a match cached before artist pages were kept is read again', { tag: '@unit' }, async () => {
  const src = await functionSource('platform_check', ['PC_CREDIT_PROVIDERS', 'cacheGetScan']);
  const store = {
    deezer: { url: 'https://www.deezer.com/album/1', source: 'search' },                   // before #671
    qobuz: { url: 'https://www.qobuz.com/us-en/album/x/1', source: 'MB rels', credits: null },
    spotify: { url: 'https://open.spotify.com/album/1', source: 'search' },                // no pages to keep
    tidal: null,
    discogs: { url: null, source: 'search' },                                            // a cached no-match
  };
  const logs = [];
  const get = new Function('cacheGet', 'appendLog', src + '\nreturn cacheGetScan;')((m, p) => store[p] || null, (l, m) => logs.push(m));
  check(get('m', 'deezer', 'Deezer') === null && logs.length === 1, 'a credit platform\'s match without `credits`: a miss, so it is scanned again (and logged)');
  check(get('m', 'qobuz') === store.qobuz && get('m', 'spotify') === store.spotify && get('m', 'discogs') === store.discogs && get('m', 'tidal') === null,
    'kept: an entry that has them (even none), a platform with none to keep, a cached no-match');
});

// #671: MusicBrainz keeps Qobuz and Apple Music links in whatever locale they were entered, and
// /ws/2/url answers only for the exact url: the common other forms are asked in the same request.
test('a link MusicBrainz holds under another locale is already linked', { tag: '@unit' }, async () => {
  const src = await functionSource('platform_check', ['pcUrlKey', 'PC_QOBUZ_LOCALES', 'PC_APPLE_STOREFRONTS', 'pcUrlForms', 'pcLinkedTo']);
  const asked = [];
  const gmGet = async url => {
    const res = new URL(url).searchParams.getAll('resource');
    asked.push(res);
    const urls = res.filter(u => u === 'https://www.qobuz.com/gb-en/interpreter/pink-floyd/38324')
      .map(u => ({ resource: u, relations: [{ 'target-type': 'artist', artist: { id: 'pf', name: 'Pink Floyd' } }] }));
    return { ok: true, status: 200, responseText: JSON.stringify({ urls }) };
  };
  const f = new Function('gmGet', 'appendLog', 'MB_ORIGIN', src + '\nreturn { pcUrlForms, pcLinkedTo, pcUrlKey };')(gmGet, () => {}, 'https://musicbrainz.org');
  const forms = f.pcUrlForms('https://www.qobuz.com/us-en/interpreter/pink-floyd/38324');
  check(forms.includes('https://www.qobuz.com/gb-en/interpreter/pink-floyd/38324') && forms.includes('https://open.qobuz.com/artist/38324') && !forms.includes('https://www.qobuz.com/us-en/interpreter/pink-floyd/38324'), `Qobuz: the other locales and open.qobuz.com (${forms})`);
  check(f.pcUrlForms('https://music.apple.com/us/artist/487143').includes('https://itunes.apple.com/gb/artist/id487143') && !f.pcUrlForms('https://www.deezer.com/artist/1').length, 'Apple Music: other storefronts and itunes.apple.com; others none');
  const linked = await f.pcLinkedTo(['https://www.qobuz.com/us-en/interpreter/pink-floyd/38324', 'https://www.deezer.com/artist/1']);
  const who = linked.get(f.pcUrlKey('https://www.qobuz.com/us-en/interpreter/pink-floyd/38324')) || [];
  check(asked.length === 1, `one request (${asked.length})`);
  check(who.length === 1 && who[0].mbid === 'pf', `the us-en link counts as linked to Pink Floyd (${JSON.stringify(who)})`);
});

// #671 (majkinetor, The Ultimate Italian Disco Funk Collection): a track whose recording is credited
// to a same-named artist shows "Recording artist: Boeing" in its title cell. That link was read
// as a track artist, paired first by name, and the right Boeing's Discogs link showed ⚠.
test('a track\'s artists are its artist column, not the "Recording artist:" line', { tag: '@unit' }, async ({ page }) => {
  await page.setContent(`<!DOCTYPE html><html><body>
    <div class="releaseheader"><h1>X</h1><p class="subheader">~ Release by <a href="/artist/89ad4ac3-39f7-470e-963a-56509c546377">Various Artists</a></p></div>
    <table class="tbl medium"><tbody>
      <tr><td class="pos t"><a href="/track/1">1</a></td><td class="title wrap-anywhere"><a href="/recording/r1"><bdi>Dance on the Beat</bdi></a><div class="small">Recording artist: <bdi><a href="/artist/fce4abde-aede-4ba2-9119-1a9ba6e72da3" title="Boeing (Argentinian house producer)">Boeing</a></bdi></div><div class="ars"></div></td><td class="wrap-anywhere"><bdi><a href="/artist/36bf8efc-34ba-4f90-b02c-90af2c6d7856" title="Boeing (italo disco music)">Boeing</a></bdi></td></tr>
      <tr><td class="pos t"><a href="/track/2">2</a></td><td class="title"><a href="/recording/r2"><bdi>Hang on It</bdi></a></td><td><bdi><a href="/artist/7a157e97-0000-4000-8000-000000000000" title="Trance">Trance</a></bdi></td></tr>
    </tbody></table></body></html>`);
  const src = await functionSource('platform_check', ['VA_MBID', 'pcMbCredits']);
  const tracks = await page.evaluate(`(() => { ${src}; return pcMbCredits(document, 2).tracks.map(t => t.map(a => a.mbid)); })()`);
  check(JSON.stringify(tracks) === JSON.stringify([['36bf8efc-34ba-4f90-b02c-90af2c6d7856'], ['7a157e97-0000-4000-8000-000000000000']]), `track 1 is the italo disco Boeing only (${JSON.stringify(tracks)})`);
});

// #671 (majkinetor: "show a number before opening… if there are 25 to be added"): once the scans
// finish, one lookup counts the links the table would add; opening the table reuses it.
test('Artists & labels shows how many links it would add, from one lookup', { tag: '@unit' }, async () => {
  const src = await functionSource('platform_check', ['pcUrlKey', 'pcMarkCell', 'pcLinkedKey', 'pcLinkedFresh', 'pcLinkedCached', 'pcNewCount', 'pcShowLinksCount', 'pcCountLinks']);
  const run = async (setting) => {
    const btn = { innerHTML: 'Artists &amp; labels', classList: { on: false, toggle(c, v) { this.on = v; } } }, calls = [];
    let key = null;
    const rows = [
      { type: 'artist', mbid: 'a', name: 'A', cells: { discogs: [{ url: 'https://www.discogs.com/artist/1' }], deezer: [{ url: 'https://www.deezer.com/artist/2' }] } },
      { type: 'artist', mbid: 'b', name: 'B', cells: { discogs: [{ url: 'https://www.discogs.com/artist/3' }, { url: 'https://x.bandcamp.com/', uncertain: true }] } },
    ];
    const env = new Function('document', 'GM_getValue', 'mbDataGet', 'mbid', 'pcLinkRows', 'pcMbCredits', 'pcConfirmedCredits', 'pcLinkedTo', 'appendLog',
      'let _pcLinked = null;\n' + src + '\nreturn { pcCountLinks, pcLinkedCached, pcUrlKey };')(
      { getElementById: () => btn }, (k, d) => k === 'pc:links-count' ? setting : d, () => ({ mbTracks: 1 }), 'm',
      () => ({ rows }), () => ({}), () => ({ byProvider: {} }),
      async urls => { calls.push(urls); return new Map([[key('https://www.discogs.com/artist/1'), [{ type: 'artist', mbid: 'a' }]]]); }, () => {});
    key = env.pcUrlKey;
    await env.pcCountLinks();
    return { btn, calls, env, rows };
  };
  const on = await run(true);
  check(on.btn.innerHTML === 'Artists &amp; labels<span class="pc-links-n">2</span>' && on.btn.classList.on, `two links to add, as a badge (Deezer A, Discogs B; not A's linked one or the uncertain account): "${on.btn.innerHTML}"`);
  check(on.calls.length === 1, `one lookup (${on.calls.length})`);
  await on.env.pcLinkedCached(on.rows.flatMap(r => Object.values(r.cells).flat().map(c => c.url)));
  check(on.calls.length === 1, 'opening the table reuses it');
  const off = await run(false);
  check(off.calls.length === 0 && off.btn.innerHTML === 'Artists &amp; labels' && !off.btn.classList.on, 'setting off: nothing asked, no number');
});

// #671 (reopened): a ✓ that barcode or format confidence withholds still gives its artists and labels.
// Another edition of the album has the same ones; only the release link waits for confidence.
test('a match withheld by link confidence still gives artists and labels', { tag: '@unit' }, async ({ page }) => {
  const src = await functionSource('platform_check', ['pcConfirmedCredits']);
  const cr = { artists: [{ name: 'A', url: 'https://x/a' }], labels: [], tracks: [] };
  const store = { deezer: { url: 'https://www.deezer.com/album/1', source: 'search', credits: cr }, qobuz: { url: 'https://www.qobuz.com/x/1', source: 'search', credits: cr }, tidal: { url: 'https://tidal.com/album/1', source: 'search', credits: cr } };
  await page.setContent('<span id="ico-deezer">✓</span><span id="ico-qobuz">✓</span><span id="ico-tidal">?</span>');
  const got = await page.evaluate(([src, store]) => new Function('PROVIDER_ORDER', 'providerEnabled', 'cacheGet', 'mbid', 'PC_CREDIT_PROVIDERS', 'barcodeBlocks', 'formatBlocks',
    src + '\nreturn pcConfirmedCredits();')(['deezer', 'qobuz', 'tidal'], () => true, (m, p) => store[p] || null, 'm', [], p => p === 'deezer', p => p === 'qobuz'), [src, store]);
  check(Object.keys(got.byProvider).sort().join() === 'deezer,qobuz', `a ✓ counts whether or not barcode (deezer) or format (qobuz) withholds it; no match (tidal) doesn't (${Object.keys(got.byProvider)})`);
});
