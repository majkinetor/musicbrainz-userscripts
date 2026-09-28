// #496 (majkinetor): "Lets put model info in Falcon docs" — the README's new
// "## JSON model" section documents the actual Import/Export item shape. This
// test extracts that exact JSON example from the README and round-trips it
// through the real importQueueJson(), confirming the documented example isn't
// just syntactically valid JSON but is actually accepted and produces the
// items the docs claim (right entityType/urls/comment/isrcs/cover per row).
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf } from '../../../dev/test/harness.mjs';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("#496: readme json model", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

  const ck = check;

  const start = readme.indexOf('```json', readme.indexOf('## JSON model'));   // the model's own example, not an earlier snippet
  const end = readme.indexOf('```', start + 7);
  const block = readme.slice(start + 7, end).trim();
  let parsed;
  try { parsed = JSON.parse(block); ck(true, 'the README JSON example is valid JSON'); }
  catch (e) { ck(false, 'the README JSON example is valid JSON — ' + e.message); throw new Error('stopped: see the log above'); }
  ck(Array.isArray(parsed.items) && parsed.items.length === 3, `the example has 3 items (got ${parsed.items?.length})`);

  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'load' });
  await requireLogin(page);
  await page.waitForTimeout(500);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 5000 });

  const result = await page.evaluate((text) => window.__falconTest.importQueueJson(text, 'readme-example'), block);
  console.log('import result:', JSON.stringify(result));
  ck(result.added === 3, `all 3 documented items are accepted by the real importer (added=${result.added}, skipped=${result.skipped || 0})`);

  const queue = await page.evaluate(() => window.__falconTest.getQueue());
  const artist = queue.find(i => i.entityType === 'artist');
  const recording = queue.find(i => i.entityType === 'recording');
  const release = queue.find(i => i.entityType === 'release');
  ck(artist && artist.status === 'done' && artist.urls.length === 1, `artist row round-trips with its documented status/urls (got status=${artist?.status}, urls=${artist?.urls.length})`);
  ck(recording && recording.disambiguation === 'live version' && recording.isrcs.length === 1 && recording.isrcs[0] === 'NLTH62000001', `recording row round-trips disambiguation + isrcs as documented (got disambiguation="${recording?.disambiguation}", isrcs=${JSON.stringify(recording?.isrcs)})`);
  ck(release && Array.isArray(release.cover) && release.cover[0] && release.cover[0].url.includes('dzcdn'), `release row round-trips its cover[0].url as documented (got cover=${JSON.stringify(release?.cover)})`);
  ck(release && release.cover[0].comment === 'page 1' && release.cover[0].type === 'Booklet', `release row round-trips the cover entry's own comment/type as documented (got ${JSON.stringify(release?.cover?.[0])})`);
  ck(release && release.urls.length === 1 && release.urls[0].linkTypeId === '75', `release row ALSO keeps its urls[] alongside cover (documented as both-at-once) (got ${JSON.stringify(release?.urls)})`);

  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
});
