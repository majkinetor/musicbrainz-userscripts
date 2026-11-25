import { test, check, until } from '../../../dev/test/harness.mjs';

const REL = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';
test.use({ gm: { name: 'Event Horizon', values: { view: { on: true } } } });

test('a matching refresh request reloads the release without replacing the player', { tag: ['@sandbox', '@flaky'] }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/release/' + REL);
  await inject('event_horizon');
  await page.locator('#app .tr').first().waitFor();
  let reads = 0;
  page.on('request', r => { if (r.url().includes('/ws/2/release/' + REL)) reads++; });
  const result = await page.evaluate(id => {
    const f = document.createElement('iframe'); f.id = 'refresh-test-player'; document.documentElement.append(f);
    document.addEventListener('mbu-release-refreshed', e => { window.__refreshedRelease = e.detail; });
    const ask = release => document.dispatchEvent(new CustomEvent('mbu-refresh-release', { detail: { release }, cancelable: true }));
    return { other: ask('00000000-0000-0000-0000-000000000000'), matching: ask(id) };
  }, REL);
  check(result.other && !result.matching, 'only the displayed release is accepted');
  // the redraw waits its turn at the gate like any read: on CI's busy sandbox that took past 20s
  await page.waitForFunction(id => window.__refreshedRelease === id, REL, { timeout: 90000 });
  check(reads > 0, 'the release is fetched again');
  check(await page.locator('#refresh-test-player').count() === 1, 'the player iframe remains attached');
});
