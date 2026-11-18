import { test, check, until, requireLogin, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// another editor's collection the sandbox account is subscribed to; the test leaves it subscribed
const COL = 'e8e33266-ead5-4b09-9005-36c674684e97';

test('a collection\'s subscribers show in place, and subscribing changes without leaving the page', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  const mb = 'https://test.musicbrainz.org';
  await page.goto(mb);
  await requireLogin(page);
  // start subscribed, whatever an earlier failed run left
  await page.request.get(`${mb}/account/subscriptions/collection/add?id=${await page.evaluate(async u => (await (await fetch(u)).text()).match(/subscriptions\/collection\/(?:add|remove)\?id=(\d+)/)[1], `${mb}/collection/${COL}`)}`);
  await page.goto(`${mb}/collection/${COL}/subscribers`);
  await inject('event_horizon');
  check(await until(() => page.locator('.hero h1').count(), n => n > 0) > 0, 'the subscribers page has the collection hero');
  check(await until(() => page.locator('#s-cs .cs-u').count(), n => n > 0) > 0, 'the subscribers are listed');
  check(await page.locator('#s-cs .cs-u', { hasText: 'majkinetor' }).count() === 1, 'the sandbox account is among them');
  check(/Subscribers/.test(await page.title()), 'the title says Subscribers: ' + await page.title());
  await attachShot(testInfo, page, 'subscribers');
  await page.evaluate(() => { window.__noReload = 1; });
  const un = page.locator('#s-cs a[href*="/subscriptions/collection/remove"]');
  check(await un.count() === 1, 'the page offers Unsubscribe');
  await un.click();
  check(await until(() => page.locator('#s-cs a[href*="/subscriptions/collection/add"]').count(), n => n > 0) > 0, 'after Unsubscribe the page offers Subscribe');
  check(await page.locator('#s-cs .cs-u', { hasText: 'majkinetor' }).count() === 0, 'the sandbox account left the list');
  check(await page.evaluate(() => window.__noReload) === 1, 'the page did not reload');
  // the collection's own page: its hero's Subscribe changes in place too
  await page.goto(`${mb}/collection/${COL}`);
  await inject('event_horizon');
  const add = page.locator('.col-nav a[href*="/subscriptions/collection/add"]');
  check(await until(() => add.count(), n => n > 0) > 0, 'the collection hero offers Subscribe');
  await page.evaluate(() => { window.__noReload = 1; });
  await add.click();
  check(await until(() => page.locator('.col-nav a[href*="/subscriptions/collection/remove"]').count(), n => n > 0) > 0, 'after Subscribe the hero offers Unsubscribe');
  check(await page.evaluate(() => window.__noReload) === 1, 'the collection page did not reload');
  // its Subscribers link opens the page inside EH
  await page.locator('.col-nav a[href$="/subscribers"]').click();
  check(await until(() => page.locator('#s-cs .cs-u', { hasText: 'majkinetor' }).count(), n => n > 0) === 1, 'the subscribers page opens in place and lists the account again');
  check(await page.evaluate(() => window.__noReload) === 1, 'it opened without a reload');
});
