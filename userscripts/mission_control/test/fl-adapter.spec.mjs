// Mission Control ↔ Fuzzy Logic. FL answers on the release page as provider fl, Auto mode by default: the probe on
// open collects the genres. The sandbox copy of Mocky's "Music Will Explain" links Deezer and Apple, which FL reads.
// The findings are the MusicBrainz genres the links gave; a dry-run apply is answered without a vote.
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';

test('Fuzzy Logic reports genres in the Genres card on the probe', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('fuzzy_logic', { waitFor: '__fuzzyLogic' });
  await page.waitForFunction(() => window.__mcTest.found().fl);

  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  check(await page.locator('#mc-root .mc-ttl a[href*="/release/"]').count() === 1, 'the header title links the release');
  check(await page.locator('#mc-root .mc-art a[href*="/artist/"]').count() >= 1, 'the header artist links the artist');
  // the release folds into its format icon when the steps need the room; hover shows it as a card
  await page.setViewportSize({ width: 1000, height: 900 });
  const folded = await until(() => page.evaluate(() => document.querySelector('#mc-root .mc-hdr').classList.contains('mc-fold')), v => v, 5_000);
  check(folded, 'at 1000 px the release folds into its format icon');
  await page.hover('#mc-root .mc-hdr .mc-fmt');
  check(await page.locator('#mc-root .mc-relcard a[href*="/release/"]').isVisible(), 'hovering the icon shows the release card with its link');
  await page.screenshot({ path: 'test-results/mc-fold.png', clip: { x: 0, y: 0, width: 1000, height: 200 } });
  await page.setViewportSize({ width: 2200, height: 900 });
  check(await until(() => page.evaluate(() => !document.querySelector('#mc-root .mc-hdr').classList.contains('mc-fold')), v => v, 5_000), 'a wide window shows the release in full');
  await page.setViewportSize({ width: 1600, height: 1000 });
  check(await page.locator('#mc-root [data-card="fl"] [data-fetch="fl"]').count() === 0, 'Auto mode: no Fetch genres button');
  const r = await until(() => page.evaluate(() => window.__mcTest.results().fl), v => v && v.state === 'done', 120_000);
  check(r && r.state === 'done', 'Fuzzy Logic answered the probe');
  const findings = (r && r.findings) || [];
  console.log('fl summary: ' + (r && r.summary) + ' · ' + findings.map(x => x.key + ':' + x.state).join(', '));
  check(findings.every(x => x.key && ['new', 'linked', 'withheld', 'unsure'].includes(x.state)), 'every finding has a key and a known state');
  const fresh = findings.filter(x => x.state === 'new').map(x => x.key).sort();
  const picked = ((await page.evaluate(() => window.__mcTest.picked())).fl || []).sort();
  check(JSON.stringify(picked) === JSON.stringify(fresh), `the genres not voted yet start selected (${picked.join(', ')})`);
  if (fresh.length) check(await page.locator('#mc-root [data-card="fl"] .mc-line.new').count() === fresh.length, 'a row per new genre');
  if (fresh.length) check(await page.locator('#mc-root [data-card="fl"] .mc-line.new .mc-srcs svg').count() >= fresh.length, 'each genre shows its sources as icons');

  // a dry run is answered without a vote
  if (fresh.length) {
    await page.evaluate(() => window.__mcTest.execute(true));
    const ap = await until(() => page.evaluate(() => (window.__mcTest.results().fl || {}).applied), v => !!v, 30_000);
    check(ap && ap.ok && ap.sent === 0 && /dry run/.test(ap.note || ''), `the dry run votes nothing ("${ap && ap.note}")`);
  }
  await page.screenshot({ path: 'test-results/mc-fl.png' });
});
