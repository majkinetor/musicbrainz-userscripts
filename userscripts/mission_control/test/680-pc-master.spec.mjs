// #680 Mission Control ↔ Platform Check: the Discogs master PC finds (the master of the release's
// Discogs release) is a row with the release's own, and Execute hands it to Falcon for the
// release group, typed 90 'discogs'. Falcon's release-group run is its own tests' job (#495), so a
// stand-in Falcon records what it's handed.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = '9a82c4c4-2c14-4c8c-82eb-b65b2453edee';   // sandbox copy of "Moterys": Discogs release 3396087, of master 2684747
const RG = '20fbf608-3d2b-4bf1-a14c-5b6256c1f947';   // its release group, without the master
const MASTER = /^https:\/\/www\.discogs\.com\/master\/2684747$/;

test('#680: a found Discogs master goes to the release group', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('platform_check', { waitFor: '__pcTest680' });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="pc"] .mc-line', { timeout: 180_000 });

  const f = await page.evaluate(() => window.__pcTest680.pcMcMasterFinding());
  console.log('master finding: ' + JSON.stringify(f));
  test.skip(f && f.state === 'linked', 'the sandbox release group already has the master (someone added it): nothing to add');
  check(f && MASTER.test(f.url) && f.entity.type === 'release_group' && f.entity.mbid === RG, `PC reports the master for the release group (${JSON.stringify(f)})`);
  const row = page.locator('#mc-root [data-card="pc"] .mc-line[data-key="discogsmaster"]');
  check(await row.count() === 1, 'the master is a row');
  check(await page.locator('#mc-root [data-card="pc"] .mc-sub:not([data-sub="release"]) ~ .mc-line[data-key="discogsmaster"]').count() === 0, 'with the release\'s own rows, not under Artists or Labels');

  // only the master selected
  await page.evaluate(() => { let c, n = 0; while ((c = document.querySelector('#mc-root .mc-pick.on')) && n++ < 500) c.click(); });
  await row.locator('.mc-tick').click();
  await page.evaluate(() => {
    window.__falconGot = [];
    document.addEventListener('falcon:run', e => { window.__falconGot.push(JSON.parse(e.detail)); document.dispatchEvent(new CustomEvent('falcon:import-ok')); });
  });
  await page.click('#mc-root [data-act="exec"]');
  await page.waitForFunction(() => window.__falconGot.length === 1);
  const items = (await page.evaluate(() => window.__falconGot[0])).items;
  console.log('items: ' + JSON.stringify(items));
  check(items.length === 1 && items[0].entityType === 'release_group' && items[0].mbid === RG, `one release-group item (${JSON.stringify(items)})`);
  check(items[0] && items[0].urls.length === 1 && MASTER.test(items[0].urls[0].url) && items[0].urls[0].linkTypeId === 90, 'with the master, typed 90 discogs');
});
