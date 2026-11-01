import { test, check, requireLogin } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Fusion', xhr: 'none' } });

test('pending edit override is explicit and keeps other matching guards', { tag: '@unit' }, async ({ page, context, inject }) => {
  await context.route(/musicbrainz\.org/, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><body><div id="content"></div></body>' }));
  await page.goto('https://test.musicbrainz.org/release-group/0ece1e80-fa3e-4fc8-8aec-c54003084bb3');
  await inject('fusion', { waitFor: '__fusion' });
  const result = await page.evaluate(() => {
    const F = window.__fusion;
    const mk = (id, extra = {}) => F.mkRecording(id, { title: 'Same Song', artistCredit: 'Same Artist', artistGids: [], length: 200000, isrcs: ['SHARED'], acoustids: [], video: false, releases: [{}], ...extra });
    const a = mk('a', { editsPending: true }), b = mk('b', { editsPending: false });
    return {
      ordinary: F.autoMatch([a, b], 5000, 'strict').length,
      override: F.autoMatch([a, b], 5000, 'strict', true).length,
      video: F.autoMatch([a, mk('c', { video: true })], 5000, 'strict', true).length,
      cutoff: F.autoMatch([mk('d', { editsPending: true, isrcs: [] }), mk('e', { isrcs: [] })], 5000, 'strict', true).length,
    };
  });
  check(result.ordinary === 0, 'ordinary matching rejects pending edits');
  check(result.override === 1, 'the explicit override includes them');
  check(result.video === 0, 'the video guard remains in force');
  check(result.cutoff === 0, 'the selected cutoff remains in force');
  await page.evaluate(async () => {
    const F = window.__fusion;
    F.STATE.recordings.set('a', F.mkRecording('a', { title: 'Same Song', artistCredit: 'Same Artist', length: 200000, isrcs: ['SHARED'], acoustids: [], video: false, releases: [], editsPending: true, isrcsKnown: true }));
    F.STATE.recordings.set('b', F.mkRecording('b', { title: 'Same Song', artistCredit: 'Same Artist', length: 200000, isrcs: ['SHARED'], acoustids: [], video: false, releases: [], editsPending: false, isrcsKnown: true }));
    F.STATE.poolOrder.push('a', 'b');
    F.SETTINGS.acoustidEnrich = false;
    await F.openFusion();
  });
  await page.locator('#fs-matchmore').click();
  check(await page.locator('.fs-match-menu [data-v="pending"]').count() === 1, 'the menu offers the override');
  await page.keyboard.press('Escape');
  check(await page.locator('.fs-match-menu').count() === 0, 'Escape removes the menu with the window');
  await page.evaluate(() => window.__fusion.openFusion());
  await page.locator('#fs-matchmore').click();
  await page.locator('.fs-match-menu [data-v="pending"]').dispatchEvent('mousedown');
  await page.waitForFunction(() => window.__fusion.STATE.groups.length === 1);
  const allowed = await page.evaluate(() => window.__fusion.STATE.groups[0].allowedPendingGids);
  check(allowed.length === 1 && allowed[0] === 'a', 'only the pending recording matched by this action is authorized');
});

test('Match menu closes with Fusion on the sandbox', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/release-group/0ece1e80-fa3e-4fc8-8aec-c54003084bb3');
  await requireLogin(page);
  await inject('fusion', { waitFor: '__fusion' });
  await page.evaluate(() => window.__fusion.openFusion());
  await page.locator('#fs-matchmore').click();
  check(await page.locator('.fs-match-menu [data-v="pending"]').isVisible(), 'the new option appears on MusicBrainz');
  await page.keyboard.press('Escape');
  check(await page.locator('.fs-match-menu').count() === 0, 'the menu closes with the window');
});
