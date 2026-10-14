// #744: the activity log opened from the settings closed only on the second ✕ or Esc: the settings stayed open under
// it and took the first for themselves (their backdrop went, the log stayed). The settings now close as the log opens.
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';

test('#744: the log opened from the settings closes on the first ✕ or Esc', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  const openLog = async () => {
    await page.click('#mc-launch', { button: 'right' });
    await page.waitForSelector('.mbu-ov .mbu-cfg-log');
    await page.click('.mbu-ov .mbu-cfg-log');
    await page.waitForSelector('#mbu-logpop');
  };
  await openLog();
  check(await page.locator('.mbu-ov').count() === 0, 'the settings close as the log opens');
  await page.keyboard.press('Escape');
  check(await until(() => page.locator('#mbu-logpop').count(), n => n === 0, { timeout: 3000 }) === 0, 'one Esc closes the log');

  await openLog();
  await page.click('#mbu-logpop .mbu-logpop-x');
  check(await until(() => page.locator('#mbu-logpop').count(), n => n === 0, { timeout: 3000 }) === 0 && await page.locator('.mbu-ov').count() === 0, 'one ✕ closes it, with nothing left behind');
});
