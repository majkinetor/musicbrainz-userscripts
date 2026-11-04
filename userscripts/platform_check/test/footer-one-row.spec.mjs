// The footer stays one row at any width: when it doesn't fit, Artists & labels drops to its icon.
import { test, check, attachShot } from '../../../dev/test/harness.mjs';
import { openPc } from './pc.mjs';

test('the footer never wraps; Artists & labels shortens to its icon', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  await openPc(page, inject, { release: 'b84ee12a-09ef-421b-82de-0441a926375b', settle: false });
  const at = w => page.evaluate(async w => {
    const f = document.querySelector('#pc-foot');
    f.style.width = w + 'px';
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const btns = [...f.querySelectorAll('.pc-icon-btn')].map(b => b.getBoundingClientRect());
    return { narrow: f.classList.contains('pc-foot-narrow'), oneRow: btns.every(b => Math.abs(b.top - btns[0].top) < 6), fits: f.scrollWidth <= f.clientWidth + 1 };
  }, w);
  // a count on the button, as the scans leave it
  await page.evaluate(() => document.querySelector('#mb-links-btn').insertAdjacentHTML('beforeend', '<span class="pc-links-n">12</span>'));
  const wide = await at(400);
  check(!wide.narrow && wide.oneRow, 'a wide footer shows the label on one row');
  const narrow = await at(200);
  await attachShot(testInfo, page.locator('#pc-foot'), 'narrow footer');
  check(narrow.narrow && narrow.oneRow && narrow.fits, 'a narrow one shows the icon, still one row, nothing cut off');
  const back = await at(400);
  check(!back.narrow, 'widened again, the label comes back');
});
