// #713 (majkinetor: "How come there is no edit field for barcode"): a release row has a Barcode
// field, after Disambiguation; in the grid it is in the row's opened part, with the links. What
// is typed is kept as digits, and Export writes it. Other types have none.
//
// Read only. The queue is seeded through the test hook and nothing is started.
import { readFile } from 'node:fs/promises';
import { test, check, sourceOf, idle, frames } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

test('#713: a release row has a Barcode field', { tag: ['@sandbox'] }, async ({ context, page }) => {
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
  const base = { note: '', disambiguation: '', rename: '', isrcs: [], video: false, aliases: [], cover: [], coverExistingCount: null, urlResults: null, status: 'queued', error: '' };
  await page.evaluate(base => {
    document.getElementById('falcon-launcher')?.click();
    window.__falconTest.setQueue([
      { ...base, id: 'l1', entityType: 'release', mbid: '00000000-0000-0000-0000-0000000000c1', name: 'Layers', urls: [] },
      { ...base, id: 'r1', entityType: 'recording', mbid: '00000000-0000-0000-0000-0000000000b1', name: 'Spoons', urls: [] },
    ]);
    window.__falconTest.getExpandedIds().add('l1'); window.__falconTest.getExpandedIds().add('r1');
    window.__falconTest.setQueue(window.__falconTest.getQueue());
  }, base);
  await frames(page);
  const labels = id => page.evaluate(id => [...document.querySelectorAll(`.falcon-form`)].filter(f => f.querySelector(`[data-id="${id}"]`)).flatMap(f => [...f.querySelectorAll('.falcon-lbl')].map(l => l.textContent.replace('+', '').trim())), id);
  const rel = await labels('l1');
  console.log('release fields: ' + rel.join(', '));
  check(rel.join() === 'Name,Links,Disambiguation,Barcode,Aliases,Cover', `a release has Barcode after Disambiguation (${rel})`);
  check(!(await labels('r1')).includes('Barcode'), 'a recording has none');

  const inp = page.locator('.falcon-barcode-input[data-id="l1"]');
  await inp.fill('5 099902-940729');
  await inp.press('Tab');
  await frames(page);
  const it = await page.evaluate(() => window.__falconTest.getQueue().find(i => i.id === 'l1').barcode);
  check(it === '5099902940729', `what is typed is kept as digits (${it})`);
  await page.locator('.falcon-form:has([data-id="l1"])').first().screenshot({ path: 'test-results/falcon-713-barcode-field.png' });

  // the grid: in the opened part, with the links
  await page.click('#falcon-view-toggle'); await frames(page);
  const grid = await page.evaluate(() => ({ sub: !!document.querySelector('.falcon-grid tr.falcon-sub[data-id="l1"] .falcon-barcode-input'), line: !!document.querySelector('.falcon-grid tr.falcon-row[data-id="l1"] .falcon-barcode-input'), v: document.querySelector('.falcon-grid tr.falcon-sub[data-id="l1"] .falcon-barcode-input')?.value }));
  check(grid.sub && !grid.line && grid.v === '5099902940729', `in the grid it is below the row (${JSON.stringify(grid)})`);
  await page.click('#falcon-view-toggle'); await frames(page);
});
