// #603: Spotify ISRCs through molla. On Random Access Memories (13 tracks, links a
// Spotify album) the Spotify import fills each row, and each fill must be the ISRC
// MusicBrainz holds for that track. The recordings' ISRCs are taken out of the reply, so
// the rows read as empty, and kept as the truth.
//
//   match      as it is: 13 = 13, mapped by position
//   split      the release reshaped into two media (7 + 6): molla's #8-13 land on medium
//              2, tracks 1-6
//   mismatch   the release loses its last track (12 vs 13): no positions, titles only;
//              the 12 rows still get their own ISRC
//   ratelimit  molla answers 500 with a 429 inside: the rate limit is named
//
// test.musicbrainz.org, with production's data (fixtures/ws-603.json.gz); molla is
// live except in "ratelimit". Nothing is submitted.
import { test, check, answerGm } from '../../../dev/test/harness.mjs';
import { openScout, logText } from './is.mjs';

const RAM = '5000a285-b67e-4cfc-b54b-2b98f1810d2e';
const REPLAY = new URL('./fixtures/ws-603.json.gz', import.meta.url);
test.use({ gm: { name: 'ISRC Scout' } });

async function run(page, context, inject, scenario) {
  const truth = [];
  if (scenario === 'ratelimit') answerGm(context, ({ url }) => (/mollamusicgroup/.test(url) ? { status: 500, body: JSON.stringify({ error: 'Spotify API error: 429 Too Many Requests' }) } : null));
  const ws = await openScout(page, inject, {
    release: RAM, replay: REPLAY,
    edit: j => {
      truth.length = 0;
      (j.media || []).forEach(md => (md.tracks || []).forEach(tk => { if (tk.recording) { truth.push(tk.recording.isrcs || []); tk.recording.isrcs = []; } }));
      if (scenario === 'split') {
        const all = j.media[0].tracks;
        j.media = [{ ...j.media[0], position: 1, tracks: all.slice(0, 7) }, { ...j.media[0], position: 2, tracks: all.slice(7).map((t, i) => ({ ...t, position: i + 1, number: String(i + 1) })) }];
      }
      if (scenario === 'mismatch') j.media[j.media.length - 1].tracks.pop();
    },
  });
  await page.waitForSelector('#ii-sp-all:not([style*="none"])', { timeout: 30000 });
  await page.click('#ii-sp-all');
  await page.waitForFunction(() => /Spotify (done|failed)/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(500);
  const rows = await page.evaluate(() => [...document.querySelectorAll('#ii-tbody tr[data-idx]')].map(tr => ({ val: (tr.querySelector('.ii-input') || {}).value || '', suspect: !!tr.querySelector('.ii-input.ii-in-suspect') })));
  await ws.done();
  return { rows, truth, log: await logText(page) };
}

for (const scenario of ['match', 'split', 'mismatch']) {
  test(`${scenario}: every row gets the ISRC MusicBrainz has for it`, { tag: ['@sandbox', '@web'] }, async ({ page, context, inject }) => {
    const r = await run(page, context, inject, scenario);
    const want = scenario === 'mismatch' ? 12 : 13;
    const filled = r.rows.filter(x => x.val).length;
    // row i holds flattened track i (reshaping keeps the order)
    const wrong = r.rows.map((x, i) => ({ i, val: x.val, want: r.truth[i] })).filter(x => x.val && !(x.want || []).includes(x.val));
    check(r.rows.length === want && filled === want, `${want} rows, all filled (${r.rows.length}, ${filled})`);
    check(wrong.length === 0, `each fill is that track's ISRC${wrong.length ? ' — wrong: ' + JSON.stringify(wrong.slice(0, 3)) : ''}`);
    check(!r.rows.some(x => x.suspect), 'none is flagged implausible');
    check(scenario === 'mismatch' ? /by title\/artist match only/.test(r.log) : /mapping by position/.test(r.log), 'the log says how it mapped');
  });
}

test('ratelimit: a throttled molla is named, and nothing is filled', { tag: ['@sandbox'] }, async ({ page, context, inject }) => {
  const r = await run(page, context, inject, 'ratelimit');
  check(/rate-limited/.test(r.log), 'the log names the rate limit');
  check(r.rows.filter(x => x.val).length === 0, 'nothing is filled');
});
