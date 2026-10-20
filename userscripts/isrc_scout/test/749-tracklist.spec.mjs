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
    // one icon per platform, its count when the recording has several links there
    links: [...tr.querySelectorAll('td.ii-col-links .ii-trk-ln')].reduce((n, a) => n + (+a.querySelector('.ii-trk-n')?.textContent || 1), 0),
    perPlatform: (n => n.length === new Set(n).size)([...tr.querySelectorAll('td.ii-col-links .ii-trk-ln')].map(a => a.dataset.tip.split('\n')[0].replace(/ — \d+ links$/, ''))),
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
  await openScout(page, inject, { open: false });
  // a page-load lookup MusicBrainz throttled leaves "?" and no release to show; the dialog loads it again (#607)
  const status = await until(() => page.evaluate(() => document.getElementById('ii-btn-status')?.textContent || ''), t => /^[✓⚠?]/.test(t));
  if (status.startsWith('?')) await page.evaluate(() => document.getElementById('ii-btn').click());
  const want = await expected();   // after the page's own lookup, so the two don't come as a burst
  const got = await until(() => shown(page), g => g.length >= want.length);
  for (const w of want) {
    const g = got.find(x => x.id === w.id);
    check(g && g.isrcs.join() === w.isrcs.join(), `track ${w.id}: ISRCs ${w.isrcs.join() || 'none'} (shown ${g ? g.isrcs.join() : 'nothing'})`);
    check(!g || g.links === w.links, `track ${w.id}: ${w.links} link(s) (shown ${g && g.links})`);
    check(!g || g.perPlatform, `track ${w.id}: one icon per platform`);
    check(!g || g.beforeRating, `track ${w.id}: the columns sit before Rating`);
  }
  for (const t of await aligned(page)) {
    check(t.head.includes('ISRC') && t.head.includes('Links'), `the header has ISRC and Links (${t.head.join(' | ')})`);
    check(t.ok, 'every row has as many cells as the header');
    check(t.spans, "the medium's heading spans the new columns");
  }
  if (!status.startsWith('?')) await page.evaluate(() => document.getElementById('ii-btn').click());
  await page.waitForSelector('#ii-modal.open', { timeout: 15000 });
  // vzell: "Could we have two separate options for displaying ISRC and Links": one goes, the other stays
  await page.evaluate(() => document.getElementById('ii-track-links').click());
  const isrcOnly = await until(() => page.evaluate(() => ({ links: document.querySelectorAll('.ii-col-links').length, isrc: document.querySelectorAll('td.ii-col-isrc').length, aligned: [...document.querySelectorAll('table.tbl')].filter(t => t.querySelector('.ii-col')).every(t => { const w = r => [...r.cells].reduce((n, c) => n + c.colSpan, 0); const h = t.querySelector('tr.subh'); const top = t.querySelector('thead th[colspan]'); return [...t.querySelectorAll('tbody > tr:not(.subh)')].every(r => w(r) === w(h)) && (!top || top.colSpan === w(h)); }) })), x => x.links === 0 && x.isrc > 0);
  check(isrcOnly.links === 0 && isrcOnly.isrc > 0 && isrcOnly.aligned, `unticking Links leaves the ISRC column, aligned (${JSON.stringify(isrcOnly)})`);
  await page.evaluate(() => document.getElementById('ii-track-isrc').click());
  check(await until(() => page.evaluate(() => document.querySelectorAll('.ii-col').length), n => n === 0) === 0, 'unticking both takes the columns off');
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

test.describe('the Links column off', () => {
  test.use({ gm: { name: 'ISRC Scout', values: { 'ii:track_links': false } } });

  test('only the ISRC column', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await openScout(page, inject, { open: false });
    const n = await until(() => page.evaluate(() => ({ isrc: document.querySelectorAll('td.ii-col-isrc').length, links: document.querySelectorAll('.ii-col-links').length })), x => x.isrc > 0, { timeout: 45000 });
    check(n.isrc > 0 && n.links === 0, `an ISRC column and no Links column (${JSON.stringify(n)})`);
  });
});

// majkinetor (with a screenshot): toggles for the two columns above the tracklist, beside
// MusicBrainz's own "Display credits at bottom"
test('the toggles above the tracklist show and hide each column', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await openScout(page, inject, { open: false });
  const at = await until(() => page.evaluate(() => { const t = document.getElementById('ii-col-toggles'); const b = document.getElementById('medium-toolbox'); if (!t || !b) return null; const r = t.getBoundingClientRect(), q = b.getBoundingClientRect(); return { beside: Math.abs(r.top - q.top) < 4 && r.right <= q.left + 2 && q.left - r.right < 30, labels: [...t.querySelectorAll('button')].map(x => x.textContent) }; }), Boolean, { timeout: 45000 });
  check(at && at.beside && at.labels.join() === 'ISRC,Links', `ISRC and Links, on the line of MusicBrainz's toolbox, just left of it (${JSON.stringify(at)})`);
  await until(() => page.evaluate(() => document.querySelectorAll('td.ii-col-links').length), n => n > 0, { timeout: 45000 });
  try {
    await page.click('#ii-col-toggles button[data-col="links"]');
    const off = await until(() => page.evaluate(() => ({ links: document.querySelectorAll('.ii-col-links').length, isrc: document.querySelectorAll('td.ii-col-isrc').length, struck: document.querySelector('#ii-col-toggles [data-col="links"]').classList.contains('ii-coloff') })), x => x.links === 0);
    check(off.links === 0 && off.isrc > 0 && off.struck, `Links toggled off: its column goes, the ISRC column stays (${JSON.stringify(off)})`);
    await page.click('#ii-col-toggles button[data-col="links"]');
    check(await until(() => page.evaluate(() => document.querySelectorAll('td.ii-col-links').length), n => n > 0) > 0, 'and on again: it comes back');
  } finally {
    await page.evaluate(() => window.__isrcScoutTestStore.store.del('track_links'));
  }
});

