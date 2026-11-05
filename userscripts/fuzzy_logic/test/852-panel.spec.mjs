import { test, check, until, requireLogin, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Fuzzy Logic' } });

const RG = 'https://test.musicbrainz.org/release-group/b1392450-e666-3926-a536-22c65f834433';
const done = page => until(() => page.evaluate(() => window.__fuzzyLogic.ran && !window.__fuzzyLogic.busy), b => b, { timeout: 90000 });

// #852: the dock item opens the window, which collects tags from the links
test('collects genres from the links', { tag: ['@sandbox', '@web'] }, async ({ page, inject }, testInfo) => {
  await page.goto(RG);
  await requireLogin(page);
  await inject('fuzzy_logic', { waitFor: '__fuzzyLogic' });
  await page.evaluate(() => document.getElementById('mb-fl-dock').click());
  await done(page);
  check(await page.locator('.fl-pop').count() === 1, 'the window is open');
  const n = await page.evaluate(() => window.__fuzzyLogic.tags.size);
  await attachShot(testInfo, page.locator('.fl-pop .mbu-ov-panel'), 'window');
  check(n > 0, 'tags collected (' + n + ')');
});

// #852: Vote sends one batched ws/2 POST, Withdraw takes it back
test('votes and withdraws', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(RG);
  await requireLogin(page);
  await inject('fuzzy_logic', { waitFor: '__fuzzyLogic' });
  await page.evaluate(() => document.getElementById('mb-fl-dock').click());
  await done(page);
  if (!(await page.locator('.fl-row').count())) await page.click('[data-a=alltags]');
  await page.evaluate(() => window.__fuzzyLogic.sel.clear());
  const row = page.locator('.fl-row:not(.bad)').first();
  const name = await row.getAttribute('data-t');
  await row.click();
  await page.click('[data-a=vote]');
  check(/Voted 1 tag/.test(await until(() => page.locator('#mbu-toast').innerText().catch(() => ''), t => /Voted|failed/.test(t))), 'vote toast ok (' + name + ')');
  check(await until(() => page.locator('.fl-pop').count(), n => n === 0) === 0, 'voting closes the window');
  await page.evaluate(() => document.getElementById('mb-fl-dock').click());
  if (!(await page.locator('.fl-row[data-t="' + name + '"]').count())) await page.click('[data-a=alltags]');
  await page.locator('.fl-row[data-t="' + name + '"]').click();
  await page.click('[data-a=withdraw]');
  check(/Withdrew 1 tag/.test(await until(() => page.locator('#mbu-toast').innerText().catch(() => ''), t => /Withdrew|failed/.test(t))), 'withdrawn');
});
