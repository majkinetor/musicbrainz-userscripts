// #467 (majkinetor: "Still fails if not shown") — the item that kept failing
// turned out to have nothing to do with visibility. Every url in it was ALREADY
// on the entity with the right type, so nothing changed and MusicBrainz had no
// edit to create. MB leaves "Enter edit" enabled anyway, so clicking submitted
// into the void: the page never navigated and Falcon burned the full 50s before
// reporting "never redirected off /edit" — on a batch that was already correct.
//
// Verified live on his exact failing recording (297fc936, all 5 distinct urls
// already present): seeding them produces ZERO .rel-add/.rel-edit/.rel-remove
// markers while the submit button stays enabled.
//
// So: ask MB whether anything is actually staged before submitting, and report
// "already up to date" instead of a bogus timeout+failure.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf } from '../../../dev/test/harness.mjs';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("#467: noop submit", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');

  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const ck = check;

  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const REC = '66d4cbcc-f78f-4f03-ae33-62fb4b20c565';   // a sandbox copy's recording (his was 297fc936, on production)
  await page.goto(`https://test.musicbrainz.org/recording/${REC}`, { waitUntil: 'load' });
  await requireLogin(page);
  await page.waitForTimeout(600);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 10000 });
  await page.evaluate(() => document.getElementById('falcon-launcher').click());
  await page.waitForTimeout(1200);

  // the links go on once, for real, so that the run below has nothing left to do
  await page.evaluate((rec) => {
    window.__falconTest.setQueue([{
      id: 'noop', entityType: 'recording', mbid: rec,
      urls: [
        { url: 'https://open.spotify.com/track/6bwfybp0HxiV5fNGU8uFyi', linkTypeId: '268' },
        { url: 'https://www.deezer.com/track/131741870', linkTypeId: '268' },
        { url: 'https://music.apple.com/de/song/1148102776', linkTypeId: '254' },
        { url: 'https://open.qobuz.com/track/34517479', linkTypeId: '979' },
        { url: 'https://tidal.com/track/64370601', linkTypeId: '979' },
      ],
      note: '', urlResults: null, status: 'queued', error: '',
    }]);
    window.__falconTest.cfg.workers = 1;
  }, REC);
  await page.evaluate(() => window.__falconTest.start());
  await page.waitForFunction(() => !['queued', 'active'].includes(window.__falconTest.getQueue()[0]?.status), null, { timeout: 90000 }).catch(() => {});
  check(['done', 'skipped'].includes(await page.evaluate(() => window.__falconTest.getQueue()[0]?.status)), 'setup: the links are on the recording');
  await page.evaluate(() => window.__falconTest.stop());

  // hard guard: nothing may actually submit during this test
  let posts = 0;
  await page.route(/\/(recording|artist|label)\/[0-9a-f-]{36}\/edit/, route => {
    const r = route.request();
    if (r.method() === 'POST' && /\/(recording|artist|label)\/[0-9a-f-]{36}\/edit/.test(r.url())) { posts++; return route.abort(); }
    return route.fallback();
  });

  await page.evaluate((rec) => {
    window.__falconTest.setQueue([{
      id: 'noop', entityType: 'recording', mbid: rec,
      urls: [
        { url: 'https://open.spotify.com/track/6bwfybp0HxiV5fNGU8uFyi', linkTypeId: '268' },
        { url: 'https://www.deezer.com/track/131741870', linkTypeId: '268' },
        { url: 'https://music.apple.com/de/song/1148102776', linkTypeId: '254' },
        { url: 'https://open.qobuz.com/track/34517479', linkTypeId: '979' },
        { url: 'https://tidal.com/track/64370601', linkTypeId: '979' },
      ],
      note: '', urlResults: null, status: 'queued', error: '',
    }]);
    window.__falconTest.cfg.workers = 1;
  }, REC);
  const t0 = Date.now();
  await page.evaluate(() => window.__falconTest.start());
  await page.waitForFunction(() => window.__falconTest.getQueue()[0]?.status !== 'queued' && window.__falconTest.getQueue()[0]?.status !== 'active', null, { timeout: 60000 }).catch(() => {});
  const elapsed = Date.now() - t0;
  const item = await page.evaluate(() => window.__falconTest.getQueue()[0]);
  console.log('elapsed', elapsed, 'ms; status:', item?.status, '; error:', item?.error);
  ck(item?.status === 'skipped', `an entity that already has every link is reported 'skipped', not 'failed' (got '${item?.status}')`);
  ck(!item?.error, `and carries no error text (got "${item?.error}")`);
  ck(elapsed < 20000, `it resolves promptly instead of burning the ~50s submit timeout (${elapsed}ms)`);
  ck(posts === 0, `nothing was submitted into the void (POST attempts: ${posts})`);

  const logText = await page.evaluate(() => { document.getElementById('falcon-tab-log').click(); return document.getElementById('falcon-log-text').textContent; });
  ck(/no pending change/i.test(logText), 'the log explains why it skipped (MB shows no pending change)');
  ck(/already up to date/i.test(logText), 'and says the entity is already up to date');

  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
});
