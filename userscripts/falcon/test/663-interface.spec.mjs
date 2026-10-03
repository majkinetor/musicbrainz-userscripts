// #663 (majkinetor): "Falcon editing is ugly". The queue gets two views:
// - a list, where an open row is a labelled form, with its links grouped by URL
//   and their link types named;
// - a grid, one line per row.
// Both share Apollo's camera glyph for Video (.mbu-video, from the shared UI
// block) and the spreadsheet keys:
// - Enter / Down go to the same field of the next row, Shift+Enter / Up to the
//   previous one;
// - Tab / Shift+Tab walk the fields, and so do Right / Left at the text edge.
//
// Read only. The queue is seeded through the test hook and nothing is started.
import { readFile } from 'node:fs/promises';
import { test, check, sourceOf, idle, frames } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

test("#663: list/grid views + keyboard walk", { tag: ['@sandbox', '@critical'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'load' });
  await idle(page);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 10000 });

  const base = { note: '', disambiguation: '', isrcs: [], video: false, aliases: [], cover: [], coverExistingCount: null, urlResults: null, status: 'queued', error: '' };
  await page.evaluate(base => {
    document.getElementById('falcon-launcher')?.click();
    window.__falconTest.setQueue([
      { ...base, id: 'a1', entityType: 'artist', mbid: '00000000-0000-0000-0000-0000000000a1', name: 'Malian Musicians', urls: [
        { url: 'https://open.spotify.com/artist/2vumMcvGJfXKD3NKD51G8a', linkTypeId: '194' },
        { url: 'https://www.deezer.com/artist/4668332', linkTypeId: '194' },
        { url: 'https://open.qobuz.com/artist/730560', linkTypeId: '978' },
        { url: 'https://open.qobuz.com/artist/730560', linkTypeId: '176' },
        { url: 'https://tidal.com/artist/7137959', linkTypeId: '978' },
        { url: 'https://music.apple.com/artist/1', linkTypeId: '978' },
      ] },
      { ...base, id: 'r1', entityType: 'recording', mbid: '00000000-0000-0000-0000-0000000000b1', name: 'Spoons', disambiguation: 'HEY NOM1', urls: [{ url: 'https://tidal.com/track/1', linkTypeId: '979' }] },
      { ...base, id: 'r2', entityType: 'recording', mbid: '00000000-0000-0000-0000-0000000000b2', name: 'Bamako City', urls: [], aliases: [{ name: 'Bamako', locale: 'fr' }] },
      { ...base, id: 'r3', entityType: 'recording', mbid: '00000000-0000-0000-0000-0000000000b3', name: 'Le Relax', urls: [] },
    ]);
    window.__falconTest.getExpandedIds().add('a1');
    window.__falconTest.setQueue(window.__falconTest.getQueue());
  }, base);
  await frames(page);

  // ── list view: links grouped by URL with named types, the rest a labelled form
  // #663: no service name on the line any more; the test still groups by it, from the url
  const links = await page.evaluate(() => {
    const svc = u => { const p = new URL(u).hostname.replace(/^www\./, '').split('.'); const n = p.length > 2 ? p[p.length - 2] : p[0]; return n[0].toUpperCase() + n.slice(1); };
    return [...document.querySelectorAll('.falcon-row[data-id="a1"] .falcon-ln:not(.falcon-ln-new)')].map(l => ({
      svc: svc(l.querySelector('input.falcon-link-url').value), types: [...l.querySelectorAll('.falcon-link-type-chg')].map(s => '+ ' + s.selectedOptions[0]?.textContent) }));
  });
  console.log('links:', JSON.stringify(links));
  check(links.length === 3, `5 distinct URLs collapse to 3 shown plus "more" (got ${links.length})`);
  const qobuz = links.find(l => l.svc === 'Qobuz');
  check(qobuz && qobuz.types.join('|') === '+ streaming|+ purchase for download', `Qobuz appears once with both named types (got ${qobuz && qobuz.types})`);
  check(links[0].types[0] === '+ free streaming', `type 194 reads "free streaming" (got ${links[0].types[0]})`);
  const more = await page.locator('.falcon-row[data-id="a1"] .falcon-more').textContent();
  check(/\+ 2 more \(Tidal, Apple\)/.test(more), `the rest folds into "+ 2 more (Tidal, Apple)" (got "${more}")`);
  const labels = await page.evaluate(() => [...document.querySelectorAll('.falcon-row[data-id="a1"] .falcon-lbl')].map(l => l.textContent));
  check(labels.join('|') === 'Name|Links+|Disambiguation|Aliases+', `artist form labels (got ${labels.join('|')})`);
  await page.screenshot({ path: 'test-results/663-list.png', clip: await page.locator('#falcon-panel').boundingBox() });

  // ── keyboard walk in the list: Enter goes to the same field on the next row it can hold it
  await page.locator('.falcon-disambiguation-input[data-id="a1"]').focus();
  await page.keyboard.type('x');
  await page.keyboard.press('Enter');
  await frames(page);
  let at = await page.evaluate(() => { const a = document.activeElement; return a.dataset.col + '@' + a.dataset.id; });
  check(at === 'disambig@r1', `Enter: a1 disambiguation → r1 disambiguation (got ${at})`);
  check(await page.evaluate(() => window.__falconTest.getQueue()[0].disambiguation === 'x'), 'the field was committed on the way out');
  await page.keyboard.press('Tab');
  at = await page.evaluate(() => document.activeElement.dataset.col + '@' + document.activeElement.dataset.id);
  check(at === 'isrc@r1', `Tab → ISRCs (got ${at})`);
  await page.keyboard.press('ArrowDown'); await frames(page);
  at = await page.evaluate(() => document.activeElement.dataset.col + '@' + document.activeElement.dataset.id);
  check(at === 'isrc@r2', `Down → r2 ISRCs (got ${at})`);
  const r1open = await page.evaluate(() => window.__falconTest.getExpandedIds().has('r1'));
  check(!r1open, 'the row the walk opened closes again when it leaves');
  await page.keyboard.press('Shift+Enter'); await frames(page);
  at = await page.evaluate(() => document.activeElement.dataset.col + '@' + document.activeElement.dataset.id);
  check(at === 'isrc@r1', `Shift+Enter → back up (got ${at})`);
  // r1 has no ISRCs yet, so the caret is already at the start
  await page.keyboard.press('ArrowLeft'); await frames(page);
  at = await page.evaluate(() => document.activeElement.dataset.col + '@' + document.activeElement.dataset.id);
  check(at === 'disambig@r1', `Left at the start of the text → previous field (got ${at})`);

  // ── grid view
  await page.click('#falcon-view-toggle'); await frames(page);
  const grid = await page.evaluate(() => ({
    rows: document.querySelectorAll('.falcon-grid tr.falcon-row').length,
    video: document.querySelectorAll('.falcon-grid input.falcon-video-input.mbu-video').length,
    videoBg: getComputedStyle(document.querySelector('.falcon-grid input.mbu-video.falcon-video-input')).backgroundImage.slice(0, 30),
    label: document.querySelector('#falcon-view-toggle .falcon-bt').textContent,
  }));
  console.log('grid:', JSON.stringify(grid));
  check(grid.rows === 4, `one grid line per item (got ${grid.rows})`);
  check(grid.video === 3 && /svg/.test(grid.videoBg), `the recordings' Video is the shared camera glyph (got ${grid.video}, ${grid.videoBg})`);
  check(grid.label === 'List', 'the toggle now offers the list');
  const vi = await page.evaluate(() => { const v = document.querySelector('.falcon-grid input.falcon-video-input[data-id="r1"]'); v.checked = true; const b = v.getBoundingClientRect(), c = v.closest('td').getBoundingClientRect(), cs = getComputedStyle(v); return [c.width, b.left - c.left, c.right - b.right, b.width, cs.marginLeft, cs.marginRight, cs.backgroundSize, cs.backgroundColor]; });
  check(vi[3] === 18 && vi[1] >= 0 && vi[2] >= 0 && Math.abs(vi[1] - vi[2]) <= 1, `a checked Video box sits whole and centred in its cell (got ${JSON.stringify(vi)})`);
  await page.locator('.falcon-grid .falcon-rename-input[data-id="r1"]').focus();
  await page.keyboard.press('Enter'); await frames(page);
  at = await page.evaluate(() => document.activeElement.dataset.col + '@' + document.activeElement.dataset.id);
  check(at === 'name@r2', `grid Enter → next row's name (got ${at})`);
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await frames(page);
  at = await page.evaluate(() => document.activeElement.dataset.col + '@' + document.activeElement.dataset.id);
  check(at === 'name@a1', `Up twice → the artist's name (got ${at})`);
  await page.keyboard.press('Shift+Tab'); await frames(page);
  at = await page.evaluate(() => document.activeElement.dataset.col + '@' + document.activeElement.dataset.id);
  check(at === 'name@a1', `Shift+Tab at the very first field stays put (got ${at})`);
  await page.locator('.falcon-grid .falcon-disambiguation-input[data-id="a1"]').focus();   // #663: aliases are edited below the row, off the walk
  await page.keyboard.press('Tab'); await frames(page);
  at = await page.evaluate(() => document.activeElement.dataset.col + '@' + document.activeElement.dataset.id);
  check(at === 'name@r1', `Tab off the last field wraps to the next row (got ${at})`);
  await page.screenshot({ path: 'test-results/663-grid.png', clip: await page.locator('#falcon-panel').boundingBox() });
});
