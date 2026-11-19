import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';

// Lagos Disco Inferno: every recording has a Spotify link
const REL = 'https://musicbrainz.org/release/20d82991-89d9-4143-9f7e-5989e73759e7';

test.describe('shuffle', () => {
  test.use({ profile: 'fresh', gm: { name: 'Event Horizon', persist: true, values: { view: { on: true, player: true } } }, pageErrors: ['No valid solution has been found to play this item'] });

  // shuffle plays every track once in a random order, previous walks back through it, and it is remembered
  test('shuffle plays each track once, and previous goes back the way it came', { tag: '@prod' }, async ({ page, inject }, testInfo) => {
    await page.goto(REL);
    await inject('event_horizon');
    await page.locator('button[data-playall]').click();
    const sh = page.locator('#eh-ply [data-ply="shuffle"]');
    check(await until(() => sh.count(), n => n === 1) === 1, 'the player has a shuffle button');
    check(await sh.getAttribute('aria-pressed') === 'false', 'shuffle starts off');
    await sh.click();
    check(await until(() => sh.getAttribute('aria-pressed'), v => v === 'true') === 'true', 'a click turns it on');
    await attachShot(testInfo, page.locator('#eh-ply'), 'shuffle on');
    const n = await page.evaluate(() => window.__ehPlayerTest.state().q.length);
    const seen = [await page.evaluate(() => window.__ehPlayerTest.state().i)];
    for (let k = 1; k < n; k++) {
      await page.locator('#eh-ply [data-ply="next"]').click();
      seen.push(await until(() => page.evaluate(() => window.__ehPlayerTest.state().i), i => i !== seen[seen.length - 1]));
    }
    check(new Set(seen).size === n, 'next played every track once: ' + seen.join(','));
    check(await page.locator('#eh-ply [data-ply="next"]').isDisabled(), 'with all played, next is off');
    // previous restarts a track that has played over three seconds; the test player hasn't, so it goes back
    await page.locator('#eh-ply [data-ply="prev"]').click();
    check(await until(() => page.evaluate(() => window.__ehPlayerTest.state().i), i => i === seen[n - 2]) === seen[n - 2], 'previous goes back to the track before');
    await sh.click();
    check(await until(() => sh.getAttribute('aria-pressed'), v => v === 'false') === 'false', 'a second click turns it off');
  });
});
