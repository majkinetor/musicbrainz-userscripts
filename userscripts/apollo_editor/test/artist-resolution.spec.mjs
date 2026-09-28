// Resolving a track's artist text to a MusicBrainz artist.
//
// #613: the exact name/alias resolver calls a match unique only when MusicBrainz returned
//   every match. The search doesn't rank exact holders first: `artist:"kim"` matches
//   2,777 artists, and the one exact "Kim" among the first 25 was auto-linked.
//   MusicBrainz's answers are production's, replayed (RECORD_WS=1 to re-record).
// #618: on a Various Artists release, the #437 co-credit lookup took the special-purpose
//   Various Artists entity for a known artist: every ambiguous name cost an extra paced
//   `recording?query=arid:<VA> AND artistname:"…"` search that can never help.
import { test, check, replayWs, settled } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test.describe('#613', () => {
  // nothing matched by itself: only the resolver's own reads reach the replay
  test.use({ gm: apolloGm({ autoMatch: false, autoMatchRec: false, autoMatchLabel: false, autoMatchArtist: false, discogsUrlMatch: false }) });
  test('a common name is not taken for unique', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
    const ws = await replayWs(page, new URL('./fixtures/ws-613.json.gz', import.meta.url));
    await openApollo(page, inject, { seed: 'seed-saigon' });
    const r = await page.evaluate(async () => {
      const out = {};
      for (const n of ['Don Abi', 'Solar Moon', 'Kim', 'Sam']) {
        const hit = await window.__apolloEditor.resolveByExactAlias(n);
        out[n] = hit ? { gid: hit.entity.gid.slice(0, 8), via: hit.via } : null;
      }
      return out;
    });
    check(r['Don Abi'] && r['Don Abi'].gid === 'b4acea3f' && r['Don Abi'].via === 'alias', `"Don Abi" (one holder) still resolves, to Abiodun by alias (#442) (${JSON.stringify(r['Don Abi'])})`);
    check(r['Solar Moon'] && r['Solar Moon'].via === 'name', `"Solar Moon" (two matches, one exact) still resolves by name (${JSON.stringify(r['Solar Moon'])})`);
    check(r.Kim === null, '"Kim" (2,777 matches) is not: it cannot be shown unique');
    check(r.Sam === null, '"Sam" (4,178 matches) is not either');
    await ws.done();
  });
});

test('#618: no co-credit search seeded with Various Artists', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const VA = '89ad4ac3-39f7-470e-963a-56509c546377';
  const reqs = [];
  page.on('request', r => reqs.push(decodeURIComponent(r.url())));
  await openApollo(page, inject, { release: '5213f47a-58f6-4c33-a968-050d5f662ceb', tab: 'tracklist' });   // Paste Sampler 117: Various Artists, on the sandbox
  await page.evaluate(() => MB.releaseEditor.rootField.release().mediums().forEach(m => { if (!m.loaded()) m.loadTracks(); }));
  await page.waitForFunction(() => MB.releaseEditor.rootField.release().mediums().every(m => m.loaded()), null, { timeout: 30000 });
  const rel = await page.evaluate(() => window.__apolloEditor.releaseArtistGids ? window.__apolloEditor.releaseArtistGids() : null);
  check(!rel || rel.includes(VA), 'a Various Artists release');
  // track 1's artist becomes the unresolved, ambiguous "Joni", as a pasted credit would be
  await page.evaluate(() => MB.releaseEditor.rootField.release().mediums()[0].tracks()[0].artistCredit({ names: [{ artist: { name: 'Joni' }, name: 'Joni', joinPhrase: '' }] }));
  await settled(page);
  const mark = reqs.length;
  const slot = await page.evaluate(async () => { const s = (await window.__apolloEditor.buildModel()).tracks[0].slots[0]; return s && { creditedAs: s.creditedAs, status: s.status }; });
  await settled(page);   // whatever that asked has gone out
  const sent = reqs.slice(mark).filter(u => /\/ws\/2\/recording\?/.test(u) && u.includes('arid:' + VA));
  check(slot && slot.creditedAs === 'Joni' && slot.status !== 'set', `track 1 is matched as the unresolved "Joni" (${JSON.stringify(slot)})`);
  check(sent.length === 0, `no co-credit search with Various Artists (${sent.length})`);
});
