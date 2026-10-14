// #749 (majkinetor): "Scout shows per track isrc and links … Native release page doesnt
// have that. Lets add an option to show it on tracks." Then: "Lets add table columns",
// "Make it on by default too".
//
// test.musicbrainz.org, a release whose ten tracks each have an ISRC.
import { test, check, until, mbJson, SANDBOX } from '../../../dev/test/harness.mjs';
import { openScout, ANY_RELEASE } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

// what the sandbox has for each track: its row id, its ISRCs and its links
async function expected() {
  const r = await mbJson(`${SANDBOX}/ws/2/release/${ANY_RELEASE}?inc=recordings+isrcs+recording-level-rels+url-rels&fmt=json`);
  return r.media.flatMap(m => m.tracks).map(t => ({
    id: t.id, isrcs: t.recording.isrcs || [],
    links: (t.recording.relations || []).filter(x => x.url).length,
  }));
}
const shown = page => page.evaluate(() => [...document.querySelectorAll('td.ii-col-isrc')].map(td => {
  const tr = td.closest('tr');
  return {
    id: tr.id,
    isrcs: [...td.querySelectorAll('.ii-trk-isrc')].map(a => a.textContent),
    links: tr.querySelectorAll('td.ii-col-links .ii-trk-ln').length,
    beforeRating: td.nextElementSibling?.classList.contains('ii-col-links') && !!td.nextElementSibling.nextElementSibling?.matches('td.rating, td.treleases'),
  };
}));
// every row of the table has as many cells as the header row, and the medium heading spans them
const aligned = page => page.evaluate(() => [...document.querySelectorAll('table.tbl')].filter(t => t.querySelector('.ii-col')).map(t => {
  const width = r => [...r.cells].reduce((n, c) => n + c.colSpan, 0);
  const head = t.querySelector('tr.subh');
  const rows = [...t.querySelectorAll('tbody > tr:not(.subh)')];
  const top = t.querySelector('thead th[colspan]');
  return { head: [...head.cells].map(c => c.textContent.trim()), ok: rows.every(r => width(r) === width(head)), spans: !top || top.colSpan === width(head) };
}));

test('on by default: an ISRC and a Links column before Rating, and the setting takes them off', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
  const want = await expected();
  await openScout(page, inject, { open: false });
  const got = await until(() => shown(page), g => g.length >= want.length);
  for (const w of want) {
    const g = got.find(x => x.id === w.id);
    check(g && g.isrcs.join() === w.isrcs.join(), `track ${w.id}: ISRCs ${w.isrcs.join() || 'none'} (shown ${g ? g.isrcs.join() : 'nothing'})`);
    check(!g || g.links === w.links, `track ${w.id}: ${w.links} link(s) (shown ${g && g.links})`);
    check(!g || g.beforeRating, `track ${w.id}: the columns sit before Rating`);
  }
  for (const t of await aligned(page)) {
    check(t.head.includes('ISRC') && t.head.includes('Links'), `the header has ISRC and Links (${t.head.join(' | ')})`);
    check(t.ok, 'every row has as many cells as the header');
    check(t.spans, "the medium's heading spans the new columns");
  }
  await page.evaluate(() => document.getElementById('ii-btn').click());
  await page.waitForSelector('#ii-modal.open', { timeout: 15000 });
  await page.evaluate(() => document.getElementById('ii-track-data').click());
  check(await until(() => page.evaluate(() => document.querySelectorAll('.ii-col').length), n => n === 0) === 0, 'unticking the setting takes the columns off');
  check(await page.evaluate(() => !document.querySelector('th[data-ii-colspan]')), "the medium's heading spans what it did before");
});

test.describe('setting off', () => {
  test.use({ gm: { name: 'ISRC Scout', values: { 'ii:track_data': false } } });

  test('the tracklist is left as it is', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await openScout(page, inject, { open: false });
    await page.waitForFunction(() => /^[✓⚠?]/.test(document.getElementById('ii-btn-status')?.textContent || ''), null, { timeout: 45000 });
    check((await page.evaluate(() => document.querySelectorAll('.ii-col').length)) === 0, 'no ISRC or Links column');
  });
});
