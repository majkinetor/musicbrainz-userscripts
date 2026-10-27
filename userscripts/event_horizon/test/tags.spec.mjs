import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// Miles Davis on the sandbox: genres (jazz, cool jazz…) and other tags (trumpeter)
const AR = '561d854a-6a28-4aa7-8c99-323e6ce46c2a';

test('an entity\'s tags show in every view, genres apart, with the filter', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/artist/${AR}/tags`);
  await inject('event_horizon');
  const chips = await until(() => page.locator('#tg-body .tg-chip').count(), n => n >= 5);
  check(chips >= 5, 'the tags show as chips: ' + chips);
  check(await page.locator('#tg-body .tg-chip.tg-gc a', { hasText: /^jazz$/ }).count() === 1, 'jazz shows as a genre');
  await attachShot(testInfo, page, 'chips');
  for (const [v, sel] of [['bars', '.tg-row'], ['cloud', '.tg-cloud a'], ['az', '.tg-az span'], ['table', '.tg-t tbody tr']]) {
    await page.click(`[data-tgset="view:${v}"]`);
    check(await until(() => page.locator('#tg-body ' + sel).count(), n => n >= 5) >= 5, 'the ' + v + ' view lists the tags');
    await attachShot(testInfo, page, v);
  }
  await page.click('[data-tgset="sc:o"]');
  check(await until(() => page.locator('#tg-body a.tg-g').count(), n => n === 0) === 0, 'Other leaves the genres out');
  await page.click('[data-tgset="sc:a"]');
  await page.fill('#tg-q', 'cool');
  check(await until(() => page.locator('#tg-body .tg-t tbody tr').count(), n => n === 1) === 1, 'the filter keeps cool jazz');
  await page.click('[data-tgset="view:chips"]');
});

test('an editor\'s tags open in place', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/user/majkinetor/tags');
  await inject('event_horizon');
  check(/Tags/.test(await until(() => page.locator('.u-hero .kicker').textContent().catch(() => ''), t => /Tags/.test(t))), 'the tags page shows');
  check(await until(() => page.locator('#tg-body').textContent(), t => !/Loading/.test(t)).then(t => !/Loading/.test(t)), 'the tags load');
  await attachShot(testInfo, page, 'editor');
});
