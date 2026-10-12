// #724 Mission Control: an album link taken in under Platform Check's card is not on the release
// yet, but Art Station is probed with it, as ISRC Scout is (680-is-pc-links), so its cover takes
// part before Execute adds the link. The sandbox copy of Mocky's "Music Will Explain" links no
// 7digital album; a stand-in for Platform Check offers one, withheld, and ticking it asks Art
// Station again, which lists 7digital among its sources; unticking drops it. Every store answers
// 404 (as in 680-as-adapter), so no cover is found and nothing is entered: read only.
import { test, check, until, answerGm } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' }, pageErrors: ['MB is not defined'] });

const RELEASE = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';   // sandbox copy of "Music Will Explain"
const ALBUM = 'https://uk.7digital.com/artist/mocky/release/music-will-explain-choir-music-vol-1-14412345';

test('#724: a link taken in under Platform Check is a source for Art Station', { tag: ['@sandbox'] }, async ({ page, context, inject }) => {
  answerGm(context, ({ url }) => /^https:\/\/([^/]+\.)?musicbrainz\.org\//.test(url) || /coverartarchive\.org/.test(url) ? null : { status: 404, headers: 'content-type: text/plain', body: 'not here' });
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('art_station');
  page.on('frameattached', async f => {
    await f.waitForLoadState('domcontentloaded').catch(() => {});
    if (/mc_frame=/.test(f.url())) await inject('art_station', { target: f }).catch(e => console.log('frame inject: ' + e.message));
  });
  // the stand-in PC: answers each probe with the album, withheld, and records what AS was asked
  await page.evaluate(([release, album]) => {
    window.__asAsked = [];
    const send = (type, d) => document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(d) }));
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      if (d.only.includes('as')) window.__asAsked.push(d.links);
      if (d.only.includes('pc')) setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, release, findings: [{ key: 'sevendigital', platform: 'sevendigital', name: '7digital', url: album, state: 'withheld', why: 'barcode not confirmed' }] }), 50);
    });
    send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, release, capabilities: ['probe', 'apply'] });
  }, [RELEASE, ALBUM]);
  await page.waitForFunction(() => window.__mcTest.found().as);

  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  const asDone = () => page.evaluate(() => (window.__mcTest.results().as || {}).state === 'done');
  const asSources = () => page.evaluate(() => ((window.__mcTest.results().as || {}).findings || []).map(x => x.name + (x.pending ? ' (pending)' : '')));
  await until(asDone, v => v, { timeout: 180_000 });
  const before = await asSources();
  check(before.length > 0 && !before.some(n => /7digital/.test(n)), `before: the release's own sources, no 7digital (${before.join(', ')})`);
  check(JSON.stringify(await page.evaluate(() => window.__asAsked)) === '[[]]', 'the first probe asks AS with no album links');

  await page.locator('#mc-root [data-card="pc"] .mc-pick').first().click();
  const asked = await until(() => page.evaluate(() => window.__asAsked), a => a.length === 2, { timeout: 5000 });
  check(JSON.stringify(asked[1]) === JSON.stringify([ALBUM]), `taking it in asks AS again, with the album (${JSON.stringify(asked)})`);
  await until(asDone, v => v, { timeout: 180_000 });
  const after = await asSources();
  check(after.includes('7digital (pending)'), `after: 7digital is a source, marked pending (${after.join(', ')})`);
  check(after.length === before.length + 1, `the release's own sources stay (${before.length} → ${after.length})`);
  check(await page.locator('#mc-root [data-card="as"] .mc-line', { hasText: '7digital' }).count() === 1, 'the card shows a 7digital row');

  await page.locator('#mc-root [data-card="pc"] .mc-pick').first().click();
  const again = await until(() => page.evaluate(() => window.__asAsked), a => a.length === 3, { timeout: 5000 });
  check(JSON.stringify(again[2]) === '[]', `leaving it out asks AS again, without it (${JSON.stringify(again)})`);
  await until(asDone, v => v, { timeout: 180_000 });
  const gone = await asSources();
  check(!gone.some(n => /7digital/.test(n)), `after leaving it out: no 7digital (${gone.join(', ')})`);
  await page.screenshot({ path: 'test-results/mc-724-as-pc-links.png' });
});
