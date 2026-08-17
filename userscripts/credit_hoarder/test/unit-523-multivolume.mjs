// #523: "Multiple media digital album credits collision" — a multi-medium
// digital release repeats per-track numbers per medium (1..n, 1..n, …) on
// Deezer, Qobuz and Apple, same as Tidal already handled (#325). Left
// unhandled, a bare repeated number is ambiguous and dispatch.js's
// getRecordingEntity() silently collapses it onto medium 1's same-numbered
// track — confirmed live: a Deezer composer credit for "Daystar" (medium 2
// track 4) landed on "Channel For the Light (Pt. II)" (medium 1 track 4)
// instead. Deezer/Qobuz/Apple now detect the reset the same way Tidal does
// and emit compound "medium-track" positions. No browser, no GM.
// Run: node test/unit-523-multivolume.mjs
import assert from 'node:assert/strict';
import { assignVolumePositions } from '../src/util.js';
import { extractDeezerCredits, deezerToEngine } from '../src/sources/deezer.js';
import { extractQobuzCredits, parseQobuzApiTracks, qobuzToEngine } from '../src/sources/qobuz.js';
import { appleToEngine } from '../src/sources/apple.js';

// ── assignVolumePositions: the shared detector ──────────────────────────────

// single medium — no reset seen, positions stay bare.
{
    const items = [{ n: '1' }, { n: '2' }, { n: '3' }];
    const { positions, multiVolume } = assignVolumePositions(items, it => it.n);
    assert.equal(multiVolume, false);
    assert.deepEqual(positions, ['1', '2', '3']);
}

// two media, natural (medium-sequential) order — reset detected, compound positions.
{
    const items = [{ n: '1' }, { n: '2' }, { n: '3' }, { n: '1' }, { n: '2' }, { n: '3' }];
    const { positions, multiVolume } = assignVolumePositions(items, it => it.n);
    assert.equal(multiVolume, true);
    assert.deepEqual(positions, ['1-1', '1-2', '1-3', '2-1', '2-2', '2-3']);
}

// three media, uneven track counts per medium — still walks correctly.
{
    const items = [{ n: '1' }, { n: '2' }, { n: '1' }, { n: '1' }, { n: '2' }, { n: '3' }];
    const { positions, multiVolume } = assignVolumePositions(items, it => it.n);
    assert.equal(multiVolume, true);
    assert.deepEqual(positions, ['1-1', '1-2', '2-1', '3-1', '3-2', '3-3']);
}

// ── the reported scenario: Deezer, index 4 on two different media ──────────
// "Channel For the Light (Pt. II)" (medium 1 track 4) vs "Daystar" (medium 2
// track 4) — both index 4, but DIFFERENT songs. Reproduces the exact HTML
// shape (song row + contributors row, medium 1 block then medium 2 block).
{
    const row = (id, pos) => `<tr class="song" itemid="/us/track/${id}"><span class="number" data-target="position">${pos}</span></tr>`;
    const cred = (id, text) => `<tr class="contributors" id="naboo_datagrid_contributors_${id}"><div data-target="contributors">${text}</div></tr>`;
    const html = [
        row(1, 4), cred(1, 'Composers: David Storrs'),      // medium 1 track 4 ("Channel For the Light")
        row(2, 4), cred(2, 'Composers: David Naegele'),     // medium 2 track 4 ("Daystar") — SAME index, different song
    ].join('\n');
    const parsed = extractDeezerCredits(html);
    // natural document order preserved — NOT sorted into [4,4] interleaved-then-tied
    assert.deepEqual(parsed.map(t => t.index), [4, 4]);
    const eng = deezerToEngine(parsed);
    assert.equal(eng.multiVolume, true);
    assert.deepEqual(eng.tracklist.map(t => t.position), ['1-4', '2-4']);
    const byArtist = Object.fromEntries(eng.tracklistRels.map(r => [r.artist.name, r.track.position]));
    assert.equal(byArtist['David Storrs'], '1-4', 'David Storrs is the FIRST index-4 occurrence (medium 1)');
    assert.equal(byArtist['David Naegele'], '2-4', 'David Naegele must land on medium 2, not collapse onto medium 1');
}

// ── Deezer: single-medium input is unaffected (no false-positive reset) ────
{
    const eng = deezerToEngine([
        { index: 1, credits: [{ name: 'A', roles: ['composer'] }] },
        { index: 2, credits: [{ name: 'B', roles: ['composer'] }] },
    ]);
    assert.equal(eng.multiVolume, false);
    assert.deepEqual(eng.tracklist.map(t => t.position), ['1', '2']);
}

// ── Qobuz: store-page scrape preserves natural order + detects the reset ──
{
    const html = [
        '<button id="popinAddToCartBtnPlayerTrack1">…</button>',
        '<p class="track__info">A, Composer</p>',
        '<button id="popinAddToCartBtnPlayerTrack1">…</button>',   // medium 2's own track "1"
        '<p class="track__info">B, Composer</p>',
    ].join('\n');
    const parsed = extractQobuzCredits(html);
    assert.deepEqual(parsed.map(t => t.index), [1, 1]);   // NOT deduped by index — two distinct positions
    const eng = qobuzToEngine(parsed);
    assert.equal(eng.multiVolume, true);
    assert.deepEqual(eng.tracklist.map(t => t.position), ['1-1', '2-1']);
}

// ── Qobuz: album/get API path — same detection, natural item order ─────────
{
    const json = { tracks: { items: [
        { track_number: 1, performers: 'A, Composer' },
        { track_number: 2, performers: 'B, Composer' },
        { track_number: 1, performers: 'C, Composer' },
        { track_number: 2, performers: 'D, Composer' },
    ] } };
    const parsed = parseQobuzApiTracks(json);
    assert.deepEqual(parsed.map(t => t.index), [1, 2, 1, 2]);
    const eng = qobuzToEngine(parsed);
    assert.equal(eng.multiVolume, true);
    assert.deepEqual(eng.tracklist.map(t => t.position), ['1-1', '1-2', '2-1', '2-2']);
}

// ── Apple: parsedTracks already arrives in natural per-medium order ────────
{
    const parsed = [
        { index: 1, title: 'Song A', credits: [{ name: 'X', role: 'Songwriter' }] },
        { index: 2, title: 'Song B', credits: [{ name: 'Y', role: 'Songwriter' }] },
        { index: 1, title: 'Song C', credits: [{ name: 'Z', role: 'Songwriter' }] },   // medium 2 track 1
    ];
    const eng = appleToEngine(parsed);
    assert.equal(eng.multiVolume, true);
    assert.deepEqual(eng.tracklist.map(t => [t.position, t.title]), [
        ['1-1', 'Song A'], ['1-2', 'Song B'], ['2-1', 'Song C'],
    ]);
    // single-medium input stays bare (regression check)
    const single = appleToEngine([{ index: 1, title: 'S', credits: [] }, { index: 2, title: 'T', credits: [] }]);
    assert.equal(single.multiVolume, false);
    assert.deepEqual(single.tracklist.map(t => t.position), ['1', '2']);
}

console.log('unit-523-multivolume: all assertions passed');
