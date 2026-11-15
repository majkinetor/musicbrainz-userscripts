// #1033: Apple Music roles the bridge didn't import. "Lyrics" is Apple's other
// name for the lyricist; "Performer" stamps the track's own artist, but anyone
// else credited with it is a guest and gets a performer rel. No browser, no GM.
import { test } from '../../../dev/test/harness.mjs';
import assert from 'node:assert/strict';
import { appleToEngine } from '../src/sources/apple.js';

test('Apple Lyrics and guest Performer credits import', { tag: '@unit' }, async () => {
    const { tracklistRels, skipped } = appleToEngine([
        { index: 1, title: 'A', artist: 'Kim Deal & Friend', credits: [
            { name: 'Kim Deal', role: 'Lyrics' },
            { name: 'Kim Deal', role: 'Performer' },
            { name: 'Friend', role: 'Performer' },
            { name: 'Terry Edwards', role: 'Performer' },
            { name: 'Heba Kadry', role: 'Mastering Engineer' },
        ] },
        { index: 2, title: 'B', credits: [{ name: 'X', role: 'Performer' }] },   // no track artist known
    ]);
    assert.deepEqual(tracklistRels.map(r => [r.track.position, r.artist.name, r.linkType]), [
        ['1', 'Kim Deal', 'lyricist'],
        ['1', 'Terry Edwards', 'performer'],
    ]);
    assert.deepEqual(skipped, [
        'track 1: Performer — Kim Deal (track artist)',
        'track 1: Performer — Friend (track artist)',
        'track 1: Mastering Engineer — Heba Kadry',
        'track 2: Performer — X (track artist)',
    ]);
});
