// #730: Falcon skips a special-purpose artist or label ([no label], [unknown], …) without opening its
// edit page: since MBS-14146 a regular editor can't edit one, so the page never loads. 'skipped',
// not 'failed', with the reason; an ordinary item in the same run still goes through the pipeline.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, idle } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

test('#730: special-purpose entities are skipped, not failed', { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const NOLABEL = '157afde4-4bf5-4039-8ad2-5a15acc85176', UNKNOWN = '125ec42a-7229-4250-afc5-e057484327fe';
  const editLoads = [];
  context.on('request', r => { if (/\/(label|artist)\/[0-9a-f-]{36}\/edit/.test(r.url())) editLoads.push(r.url()); });
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'load' });
  await requireLogin(page);
  await idle(page);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 5000 });
  await page.evaluate(({ NOLABEL, UNKNOWN }) => {
    window.__falconTest.setQueue([
      { id: 's1', entityType: 'label', mbid: NOLABEL, urls: [{ url: 'https://www.discogs.com/label/750', linkTypeId: null }], urlResults: null, status: 'queued', error: '' },
      { id: 's2', entityType: 'artist', mbid: UNKNOWN, urls: [{ url: 'https://www.discogs.com/artist/118760', linkTypeId: null }], urlResults: null, status: 'queued', error: '' },
    ]);
    window.__falconTest.start();
  }, { NOLABEL, UNKNOWN });
  await page.waitForFunction(() => window.__falconTest.getQueue().every(i => !['queued', 'active'].includes(i.status)), null, { timeout: 15000 }).catch(() => {});
  const q = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ type: i.entityType, status: i.status, error: i.error })));
  console.log(JSON.stringify(q));
  check(q.every(i => i.status === 'skipped'), `both skipped, not failed (${JSON.stringify(q)})`);
  check(q.every(i => /special-purpose/.test(i.error || '')), 'and say why');
  check(editLoads.length === 0, `no edit page opened (${editLoads.join(', ')})`);
  await page.evaluate(() => window.__falconTest.stop && window.__falconTest.stop());
});
