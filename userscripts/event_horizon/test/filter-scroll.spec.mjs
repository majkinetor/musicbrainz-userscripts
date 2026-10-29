import { test, check, until, frames } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// typing in the discography's filter keeps the page still, scrolled down too, and the pinned header stays shown
test('typing in the filter does not move the page', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('https://test.musicbrainz.org/artist/a74b1b7f-71a5-4011-9441-d0b5e4122711');
  await inject('event_horizon');
  const open = page.locator('[data-fopen="dg"]');
  check(await until(() => open.count(), n => n === 1) === 1, 'the discography has a filter button');
  await until(() => page.locator('#s-dg tbody tr, #s-dg .dg-card, #s-dg li').count(), n => n > 5);
  await page.locator('#s-dg [data-dgview="table"]').click();
  await open.click();
  const box = page.locator('[data-fq="dg"]');
  // the box at the window's foot, past the page's header, so the pinned bar shows: the bar took the action row a frame
  // after each redraw, the header shrank under the corrected scroll, and every letter moved the page (Radiohead's header shows it)
  await box.evaluate((el, at) => scrollBy(0, el.getBoundingClientRect().top - innerHeight * at), 0.97);
  await frames(page, 5);
  await box.focus();
  const read = () => page.evaluate(() => ({ y: Math.round(scrollY), top: Math.round(document.querySelector('[data-fq="dg"]').getBoundingClientRect().top), pin: document.getElementById('eh-pin')?.classList.contains('on') }));
  const start = await read();
  console.log('start', JSON.stringify(start));
  check(start.y > 300, `the page is scrolled down (${start.y})`);
  const seen = [];
  // every frame after a letter, not only where it settles: a jump put right a frame later still shows
  const watch = () => page.evaluate(() => new Promise(done => { const tops = [], el = () => document.querySelector('[data-fq="dg"]'); const f = () => { tops.push(Math.round(el().getBoundingClientRect().top)); tops.length < 20 ? requestAnimationFrame(f) : done(tops); }; requestAnimationFrame(f); }));
  for (const ch of 'tbttttt') {
    const tops = watch();
    await page.keyboard.type(ch);
    const t = await tops;
    check(t.every(x => Math.abs(x - start.top) <= 2), `typing "${ch}" leaves the box still in every frame: ${t.join(' ')}`);
    seen.push(await read());
  }
  await page.keyboard.type('xyz', { delay: 30 });
  await frames(page, 10);
  seen.push(await read());
  console.log(JSON.stringify(seen));
  check(seen.every(s => Math.abs(s.top - start.top) <= 2), `the box stays where it was: ${JSON.stringify(seen.map(s => s.top))} vs ${start.top}`);
  check(seen.every(s => s.pin === start.pin), 'the pinned header keeps its state');
  await page.keyboard.press('Escape');
});
