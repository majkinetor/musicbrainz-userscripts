import { test, check, answerGm, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'First Contact', values: { 'fc.settings': { archive: false } } } });

test('Discogs digital country follows the setting and physical releases keep theirs', { tag: '@sandbox' }, async ({ page, context, inject }) => {
  let formats = [{ name: 'File', qty: '1' }];
  answerGm(context, ({ url }) => url.startsWith('https://api.discogs.com/releases/') ? {
    status: 200, body: JSON.stringify({ title: 'Example', country: 'UK', released: '2020', formats, artists: [], tracklist: [] }),
  } : null);
  await page.goto(SANDBOX + '/', { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  const read = () => page.evaluate(() => window.__fcTest.providers.find(p => p.id === 'discogs').fetchRelease('1'));
  check((await read()).country === 'XW', 'existing settings default digital releases to Worldwide');
  await page.evaluate(() => GM_setValue('fc.settings', { discogsWorldwide: false }));
  check((await read()).country === 'GB', 'disabling the setting keeps Discogs country');
  await page.evaluate(() => GM_setValue('fc.settings', { discogsWorldwide: true }));
  formats = [{ name: 'Vinyl', qty: '1' }];
  check((await read()).country === 'GB', 'physical release keeps Discogs country');
  formats = [{ name: 'File', qty: '1' }, { name: 'CD', qty: '1' }];
  check((await read()).country === 'GB', 'mixed release keeps Discogs country');
});
