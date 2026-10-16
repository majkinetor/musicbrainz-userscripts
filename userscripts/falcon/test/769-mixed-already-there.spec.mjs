// #769 (majkinetor, live from Platform Check): an artist got two links, one of them already on
// MusicBrainz in another form. Falcon took that one back, as it should, then refused the whole
// form: "1 pre-existing link(s) vanished from the form". Its snapshot of the links to protect was
// taken after MusicBrainz rendered the seeded rows, so the row it took back counted as existing.
// The new link must go in; the one already there is reported as such.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, idle, mbNoise } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

const ARTIST = '5441c29d-3602-4898-b1a1-b77fa23b8e50';   // David Bowie, on the sandbox
const QOBUZ = id => `https://www.qobuz.com/${id}/interpreter/falcon-test/769001`;
// a channel that's new on every run, so the run always has something to submit
const ytm = () => 'https://music.youtube.com/channel/UC' + Array.from({ length: 22 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join('');

test('#769: a link already there in another form does not stop the new one going in', { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
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

  // the gb-en form goes on (or is already there from an earlier run)
  const setup = await run([{ url: QOBUZ('gb-en'), linkTypeId: '176' }]);
  check(['done', 'skipped'].includes(setup?.status), `setup: the gb-en Qobuz page is on the artist (${setup?.status}: ${setup?.error})`);

  // the same Qobuz page in us-en, beside a channel the artist doesn't have
  const fresh = ytm();
  const item = await run([{ url: QOBUZ('us-en'), linkTypeId: '176' }, { url: fresh, linkTypeId: null }]);
  console.log('status:', item?.status, '; error:', item?.error, '; results:', JSON.stringify(item?.urlResults));
  check(item?.status === 'done', `the new link went in (got '${item?.status}': ${item?.error})`);
  const res = item?.urlResults || [];
  check(res.find(r => r.url === QOBUZ('us-en'))?.present, 'the us-en Qobuz page is reported as already there');
  check(res.find(r => r.url === fresh)?.ok, 'the new channel is committed');

  // read it back from MusicBrainz itself
  const r = await page.request.get(`https://test.musicbrainz.org/ws/2/artist/${ARTIST}?inc=url-rels&fmt=json`);
  const urls = ((await r.json()).relations || []).map(x => x.url?.resource);
  check(urls.includes(fresh), `the artist has the new channel on MusicBrainz (${fresh})`);
  check(!urls.includes(QOBUZ('us-en')), 'the us-en duplicate was not added');
  check(urls.includes(QOBUZ('gb-en')), 'the gb-en link is still there');
  check(!errs.length, `no page errors (${errs.join(' | ')})`);
});
