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
  await page.locator('[data-hgrp="day"]').click();
  await page.locator('.hgrp .hgh').first().click();
  check(await until(() => page.locator('.hgrp.open .hwho').count(), n => n > 0) > 0, 'grouped by day, each edit names its editor');
  check(await page.locator('.hed .hnc').count() > 0, 'an edit with notes shows their count');
  const noted = page.locator('.hgrp.open .hed:has(.hnc) > summary:visible').first();
  if (await noted.count()) { await noted.click(); check(await until(() => page.locator('.hed[open] .hnote').count(), n => n > 0) > 0, 'an opened edit shows its notes'); }
  check(await page.locator('.hdt span.artwork-image:not(:has(img))').count() === 0, 'every cover in the details has its thumbnail');
  await page.locator('.hgrp .hgh').nth(1).click({ button: 'right' });
  check(await until(() => page.locator('.hgrp:not(.open)').count(), n => n === 0) === 0, 'a right-click on a closed group opens every group');
  const row = page.locator('.hgrp.open .hgb > details > summary:visible').first();
  const n = await page.locator('.hgrp.open').first().locator('.hgb > details').count();
  await row.click({ button: 'right' });
  check(await page.locator('.hgrp.open').first().locator('.hgb > details[open]').count() === n, 'a right-click on a row opens its siblings');
  await attachShot(testInfo, page, 'history');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT, fullPage: true });
});

// MusicBrainz's other edit lists open in the same viewer: open edits, under their own title
test('open edits show in the history viewer', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/edit/open', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await idle(page);
  await inject('event_horizon');
  check(await until(() => page.locator('.arthd h1').textContent(), t => /Open edits/.test(t || '')), 'the title names the list');
  check(await until(() => page.locator('.hist .hgrp, .hist .hmore').count(), n => n > 0) > 0, 'the edits or their count show');
  await attachShot(testInfo, page, 'open-edits');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace(/\.png$/, '-open.png'), fullPage: true });
});
