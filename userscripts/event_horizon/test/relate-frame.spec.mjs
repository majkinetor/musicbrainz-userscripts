import { test, check, until, attachShot, requireLogin } from '../../../dev/test/harness.mjs';
import { RELEASE } from '../../art_station/test/as.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// Relate inside Event Horizon opens MusicBrainz's relationship editor in a frame under EH's header: the tab never
// reloads (the player keeps playing), and a link in the editor opens in EH
test('the relationship editor opens in a frame, without reloading the tab', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  // a manager runs it once <html> exists; Playwright's init script runs before, so it waits for it
  const whenHtml = code => `(() => { const go = () => { ${code}
}; if (document.documentElement) go(); else new MutationObserver((m, o) => { if (document.documentElement) { o.disconnect(); go(); } }).observe(document, { childList: true }); })();`;
  await inject('event_horizon', { atStart: true, transform: whenHtml });   // the frame runs it too, as a manager does
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  await page.waitForSelector('#app .hero', { timeout: 60000 });
  await page.evaluate(() => { window.__noReload = 1; });
  await page.locator(`#app a[href$="/release/${RELEASE}/edit-relationships"]`).first().click();
  check(await until(() => page.locator('#app > #eh-relframe').count(), n => n === 1) === 1, 'the editor opens in a frame');
  check(await page.evaluate(() => window.__noReload) === 1, 'the tab did not reload');
  check(new URL(page.url()).pathname === `/release/${RELEASE}/edit-relationships`, 'the address is the editor\'s');
  check(await until(() => page.locator(`#app .arthd h1 a[href$="/release/${RELEASE}"]`).count(), n => n === 1) === 1, 'EH\'s header shows the release');
  const fr = page.frameLocator('#eh-relframe');
  check(await until(() => fr.locator('#tracklist').isVisible().catch(() => false), v => v) === true, 'the editor loads in the frame');
  check(await fr.locator('#eh-relhd').count() === 0, 'the frame has no header of its own');
  check(!(await fr.locator('body > .header').isVisible()), 'nor MusicBrainz\'s');
  const h = await until(() => page.evaluate(() => document.getElementById('eh-relframe').getBoundingClientRect().height), v => v > 300);
  check(h > 300, 'the frame takes the editor\'s height');
  await attachShot(testInfo, page, 'relate-frame');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT, fullPage: true });
  // the editor still works: Add relationship opens MusicBrainz's dialog
  await fr.locator('#release-rels button.add-item, #release-rels .add-relationship').first().click();
  check(await until(() => fr.locator('[role=dialog], .dialog').count(), n => n > 0) > 0, 'Add relationship opens the dialog');
  if (process.env.EH_SHOT) await page.screenshot({ path: process.env.EH_SHOT.replace('.png', '-dialog.png'), fullPage: true });
  await fr.locator('[role=dialog], .dialog').first().press('Escape');   // in the frame: Escape in EH would leave the editor
  // a link in the editor opens in EH, not in the frame in place, as EH's own do (its entity links open a new tab, as on MusicBrainz)
  await fr.locator('a[href$="/discids"]:not([target])').first().evaluate(a => a.click());
  check((await until(() => page.url(), u => u.endsWith('/discids'))).endsWith('/discids'), 'a link in the editor opens in EH');
  check(await until(() => page.locator('#eh-relframe').count(), n => n === 0) === 0, 'and the frame goes');
  check(await page.evaluate(() => window.__noReload) === 1, 'still without a reload');
  // Back returns to the editor
  await page.goBack();
  check(await until(() => page.locator('#app > #eh-relframe').count(), n => n === 1) === 1, 'Back opens the editor again');
  check(await page.evaluate(() => window.__noReload) === 1, 'without a reload');
});

// String Theory treats the frame as the tab's own page: a member with @noframes (Group Therapy) still starts in it
test('in String Theory, Group Therapy starts in the editor\'s frame', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const whenHtml = code => `(() => { const go = () => { ${code}
}; if (document.documentElement) go(); else new MutationObserver((m, o) => { if (document.documentElement) { o.disconnect(); go(); } }).observe(document, { childList: true }); })();`;
  await inject('string_theory', { atStart: true, transform: whenHtml });
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  await page.waitForSelector('#app .hero', { timeout: 60000 });
  await page.locator(`#app a[href$="/release/${RELEASE}/edit-relationships"]`).first().click();
  const fr = page.frameLocator('#eh-relframe');
  check(await until(() => fr.locator('#tracklist').isVisible().catch(() => false), v => v) === true, 'the editor loads in the frame');
  check(await until(() => fr.locator('#gt-css').count(), n => n > 0) > 0, 'Group Therapy runs in it');
});
