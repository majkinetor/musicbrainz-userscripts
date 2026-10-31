import { test, check, until, settled } from '../../../dev/test/harness.mjs';

// Platform Check's settings open over Event Horizon's page and over its own docked panel
test('Platform Check settings show on top in Event Horizon', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/release/54b7bca2-7ed6-4484-bdd3-fe35a3f33dda', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await inject('platform_check');
  await inject('event_horizon');
  const on = () => page.evaluate(() => document.documentElement.hasAttribute('data-mbu-dock'));
  if (!(await on())) await page.locator('#eh-launch').click();
  check(await until(on, v => v) === true, 'EH shows with the dock');
  await until(() => page.locator('#mb-token-setup-btn').count(), n => n > 0, 15000);
  await page.evaluate(() => document.getElementById('mb-token-setup-btn').click());
  const top = await until(() => page.evaluate(() => { const c = document.getElementById('mb-provider-modal-card'), b = c && c.getBoundingClientRect(); if (!b || !b.width) return 'hidden'; const el = document.elementFromPoint(b.left + b.width / 2, b.top + 30); return c.contains(el) ? 'card' : (el && (el.id || el.className)); }), v => v === 'card', 8000);
  check(top === 'card', `the settings card is on top (${top})`);
});
