// #680 Mission Control → Credit Hoarder: the Release credits card offers CH's import sources,
// the same choice as CH's toolbar. A click opens edit-relationships with #ch-import=<source>,
// where CH presses that source's button and the pre-flight starts at once. The sandbox copy of
// Mocky's "Music Will Explain" links Discogs, Tidal, Qobuz, Deezer and Apple. Nothing is ever written.
import { test, check, requireLogin } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';

test('#680: Release credits opens CH on a source, and its pre-flight starts', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('credit_hoarder');
  await page.waitForFunction(() => window.__mcTest.found().ch);
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root .mc-chopen a');

  // before any probe: the links come with CH's answer to discover
  const links = await page.locator('#mc-root .mc-chopen a').evaluateAll(as => as.map(a => a.getAttribute('href')));
  console.log(links.join('\n'));
  const names = links.map(h => decodeURIComponent((h.match(/^\/release\/[0-9a-f-]{36}\/edit-relationships#ch-import=(.+)$/) || [])[1] || '?'));
  check(names.length > 2 && names.at(-1) === 'All' && names.includes('Deezer') && !names.includes('?'), `one link per source, and All (${names})`);
  await page.screenshot({ path: 'test-results/mc-680-ch-open.png' });

  await page.locator('#mc-root .mc-chopen a[href$="ch-import=Deezer"]').click();
  await page.waitForURL(/edit-relationships#ch-import=Deezer$/);
  await requireLogin(page);
  await inject('credit_hoarder');
  await page.waitForSelector('.discogs-bar .discogs-src-ico[data-src="Deezer"].importing', { timeout: 40_000 });
  check(true, 'CH pressed Deezer: the import runs');
  // the same choice as CH's toolbar (Titles aside: CH offers it only after reading the titles)
  const bar = await page.locator('.discogs-bar .discogs-src-ico').evaluateAll(bs => bs.map(b => b.dataset.src).filter(n => n !== 'Titles'));
  check(JSON.stringify([...bar].sort()) === JSON.stringify([...names].sort()), `the links are the toolbar's sources (${bar})`);
  check(!/ch-import/.test(page.url()), `the hash is gone, so a reload doesn't import again (${page.url()})`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/mc-680-ch-open-ch.png' });
});
