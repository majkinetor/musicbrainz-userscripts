// #775: Spotify ISRCs through Harmony, the default since molla's Spotify quota ran out. On Random Access Memories
// (13 tracks, links a Spotify album) the Spotify import fills each row, and each fill must be the ISRC MusicBrainz
// holds for that track. The recordings' ISRCs are taken out of the reply, so the rows read as empty, and kept as the
// truth.
//
//   match      as it is: Harmony's medium 1, tracks 1-13 land by position
//   split      the release reshaped into two media (7 + 6): Harmony's 1.8-1.13 have no track there, so they land
//              by title
//   mismatch   the release loses its last track (12 vs 13): the 12 rows still get their own ISRC
//   error      Harmony's page says no provider returned a release: its reason is named, nothing is filled
//   migrated   an install left on molla, the old default, is moved to Harmony once
//
// test.musicbrainz.org, with production's data (fixtures/ws-603.json.gz); Harmony is live except in "error".
// Nothing is submitted.
import { test, check, answerGm } from '../../../dev/test/harness.mjs';
import { openScout, logText, ended } from './is.mjs';

const RAM = '5000a285-b67e-4cfc-b54b-2b98f1810d2e';
const REPLAY = new URL('./fixtures/ws-603.json.gz', import.meta.url);
const NO_RELEASE = '<!doctype html><html><body><div class="message error"><p>No provider returned a release</p></div></body></html>';

async function run(page, context, inject, scenario) {
  const truth = [];
  if (scenario === 'error') answerGm(context, ({ url }) => (/harmony\.pulsewidth/.test(url) ? { status: 200, body: NO_RELEASE } : null));
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
  await ended(page, 'Spotify');
  const rows = await page.evaluate(() => [...document.querySelectorAll('#ii-tbody tr[data-idx]')].map(tr => ({ val: (tr.querySelector('.ii-input') || {}).value || '', suspect: !!tr.querySelector('.ii-input.ii-in-suspect') })));
  await ws.done();
  return { rows, truth, log: await logText(page) };
}

test.describe('Harmony', () => {
  test.use({ gm: { name: 'ISRC Scout' } });
  for (const scenario of ['match', 'split', 'mismatch']) {
    test(`#775 ${scenario}: every row gets the ISRC MusicBrainz has for it`, { tag: ['@sandbox', '@web'] }, async ({ page, context, inject }) => {
      const r = await run(page, context, inject, scenario);
      const want = scenario === 'mismatch' ? 12 : 13;
      const filled = r.rows.filter(x => x.val).length;
      // row i holds flattened track i (reshaping keeps the order)
      const wrong = r.rows.map((x, i) => ({ i, val: x.val, want: r.truth[i] })).filter(x => x.val && !(x.want || []).includes(x.val));
      check(/Spotify via Harmony/.test(r.log), 'the import went through Harmony (the default)');
      check(r.rows.length === want && filled === want, `${want} rows, all filled (${r.rows.length}, ${filled})`);
      check(wrong.length === 0, `each fill is that track's ISRC${wrong.length ? ' — wrong: ' + JSON.stringify(wrong.slice(0, 3)) : ''}`);
      check(!r.rows.some(x => x.suspect), 'none is flagged implausible');
      // the length is read too, so a fill on the wrong song is caught by its length (#431)
      check(/Harmony 1\.8 USQX91300108 "Get Lucky" 6:\d\d/.test(r.log), 'Harmony\'s track lengths are read');
    });
  }

  test('#775 error: Harmony\'s reason is named, and nothing is filled', { tag: ['@sandbox'] }, async ({ page, context, inject }) => {
    const r = await run(page, context, inject, 'error');
    check(/Harmony: No provider returned a release/.test(r.log), 'the log names Harmony\'s reason');
    check(r.rows.filter(x => x.val).length === 0, 'nothing is filled');
  });
});

test.describe('an install on molla', () => {
  test.use({ gm: { name: 'ISRC Scout', values: { 'ii:spotify_isrc_source': 'molla' } } });
  test('#775 migrated: an install left on molla imports through Harmony', { tag: ['@sandbox', '@web'] }, async ({ page, context, inject }) => {
    const r = await run(page, context, inject, 'match');
    check(/Spotify via Harmony/.test(r.log) && !/Spotify via molla/.test(r.log), 'the import went through Harmony');
    check(r.rows.filter(x => x.val).length === 13, 'every row is filled');
  });
});
