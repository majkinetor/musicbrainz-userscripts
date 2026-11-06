// On a phone, Artists & labels fits the screen: MB's page is wider than it, so the window is pinned
// to what is on screen, the table scrolls sideways inside it, and the footer's button stays on it.
import { test, check } from '../../../dev/test/harness.mjs';
import { openPc } from './pc.mjs';

test.use({ gm: { name: 'Platform Check' }, viewport: { width: 414, height: 846 }, isMobile: true, hasTouch: true });

test('Artists & labels fits a phone', { tag: ['@sandbox', '@web', '@cosmetic'] }, async ({ page, inject }) => {
  await openPc(page, inject, { release: '51ee65f6-5c5b-4121-86d3-2ddd6fa62f52' });
  await page.evaluate(() => document.getElementById('mb-links-btn').click());
  await page.waitForSelector('#pc-links-ov .mbu-ov-body table', { timeout: 30000 });
  if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/pc-links-mobile.png' });
  const r = await page.evaluate(() => {
    const vv = visualViewport, L = vv.offsetLeft, R = L + vv.width;
    const b = s => document.querySelector(s).getBoundingClientRect();
    const p = b('#pc-links-ov .mbu-ov-panel'), s = b('#pc-links-ov .pc-lk-split');
    return { vv: [L, R], panel: [p.left, p.right], send: [s.left, s.right] };
  });
  console.log(JSON.stringify(r));
  check(r.panel[0] >= r.vv[0] - 1 && r.panel[1] <= r.vv[1] + 1, `the window is on the screen (${r.panel} on ${r.vv})`);
  check(r.send[1] <= r.vv[1] + 1, `the Falcon button is on the screen (${r.send})`);
});
