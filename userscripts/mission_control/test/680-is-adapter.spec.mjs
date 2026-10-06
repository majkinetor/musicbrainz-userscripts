// #680 Mission Control ↔ ISRC Scout: per-track findings in the matrix.
// The sandbox copy of Mocky's "Music Will Explain" links Deezer and has no ISRCs,
// so IS's headless probe imports Deezer and every matched track comes back new.
// Read only: apply is exercised as a dry run (a real one submits through IS's
// OAuth, which this harness doesn't hold for the sandbox).
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';

test('#680: Probe asks ISRC Scout; the matrix shows each track\'s ISRC', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('isrc_scout', { waitFor: '__isTest680' });
  check(!!(await page.evaluate(() => window.__mcTest.found().is)), 'IS announced itself to MC');

  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForFunction(() => /\+|✓/.test(document.querySelectorAll('#mc-root .mc-bdg')[1].textContent), null, { timeout: 120_000 });

  const cells = await page.locator('#mc-root .mc-tbl td[data-col="isrc"]').allTextContents();
  const added = cells.filter(c => /^\s*\+ [A-Z]{2}[A-Z0-9]{3}\d{7}/.test(c)).length;
  check(added > 0, `ISRC column shows found ISRCs (${added} of ${cells.length})`);
  const ticked = await page.locator('#mc-root .mc-tbl td[data-col="isrc"] .mc-pick.on').count();
  check(ticked === added, `the new ones start ticked (${ticked})`);

  // the inspector shows the found ISRC and its source
  await page.locator('#mc-root .mc-tbl tbody tr[data-i]').first().locator('td.ttl').click();
  check(/Deezer/.test(await page.locator('#mc-root .mc-insp').textContent()), 'inspector names the source');

  await page.click('#mc-root [data-act="dry"]');
  await page.waitForSelector('#mc-root .mc-tapplied .mc-applied', { timeout: 20_000 });
  const note = await page.locator('#mc-root .mc-tapplied').textContent();
  // #680: Find links runs in the probe too, so its ticked links ride along
  const links = await page.locator('#mc-root .mc-tbl td[data-col="links"] .mc-pick.on').count();
  console.log('links ticked: ' + links);
  check(new RegExp(`dry run: ${ticked} ISRCs?${links ? ` and ${links} links?` : ''} would be submitted`).test(note), `dry run reports what IS would submit, without submitting ("${note}")`);
  await page.screenshot({ path: 'test-results/mc-680-is.png' });
});
