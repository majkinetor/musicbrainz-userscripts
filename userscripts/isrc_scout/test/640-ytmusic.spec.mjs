// #640: YouTube Music track links, found by each track's ISRC. YouTube Music shows no ISRCs,
// but its search (the "songs" filter) finds most songs by one; a miss comes back as unrelated
// songs, so a hit counts only when it is official audio, with the track's title and length.
//
// Random Access Memories, whose recordings are on YouTube Music: their YouTube Music links
// are taken out of the reply, and Find links finds them again, one per track, each a watch
// link. Its log shows the guard at work on the results it skipped.
//
// test.musicbrainz.org, with production's data (fixtures/ws-458.json.gz). YouTube Music is
// live. Nothing is submitted.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

test('#640: YouTube Music track links, by ISRC, title- and length-checked', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, {
    release: '5000a285-b67e-4cfc-b54b-2b98f1810d2e', replay: new URL('./fixtures/ws-458.json.gz', import.meta.url),
    edit: j => (j.media || []).forEach(md => (md.tracks || []).forEach(tk => { const rec = tk.recording; if (rec && rec.relations) rec.relations = rec.relations.filter(x => !/music\.youtube\.com/i.test(x.url?.resource || '')); })),
  });
  const cands = await until(() => page.evaluate(() => document.querySelectorAll('#ii-modal .ii-tl.cand[data-code="yt"]').length), n => n > 0, { timeout: 20000 });
  await page.click('#ii-links-btn');
  const r = await until(() => page.evaluate(() => {
    const n = sel => document.querySelectorAll('#ii-modal .ii-tl' + sel + '[data-code="yt"]').length;
    return { found: n('.new'), absent: n('.absent'), spinning: n('.spin'), hrefs: [...document.querySelectorAll('#ii-modal .ii-tl.new[data-code="yt"]')].map(a => a.href) };
  }), r => r.spinning === 0 && r.found + r.absent > 0, { timeout: 120000 });
  const log = await page.evaluate(() => (document.getElementById('ii-log-out')?.textContent || '').split('\n').filter(l => /YouTube Music/.test(l)));
  console.log(JSON.stringify({ cands, ...r, log: log.slice(0, 40) }, null, 1));
  check(cands === 13, `every track offers a YouTube Music slot (${cands})`);
  // live search: which songs an ISRC brings up varies a little from run to run (10–11 of 13 seen)
  check(r.found >= 8, `most tracks find their YouTube Music song (${r.found} of 13, ${r.absent} not)`);
  check(r.hrefs.every(h => /^https:\/\/music\.youtube\.com\/watch\?v=[\w-]{11}$/.test(h)), `each a watch link (${r.hrefs.slice(0, 2).join(', ')})`);
  check(new Set(r.hrefs).size === r.hrefs.length, 'no two tracks share a song');
  check(log.some(l => /matches "/.test(l)), 'the log says what each match was');
  await ws.done();
});
