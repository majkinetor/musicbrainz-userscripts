// #671 (majkinetor's Platform Check batch, run three times over): a link that is already on the
// entity is nothing to do, not a failure. The second and third copies of each artist found the
// link the first had just added and were reported failed ("MusicBrainz wanted a second
// relationship type for it, and none was given").
//
// And the same page under another locale counts as already there: MusicBrainz keeps a Qobuz or
// Apple Music link in whatever locale it was entered in, so adding the us-en form of a gb-en
// link would only have duplicated it.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, idle, mbNoise } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

const ARTIST = '5441c29d-3602-4898-b1a1-b77fa23b8e50';   // David Bowie, on the sandbox
const YTM = 'https://music.youtube.com/channel/UC671FalconTestChannel00';
const QOBUZ = id => `https://www.qobuz.com/${id}/interpreter/falcon-test/671001`;

test('#671: a link already there (or there in another locale) is skipped, not failed', { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const errs = []; page.on('pageerror', e => { if (!mbNoise(e.message)) errs.push(e.message); });
  await page.goto(`https://test.musicbrainz.org/artist/${ARTIST}`, { waitUntil: 'load' });
  await requireLogin(page);
  await idle(page);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 10000 });
  await page.evaluate(() => document.getElementById('falcon-launcher').click());
  await page.waitForFunction(() => document.getElementById('falcon-panel')?.style.display === 'flex', null, { timeout: 10000 });

  const run = async urls => {
    await page.evaluate(([mbid, urls]) => {
      window.__falconTest.setQueue([{ id: 'x', entityType: 'artist', mbid, urls, note: '', urlResults: null, status: 'queued', error: '' }]);
      window.__falconTest.cfg.workers = 1;
      window.__falconTest.start();
    }, [ARTIST, urls]);
    await page.waitForFunction(() => !['queued', 'active'].includes(window.__falconTest.getQueue()[0]?.status), null, { timeout: 90000 }).catch(() => {});
    const item = await page.evaluate(() => window.__falconTest.getQueue()[0]);
    await page.evaluate(() => window.__falconTest.stop());
    return item;
  };

  // the links go on once, for real (the gb-en form), so the run below finds them there
  const setup = await run([{ url: YTM, linkTypeId: null }, { url: QOBUZ('gb-en'), linkTypeId: '176' }]);
  check(['done', 'skipped'].includes(setup?.status), `setup: the links are on the artist (${setup?.status}: ${setup?.error})`);

  let posts = 0;
  await page.route(/\/artist\/[0-9a-f-]{36}\/edit/, route => {
    if (route.request().method() === 'POST') { posts++; return route.abort(); }
    return route.fallback();
  });

  // the same YouTube Music channel, and the same Qobuz page in us-en
  const item = await run([{ url: YTM, linkTypeId: null }, { url: QOBUZ('us-en'), linkTypeId: '176' }]);
  console.log('status:', item?.status, '; results:', JSON.stringify(item?.urlResults));
  check(item?.status === 'skipped', `already there: skipped, not failed (got '${item?.status}': ${item?.error})`);
  const res = item?.urlResults || [];
  check(res.length === 2 && res.every(r => r.present), `both urls reported as already there (${JSON.stringify(res)})`);
  check(/as https:\/\/www\.qobuz\.com\/gb-en\//.test(res.find(r => r.url === QOBUZ('us-en'))?.error || ''), 'the us-en Qobuz page names the gb-en link it already is');
  check(posts === 0, `nothing submitted (${posts} POST)`);
  check(!errs.length, `no page errors (${errs.join(' | ')})`);
});
