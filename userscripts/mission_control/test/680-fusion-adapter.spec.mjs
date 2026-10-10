// #680 Mission Control ↔ Fusion: release-group duplicates per track, on request.
// Sandbox "Music Save Me (One More Time)" (Mocky) shares its release group with a
// second release whose recordings are different MBIDs under the same titles, so
// Fusion's auto-match groups several of this release's tracks with them.
// Fusion is in Ask mode by default: the column offers Fetch RG, nothing runs on
// Probe. Apply is a dry run only: a real one merges on the sandbox and would use
// the fixture up.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

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

  const row = page.locator('#mc-root .mc-tbl td[data-col="fusion"] .mc-fxo').first().locator('xpath=ancestor::tr');
  await row.locator('td.ttl').click();   // the title cell: the row's middle can be a pick cell
  check(await page.locator('#mc-root .mc-insp a[href^="/recording/"]').count() >= 2, 'inspector lists the matching recordings');

  // the count opens Fusion's comparison under the row: this track's recording and each match
  await page.locator('#mc-root .mc-tbl td[data-col="fusion"] .mc-fxo').first().click();
  const det = page.locator('#mc-root .mc-tbl tr.mc-fxd:not([hidden])');
  await det.waitFor();
  check(await det.locator('.mc-fxtbl tbody tr').count() >= 2, 'the comparison lists this recording and its match');
  check(await det.locator('.mc-fxtbl .who').first().textContent() === 'this', 'this release\'s recording comes first');
  check(await det.locator('.mc-fxc').count() === 5, 'with the five signal chips');
  check(await det.locator('.mc-fxc.on').count() > 0, 'and at least one lit');
  check(await page.locator('#mc-root .mc-pick.on').count() === hits, 'opening it leaves the ticks alone');

  // the ISRCs and AcoustIDs are looked up by themselves, group after group: no button, and no chip stays unknown
  check(await page.locator('#mc-root [data-act="fx-check"]').count() === 0, 'no Check button');
  await page.waitForFunction(() => window.__mcTest.fxChecking() === 0, null, { timeout: 120_000 });
  check(await det.locator('.mc-fxc.unk').count() === 0, 'once checked, no chip is unknown');
  check(/AcoustIDs/.test(await page.locator('#mc-root .mc-insp .mc-fxm').first().textContent()), 'the inspector lists the match\'s AcoustIDs');
  check(!/not checked/.test(await page.locator('#mc-root .mc-insp .mc-fxm').first().textContent()), 'and they are checked');
  check(await det.locator('[data-act="fx-fusion"] img').count() === 1 && await det.locator('[data-act="fx-fusion"]').getAttribute('title') !== null, 'Open in Fusion is Fusion\'s icon, with a tooltip');

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
  const members = await det.locator('.mc-fxtbl tbody tr').count();
  await det.locator('[data-act="fx-fusion"]').click();
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
