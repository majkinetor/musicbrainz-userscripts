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
  // the arrow copies the begin to the end, and an end date checks and locks "no longer current"
  await row.locator('.tc-al-cp').click();
  check(await row.locator('.tc-al-e').inputValue() === '2005', 'the arrow copies the begin to the end');
  check(await row.locator('.tc-al-ed').evaluate(i => i.checked && i.disabled), 'an end date marks the alias ended');
  check(/\(\d+\)/.test(await page.locator('#eh-aliases .eh-al-n').innerText()), 'the title counts the aliases');
  check(/\/aliases$/.test(await page.locator('#eh-aliases .eh-al-tab').getAttribute('href')), 'the header links the Aliases tab');
  check(!(await page.locator('#eh-aliases .tc-al-bar').isVisible()), 'without the editor\'s own bar');
  // Note opens the edit note box
  await page.locator('#eh-aliases .tc-al-nb').click();
  check(await page.locator('#eh-aliases .tc-al-note').isVisible(), 'Note opens the edit note');
  await page.keyboard.type('why');
  await attachShot(testInfo, page, 'aliases');
  await page.keyboard.press('Escape');
  check(await until(() => page.locator('#eh-aliases').count(), n => n === 0) === 0, 'Escape closes it');
});

// a release lists its aliases too, with the pencil to add one, whatever facts the settings show
test('a release shows its aliases with the pencil', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/release/54b7bca2-7ed6-4484-bdd3-fe35a3f33dda', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  await settled(page);
  await inject('event_horizon');
  check(await until(() => page.locator('section.hero .facts button.eh-edit[data-aliases]').count(), n => n === 1) === 1, 'the hero has the alias pencil');
  check(/^alias/i.test(await page.locator('section.hero .facts > div:has(button[data-aliases]) > .label').innerText()), 'under an Aliases label');
  await attachShot(testInfo, page, 'release-aliases');
  await page.locator('section.hero button.eh-edit[data-aliases]').click();
  check(await until(() => page.locator('#eh-aliases #tc-alias').count(), n => n === 1) === 1, 'the popup holds the alias editor');
  check(/\/release\/[0-9a-f-]{36}\/aliases$/.test(await page.locator('#eh-aliases .eh-al-tab').getAttribute('href')), 'for the release');
});
