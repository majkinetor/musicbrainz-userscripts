// #663 (majkinetor), second round:
// - Aliases: an alias language in the toolbar (empty or set; @locale still overrides it);
//   alias chips can be edited; the grid shows a row's aliases below it, as it does links.
// - Links: edit the url, add / change / remove a type, remove the row, add a link.
// - The open tab is marked; the toolbar is laid out as in the issue's picture.
//
// Read only. The queue is seeded through the test hook and nothing is started.
import { readFile } from 'node:fs/promises';
import { test, check, sourceOf, idle, frames } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

test('#663: alias language, editable aliases and links, toolbar', { tag: ['@sandbox', '@critical'] }, async ({ context, page }) => {
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
      ], aliases: [{ name: 'Bamako', locale: 'fr', type: 'Artist name', primary: true }] },
      { ...base, id: 'r1', entityType: 'recording', mbid: '00000000-0000-0000-0000-0000000000b1', name: 'Spoons', urls: [] },
    ]);
    window.__falconTest.getExpandedIds().add('a1');
    window.__falconTest.setQueue(window.__falconTest.getQueue());
  }, base);
  await frames(page);
  const q = id => page.evaluate(id => JSON.parse(JSON.stringify(window.__falconTest.getQueue().find(i => i.id === id))), id);

  // ── layout
  const layout = await page.evaluate(() => {
    const bar = document.getElementById('falcon-queue-toolbar'), row2 = document.getElementById('falcon-type-chips');
    const ids = el => [...el.querySelectorAll('[id]')].map(e => e.id);
    const run = document.getElementById('falcon-run').getBoundingClientRect(), retry = document.getElementById('falcon-retry-failed').getBoundingClientRect();
    return { bar: ids(bar), row2: ids(row2), head: !!document.querySelector('#falcon-queue-list .falcon-lhead #falcon-select-all'),
      retryUnderStart: retry.top >= run.bottom - 1 && Math.abs(retry.right - run.right) < 2,
      tabOn: [...document.querySelectorAll('#falcon-hdr .falcon-tab-on')].map(b => b.id) };
  });
  console.log('layout:', JSON.stringify(layout));
  check(layout.bar.includes('falcon-import') && layout.bar.includes('falcon-export') && layout.bar.includes('falcon-alias-lang') && !layout.bar.includes('falcon-view-toggle'), 'toolbar: Add/Import, alias language, Export');
  check(layout.row2.includes('falcon-view-toggle') && layout.row2.includes('falcon-type-chips-in'), 'the type chips row carries the view switch');
  check(layout.head, 'select-all heads the rows');
  check(layout.retryUnderStart, 'Retry failed sits under Start');
  check(layout.tabOn.join() === 'falcon-tab-queue', `the Queue tab is marked (${layout.tabOn})`);
  await page.click('#falcon-tab-log'); await frames(page);
  check(await page.evaluate(() => [...document.querySelectorAll('#falcon-hdr .falcon-tab-on')].map(b => b.id).join()) === 'falcon-tab-log', 'the Log tab is marked once open');
  await page.click('#falcon-tab-queue'); await frames(page);

  // ── selection count in the header
  await page.check('.falcon-row-check[data-id="r1"]'); await frames(page);
  check((await page.textContent('#falcon-select-count')).trim() === '1', 'the header counts the selection');

  // ── alias language
  await page.fill('#falcon-alias-lang', 'sr'); await page.press('#falcon-alias-lang', 'Enter'); await frames(page);
  await page.fill('.falcon-alias-add[data-id="a1"]', 'Bamako Band'); await page.press('.falcon-alias-add[data-id="a1"]', 'Enter'); await frames(page);
  await page.fill('.falcon-alias-add[data-id="a1"]', 'Banda@pl'); await page.press('.falcon-alias-add[data-id="a1"]', 'Enter'); await frames(page);
  let a1 = await q('a1');
  check(a1.aliases[1] && a1.aliases[1].locale === 'sr', `a typed alias gets the alias language (${JSON.stringify(a1.aliases[1])})`);
  check(a1.aliases[2] && a1.aliases[2].locale === 'pl', `@locale overrides it (${JSON.stringify(a1.aliases[2])})`);

  // ── alias chip editing: the rest of the alias is kept
  await page.click('.falcon-alias-name[data-id="a1"][data-idx="0"]'); await frames(page);
  check(await page.evaluate(() => document.activeElement?.classList.contains('falcon-alias-edit') && document.activeElement.value), 'a clicked chip opens as a box holding name@locale');
  await page.keyboard.press('Control+A'); await page.keyboard.type('Bamako Stars@fr'); await page.keyboard.press('Enter'); await frames(page);
  a1 = await q('a1');
  check(a1.aliases[0].name === 'Bamako Stars' && a1.aliases[0].locale === 'fr' && a1.aliases[0].primary === true && a1.aliases[0].type === 'Artist name', `the edit renames it and keeps type and primary (${JSON.stringify(a1.aliases[0])})`);
  await page.click('.falcon-alias-name[data-id="a1"][data-idx="2"]'); await frames(page);
  await page.keyboard.press('Escape'); await frames(page);
  check((await q('a1')).aliases[2].name === 'Banda' && !(await page.$('.falcon-alias-edit')), 'Esc leaves the alias as it was');
  await page.click('.falcon-alias-name[data-id="a1"][data-idx="2"]'); await frames(page);
  await page.keyboard.press('Control+A'); await page.keyboard.press('Delete'); await page.keyboard.press('Enter'); await frames(page);
  check((await q('a1')).aliases.length === 2, 'emptying the box removes the alias');

  // ── links
  const spot = 'https://open.spotify.com/artist/2vumMcvGJfXKD3NKD51G8a', deez = 'https://www.deezer.com/artist/4668332';
  const opts = await page.evaluate(u => [...document.querySelector(`.falcon-link-type[data-url="${u}"]`).options].map(o => o.textContent), spot);
  check(opts.includes('official homepage') && !opts.includes('free streaming') && !opts.includes('cover art link'), `the type picker offers the artist's other link types only (${opts.length})`);
  await page.selectOption(`.falcon-link-type[data-url="${spot}"]`, { label: 'streaming' }); await frames(page);
  a1 = await q('a1');
  check(a1.urls.filter(u => u.url === spot).map(u => u.linkTypeId).sort().join() === '194,978', `a type is added (${JSON.stringify(a1.urls)})`);
  await page.click(`.falcon-link-type-del[data-url="${spot}"][data-type="194"]`); await frames(page);
  a1 = await q('a1');
  check(a1.urls.filter(u => u.url === spot).map(u => u.linkTypeId).join() === '978', `a type is removed: change = add + remove (${JSON.stringify(a1.urls)})`);
  await page.click(`.falcon-link-type-del[data-url="${spot}"][data-type="978"]`); await frames(page);
  a1 = await q('a1');
  check(a1.urls.some(u => u.url === spot && !u.linkTypeId), 'removing the last type leaves the link for MusicBrainz to type');
  await page.fill(`.falcon-link-url[data-url="${deez}"]`, 'https://www.deezer.com/artist/1'); await page.press(`.falcon-link-url[data-url="${deez}"]`, 'Enter'); await frames(page);
  a1 = await q('a1');
  check(a1.urls.some(u => u.url === 'https://www.deezer.com/artist/1' && u.linkTypeId === '194') && !a1.urls.some(u => u.url === deez), `the url is edited in place, its type kept (${JSON.stringify(a1.urls)})`);
  await page.click(`.falcon-link-del[data-url="${spot}"]`); await frames(page);
  check(!(await q('a1')).urls.some(u => u.url === spot), 'the row ✕ removes the link');
  await page.fill('.falcon-link-new[data-id="a1"]', 'https://example.com/x'); await page.press('.falcon-link-new[data-id="a1"]', 'Enter'); await frames(page);
  check((await q('a1')).urls.some(u => u.url === 'https://example.com/x'), 'a link is added');
  await page.screenshot({ path: 'test-results/663-editing-list.png', clip: await page.locator('#falcon-panel').boundingBox() });

  // ── grid: aliases below the row
  await page.click('#falcon-view-toggle'); await frames(page);
  await page.evaluate(() => { window.__falconTest.getExpandedIds().clear(); window.__falconTest.setQueue(window.__falconTest.getQueue()); });
  await frames(page);
  check(await page.evaluate(() => !!document.querySelector('.falcon-grid th #falcon-select-all')), 'the grid heads select-all too');
  check(!(await page.$('.falcon-grid tr.falcon-row .falcon-chip')), 'the grid line holds no alias chips');
  await page.click('.falcon-grid-aliases[data-id="a1"]'); await frames(page);
  const subChips = await page.evaluate(() => [...document.querySelectorAll('.falcon-grid tr.falcon-sub[data-id="a1"] .falcon-chip .falcon-alias-name')].map(s => s.textContent.trim()));
  check(subChips.length === 2 && subChips[0].startsWith('Bamako Stars'), `the aliases show below the row (${subChips})`);
  check(await page.evaluate(() => !!document.querySelector('.falcon-grid tr.falcon-sub[data-id="a1"] .falcon-link-url')), 'and the links with them');
  await page.click('.falcon-grid tr.falcon-sub .falcon-alias-name[data-idx="1"]'); await frames(page);
  check(await page.evaluate(() => document.activeElement?.classList.contains('falcon-alias-edit')), 'a grid alias chip edits in place too');
  await page.keyboard.press('Escape'); await frames(page);
  await page.screenshot({ path: 'test-results/663-editing-grid.png', clip: await page.locator('#falcon-panel').boundingBox() });
});
