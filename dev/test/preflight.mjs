#!/usr/bin/env node
// Is the sandbox up? CI asks before a run, so that a sandbox that is down stops the run in
// seconds with one clear message, not after hours of red tests.
//
//   node dev/test/preflight.mjs
//
// Exit 1 when test.musicbrainz.org does not answer a ws/2 lookup or its home page. A sandbox
// whose search index is empty only gets a warning: the @env specs that need it are not in the
// nightly set, and the others still run.
const SANDBOX = 'https://test.musicbrainz.org';
const UA = { 'User-Agent': 'mb-userscripts-ci/1.0 (preflight)' };
const ARTIST = 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d';   // an artist the specs already read

async function get(path, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(SANDBOX + path, { headers: UA, signal: AbortSignal.timeout(30_000) });
      if (r.ok) return r;
      last = `HTTP ${r.status}`;
    } catch (e) { last = e.cause?.code || e.message; }
    await new Promise(z => setTimeout(z, 5000 * (i + 1)));
  }
  throw new Error(`${path}: ${last}`);
}

try {
  const lookup = await (await get(`/ws/2/artist/${ARTIST}?fmt=json`)).json();
  if (lookup.id !== ARTIST) throw new Error('/ws/2 lookup: an answer without the artist');
  await get('/');
} catch (e) {
  console.log(`::error title=Sandbox down::test.musicbrainz.org does not answer (${e.message}); the run is stopped`);
  process.exit(1);
}
try {
  const search = await (await get('/ws/2/artist?query=artist:%22Daft%20Punk%22&fmt=json&limit=1', 1)).json();
  if (!search.count) console.log('::warning title=Sandbox search empty::test.musicbrainz.org finds nothing by search; specs that search will fail');
} catch (e) { console.log(`::warning title=Sandbox search::the search did not answer (${e.message})`); }
console.log('preflight: test.musicbrainz.org answers');
