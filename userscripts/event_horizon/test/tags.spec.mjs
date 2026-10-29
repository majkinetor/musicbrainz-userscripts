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
  await page.click('[data-tgf="open"]');
  await page.fill('#tg-q', 'cool');
  check(await until(() => page.locator('#tg-body .tg-t tbody tr').count(), n => n === 1) === 1, 'the filter keeps cool jazz');
  await page.click('[data-tgset="view:chips"]');
});

test('an editor\'s tags open in place', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/user/majkinetor/tags');
  await inject('event_horizon');
  check(/Tags/.test(await until(() => page.locator('.u-nav .u-nt.on').textContent().catch(() => ''), t => /Tags/.test(t))), 'the tags page shows');
  check(await until(() => page.locator('#tg-body').textContent(), t => !/Loading/.test(t)).then(t => !/Loading/.test(t)), 'the tags load');
  await attachShot(testInfo, page, 'editor');
});

test('tags are added as tokens: Enter takes a suggestion, a comma ends one, Ctrl+Enter sends', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/artist/${AR}/tags`);
  await inject('event_horizon');
  await until(() => page.locator('#tg-body .tg-chip').count(), n => n >= 5);
  // the sandbox as it was: neither tag upvoted (a chip's votes show on hover)
  const unvote = async () => { for (const n of ['eh test tag', 'boogie-woogie']) {
    const chip = page.locator('#tg-body .tg-chip', { has: page.locator('a', { hasText: new RegExp('^' + n + '$') }) }), up = chip.locator('.tg-up.on');
    if (await up.count()) { await chip.hover(); await up.click(); await page.waitForTimeout(1500); }
  } };
  await unvote();
  await page.click('[data-tgnew="open"]');
  await page.locator('#tg-new').pressSequentially('boogie-wo');
  check(/boogie-woogie/.test(await until(() => page.locator('.tg-ac').textContent(), t => /boogie/.test(t))), 'the genres are suggested');
  await page.keyboard.press('Enter');
  await page.locator('#tg-new').pressSequentially('eh test tag,');
  check(await page.locator('.tg-tk').count() === 2, 'Enter and the comma each made a token');
  await attachShot(testInfo, page, 'tokens');
  await page.keyboard.press('Control+Enter');
  check(await until(() => page.locator('#tg-body .tg-chip.tg-mine a', { hasText: /^eh test tag$/ }).count(), n => n === 1) === 1, 'the tags are added');
  await unvote();
});

test('an editor\'s ratings open in place: a card per type, in every view, with the stars to filter by', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto('https://test.musicbrainz.org/user/majkinetor/ratings');
  await inject('event_horizon');
  check(/Ratings/.test(await until(() => page.locator('.u-nav .u-nt.on').textContent().catch(() => ''), t => /Ratings/.test(t))), 'the ratings page shows');
  check(!/Loading/.test(await until(() => page.locator('.u-pbar .u-sub').textContent(), t => !/Loading/.test(t))), 'the ratings load');
  await attachShot(testInfo, page, 'row');
  for (const v of ['grid', 'table']) { await page.click(`[data-rtview="${v}"]`); await attachShot(testInfo, page, v); }
  await page.click('[data-rtview="row"]');
  check(await page.locator('.rt-l li').count() >= 1, 'the rows list the ratings');
  // your own ratings: a star rates from here, and MusicBrainz keeps it
  const li = page.locator('.rt-l li').first(), name = await li.locator('span > a').first().textContent(), b = li.locator('[data-rtrate]');
  const was = await li.locator('.st.on').count(), to = was === 5 ? 4 : was + 1;
  await b.nth(to - 1).click();
  await until(() => page.locator('#toast').textContent().catch(() => ''), t => /Rated/.test(t));
  await page.reload(); await inject('event_horizon');
  const row = () => page.locator('.rt-l li').filter({ has: page.locator('span > a', { hasText: name }) }).first();
  check(await until(() => row().locator('.st.on').count(), n => n === to) === to, 'the new rating holds after a reload');
  await row().locator('[data-rtrate]').nth(was - 1).click();
  await until(() => page.locator('#toast').textContent().catch(() => ''), t => /Rated/.test(t));
});

test('the header\'s pencil edits the tags in place: add, withdraw, done', { tag: '@sandbox' }, async ({ page, inject }, testInfo) => {
  await page.goto(`https://test.musicbrainz.org/artist/${AR}`);
  await inject('event_horizon');
  await until(() => page.locator('button.eh-edit[data-tgin="open"]').count(), n => n > 0);
  check(await page.locator('.tgi button').count() === 0, 'no × or ▲ out of edit mode');
  await page.click('button.eh-edit[data-tgin="open"]');
  const i = page.locator('.tgi-in');
  await i.waitFor();
  check(await until(() => page.locator('.tgi').count(), n => n >= 5) >= 5, 'every tag shows');   // the editor opens at once; the tags come after
  await i.fill('eh inline test');
  await i.press('Enter');
  const mine = page.locator('.tgi.mine', { hasText: 'eh inline test' });
  check(await until(() => mine.count(), n => n === 1) === 1, 'the new tag shows as yours');
  await attachShot(testInfo, page, 'editing');
  await mine.locator('button').click();
  check(await until(() => mine.count(), n => n === 0) === 0, 'withdrawn');
  await page.click('button[data-tgin="close"]');
  check(await until(() => page.locator('.tgi-in').count(), n => n === 0) === 0, 'Done closes the editor');
});
