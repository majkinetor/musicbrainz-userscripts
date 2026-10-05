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
  const hits = await page.locator('#mc-root .mc-tbl td[data-col="fusion"] .mc-pill').count();
  check(hits > 0, `tracks with duplicates in the release group are marked (${hits})`);
  check(await page.locator('#mc-root .mc-tbl td[data-col="fusion"] .mc-pick:checked').count() === hits, 'and start ticked');

  const row = page.locator('#mc-root .mc-tbl td[data-col="fusion"] .mc-pill').first().locator('xpath=ancestor::tr');
  await row.click();
  check(await page.locator('#mc-root .mc-insp a[href^="/recording/"]').count() >= 2, 'inspector lists the matching recordings');

  await page.click('#mc-root [data-act="dry"]');
  await page.waitForSelector('#mc-root .mc-tapplied .mc-applied', { timeout: 20_000 });
  check(/Fusion: dry run: \d+ merges? would be submitted/.test(await page.locator('#mc-root .mc-tapplied').textContent()), 'dry run reports the merges, without submitting');
  await page.screenshot({ path: 'test-results/mc-680-fusion.png' });
});
