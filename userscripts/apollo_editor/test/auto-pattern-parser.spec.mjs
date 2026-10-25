// A new release with an empty tracklist opens Apollo's Pattern parser on the Tracklist
//   tab, not MB's own Add medium / Track parser dialog.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('empty new release opens the Pattern parser', async ({ page, inject }) => {
  await openApollo(page, inject, { seed: { name: 'Apollo empty tracklist' }, tab: 'tracklist' });
  await page.waitForSelector('#tc-tpppop', { timeout: 15000 });
  const nativeOpen = await page.evaluate(() => [...document.querySelectorAll('.ui-dialog')].some(d => d.offsetParent !== null));
  check(!nativeOpen, 'the native dialog stays closed');
});
