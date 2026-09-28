// #613 / #612: Credit Hoarder's artist matching. An exact NAME or ALIAS, only when
// provably unique; the release's CONTEXT (artists related to the release artist, one
// request per real release artist, none on Various Artists); and the co-credit option
// (off by default).
//
// test.musicbrainz.org, read-only: only the preflight resolver runs (the
// __creditHoarder test hook), names-only, so the IndexedDB cache isn't touched. The
// web-service answers are production's, recorded in fixtures/ws-613-matching.json.gz
// (RECORD_WS=1 to refresh): who is called what doesn't change under the test, and a
// busy MusicBrainz can't turn a match into "needs review", which is how this failed in
// the baseline run.
import { test, check, requireLogin, replayWs, SANDBOX } from '../../../dev/test/harness.mjs';

const FIXTURE = new URL('./fixtures/ws-613-matching.json.gz', import.meta.url);
test.use({ gm: { name: 'CH', values: {} } });

test('artists match by exact name or alias only when unique, by release context, and by co-credit', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
  const reqs = []; page.on('request', r => reqs.push(decodeURIComponent(r.url())));
  let ws = null;
  const open = async rel => {
    await page.goto(`${SANDBOX}/release/${rel}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await requireLogin(page);
    await page.waitForFunction(() => window.MB && MB.relationshipEditor && MB.relationshipEditor.state && MB.relationshipEditor.state.entity, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    if (!ws) ws = await replayWs(page, FIXTURE);   // after MusicBrainz's own page load
    await inject('credit_hoarder', { waitFor: '__creditHoarder' });
  };
  // resolve names-only artists, with or without the page's release context
  const resolveNames = (names, { withContext = true, coCredit = false } = {}) => page.evaluate(async ([names, withContext, coCredit]) => {
    const C = window.__creditHoarder;
    const context = withContext ? await C.buildReleaseContext({ coCredit }) : null;
    const { allResults } = await C.resolveAll(names.map(n => ({ name: n, resource_url: '' })), { kindOf: C.ARTIST_KIND, bypassIdb: true, context });
    return { context: context && { seeds: context.seeds.length, related: context.related.length }, results: allResults.map(r => ({ name: r.displayName, type: r.type, via: r.logEntry && r.logEntry.via, gid: (r.mbUrl || '').split('/').pop().slice(0, 8), reason: r.ambiguityReason || null })) };
  }, [names, withContext, coCredit]);
  const byName = (res, n) => res.results.find(r => r.name === n) || {};
  const ctxReqs = () => reqs.filter(u => /\/ws\/2\/artist\/[0-9a-f-]{36}\?inc=aliases\+artist-rels/.test(u)).length;

  // ── The Beatles, Abbey Road ──
  await open('b25a1e5d-3247-41ea-9920-f93c58a6e479');
  let before = ctxReqs();
  const A = await resolveNames(['George Harrison', 'Don Abi', 'Solar Moon', 'Kim']);
  check(A.context.seeds === 1 && A.context.related > 4, `context: one release artist, ${A.context.related} related`);
  check(ctxReqs() - before === 1, `one context request for the one release artist (${ctxReqs() - before})`);
  check(byName(A, 'George Harrison').via === 'ctx' && byName(A, 'George Harrison').gid === '42a8f507', '"George Harrison" (three exact namesakes) → the Beatle, through the release context');
  check(byName(A, 'Don Abi').via === 'alias' && byName(A, 'Don Abi').gid === 'b4acea3f', `"Don Abi" → Abiodun by alias, provably unique (#442) (${JSON.stringify(byName(A, 'Don Abi'))})`);
  check(byName(A, 'Solar Moon').type === 'resolved' && byName(A, 'Solar Moon').via === 'name', '"Solar Moon" → by name');
  check(byName(A, 'Kim').type === 'attention' && /not provably unique/.test(byName(A, 'Kim').reason || ''), `"Kim" is left for review (${byName(A, 'Kim').reason})`);
  const noCtx = await resolveNames(['George Harrison'], { withContext: false });
  check(byName(noCtx, 'George Harrison').type === 'attention', 'without the context, "George Harrison" is left for review');

  // a Discogs URL and an exact alias agreeing → "alias+url"
  const both = await page.evaluate(async () => {
    const C = window.__creditHoarder;
    const { allResults } = await C.resolveAll([{ name: 'Don Abi', resource_url: 'https://api.discogs.com/artists/84909' }], { kindOf: C.ARTIST_KIND, bypassIdb: true, context: null });
    const r = allResults[0]; return { via: r.logEntry && r.logEntry.via, gid: (r.mbUrl || '').split('/').pop().slice(0, 8) };
  });
  check(both.via === 'both-alias' && both.gid === 'b4acea3f', `the Discogs URL and the exact alias agree → "both-alias" (${JSON.stringify(both)})`);

  // ── a Various Artists release: no context, no request ──
  await open('cf24355a-bc71-4cfe-9178-51d748649b2e');
  before = ctxReqs();
  const B = await resolveNames(['Don Abi']);
  check(B.context.seeds === 0 && B.context.related === 0 && ctxReqs() - before === 0, 'Various Artists: no context and no context request');
  check(byName(B, 'Don Abi').via === 'alias', 'alias matching still works there');

  // ── #437 co-credit: Sidney Samson, "Today (feat. Joni)" ──
  await open('a56091bd-dd60-44f5-87f5-dec6754b8523');
  const off = await resolveNames(['Joni'], { coCredit: false });
  const on = await resolveNames(['Joni'], { coCredit: true });
  check(byName(off, 'Joni').type === 'attention', 'co-credit off: "Joni" is left for review');
  check(byName(on, 'Joni').via === 'cred' && byName(on, 'Joni').gid === 'a766abff', `co-credit on: "Joni" → a766abff, credited next to Sidney Samson (${JSON.stringify(byName(on, 'Joni'))})`);

  // A name the exact-identity check rejects ("not provably unique") still gets the
  // co-credit step. MusicBrainz's answers are simulated in the page for this one.
  const gap = coCredit => page.evaluate(async ([coCredit]) => {
    const real = window.fetch;
    const J = o => Promise.resolve(new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } }));
    const SS = '4fc48643-7a22-482c-b419-9628e0fbfe25';   // Sidney Samson, the release artist
    window.fetch = (u, o) => {
      const url = decodeURIComponent(String(u));
      if (/\/ws\/2\/artist\?query=Joni Zz&/.test(url)) return J({ count: 3, offset: 0, artists: [{ id: 'aaaaaaaa-0000-4000-8000-00000000000a', name: 'Joni Zz', score: 100, aliases: [] }, { id: 'bbbbbbbb-0000-4000-8000-00000000000b', name: 'Joni Zzz', score: 80 }, { id: 'cccccccc-0000-4000-8000-00000000000c', name: 'Joni Z', score: 75 }] });
      if (/\/ws\/2\/artist\?query=alias:"Joni Zz" OR artist:"Joni Zz"/.test(url)) return J({ count: 500, offset: 0, artists: [{ id: 'aaaaaaaa-0000-4000-8000-00000000000a', name: 'Joni Zz', score: 100, aliases: [] }] });
      if (/\/ws\/2\/recording\?query=arid:/.test(url) && /artistname:"Joni Zz"/.test(url)) return J({ recordings: [{ 'artist-credit': [{ name: 'Sidney Samson', artist: { id: SS, name: 'Sidney Samson' } }, { name: 'Joni Zz', artist: { id: 'dddddddd-0000-4000-8000-00000000000d', name: 'Joni Zz' } }] }] });
      return real(u, o);
    };
    try {
      const C = window.__creditHoarder;
      const context = await C.buildReleaseContext({ coCredit });
      const { allResults } = await C.resolveAll([{ name: 'Joni Zz', resource_url: '' }], { kindOf: C.ARTIST_KIND, bypassIdb: true, context });
      const r = allResults[0];
      return { type: r.type, via: r.logEntry && r.logEntry.via, gid: (r.mbUrl || '').split('/').pop().slice(0, 8), reason: r.ambiguityReason || null };
    } finally { window.fetch = real; }
  }, [coCredit]);
  const gapOn = await gap(true), gapOff = await gap(false);
  check(gapOn.via === 'cred' && gapOn.gid === 'dddddddd', `a name with 500 matches still gets the co-credit step (${JSON.stringify(gapOn)})`);
  check(gapOff.type === 'attention' && /not provably unique \(500 artists match\)/.test(gapOff.reason || ''), `with co-credit off it is left for review, saying why (${gapOff.reason})`);

  await ws.done();
});
