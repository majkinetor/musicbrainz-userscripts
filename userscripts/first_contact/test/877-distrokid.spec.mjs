import { test, check, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', gm: { name: 'First Contact' } });

test('a DistroKid placeholder is finished and seeded as no label', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(SANDBOX + '/', { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  const params = await page.evaluate(() => {
    const rel = { title: 'Example', credit: [{ name: 'Artist', join: '' }], types: [], labels: [{ name: '123456 Records DK2' }], mediums: [{ tracks: [{ title: 'Song', credit: [{ name: 'Artist', join: '' }] }] }], urls: [] };
    window.__fcTest.finishRelease(rel, { name: 'Example' });
    return Object.fromEntries(window.__fcTest.seedParams(rel, ''));
  });
  check(params['labels.0.mbid'] === '157afde4-4bf5-4039-8ad2-5a15acc85176', 'the seed selects [no label]');
  check(params['labels.0.name'] === '[no label]', 'the placeholder is not seeded as a label');
});
