import { test, check, until, settled, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', values: { view: { width: 0 } } }, viewport: { width: 1000, height: 800 } });

// a page as wide as the screen keeps a column clear at its right edge, where the dock's launchers stand
test('the dock stands in a column beside the page', { tag: ['@sandbox', '@cosmetic'] }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/release/54b7bca2-7ed6-4484-bdd3-fe35a3f33dda', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await page.evaluate(() => localStorage.setItem('mbu.dockOpen', 'true'));
  await inject('mission_control');
  await inject('fusion');
  await inject('event_horizon');
  const on = () => page.evaluate(() => document.documentElement.hasAttribute('data-mbu-dock'));
  if (!(await on())) await page.locator('#eh-launch').click();
  check(await until(on, v => v) === true, 'EH turns the dock on');
  const m = await until(() => page.evaluate(() => {
    const w = [...document.querySelectorAll('.wrap')].find(e => e.offsetWidth), cs = w && getComputedStyle(w);
    const right = w ? w.getBoundingClientRect().right - parseFloat(cs.paddingRight) : 0;
    const icons = [...document.querySelectorAll('#mbu-dock,[data-mbu-docked=show]')].map(e => e.getBoundingClientRect()).filter(r => r.width);
    // EH scrolls the body, whose scrollbar is inside the window: the edge is where it starts
    const vw = Math.min(document.documentElement.clientWidth, document.body.getBoundingClientRect().left + document.body.clientWidth);
    return { right, left: Math.min(...icons.map(r => r.left)), vw, inner: innerWidth, maxRight: Math.max(...icons.map(r => r.right)), n: icons.length };
  }), v => v.n > 1 && v.right > 0);
  console.log(JSON.stringify(m));
  check(m.right <= m.left, `the page's content (to ${m.right}px) ends before the launchers (from ${m.left}px)`);
  check(m.vw - m.maxRight <= 8, `the launchers sit near the edge (${m.vw - m.maxRight}px)`);
  // in the middle of the column: as much room on their left as to the window's edge, the scrollbar's gutter included
  check(Math.abs((m.left - m.right) - (m.inner - m.maxRight)) <= 2, `the launchers sit in the column's middle (${m.left - m.right}px on their left, ${m.inner - m.maxRight}px on their right)`);
  await attachShot(testInfo, page, 'dock-column');
});
