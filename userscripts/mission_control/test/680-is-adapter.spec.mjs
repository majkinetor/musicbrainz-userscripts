// #680 Mission Control ↔ ISRC Scout: per-track findings in the matrix.
// The sandbox copy of Mocky's "Music Will Explain" links Deezer and has no ISRCs,
// so IS's headless probe imports the fastest source it links and every matched track comes back new.
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
  await page.waitForFunction(() => /\b(add|ok)\b/.test(document.querySelector('#mc-root .mc-step[data-step="is"]').className), null, { timeout: 120_000 });

  // the probe reads only the release's album links and the ones selected in MC: never a Platform
  // Check find straight from its sidebar (a withheld Deezer album gave a release its ISRCs)
  const srcs = await page.evaluate(() => {
    // 7digital: one this release doesn't link
    const row = document.createElement('div');
    row.id = 'row-sevendigital'; row.className = 'pc-st-match';
    row.innerHTML = '<a id="mb-online-sevendigital" href="https://uk.7digital.com/artist/planted/release/planted-7353960"></a>';
    document.body.append(row);
    const t = window.__isTest680, out = { dialog: t.fastest().map(x => x.source), probe: t.mcSources().map(x => x.source) };
    row.remove();
    return out;
  });
  check(srcs.dialog.includes('7digital'), `the dialog still falls back to Platform Check's find (${srcs.dialog.join(', ')})`);
  check(!srcs.probe.includes('7digital'), `the MC probe does not (${srcs.probe.join(', ')})`);

  const cells = await page.locator('#mc-root .mc-tbl td[data-col="isrc"]').allTextContents();
  const added = cells.filter(c => /^\s*\+ [A-Z]{2}[A-Z0-9]{3}\d{7}/.test(c)).length;
  check(added > 0, `ISRC column shows found ISRCs (${added} of ${cells.length})`);
  const selected = await page.locator('#mc-root .mc-tbl td[data-col="isrc"] .mc-pick.on').count();
  check(selected === added, `the new ones start selected (${selected})`);

  // the inspector shows the found ISRC and its source
  await page.locator('#mc-root .mc-tbl tbody tr[data-i]').first().locator('td.ttl').click();
  // the fastest source the release links (Find everything's order): Audiomack here, before Deezer
  check(/Audiomack|Deezer|Qobuz|Apple/.test(await page.locator('#mc-root .mc-insp').textContent()), 'inspector names the source');

  await page.evaluate(() => { window.__mcTest.execute(true); });   // Dry run: the test hook only (#680)
  await page.waitForSelector('#mc-root .mc-tapplied .mc-applied', { timeout: 20_000 });
  const note = await page.locator('#mc-root .mc-tapplied').textContent();
  // #680: Find links runs in the probe too, so its selected links ride along
  const links = await page.locator('#mc-root .mc-tbl td[data-col="links"] .mc-pick.on').count();
  console.log('links selected: ' + links);
  check(new RegExp(`dry run: ${selected} ISRCs?${links ? ` and ${links} links?` : ''} would be submitted`).test(note), `dry run reports what IS would submit, without submitting ("${note}")`);
  await page.screenshot({ path: 'test-results/mc-680-is.png' });
});
