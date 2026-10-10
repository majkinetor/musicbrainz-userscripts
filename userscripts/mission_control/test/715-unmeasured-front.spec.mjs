// #715: a current front the Cover Art Archive hasn't processed yet comes from Art Station as 0×0.
// The Cover art card shows its size as unknown (? × ?, "?" between the covers), not "0 × 0" and
// "larger: Execute removes the current one". A stand-in AS answers the probe. Nothing is written.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-in's

test('#715: an unprocessed front shows its size as unknown', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => send('mc:findings', { id: 'as', run: d.run, summary: 'Cover art: 1 image, front cover ✓',
        findings: [{ key: 'Apple Music', name: 'Apple Music', url: 'https://music.apple.com/us/album/1', state: 'unsure', role: 'best',
          why: "the best cover (3000×3000); the current front isn't processed by the Cover Art Archive yet, so its size is unknown; probe again later" }],
        best: { provider: 'Apple Music', w: 3000, h: 3000, bytes: 900000, of: 1, larger: false, replace: false, unknown: true, current: { id: 1, w: 0, h: 0, bytes: 0 } } }), 50);
    });
    send('mc:provider', { id: 'as', name: 'Art Station', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  const card = page.locator('#mc-root [data-card="as"] .mc-best');
  await card.waitFor();
  const text = await card.innerText();
  console.log(text);
  check(!/0 × 0/.test(text), 'no 0 × 0');
  check(/\? × \?/.test(text) && /not processed yet/.test(text), 'the current front: ? × ?, not processed yet');
  check(await card.locator('.mc-best-vs').textContent() === '?', 'a ? between the covers, not > or ≤');
  check(/Size unknown/.test(text) && !/removes/.test(text), 'Execute is not said to remove the current front');
  const on = await page.locator('#mc-root [data-card="as"] .mc-line.on').count();
  check(on === 0, 'the source is not selected');
  await page.locator('#mc-root [data-card="as"]').screenshot({ path: 'test-results/mc-715-unmeasured-front.png' });
});
