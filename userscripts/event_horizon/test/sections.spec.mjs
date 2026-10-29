import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('the Sections button in the action row opens the section list', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/artist/b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
  await inject('event_horizon');
  const btn = page.locator('#app .kicker .acts [data-ehsec]');
  check(await until(() => btn.count(), n => n > 0, 20000) === 1, 'the button is in the action row');
  check(!(await page.locator('#eh-rail').isVisible()), 'the list is closed at first');
  await btn.click();
  check(await page.locator('#eh-rail').isVisible(), 'a click opens the list');
  check(await page.locator('#eh-rail [data-sec]').count() > 1, 'it lists the sections');
  await page.locator('#app h1').click();
  check(!(await page.locator('#eh-rail').isVisible()), 'a click elsewhere closes it');
});

test('the header pins to the top once it scrolls away, carrying the action row', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/artist/b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
  await inject('event_horizon');
  check(await until(() => page.locator('#app .kicker .acts [data-ehsec]').count(), n => n > 0, 20000) === 1, 'the page drew');
  check(!(await page.locator('#eh-pin.on').count()), 'no bar at the top');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  check(await until(() => page.locator('#eh-pin.on .acts [data-ehsec]').count(), n => n > 0, 5000) === 1, 'scrolled, the bar holds the actions');
  check((await page.locator('#eh-pin .pnm').textContent()).trim().length > 0, 'and the title');
  await page.locator('#eh-pin [data-ehsec]').click();
  check(await page.locator('#eh-rail').isVisible(), 'its Sections button works');
  await page.keyboard.press('Escape');
  await page.evaluate(() => scrollTo(0, 0));
  check(await until(() => page.locator('#app .kicker .acts [data-ehsec]').count(), n => n > 0, 5000) === 1, 'back at the top, the actions return to the header');
});

test('dragging a section shows a line where it will land', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/artist/b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
  await inject('event_horizon');
  const btn = page.locator('#app .kicker .acts [data-ehsec]');
  check(await until(() => btn.count(), n => n > 0, 20000) === 1, 'the page drew');
  await btn.click();
  const line = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#eh-rail [data-sec]')];
    const fire = (el, type, y) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, clientY: y, dataTransfer: new DataTransfer() }));
    const r = rows[1].getBoundingClientRect();
    fire(rows[0], 'dragstart', 0);
    fire(rows[1], 'dragover', r.top + 2);
    const before = rows[1].classList.contains('db') && getComputedStyle(rows[1], '::before').content !== 'none';
    fire(rows[1], 'dragover', r.bottom - 2);
    const after = rows[1].classList.contains('da') && !rows[1].classList.contains('db');
    fire(rows[0], 'dragend', 0);
    return { before, after, cleared: !document.querySelector('#eh-rail .db,#eh-rail .da') };
  });
  check(line.before, 'over the top half, the line is above the row');
  check(line.after, 'over the bottom half, below it');
  check(line.cleared, 'letting go clears it');
});
