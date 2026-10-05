// #680 Mission Control ↔ Credit Hoarder (info only). CH now also loads on the
// release page, where it has no UI and only answers Mission Control. Ask mode by
// default: the Credits column offers Fetch credits. The sandbox copy of Mocky's
// "Music Will Explain" links Qobuz, Deezer and Apple; CH reads the first of them
// and reports a credit count per track. Nothing is ever written.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';

test('#680: Credit Hoarder reports credits per track on Fetch credits', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('credit_hoarder');
  await page.waitForFunction(() => window.__mcTest.found().ch);
  check(await page.locator('.discogs-bar').count() === 0, 'no Credit Hoarder bar on the release page');

  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  check(await page.locator('#mc-root [data-fetch="ch"]').count() === 1, 'Ask mode: the Credits column offers Fetch credits');
  await page.click('#mc-root [data-fetch="ch"]');
  await page.waitForFunction(() => document.querySelector('#mc-root [data-fetch="ch"]'), null, { timeout: 120_000 });

  const meta = await page.locator('#mc-root .mc-stage[data-p="ch"] .meta').textContent();
  check(/(Qobuz|Deezer|Apple|Discogs): \d+ credits? on \d+ of 12 tracks|No credit source linked/.test(meta), `the step says what CH read ("${meta}")`);
  const total = Number(((await page.locator('#mc-root .mc-bdg').nth(4).textContent()).match(/\d+/) || [0])[0]);
  const cells = (await page.locator('#mc-root .mc-tbl td[data-col="ch"]').allTextContents()).map(t => Number(t.trim()) || 0);
  check(cells.reduce((a, b) => a + b, 0) === total, `the badge total matches the column (${total})`);
  check(await page.locator('#mc-root .mc-tbl td[data-col="ch"] .mc-pick').count() === 0, 'info only: nothing to tick');
  if (total) {
    const i = cells.findIndex(n => n > 0);
    await page.locator('#mc-root .mc-tbl tbody tr[data-i]').nth(i).click();
    check(await page.locator('#mc-root .mc-insp .mc-mini').count() >= cells[i], 'inspector lists the credits');
  }
  await page.screenshot({ path: 'test-results/mc-680-ch.png' });
});
