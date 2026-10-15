// #759: MusicBrainz cleans an Apple Music album link as it seeds it (…/us/album/<name>/<id>
// shows as …/us/album/<id>). Falcon looked for the row by the exact url it asked for, missed it,
// never set the link's type (purchase for download), typed the url in again, and reported the
// url failed with every validation message the release editor keeps hidden on the page.
//
// Writes to the sandbox: each run adds a made-up Apple Music album link to a release there.
import { readFile } from 'node:fs/promises';
import { test, check, until, requireLogin, sourceOf, idle, mbNoise, loadFunctions } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

const RELEASE = '3d2edcfc-d823-4e04-abc6-1dca9702af94';
const ID = '1999' + String(Date.now()).slice(-6);
const URL1 = `https://music.apple.com/us/album/zzq-falcon-759-single/${ID}`;

test('#759: a release link MusicBrainz cleans as it seeds it gets both its types', { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  test.setTimeout(180000);
  const code = await readFile(sourceOf('falcon'), 'utf8');
  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const errs = []; page.on('pageerror', e => { if (!mbNoise(e.message)) errs.push(e.message); });
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'load' });
  await requireLogin(page);
  await idle(page);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 10000 });
  await page.evaluate(() => document.getElementById('falcon-launcher').click());
  await page.waitForFunction(() => document.getElementById('falcon-panel')?.style.display === 'flex', null, { timeout: 10000 });

  // purchase for download + streaming, as Harmony suggests for an Apple Music album
  await page.evaluate(([mbid, url]) => {
    window.__falconTest.setQueue([{ id: 'x', entityType: 'release', mbid, urls: [{ url, linkTypeId: '74' }, { url, linkTypeId: '980' }], note: 'Falcon test #759', urlResults: null, status: 'queued', error: '' }]);
    window.__falconTest.cfg.workers = 1;
    window.__falconTest.start();
  }, [RELEASE, URL1]);
  await page.waitForFunction(() => !['queued', 'active'].includes(window.__falconTest.getQueue()[0]?.status), null, { timeout: 150000 }).catch(() => {});
  const item = await page.evaluate(() => window.__falconTest.getQueue()[0]);
  await page.evaluate(() => window.__falconTest.stop());
  console.log('status:', item?.status, '; error:', item?.error, '; results:', JSON.stringify(item?.urlResults));
  check(item?.status === 'done', `the item is done (got '${item?.status}': ${String(item?.error).slice(0, 300)})`);
  check(!/release title is required/i.test(item?.error || ''), 'no hidden release-editor validation text in the error');

  const types = await until(() => page.evaluate(([g, id]) => fetch('/ws/2/release/' + g + '?inc=url-rels&fmt=json').then(r => r.json())
    .then(j => (j.relations || []).filter(r => r.url && r.url.resource.endsWith('/' + id)).map(r => r.type)), [RELEASE, ID])
    .catch(() => []), v => v.length >= 2, { timeout: 30000 });
  console.log('stored types:', JSON.stringify(types));
  check(types.includes('purchase for download'), 'stored as purchase for download');
  check(types.includes('streaming'), 'stored as streaming');
  check(!errs.length, `no page errors (${errs.join(' | ')})`);
});

test('#759: a cleaned url is the same link, another page is not', { tag: '@unit' }, async () => {
  const { sameLink } = await loadFunctions('falcon', ['sameLink']);
  const apple = 'https://music.apple.com/us/album/demonic-single/6821820610';
  check(sameLink('https://music.apple.com/us/album/6821820610', apple), 'Apple Music without the name');
  check(sameLink('https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy', 'https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy?si=abc'), 'tracking parameter dropped');
  check(sameLink('https://bandcamp.com/x', 'https://www.bandcamp.com/x/'), 'www and trailing slash');
  check(!sameLink('https://music.apple.com/us/album/6821820611', apple), 'another id');
  check(!sameLink('https://music.apple.com/us/artist/6821820610', apple), 'artist with the same id');
  check(!sameLink('https://www.youtube.com/watch?v=B', 'https://www.youtube.com/watch?v=A'), 'another video');
  check(!sameLink('https://itunes.apple.com/us/album/6821820610', apple), 'another host');
});
