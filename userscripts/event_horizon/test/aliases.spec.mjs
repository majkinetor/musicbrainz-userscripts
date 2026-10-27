import { test, check, until, settled, requireLogin, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

const RG = 'ed64def7-4a2f-4ff7-9ae3-fbdfac9f8e0e';

// the alias pencil opens Apollo Editor's alias editor (the shared one) in a popup; Escape closes it
test('the alias pencil opens the alias editor in a popup', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/release-group/${RG}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  await settled(page);
  await inject('event_horizon');
  check(await until(() => page.locator('button.eh-edit[data-aliases] svg').count(), n => n > 0) > 0, 'the pencil shows');
  await page.locator('button.eh-edit[data-aliases]').first().click();
  check(await until(() => page.locator('#eh-aliases #tc-alias').count(), n => n === 1) === 1, 'the popup holds the alias editor');
  check(await until(() => page.locator('#eh-aliases .tc-al-list input').count(), n => n > 0) > 0, 'with a row to type a new alias in');
  // the calendar opens the row's dates, and they stay open, unflagged, while a date is typed
  const row = page.locator('#eh-aliases .tc-al-row').first();
  await row.locator('.tc-al-c').click();
  await page.keyboard.type('2');
  await page.keyboard.type('0', { delay: 80 });
  check(await row.evaluate(r => r.classList.contains('tc-al-dopen')), 'the dates stay open while typing');
  check(await row.locator('.tc-al-b').evaluate(i => document.activeElement === i), 'the begin keeps the focus');
  check(!(await row.locator('.tc-al-b').evaluate(i => i.classList.contains('tc-al-bad'))), 'a half-typed date is not flagged');
  await page.keyboard.type('05');
  check((await row.locator('.tc-al-c').innerText()).includes('2005'),'the calendar shows the date');
  await attachShot(testInfo, page, 'aliases');
  await page.keyboard.press('Escape');
  check(await until(() => page.locator('#eh-aliases').count(), n => n === 0) === 0, 'Escape closes it');
});
