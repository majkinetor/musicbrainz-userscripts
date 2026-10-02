// #580 (majkinetor): "Tracklist automatch runs while artist is being searched … editing its
// search query stops after a single letter and match auto completes it. So you can't for
// example create new artist with the same name as [+] never appears … (BTW, we should also
// have [+] always appear on item having a focus). Auto match should run after focus is
// lost (so stuff like split artist still auto matches)."
//
// Un-linking a matched artist wrote the credit back, MusicBrainz echoed it after Apollo's
// own-edit guard had dropped, and the watcher rebuilt the whole tracklist 400 ms later:
// a new input, no focus, the typed text gone, the slot queued for matching again.
//
// A seeded release whose artist auto-matches; MusicBrainz's search answers replayed from
// production (RECORD_WS=1), so the match is the same every run. Nothing is submitted.
import { test, check, replayWs, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('a matched slot being edited is left alone until it loses focus', { tag: ['@sandbox', '@login', '@critical', '@flaky'] }, async ({ page, inject }) => {
  const ws = await replayWs(page, new URL('./fixtures/ws-580.json.gz', import.meta.url));
  // #652: the release artist goes through every stage now, and the batched alias read for the
  // candidates holds a different set of artists from run to run; aliases only label the picker
  await page.route(/\/ws\/2\/artist\?query=arid%3A/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"count":0,"artists":[]}' }));
  const seed = { name: 'Apollo 580 fixture', 'artist_credit.names.0.name': 'Miles Davis', 'mediums.0.format': 'CD' };
  ['So What', 'Blue in Green'].forEach((t, i) => { seed[`mediums.0.track.${i}.name`] = t; seed[`mediums.0.track.${i}.artist_credit.names.0.name`] = 'Miles Davis'; });
  await page.clock.install();   // "well past the 400 ms rebuild" is run out on it, below
  const submitted = await openApollo(page, inject, { seed, tab: 'tracklist' });
  await page.waitForSelector('.tc-medsec .tc-search input.nm', { state: 'visible', timeout: 60000 });
  const matched = await page.waitForFunction(() => window.__apolloEditor.model?.tracks[0]?.slots[0].committed, null, { timeout: 120000 }).then(() => true).catch(() => false);
  check(matched, 'the slot auto-matched (the bug needs a matched slot)');
  if (!matched) return;
  await page.clock.runFor(2000);   // the match's own rebuild is due: let it land before marking the input
  await page.waitForSelector('.tc-medsec .tc-search input.nm', { state: 'visible' });
  const mkShown = () => page.evaluate(() => { const mk = document.querySelector('.tc-medsec .tc-search .mk'); return !!mk && mk.offsetParent !== null; });
  await page.evaluate(() => { document.querySelector('.tc-medsec .tc-search input.nm').dataset.fixtureMark = 'original'; });
  check(!(await mkShown()), 'settled and matched: no ＋');
  await page.locator('.tc-medsec .tc-search input.nm').first().click();
  check(await until(mkShown), 'focused: ＋ is offered (to create a same-named artist)');

  await page.keyboard.press('Control+A');
  await page.keyboard.type('M');   // one letter over the name: the reported gesture
  await page.clock.runFor(2000);   // well past the 400 ms rebuild
  const after = await page.evaluate(() => {
    const live = document.querySelector('.tc-medsec .tc-search input.nm'), s = window.__apolloEditor.model.tracks[0].slots[0];
    return { value: live && live.value, same: !!live && live.dataset.fixtureMark === 'original', focused: document.activeElement === live, committed: !!s.committed, pending: !!s._pending };
  });
  check(after.value === 'M', `the typed letter stays (${JSON.stringify(after.value)})`);
  check(after.same && after.focused, `the same field, still focused (${JSON.stringify(after)})`);
  check(!after.committed && !after.pending, `the slot is un-linked and not queued for matching (committed ${after.committed}, queued ${after.pending})`);
  check(await mkShown(), '＋ is offered for the typed name');

  await page.evaluate(() => document.activeElement.blur());
  const ran = await page.waitForFunction(() => { const live = document.querySelector('.tc-medsec .tc-search input.nm'); return !live || live.dataset.fixtureMark !== 'original'; }, null, { timeout: 30000 }).then(() => true).catch(() => false);
  check(ran, 'leaving the field lets the held-back rebuild run: deferred, not dropped');
  check(submitted.length === 0, 'nothing submitted');
  await ws.done();
});
