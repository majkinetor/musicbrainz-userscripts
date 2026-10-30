import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('on a phone the pinned bar folds its action links into More', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.setViewportSize({ width: 420, height: 800 });
  await page.goto('https://test.musicbrainz.org/artist/b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
  await inject('event_horizon');
  check(await until(() => page.locator('#app .kicker .acts [data-ehsec]').count(), n => n > 0, 20000) === 1, 'the page drew');
  const inHeader = await page.locator('#app .kicker .acts > a.ab:has(>span)').count();
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  check(await until(() => page.locator('#eh-pin.on').count(), n => n > 0, 5000) === 1, 'the bar shows');
  check(await page.locator('#eh-pin .acts > a.ab:has(>span)').count() === 0, 'no action links in the bar row');
  check(await page.locator('#eh-pin .eh-more .abm a.ab').count() >= inHeader, 'they are in More');
  await page.locator('#eh-pin .eh-more > summary').click();
  check(await page.locator('#eh-pin .eh-more .abm .abt').first().isVisible(), 'with their labels');
  await page.screenshot({ path: 'dev/_eh-pin-mobile.png' });
  await page.evaluate(() => scrollTo(0, 0));
  check(await until(() => page.locator('#app .kicker .acts > a.ab:has(>span)').count(), n => n === inHeader, 5000) === inHeader, 'back at the top, the links return to the row');
});

test('on a phone the page keeps no column for the launchers', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.setViewportSize({ width: 420, height: 800 });
  await page.goto('https://test.musicbrainz.org/artist/b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
  await page.evaluate(() => localStorage.setItem('mbu.dockOpen', 'true'));
  await inject('event_horizon');
  check(await until(() => page.locator('#app .kicker .acts').count(), n => n > 0, 20000) === 1, 'the page drew');
  await page.evaluate(() => document.documentElement.setAttribute('data-mbu-dock', ''));
  const pad = await page.evaluate(() => parseFloat(getComputedStyle([...document.querySelectorAll('.wrap')].find(e => e.offsetWidth)).paddingRight));
  check(pad <= 16, `the right padding is the usual 16px (${pad}px)`);
});

test('on a phone the alias editor stacks each alias so its fields have room', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.setViewportSize({ width: 420, height: 800 });
  await page.goto('https://test.musicbrainz.org/artist/b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await inject('event_horizon');
  check(await until(() => page.locator('button.eh-edit[data-aliases]').count(), n => n > 0, 20000) > 0, 'the pencil shows');
  await page.locator('button.eh-edit[data-aliases]').first().click();
  check(await until(() => page.locator('#eh-aliases .tc-al-row').count(), n => n > 1, 15000) > 1, 'the editor lists the aliases');
  const w = await page.locator('#eh-aliases .tc-al-row .tc-al-n').first().evaluate(i => i.getBoundingClientRect().width);
  check(w > 200, `the name field is wide (${w}px)`);
  check(!(await page.locator('#eh-aliases .tc-al-head').isVisible()), 'the column headings give way to placeholders');
  await page.screenshot({ path: 'dev/_eh-aliases-mobile.png' });
});
