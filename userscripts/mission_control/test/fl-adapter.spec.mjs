// Mission Control ↔ Fuzzy Logic. FL answers on the release page as provider fl, Ask mode by default: the Genres card
// offers Fetch genres. The sandbox copy of Mocky's "Music Will Explain" links Deezer and Apple, which FL reads.
// The findings are the MusicBrainz genres the links gave; a dry-run apply is answered without a vote.
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';

test('Fuzzy Logic reports genres in the Genres card on Fetch genres', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('fuzzy_logic', { waitFor: '__fuzzyLogic' });
  await page.waitForFunction(() => window.__mcTest.found().fl);

  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  const fetch = page.locator('#mc-root [data-card="fl"] [data-fetch="fl"]');
  check(await fetch.count() === 1, 'Ask mode: the Genres card offers Fetch genres');
  await fetch.click();
  const r = await until(() => page.evaluate(() => window.__mcTest.results().fl), v => v && v.state === 'done', 120_000);
  check(r && r.state === 'done', 'Fuzzy Logic answered the probe');
  const findings = (r && r.findings) || [];
  console.log('fl summary: ' + (r && r.summary) + ' · ' + findings.map(x => x.key + ':' + x.state).join(', '));
  check(findings.every(x => x.key && ['new', 'linked', 'withheld', 'unsure'].includes(x.state)), 'every finding has a key and a known state');
  const fresh = findings.filter(x => x.state === 'new').map(x => x.key).sort();
  const picked = ((await page.evaluate(() => window.__mcTest.picked())).fl || []).sort();
  check(JSON.stringify(picked) === JSON.stringify(fresh), `the genres not voted yet start selected (${picked.join(', ')})`);
  if (fresh.length) check(await page.locator('#mc-root [data-card="fl"] .mc-line.new').count() === fresh.length, 'a row per new genre');

  // a dry run is answered without a vote
  if (fresh.length) {
    await page.evaluate(() => window.__mcTest.execute(true));
    const ap = await until(() => page.evaluate(() => (window.__mcTest.results().fl || {}).applied), v => !!v, 30_000);
    check(ap && ap.ok && ap.sent === 0 && /dry run/.test(ap.note || ''), `the dry run votes nothing ("${ap && ap.note}")`);
  }
  await page.screenshot({ path: 'test-results/mc-fl.png' });
});
