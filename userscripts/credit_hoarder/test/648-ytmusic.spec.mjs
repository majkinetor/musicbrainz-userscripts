// #648: YouTube Music as a credit source — each song's ⋮ → Credits dialog, read anonymously
// through the innertube API YouTube Music's web player uses.
//  1. @unit — the mapping: "Written by" → writer, "Produced by" → producer, "Performed by"
//     (the track artist credit) and "Music metadata provided by" (the label) reported, not
//     imported; positions numbered straight through (as YouTube Music does) placed onto the
//     release's mediums, and plain with a mismatch flag when the counts disagree.
//  2. @web — the live fetch, GM_xmlhttpRequest shimmed over Node's fetch:
//       Random Access Memories  its album page links only official-audio videos (no
//                               credits), so the songs must come from the playlist page —
//                               all 13 credited (Columbia, Bangalter, de Homem-Christo)
//       Music Will Explain      linked by album page (MPREb_), not playlist: resolved to its
//                               playlist; Mocky produces, Dominic "Mocky" Salole writes
//       Migration               Ninja Tune sends no credits: every song comes back empty, in order
import { test } from '../../../dev/test/harness.mjs';
import assert from 'node:assert/strict';
import { ytmPositions, ytmToEngine, parseYtmAlbumUrl, fetchYtmCredits } from '../src/sources/ytmusic.js';

test('YouTube Music credits map onto writer/producer and the release mediums', { tag: '@unit' }, async () => {
  assert.deepEqual(parseYtmAlbumUrl('https://music.youtube.com/playlist?list=OLAK5uy_kNhM2yaBTOVwrcZJepB1C9P3-n5_Sfy5c'), { list: 'OLAK5uy_kNhM2yaBTOVwrcZJepB1C9P3-n5_Sfy5c' });
  assert.deepEqual(parseYtmAlbumUrl('//music.youtube.com/browse/MPREb_OaK7LWmNDG6'), { album: 'MPREb_OaK7LWmNDG6' });
  assert.equal(parseYtmAlbumUrl('https://music.youtube.com/watch?v=Rgrt_8mXrK8'), null);

  // single medium (or unknown): plain numbers
  assert.deepEqual(ytmPositions(3, [3]), { positions: ['1', '2', '3'], multiMedium: false, mismatch: false });
  assert.deepEqual(ytmPositions(3, []), { positions: ['1', '2', '3'], multiMedium: false, mismatch: false });
  // Mellon Collie: 28 straight through, 2×14 on MusicBrainz — song 15 is "2-1"
  const mc = ytmPositions(28, [14, 14]);
  assert.equal(mc.mismatch, false);
  assert.equal(mc.positions[13], '1-14');
  assert.equal(mc.positions[14], '2-1');
  assert.equal(mc.positions[27], '2-14');
  // counts disagree: positions stay plain, flagged
  assert.deepEqual(ytmPositions(4, [2, 3]), { positions: ['1', '2', '3', '4'], multiMedium: true, mismatch: true });

  const songs = [
    { title: 'Give Life Back to Music', sections: {
      'Performed by': ['Daft Punk'],
      'Written by': ['Thomas Bangalter', 'Guy-Manuel de Homem-Christo', 'Paul Jackson Jr.', 'Nile Rodgers'],
      'Produced by': ['Thomas Bangalter', 'Guy-Manuel de Homem-Christo'],
      'Music metadata provided by': ['Columbia'],
    } },
    { title: 'Uncredited', sections: {} },
    { title: 'Odd', sections: { 'Mixed by': ['Someone'] } },
  ];
  const eng = ytmToEngine(songs, [2, 1]);
  assert.deepEqual(eng.tracklist.map(t => t.position), ['1-1', '1-2', '2-1']);
  assert.equal(eng.tracklist[1].title, 'Uncredited');   // an uncredited song still holds its place
  const got = eng.tracklistRels.map(r => `${r.track.position} ${r.linkType} ${r.artist.name}`);
  assert.deepEqual(got, [
    '1-1 writer Thomas Bangalter', '1-1 writer Guy-Manuel de Homem-Christo', '1-1 writer Paul Jackson Jr.', '1-1 writer Nile Rodgers',
    '1-1 producer Thomas Bangalter', '1-1 producer Guy-Manuel de Homem-Christo',
  ]);
  assert.ok(eng.tracklistRels.every(r => r.artist.resource_url === '' && r.entityType === 'artist'), 'names only — no source URL');
  assert.ok(eng.skipped.some(s => /Performed by — Daft Punk \(the track artist credit\)/.test(s)), eng.skipped.join('\n'));
  assert.ok(eng.skipped.some(s => /Music metadata provided by — Columbia \(the label or distributor\)/.test(s)), eng.skipped.join('\n'));
  assert.ok(eng.skipped.some(s => /2-1: Mixed by — Someone \(unmapped section\)/.test(s)), eng.skipped.join('\n'));
});

test('YouTube Music credits fetch live: songs from the playlist page, album links resolved, uncredited albums empty', { tag: '@web' }, async () => {
  test.setTimeout(3 * 60_000);
  // the userscript manager's request, over Node's fetch
  globalThis.GM_xmlhttpRequest = o => {
    fetch(o.url, { method: o.method, headers: o.headers, body: o.data })
      .then(async r => o.onload({ status: r.status, responseText: await r.text() }))
      .catch(() => o.onerror());
  };
  try {
    const ram = await fetchYtmCredits('https://music.youtube.com/playlist?list=OLAK5uy_kNhM2yaBTOVwrcZJepB1C9P3-n5_Sfy5c');
    assert.equal(ram.songs.length, 13, `RAM: 13 songs (${ram.songs.length})`);
    assert.equal(ram.songs[0].title, 'Give Life Back to Music');
    assert.ok(ram.songs.every(s => (s.sections['Music metadata provided by'] || []).includes('Columbia')), 'RAM: every song credited, Columbia');
    assert.ok(ram.songs[0].sections['Produced by'].includes('Thomas Bangalter'), JSON.stringify(ram.songs[0].sections));

    const mwe = await fetchYtmCredits('https://music.youtube.com/browse/MPREb_OaK7LWmNDG6');
    assert.match(mwe.list, /^OLAK5uy_/, 'Music Will Explain: album page → its playlist');
    const iv = mwe.songs.find(s => s.title === 'Infinite Vibrations');
    assert.ok(iv, `Infinite Vibrations is on it (${mwe.songs.map(s => s.title).join(', ')})`);
    assert.deepEqual(iv.sections['Produced by'], ['Mocky']);
    assert.deepEqual(iv.sections['Written by'], ['Dominic “Mocky” Salole']);

    const mig = await fetchYtmCredits('https://music.youtube.com/playlist?list=OLAK5uy_nAld19q2PYRkJK9NCiOms9827W2BN24wA');
    assert.ok(mig.songs.length >= 12, `Migration: its songs (${mig.songs.length})`);
    assert.ok(mig.songs.every(s => !Object.keys(s.sections).length), 'Migration: no credits on any song');
    assert.equal(ytmToEngine(mig.songs, []).tracklistRels.length, 0);
  } finally { delete globalThis.GM_xmlhttpRequest; }
});
