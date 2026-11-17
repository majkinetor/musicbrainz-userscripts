import { test, check, until, attachShot, answerGm } from '../../../dev/test/harness.mjs';

// Lagos Disco Inferno: every recording has a Spotify link
const REL = 'https://musicbrainz.org/release/20d82991-89d9-4143-9f7e-5989e73759e7';

test.describe('bar', () => {
  test.use({ profile: 'fresh', gm: { name: 'Event Horizon', persist: true, values: { view: { on: true, player: true, playerScrobble: true }, lbToken: 'tok' } } });

  // a track's play button starts the player at the bottom; the listen goes to ListenBrainz as playing_now
  test('a track plays in the bottom bar, and ListenBrainz hears it is playing', { tag: '@prod' }, async ({ page, context, inject }, testInfo) => {
    const sent = [];
    await answerGm(context, o => /api\.listenbrainz\.org/.test(o.url) ? (sent.push(o), { status: 200, body: '{"status":"ok"}' }) : null);
    await page.goto(REL);
    await inject('event_horizon');
    const row = page.locator('.tr[data-row]').first();
    await row.waitFor();
    check(await page.locator('button[data-playall]').count() === 1, 'the release has a Play button');
    await row.hover();
    const b = row.locator('button.trp');
    check(await b.isVisible(), 'the row shows its play button on hover');
    await b.click();
    check(await until(() => page.locator('#eh-ply.ply-bar').count(), n => n === 1) === 1, 'the player shows as the bottom bar');
    check(await until(() => page.locator('.tr.ply-on').count(), n => n === 1) === 1, 'the playing row is marked');
    check(await page.locator('#eh-ply .ply-ctl.pa').count() === 1, 'the bar has its controls');
    check(await page.locator('#eh-ply [data-ply="prev"]').isEnabled(), 'the first track can be restarted');
    await page.locator('#eh-ply [data-ply="list"]').click();
    check(await until(() => page.locator('#eh-ply-menu .qi').count(), n => n > 1) > 1, 'the title opens the playlist');
    check(await page.locator('#eh-ply-menu .qi[aria-current]').count() === 1, 'the playing track is marked in it');
    await page.locator('#eh-ply [data-ply="lb"]').click();
    check(await until(() => page.locator('#eh-ply-menu a[href*="listenbrainz.org/track/"]').count(), n => n >= 1) >= 1, 'the ListenBrainz menu links the track');
    const now = await until(() => sent.find(o => /submit-listens/.test(o.url)), v => !!v);
    const body = now ? JSON.parse(now.data) : {};
    check(body.listen_type === 'playing_now' && /^Token tok$/.test((now.headers || {}).Authorization || ''), 'playing_now goes to ListenBrainz with the token');
    check(body.payload?.[0]?.track_metadata?.additional_info?.music_service === 'spotify.com', 'the listen names Spotify');
    await attachShot(testInfo, page, 'bar');
  });
});

test.describe('chip', () => {
  test.use({ profile: 'fresh', gm: { name: 'Event Horizon', persist: true, values: { view: { on: true, player: true, playerPlace: 'chip', playerLb: false } } }, pageErrors: ['No valid solution has been found to play this item'] });

  test('the player shows as a header chip, without ListenBrainz links when they are off', { tag: '@prod' }, async ({ page, inject }, testInfo) => {
    await page.goto(REL);
    await inject('event_horizon');
    await page.locator('button[data-playall]').click();
    check(await until(() => page.locator('#eh-ply.ply-chip').count(), n => n === 1) === 1, 'the player shows as a chip');
    check(!(await page.evaluate(() => document.documentElement.classList.contains('eh-ply-bar'))), 'no room is kept for a bar');
    check(await until(() => page.locator('#eh-pin .ply-ctl.pb').count(), n => n === 1) === 1, 'the controls sit in the header');
    await page.locator('.ply-ctl [data-ply="lb"]').click();
    check(await until(() => page.locator('#eh-ply-menu').count(), n => n === 1) === 1, 'the source menu opens');
    check(await page.locator('#eh-ply-menu a[href*="listenbrainz.org"]').count() === 0, 'no ListenBrainz links');
    await attachShot(testInfo, page, 'chip');
  });
});

test.describe('settings', () => {
  test.use({ profile: 'fresh', gm: { name: 'Event Horizon', persist: true, values: { view: { on: true, player: true } } } });

  test('the settings have a Player tab', { tag: '@prod' }, async ({ page, inject }, testInfo) => {
    await page.goto(REL);
    await inject('event_horizon');
    await page.locator('.tr[data-row]').first().waitFor();
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: 'event_horizon', cancelable: true })));
    const cfg = page.locator('#eh-cfg');
    await cfg.waitFor();
    await cfg.locator('[data-tab="player"]').click();
    check(await cfg.locator('[data-g="player"]').count() === 1, 'the player can be enabled');
    check(await cfg.locator('[data-lbtok]').count() === 1, 'a ListenBrainz token field');
    const pc = cfg.locator('[data-g="playerPlace"][data-k="chip"]');
    await pc.click();
    check(await until(() => cfg.locator('[data-g="playerPlace"][data-k="chip"]').getAttribute('aria-pressed'), v => v === 'true') === 'true', 'Top bar is chosen');
    await attachShot(testInfo, cfg, 'settings');
  });
});
