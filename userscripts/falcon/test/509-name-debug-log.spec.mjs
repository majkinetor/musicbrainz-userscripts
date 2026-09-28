// #509 follow-up (majkinetor): "I don't think its working, although not
// sure. Lets add debug log for track fetching - list entity mbid and if name
// is fetched or passed." Verifies the Log tab actually shows, per entity,
// whether its name came straight from the source (Harmony-scraped) or had to
// be fetched from MB — so this is checkable from the log instead of assumed.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, frames, mbNoise } from '../../../dev/test/harness.mjs';
import { join } from 'node:path';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("#509: name debug log", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');

  const ck = check;

  const NAMED_MBID = 'aaaaaaaa-5090-0000-0000-0000000000a1';
  const FETCH_MBID = 'aaaaaaaa-5090-0000-0000-0000000000a2';

  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const errs = []; 
  page.on('pageerror', e => { if (!mbNoise(e.message)) errs.push(e.message); });
  await page.route('**/ws/2/recording/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ title: 'Fetched From MB' }) }));
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'load' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });

  await page.evaluate(({ NAMED_MBID, FETCH_MBID }) => {
    const t = window.__falconTest;
    t.addToQueue([
      { entityType: 'recording', mbid: NAMED_MBID, url: 'https://example.com/named', name: 'Passed Straight Through' },
      { entityType: 'recording', mbid: FETCH_MBID, url: 'https://example.com/fetch' },
    ]);
  }, { NAMED_MBID, FETCH_MBID });
  await frames(page);

  const log = await page.evaluate(() => window.__falconTest.getLog().join('\n'));
  console.log('--- log tail ---');
  console.log(log.split('\n').filter(l => /\[names\]/.test(l)).join('\n'));

  ck(new RegExp(`\\[names\\].*recording:${NAMED_MBID}.*passed from source.*Passed Straight Through`).test(log), 'log shows the Harmony-scraped name as "passed from source"');
  ck(new RegExp(`\\[names\\].*recording:${FETCH_MBID}.*fetching from MB`).test(log), 'log shows the nameless item triggering an MB fetch');
  ck(new RegExp(`\\[names\\].*recording:${FETCH_MBID}.*fetched:.*Fetched From MB`).test(log), 'log shows the fetch actually resolving to a name');

  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
});
