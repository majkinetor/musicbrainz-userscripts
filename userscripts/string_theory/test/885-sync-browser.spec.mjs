import { readFileSync } from 'node:fs';
import { test, expect, SANDBOX } from '../../../dev/test/harness.mjs';
const members = readFileSync(new URL('../members.txt', import.meta.url), 'utf8').split(/\r?\n/).map(x => x.replace(/#.*/, '').trim()).filter(Boolean);
test.use({ gm: { name: 'String Theory', persist: true, values: {
  'string_theory.off': members,
  view: { width: 800, stars: [] },
  'mbu.archive': { iaKey: 'fixture-key', iaSecret: 'fixture-secret' },
} } });

test('backup download and import use the bundle’s real settings and apply on reload', { tag: '@sandbox' }, async ({ page, inject }, info) => {
  await page.goto(SANDBOX + '/search/edits', { waitUntil: 'load' });
  await inject('string_theory');
  await page.evaluate(() => document.dispatchEvent(new Event('mbu-st-settings')));
  await page.locator('#st-tab-s').click();
  await expect(page.locator('#st-sync-auto')).not.toBeChecked();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#st-sync-export').click();
  const download = await downloadPromise;
  const backup = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(backup.data.gm['mbu.archive'].value.iaSecret).toBe('fixture-secret');
  expect(backup.data.gm.view.value.width).toBeUndefined();
  backup.data.gm.view.value.stars = [{ key: 'artist/7a2e9474-459e-44f5-8421-8b7943c8a6f0', title: 'Fixture' }];
  backup.data.gm.view.value.width = 1600; // imports reapply exclusions too
  await page.locator('#st-sync-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.locator('#st-sync-reload')).toBeVisible();
  expect(await page.evaluate(() => GM_getValue('view'))).toEqual({ width: 800, stars: [] });
  await page.screenshot({ path: 'dev/_885-sync.png', fullPage: false });
  await info.attach('Sync settings', { path: 'dev/_885-sync.png', contentType: 'image/png' });
  await page.reload(); await inject('string_theory');
  const stored = await page.evaluate(() => GM_getValue('view'));
  expect(stored.width).toBe(800); expect(stored.stars).toHaveLength(1);
  expect(await page.evaluate(() => GM_getValue('string_theory.sync.stage'))).toBeUndefined();
});
