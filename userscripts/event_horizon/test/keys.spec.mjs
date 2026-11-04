import { test, check, until, settled, requireLogin, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

const RG = 'ed64def7-4a2f-4ff7-9ae3-fbdfac9f8e0e';

// #907: a single key opens the entity's pages in the viewer and on MusicBrainz's page; Ctrl+/ lists them and changes a key
test('keyboard shortcuts open pages, and Ctrl+/ lists and rebinds them', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  const mb = 'https://test.musicbrainz.org';
  await page.goto(`${mb}/release-group/${RG}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  await settled(page);
  await inject('event_horizon');
  check(await until(() => page.locator('#app').count(), n => n > 0) > 0, 'the viewer is on');
  // the palette lists the commands and filters them
  await page.keyboard.press('Control+/');
  check(await until(() => page.locator('#eh-keys li').count(), n => n > 5) > 5, 'Ctrl+/ lists the commands');
  await attachShot(page, testInfo, 'palette');
  await page.keyboard.type('relat');
  check(await page.locator('#eh-keys li').count() === 1, 'typing filters the list');
  // rebind: click its key, press another
  await page.locator('#eh-keys li button').first().click();
  await page.keyboard.press('q');
  check((await page.locator('#eh-keys li button').first().innerText()).trim() === 'Q', 'the new key shows');
  await page.keyboard.press('Escape');
  check(await until(() => page.locator('#eh-keys').count(), n => n === 0) === 0, 'Escape closes it');
  // h goes to the history page, inside the viewer
  await page.keyboard.press('h');
  check(await until(() => page.url(), u => u.endsWith('/edits')).endsWith('/edits'), 'h opens the editing history');
  // q, rebound, opens relationships (a MusicBrainz page)
  await page.goto(`${mb}/release-group/${RG}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await inject('event_horizon');
  await until(() => page.locator('#app').count(), n => n > 0);
  await page.keyboard.press('q');
  check(await until(() => page.url(), u => u.includes('/edit-relationships')).includes('/edit-relationships'), 'the rebound key opens the relationship editor');
});
