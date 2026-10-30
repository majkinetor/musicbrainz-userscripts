import { test, check, until } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

test('the dock mirrors the editor pending count as inputs change', { tag: '@sandbox' }, async ({ page, inject }) => {
  await openScout(page, inject, { edit: release => {
    for (const medium of release.media || []) for (const track of medium.tracks || []) track.recording.isrcs = [];
  } });
  const inputs = page.locator('#ii-tbody tr[data-idx] .ii-input');
  await inputs.nth(0).fill('USAAA2000001');
  await inputs.nth(1).fill('USAAA2000002');
  const status = () => page.locator('#ii-dock').getAttribute('data-mb-corner-status');
  check(await until(status, value => value === '2') === '2', 'dock shows the same two pending ISRCs as Submit');
  check((await page.locator('#ii-submit').textContent()).includes('2 ISRCs'), 'the editor counts two pending ISRCs');
  await inputs.nth(0).fill('');
  check(await until(status, value => value === '1') === '1', 'clearing one input updates the dock');
});
