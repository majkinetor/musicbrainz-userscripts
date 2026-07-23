// #457 — Beatport's release PAGE serves the tracklist id-DESCENDING (reverse of album order) with
// no `number`, so the harvest's index-based position came out reversed vs the authenticated API
// (id-ASCENDING). Fix: sort the harvested results by id ascending before assigning positions.
// This replicates the harvester's ordering step on chaban's real page data (release 2727783) and
// asserts it now matches the API/album order. Pure unit test — no browser.
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// chaban's release-page __NEXT_DATA__ results, in the order the page serves them (id DESCENDING):
// idx 1 = Luly (id 12603496, ISRC …264), idx 29 = Continuous Mix 1 (id 12603468, ISRC …236).
const first = 12603496, isrcFirst = 264;   // Luly
const pageResults = Array.from({ length: 29 }, (_, i) => ({
  id: first - i,                                   // 12603496, 12603495, … 12603468
  isrc: 'AUXN21934' + (isrcFirst - i),             // AUXN21934264, …263, … …236
  name: i === 0 ? 'Luly' : i === 28 ? 'Balance presents The Soundgarden (Continuous Mix 1)' : 'track ' + (i + 1),
}));
// sanity: the page data really is id-descending (reversed)
ck(pageResults[0].id > pageResults[28].id, 'fixture: page data is id-descending (as Beatport serves it)');

// the harvester's ordering step (post-fix)
const ordered = [...pageResults].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
const tracks = ordered.map((t, i) => ({ pos: i + 1, id: t.id, isrc: t.isrc, name: t.name }));

// after the fix, position 1 = the lowest-id track = album track 1 (Continuous Mix 1, ISRC …236)
ck(tracks[0].id === 12603468 && tracks[0].isrc === 'AUXN21934236', `pos 1 → album track 1 (Continuous Mix 1, …236) — got id ${tracks[0].id} isrc ${tracks[0].isrc}`);
ck(tracks[28].id === 12603496 && tracks[28].isrc === 'AUXN21934264', `pos 29 → last track (Luly, …264) — got id ${tracks[28].id} isrc ${tracks[28].isrc}`);
// ISRCs now ascend with position (matching the authenticated API), i.e. no longer reversed
ck(tracks.every((t, i) => i === 0 || tracks[i - 1].isrc <= t.isrc), 'ISRCs ascend with position — matches the API (no longer reversed)');

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
