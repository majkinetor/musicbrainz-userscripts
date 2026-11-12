// #1009: "assign each recording its own tag from the release page". A REAL run on
// test.musicbrainz: one JSON gives each recording of a pristine two-track release
// its own tags, Falcon votes for them, and every tag is read back from ws/2.
//
// Sandbox only: refuses to run against any host but test.musicbrainz.org.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, idle, frames, mbNoise, pristine } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

test('live 1009 tags proof', { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  const HOST = 'https://test.musicbrainz.org';
  if (!/test\.musicbrainz\.org$/.test(new URL(HOST).hostname)) throw new Error('sandbox only');
  const { mbid: RELEASE } = await pristine(page, 'release', { tracks: 2 });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function ws2(path) {
    for (let a = 1; a <= 6; a++) {
      const j = await page.evaluate(p => fetch('/ws/2/' + p, { cache: 'no-store' }).then(r => r.ok ? r.json() : r.status).catch(e => String(e)), path).catch(e => String(e));
      if (j && typeof j === 'object') return j;
      await sleep(2500 * a);
    }
    return null;
  }
  const rel = await ws2(`release/${RELEASE}?inc=recordings&fmt=json`);
  const recs = (rel.media || []).flatMap(m => (m.tracks || []).map(t => t.recording.id));
  const want = recs.map((id, i) => [`falcon test ${i + 1}`, i ? 'Jazz' : 'rock']);
  const payload = { items: recs.map((mbid, i) => ({ entityType: 'recording', mbid, tags: want[i] })) };

  await context.addInitScript(() => {
    const s = new Map();
    window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
    window.GM_setValue = (k, v) => s.set(k, v);
    window.GM_deleteValue = k => s.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const errs = []; page.on('pageerror', e => { if (!mbNoise(e.message)) errs.push(e.message); });
  await page.goto(`${HOST}/release/${RELEASE}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  await idle(page);
  await page.addScriptTag({ content: code });
  await idle(page);

  const imported = await page.evaluate(t => window.__falconTest.importQueueJson(t, 'tags'), JSON.stringify(payload));
  check(imported.added === recs.length, `the JSON imported every recording (${imported.added}/${recs.length})`);
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 15000 });
  await frames(page);
  // the list shows a Tags box holding them
  const shown = await page.evaluate(() => [...document.querySelectorAll('.falcon-tags-input')].map(i => i.value));
  console.log('tag boxes: ' + JSON.stringify(shown));
  await page.evaluate(() => window.__falconTest.start());
  await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 300000 }).catch(() => {});
  const outcome = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ s: i.status, t: i.tagResults, e: i.error })));
  console.log('outcome: ' + JSON.stringify(outcome));
  check(outcome.every(o => o.s === 'done'), 'every row reports done');

  for (let i = 0; i < recs.length; i++) {
    const j = await ws2(`recording/${recs[i]}?inc=tags&fmt=json`);
    const names = ((j && j.tags) || []).map(t => t.name);
    console.log(`${recs[i]}: ${JSON.stringify(names)}`);
    check(want[i].every(w => names.includes(w.toLowerCase())), `recording ${i + 1} carries its own tags`);
  }
  check(!errs.length, `no page errors (${errs.join(' | ')})`);
});
