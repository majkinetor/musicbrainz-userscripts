// #680 Mission Control ↔ Art Station. Art Station now also loads on the release
// page, where it has no UI and only answers Mission Control. The sandbox copy of
// Mocky's "Music Will Explain" links several platforms Art Station can source
// from; the card lists them, with the Cover Art Archive's state as its summary.
// Apply opens the cover-art page seeded with the ticked links (checked here by
// its URL; the import itself runs through ROpdebee's ECAU, not in this harness).
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';

test('#680: Probe asks Art Station; Execute opens the cover-art page seeded', { tag: ['@sandbox'] }, async ({ page, inject, context }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('art_station');
  await page.waitForFunction(() => window.__mcTest.found().as);
  check(await page.locator('#as-root').count() === 0, 'no Art Station gallery on the release page');

  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="as"] .mc-summary', { timeout: 60_000 });
  check(/Cover Art Archive/.test(await page.locator('#mc-root [data-card="as"] .mc-summary').textContent()), 'card summary: the Cover Art Archive state');
  const rows = await page.locator('#mc-root [data-card="as"] .mc-line').count();
  check(rows > 0, `a row per linked platform AS can source from (${rows})`);
  check(await page.locator('#mc-root [data-card="as"] .mc-line svg').count() === rows, 'each with its platform icon');

  await page.evaluate(() => document.querySelectorAll('#mc-root .mc-pick').forEach(c => { if (c.checked) c.click(); }));
  await page.locator('#mc-root [data-card="as"] .mc-pick').first().check();
  await page.click('#mc-root [data-act="dry"]');
  await page.waitForSelector('#mc-root [data-card="as"] .mc-applied.ok');
  check(/dry run: would open Art Station/.test(await page.locator('#mc-root [data-card="as"] .mc-applied').textContent()), 'dry run says what it would open');

  const popup = context.waitForEvent('page');
  await page.click('#mc-root [data-act="exec"]');
  const tab = await popup;
  const url = new URL(tab.url() === 'about:blank' ? await tab.waitForURL(/cover-art/).then(() => tab.url()) : tab.url());
  check(url.pathname === `/release/${RELEASE}/cover-art`, 'opens this release\'s cover-art page');
  check(JSON.parse(url.searchParams.get('mc_source') || '[]').length === 1, 'seeded with the one ticked link');
  await tab.close();
  await page.screenshot({ path: 'test-results/mc-680-as.png' });

  // on the seeded cover-art page Art Station starts importing from those links
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await inject('art_station', { atStart: false });
  await page.waitForSelector('#as-root', { timeout: 30_000 });
  await page.waitForFunction(() => /[Ii]mporting from 1 source, keeping the best/.test(document.getElementById('mbu-toast')?.textContent || ''), null, { timeout: 30_000 });
  check(true, 'Art Station picks up mc_source and starts the best-cover import');
});
