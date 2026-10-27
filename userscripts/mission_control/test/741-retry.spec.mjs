// #741: a provider whose apply failed and says it can try again (mc:applied with retry: true) gets a Retry button on
// its card, which applies that provider alone with what is still taken in. A stand-in Art Station fails the first
// time and enters the cover the second.
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-in's

test('#741: Retry on a card applies its provider again', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    window.__applies = [];
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => send('mc:findings', { id: 'as', run: d.run, release: d.release, summary: '', findings: [{ key: 'Spotify', name: 'Spotify', icon: 'spotify', url: 'https://open.spotify.com/album/1', state: 'new' }] }), 50);
    });
    document.addEventListener('mc:apply', e => {
      const d = JSON.parse(e.detail); if (d.id !== 'as') return;
      window.__applies.push(d.keys);
      const n = window.__applies.length;
      setTimeout(() => send('mc:applied', n === 1
        ? { id: 'as', run: d.run, release: d.release, ok: false, sent: 0, retry: true, note: 'the edit failed: sign 400 (repeated for 10 attempts)' }
        : { id: 'as', run: d.run, release: d.release, ok: true, sent: 1, note: 'entered Spotify 3000×3000 as the front cover' }), 50);
    });
    send('mc:provider', { id: 'as', name: 'Art Station', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="as"] .mc-line');
  await page.click('#mc-root [data-act="exec"]', { button: 'right' });   // #841: past the review
  const btn = page.locator('#mc-root [data-card="as"] .mc-applied.err [data-act="retry-apply"]');
  await btn.waitFor({ timeout: 20_000 });
  check(/sign 400/.test(await page.locator('#mc-root [data-card="as"] .mc-applied').textContent()), 'the card says why it failed, with Retry');
  await page.locator('#mc-root .mc-sect:has([data-card="as"])').screenshot({ path: 'test-results/mc-741-retry.png' });
  await btn.click();
  const ok = await until(() => page.locator('#mc-root [data-card="as"] .mc-applied.ok').count(), n => n === 1);
  const applies = await page.evaluate(() => window.__applies);
  check(ok === 1 && applies.length === 2 && JSON.stringify(applies[1]) === '["Spotify"]', `Retry applies Art Station again, with what is taken in (${JSON.stringify(applies)})`);
  check(await page.locator('#mc-root [data-act="retry-apply"]').count() === 0, 'and the button goes once it is through');
});
