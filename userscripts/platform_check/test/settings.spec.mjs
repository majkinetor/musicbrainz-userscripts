// The settings window.
//
// #188: it opens on a compact main view (link confidence, appearance with icon and name
//       size sliders); "Platforms" and "Authentication" are sub-views that replace it,
//       with ‹ Back. The icon-size slider drives the panel's --pc-icon-size.
// #464: "Add links in a new tab" is on by default, and unticking it is saved.
//
// test.musicbrainz.org; no provider is asked anything (the scans never get an answer).
import { test, check, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Platform Check', xhr: 'none' } });

test('main view, sub-views, sliders, and the new-tab setting', { tag: ['@sandbox'] }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/release/ec116461-5b0d-4c98-bb44-a4de5de63076', { waitUntil: 'domcontentloaded' });
  await inject('platform_check');
  await page.click('#mb-token-setup-btn');
  await page.waitForSelector('#mb-setup-main', { state: 'visible' });
  const card = page.locator('#mb-provider-modal-card');
  const shown = () => page.evaluate(() => Object.fromEntries(['mb-setup-main', 'mb-setup-order', 'mb-setup-auth'].map(id => [id.slice(9), !!document.getElementById(id)?.offsetParent])));

  const main = await shown();
  check(main.main && !main.order && !main.auth, `#188: it opens on the main view (${JSON.stringify(main)})`);
  check(await page.locator('#mb-icon-size').count() && await page.locator('#mb-name-size').count(), '#188: with the icon and name size sliders');
  await attachShot(testInfo, card, 'main');
  const iconVar = await page.evaluate(() => {
    const el = document.getElementById('mb-icon-size'); el.value = '30'; el.dispatchEvent(new Event('input', { bubbles: true }));
    return getComputedStyle(document.getElementById('mb-pc-panel')).getPropertyValue('--pc-icon-size').trim();
  });
  check(iconVar === '30px', `#188: the icon-size slider sizes the panel's icons (${iconVar})`);

  await page.click('#mb-view-order');
  const order = await shown();
  const rows = await page.locator('#mb-setup-order .pc-prov-row').count();
  check(order.order && !order.main && rows > 0, `#188: "Platforms" replaces the main view (${JSON.stringify(order)}, ${rows} platforms)`);
  await attachShot(testInfo, card, 'platforms');
  await page.click('#mb-setup-order .pc-setup-back');
  check((await shown()).main, '#188: ‹ Back returns to the main view');
  await page.click('#mb-view-auth');
  const auth = await shown();
  check(auth.auth && !auth.main && await page.locator('#mb-bp-form').count(), `#188: so does "Authentication", with the Beatport login (${JSON.stringify(auth)})`);
  await attachShot(testInfo, card, 'authentication');
  await page.click('#mb-setup-auth .pc-setup-back');

  check(await page.isChecked('#mb-open-new-tab'), '#464: "Add links in a new tab" is on by default');
  await page.click('#mb-open-new-tab');
  check(await page.evaluate(() => GM_getValue('pc:open-new-tab', true)) === false, '#464: unticking it is saved');
});
