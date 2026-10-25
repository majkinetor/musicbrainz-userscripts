import { test, check, until, attachShot, idle } from '../../../dev/test/harness.mjs';
import { RELEASE } from '../../art_station/test/as.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// a release's History: its edits grouped into bursts, a group opening to its edits, the group switch regrouping them
test('the history page groups a release\'s edits', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/edits`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await idle(page);
  await inject('event_horizon');
  check(await until(() => page.locator('.hist .hgrp').count(), n => n > 0) > 0, 'the edits show as groups');
  check(await until(() => page.locator('.arthd h1 a').count(), n => n === 1) === 1, 'the title links back to the release');
  check(await page.locator('.arthd .ab.on[href$="/edits"]').count() === 1, 'History is the open tab');
  check(await page.locator('.hday').count() > 0, 'bursts sit under day headers');
  await page.locator('.hgrp .hgh').first().click();
  check(await until(() => page.locator('.hgrp.open .hed, .hgrp.open .hrun').count(), n => n > 0) > 0, 'a group opens to its edits');
  await page.locator('[data-hgrp="type"]').click();
  check(await until(() => page.locator('.hday').count(), n => n === 0) === 0, 'grouped by type, no day headers');
  check(await page.locator('.hist .hgrp').count() > 0, 'grouped by type, the groups show');
  await page.locator('[data-hgrp="burst"]').click();
  await attachShot(testInfo, page, 'history');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT, fullPage: true });
});
