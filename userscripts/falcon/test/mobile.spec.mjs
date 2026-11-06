// On a phone, Falcon's window fills the screen: MB's page is wider than it, so the window is
// pinned to what is on screen, nothing in its bars sticks out, and the grid scrolls sideways.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, idle } from '../../../dev/test/harness.mjs';

test.use({ gm: false, viewport: { width: 414, height: 846 }, isMobile: true, hasTouch: true });

test('the window fits a phone', { tag: ['@sandbox', '@cosmetic'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'load' });
  await requireLogin(page);
  await idle(page);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.evaluate(() => document.getElementById('falcon-launcher').click());
  await page.waitForSelector('#falcon-panel', { timeout: 5000 });
  await page.evaluate(() => window.__falconTest.setQueue([
    { id: 'a', entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', urls: [{ url: 'https://myspace.com/exp1', linkTypeId: null }], name: 'Some artist', urlResults: null, status: 'queued', error: '' },
  ]));
  await page.waitForTimeout(500);
  if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/falcon-mobile.png' });
  const r = await page.evaluate(() => {
    const vv = visualViewport, L = vv.offsetLeft, R = L + vv.width;
    const out = [...document.querySelectorAll('#falcon-panel *')].filter(e => e.getClientRects().length && !e.closest('#falcon-queue-list, #falcon-status-chips, #falcon-body-workers'))
      .map(e => [e.id || e.className, e.getBoundingClientRect()]).filter(([, b]) => b.width && (b.left < L - 1 || b.right > R + 1))
      .map(([c, b]) => c + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
    const p = document.getElementById('falcon-panel').getBoundingClientRect();
    return { vv: [L, R], panel: [Math.round(p.left), Math.round(p.right)], out };
  });
  console.log(JSON.stringify(r));
  check(r.panel[0] >= r.vv[0] - 1 && r.panel[1] <= r.vv[1] + 1, `the window is on the screen (${r.panel} on ${r.vv})`);
  check(r.out.length === 0, `nothing sticks out (${r.out.slice(0, 8).join(' · ')})`);
});
