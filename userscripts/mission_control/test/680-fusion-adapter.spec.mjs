// #680 Mission Control ↔ Fusion: release-group duplicates per track, on request.
// Sandbox "Music Save Me (One More Time)" (Mocky) shares its release group with a
// second release whose recordings are different MBIDs under the same titles, so
// Fusion's auto-match groups several of this release's tracks with them.
// Fusion is in Ask mode by default: the column offers Fetch RG, nothing runs on
// Probe. Apply is a dry run only: a real one merges on the sandbox and would use
// the fixture up.
import { test, check } from '../../../dev/test/harness.mjs';

// a successful Execute would reload the page under the test (on by default since settings v2).
// The fixture's duplicates share title, artist and length, no ISRC or AcoustID: Fusion groups
// them at the normal cutoff, and its default is strict (identifiers only) since e4af01ff.
test.use({ gm: { name: 'Mission Control', values: { 'mc.settings': JSON.stringify({ v: 2, reloadAfter: false }), 'fusion.settings': JSON.stringify({ matchCutoff: 'normal' }) } } });

const RELEASE = '3d1e3d44-84c8-4746-a99c-be4486e866e7';

test('#680: Fusion runs on Fetch RG and marks the tracks with duplicates', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('fusion', { waitFor: '__fusion' });
  check(!!(await page.evaluate(() => window.__mcTest.found().fusion)), 'Fusion announced itself to MC');

  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForTimeout(500);
  check((await page.locator('#mc-root .mc-tbl td[data-col="fusion"] .mc-pill').count()) === 0, 'Ask mode: Probe leaves Fusion alone');

  await page.click('#mc-root [data-fetch="fusion"]');
  await page.waitForFunction(() => document.querySelector('#mc-root [data-fetch="fusion"]'), null, { timeout: 120_000 });   // back once the probe is done
  const hits = await page.locator('#mc-root .mc-tbl td[data-col="fusion"] .mc-fxo:not(.err)').count();
  check(hits > 0, `tracks with duplicates in the release group are marked (${hits})`);
  check(await page.locator('#mc-root .mc-tbl td[data-col="fusion"] .mc-pick.on').count() === hits, 'and start selected');

  // a badge in the row (the count, the tick) leaves the inspector closed; the row itself opens it
  const insp = page.locator('#mc-root .mc-insp');
  if (await insp.isVisible()) await page.click('#mc-root [data-close="right"]');
  const fxo = page.locator('#mc-root .mc-tbl td[data-col="fusion"] .mc-fxo').first();
  await fxo.click(); await fxo.click();   // opens the comparison and folds it again
  const row = fxo.locator('xpath=ancestor::tr');
  const tick = row.locator('td[data-col="fusion"] .mc-pick').first();
  await tick.click(); await tick.click();   // leaves it out and takes it in again
  check(!(await insp.isVisible()), 'a click on a badge leaves the inspector closed');
  await row.locator('td.ttl').click();   // the title cell: the row's middle can be a pick cell
  check(await page.locator('#mc-root .mc-insp a[href^="/recording/"]').count() >= 2, 'inspector lists the matching recordings');

  // the count opens Fusion's own group card under the row (#790): this track's recording and each match
  await page.locator('#mc-root .mc-tbl td[data-col="fusion"] .mc-fxo').first().click();
  const det = page.locator('#mc-root .mc-tbl tr.mc-fxd:not([hidden])');
  await det.waitFor();
  const card = det.locator('[data-mc-slot="fusion"] .fs-embed .fs-gcard');
  await card.waitFor();
  check(await card.locator('.fs-grow').count() >= 2, 'Fusion\'s card lists this recording and its match');
  check(await card.locator('.fs-sig span').count() === 5, 'with the five signal chips');
  check(await card.locator('.fs-sig span.hit').count() > 0, 'and at least one lit');
  check(await card.locator('.fs-star-on').count() === 1, 'the merge target is starred');
  check(await card.locator('[data-act="merge-group"], [data-act="delete-group"], [data-act="return"], [data-act="toggle-card"]').count() === 0, 'none of the board\'s own actions: MC\'s Execute merges');
  check(await page.locator('#mc-root .mc-pick.on').count() === hits, 'opening it leaves the ticks alone');

  // the ISRCs and AcoustIDs are looked up by themselves, group after group: no button, and none stays unknown
  check(await page.locator('#mc-root [data-act="fx-check"]').count() === 0, 'no Check button');
  await page.waitForFunction(() => window.__mcTest.fxChecking() === 0, null, { timeout: 120_000 });
  check(await card.locator('.fs-idunk').count() === 0, 'once checked, no ISRC or AcoustID is unknown on the card');
  check(/AcoustIDs/.test(await page.locator('#mc-root .mc-insp .mc-fxm').first().textContent()), 'the inspector lists the match\'s AcoustIDs');
  check(!/not checked/.test(await page.locator('#mc-root .mc-insp .mc-fxm').first().textContent()), 'and they are checked');
  check(await card.locator('[data-act="mc-open"] img').count() === 1 && await card.locator('[data-act="mc-open"]').getAttribute('title') !== null, 'Open in Fusion is Fusion\'s icon, with a tooltip');

  // the card is Fusion's: a new merge target is the one Execute merges into, and the card survives MC's repaints
  const other = card.locator('.fs-grow:not(.fs-target-row)').first(), gid = await other.getAttribute('data-gid');
  await other.locator('.fs-star').click();
  check(await card.locator('.fs-target-row').getAttribute('data-gid') === gid, 'a click on a star makes that recording the merge target');
  await page.locator('#mc-root .mc-tbl td[data-col="fusion"] .mc-pick.on').first().click();
  await page.locator('#mc-root .mc-tbl td[data-col="fusion"] .mc-pick:not(.on)').first().click();
  check(await card.locator('.fs-target-row').getAttribute('data-gid') === gid, 'and stays so across MC\'s repaints');
  await card.locator('[data-act="toggle-releases"]').first().click();
  await card.locator('.fs-reltbl:not(.fs-relload)').first().waitFor({ timeout: 30_000 });
  check(await card.locator('.fs-reltbl').count() === 1, 'a recording\'s releases open in the card, as on Fusion\'s board');

  // every track with a change taken in has the left bar, and the header counts the changes
  const pend = async () => +((await page.locator('#mc-root .mc-tpend').textContent()).match(/^(\d+) pending/) || [0, 0])[1];
  const ons = () => page.locator('#mc-root .mc-tbl .mc-pick.on').count();
  check(await pend() === await ons(), 'the Tracks header counts the changes taken in');
  check(await page.locator('#mc-root .mc-tbl tr.chg').count() === await page.locator('#mc-root .mc-tbl tr[data-i]:has(.mc-pick.on)').count(), 'every track with a change taken in has the bar');
  const fxPick = page.locator('#mc-root .mc-tbl td[data-col="fusion"] .mc-pick.on').first(), before = await pend();
  await fxPick.click();
  check(await pend() === before - 1, 'leaving a Fusion group out takes it off the count');
  await page.locator('#mc-root .mc-tbl td[data-col="fusion"] .mc-pick:not(.on)').first().click();
  check(await pend() === before, 'and taking it in puts it back');

  // Expand all opens every comparison, Collapse all folds them
  const all = page.locator('#mc-root .mc-fxall [data-act="fx-all"]');
  check(await all.textContent() === 'Expand all', 'the Tracks header offers Expand all');
  await all.click();
  check(await page.locator('#mc-root .mc-tbl tr.mc-fxd:not([hidden])').count() === hits, `Expand all opens all ${hits} comparisons`);
  check(await all.textContent() === 'Collapse all', 'and turns into Collapse all');
  await page.screenshot({ path: 'test-results/mc-680-fusion-all.png' });
  await all.click();
  check(await page.locator('#mc-root .mc-tbl tr.mc-fxd:not([hidden])').count() === 0, 'Collapse all folds them');
  await page.locator('#mc-root .mc-tbl td[data-col="fusion"] .mc-fxo').first().click();
  await page.screenshot({ path: 'test-results/mc-680-fusion-detail.png' });

  // Open in Fusion puts the group on Fusion's board
  const members = await card.locator('.fs-grow').count();
  await card.locator('[data-act="mc-open"]').click();
  await page.waitForSelector('#fs-overlay .fs-gcard', { timeout: 60_000 });
  check(await page.locator('#fs-overlay .fs-gcard').first().locator('.fs-grow').count() === members, 'Fusion shows the group with its ' + members + ' recordings');
  await page.screenshot({ path: 'test-results/mc-680-fusion-open.png' });
  await page.locator('#fs-overlay').evaluate(n => n.remove());

  await page.evaluate(() => { window.__mcTest.execute(true); });   // Dry run: the test hook only (#680)
  await page.waitForSelector('#mc-root .mc-tapplied .mc-applied', { timeout: 20_000 });
  check(/Fusion: dry run: \d+ merges? would be submitted/.test(await page.locator('#mc-root .mc-tapplied').textContent()), 'dry run reports the merges, without submitting');
  await page.screenshot({ path: 'test-results/mc-680-fusion.png' });
});

// A group with a pending edit on a member is never proposed (#529): Fusion's
// window drops it and leaves its recordings in the pool, the one with the edit
// badged "pending". MC does the same. Every recording reads as having a pending
// edit here (the entity lookup is rewritten), so nothing is offered for merging.
test('#680: Fusion offers no group with a pending edit, and marks the recording pending', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.route('**/ws/js/entity/**', async route => {
    const res = await route.fetch();
    const j = await res.json().catch(() => null);
    await route.fulfill({ response: res, json: j ? Object.assign(j, { editsPending: true }) : j });
  });
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('fusion', { waitFor: '__fusion' });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.click('#mc-root [data-fetch="fusion"]');
  await page.waitForFunction(() => document.querySelector('#mc-root [data-fetch="fusion"]'), null, { timeout: 120_000 });
  check(await page.locator('#mc-root .mc-tbl td[data-col="fusion"] .mc-fxo').count() === 0, 'no group is offered');
  check(await page.locator('#mc-root .mc-tbl td[data-col="fusion"] .mc-pick').count() === 0, 'nothing can be selected');
  const pend = page.locator('#mc-root .mc-tbl td[data-col="fusion"] a.mc-fxp');
  check(await pend.count() > 0, `the recordings with an open edit are marked pending (${await pend.count()})`);
  check(/\/open_edits$/.test(await pend.first().getAttribute('href')), 'and link their open edits');
  await page.screenshot({ path: 'test-results/mc-680-fusion-pending.png' });
});
