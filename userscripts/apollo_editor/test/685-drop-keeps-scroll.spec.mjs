// #685 majkinetor: "When moving tracks, as soon as I drop them to new position
// tracklist scrolls to the top." A drop rebuilds every row (mirror mode removes
// and re-adds the whole section), the page loses its height for a moment and the
// browser clamps the scroll. The drop must leave the view where it was.
import { test, check, idle, frames } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });
const MBID = '55530bc0-97ec-4256-97fc-e6058958c251';   // 13 tracks, as in 586b

test('#685: a dropped track leaves the tracklist scrolled where it was', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.setViewportSize({ width: 1400, height: 500 });   // short, so the tracklist scrolls
  const posted = await openApollo(page, inject, { release: MBID });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')].find(x => x.textContent.trim().toLowerCase().startsWith('tracklist'));
    if (b) b.click();
  });
  await page.waitForSelector('.tc-mirror tr[data-tk]', { state: 'attached', timeout: 20000 });
  await idle(page);

  const row = ti => `.tc-mirror tr[data-tk="0:${ti}"]`;
  await page.locator(row(9)).scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  check(before > 200, `fixture: the page is scrolled down to the last tracks (${before}px)`);

  const titles = () => page.evaluate(() => window.MB.releaseEditor.rootField.release().mediums()[0].tracks().map(t => t.name()).join(' | '));
  const t0 = await titles();
  await page.evaluate(([s, d]) => {
    const src = document.querySelector(s), dst = document.querySelector(d), h = src.querySelector('.tc-drag');
    const dt = new DataTransfer(), box = dst.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, dataTransfer: dt, clientY: box.bottom - 2, clientX: box.left + 10 };
    h.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    dst.dispatchEvent(new DragEvent('dragover', opts));
    dst.dispatchEvent(new DragEvent('drop', opts));
    h.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, [row(8), row(9)]);
  await frames(page); await idle(page);

  check((await titles()) !== t0, 'the track moved');
  const after = await page.evaluate(() => window.scrollY);
  check(Math.abs(after - before) < 5, `the view stayed put (${before}px → ${after}px)`);
  check(!posted.some(u => /\/edit\/create/.test(u)), 'nothing was submitted');
});
