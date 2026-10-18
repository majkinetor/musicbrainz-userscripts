// #783: a release row has an Event field (a release event for a release that has none: "2014-02-20 XW") and a Lengths
// field (lengths for tracks that have none: "1.3 6:58, 1.4 7:08"), after Barcode; in the grid both are in the row's
// opened part. A recording row has a Length field. What is typed is read into the item; what doesn't read is put
// back as it was. An import carries them in, Export writes them, and a recording's length goes in its edit's seed.
//
// Read only. The queue is seeded through the test hook and nothing is started.
import { readFile } from 'node:fs/promises';
import { test, check, sourceOf, idle, frames } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

test('#783: Event and Lengths on a release row, Length on a recording row', { tag: ['@sandbox'] }, async ({ context, page }) => {
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
  await page.evaluate(() => document.getElementById('falcon-launcher')?.click());
  // as a script hands them over: a release with an event and lengths, a recording with a length
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('falcon:import', { detail: JSON.stringify({ name: '#783', items: [
    { entityType: 'release', mbid: '00000000-0000-0000-0000-0000000007c1', name: 'Fjara', urls: [], event: { date: { year: 2014, month: 2, day: 20 }, country: 'xw' }, lengths: [{ medium: 1, position: 3, ms: 418952 }] },
    { entityType: 'recording', mbid: '00000000-0000-0000-0000-0000000007b1', name: 'Spoons', urls: [], length: 242000 },
  ] }) })));
  await page.waitForFunction(() => window.__falconTest.getQueue().length === 2, null, { timeout: 10000 });
  const q = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ event: i.event, lengths: i.lengths, length: i.length })));
  check(JSON.stringify(q[0].event) === JSON.stringify({ date: { year: 2014, month: 2, day: 20 }, country: 'XW' }) && q[0].lengths.length === 1 && q[1].length === 242000, `the import carries them in (${JSON.stringify(q)})`);
  await page.evaluate(() => { const q = window.__falconTest.getQueue(); q.forEach(i => window.__falconTest.getExpandedIds().add(i.id)); window.__falconTest.setQueue(q); });
  await frames(page);
  const [rid, cid] = await page.evaluate(() => window.__falconTest.getQueue().map(i => i.id));
  const labels = id => page.evaluate(id => [...document.querySelectorAll('.falcon-form')].filter(f => f.querySelector(`[data-id="${id}"]`)).flatMap(f => [...f.querySelectorAll('.falcon-lbl')].map(l => l.textContent.replace('+', '').trim())), id);
  const rel = await labels(rid), rec = await labels(cid);
  console.log('release: ' + rel.join(', ') + ' · recording: ' + rec.join(', '));
  check(rel.join() === 'Name,Links,Disambiguation,Barcode,Event,Lengths,Aliases,Cover', `a release has Event and Lengths after Barcode (${rel})`);
  check(rec.includes('Length') && !rec.includes('Event'), `a recording has Length (${rec})`);
  const val = sel => page.locator(sel).inputValue();
  check(await val(`.falcon-event-input[data-id="${rid}"]`) === '2014-02-20 XW', 'the event shows as date and country');
  check(await val(`.falcon-lengths-input[data-id="${rid}"]`) === '1.3 6:59', 'the lengths as medium.track length');
  check(await val(`.falcon-length-input[data-id="${cid}"]`) === '4:02', 'the recording\'s length as m:ss');

  const type = async (sel, v) => { const i = page.locator(sel); await i.fill(v); await i.press('Tab'); await frames(page); };
  await type(`.falcon-event-input[data-id="${rid}"]`, '2015-03 gb');
  await type(`.falcon-lengths-input[data-id="${rid}"]`, '1.3 6:58, 1.4 1:07:08');
  await type(`.falcon-length-input[data-id="${cid}"]`, '3:21');
  let it = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ event: i.event, lengths: i.lengths, length: i.length })));
  check(JSON.stringify(it[0].event) === JSON.stringify({ date: { year: 2015, month: 3, day: null }, country: 'GB' }), `what is typed is read as an event (${JSON.stringify(it[0].event)})`);
  check(JSON.stringify(it[0].lengths) === JSON.stringify([{ medium: 1, position: 3, ms: 418000 }, { medium: 1, position: 4, ms: 4028000 }]), `as lengths (${JSON.stringify(it[0].lengths)})`);
  check(it[1].length === 201000, `as a length (${it[1].length})`);
  await type(`.falcon-event-input[data-id="${rid}"]`, 'next spring');
  await type(`.falcon-length-input[data-id="${cid}"]`, '3 minutes');
  it = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ event: i.event, length: i.length })));
  check(it[0].event && it[0].event.date.year === 2015 && await val(`.falcon-event-input[data-id="${rid}"]`) === '2015-03 GB', 'what doesn\'t read as an event is put back as it was');
  check(it[1].length === 201000 && await val(`.falcon-length-input[data-id="${cid}"]`) === '3:21', 'so is what doesn\'t read as a length');
  await type(`.falcon-lengths-input[data-id="${rid}"]`, '');
  check(await page.evaluate(() => window.__falconTest.getQueue()[0].lengths.length === 0), 'an emptied field drops them');
  await page.locator(`.falcon-form:has([data-id="${rid}"])`).first().screenshot({ path: 'test-results/falcon-783-fields.png' });

  // the grid: in the opened part, with the barcode
  await page.click('#falcon-view-toggle'); await frames(page);
  const grid = await page.evaluate(id => ({ sub: !!document.querySelector(`.falcon-grid tr.falcon-sub[data-id="${id}"] .falcon-event-input`) && !!document.querySelector(`.falcon-grid tr.falcon-sub[data-id="${id}"] .falcon-lengths-input`), line: !!document.querySelector(`.falcon-grid tr.falcon-row[data-id="${id}"] .falcon-event-input`) }), rid);
  check(grid.sub && !grid.line, `in the grid they are below the row (${JSON.stringify(grid)})`);
  await page.click('#falcon-view-toggle'); await frames(page);

  // a recording's length is seeded into its edit form, in ms
  const url = await page.evaluate(() => window.__falconTest.buildSeedEditUrl(window.__falconTest.getQueue()[1]));
  check(/edit-recording\.length=201000/.test(url), `the recording's edit is seeded with its length (${url})`);
});
