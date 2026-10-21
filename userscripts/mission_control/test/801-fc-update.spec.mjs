// #801: First Contact found an album on a platform in MusicBrainz, and its Update this release opened the release
// (/release/<mbid>#fc-update=<token>). Mission Control opens, probes, and compares the release with the platforms,
// that album taken in as First Contact read it, though Platform Check found nothing (the case: a release with
// neither the album's link nor its barcode). A stand-in First Contact publishes the update.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = '9d290316-dcd3-4d7e-a62b-392ab2396f27';   // "Rushing Pictures": no barcode, no platform links
const PRESTO = 'https://www.prestomusic.com/classical/products/801801';

test('#801: an update from First Contact compares the release with the album it read', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/release/${RELEASE}#fc-update=t801`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  const n = await page.locator('#content table.medium tbody tr:has(td.pos)').count();
  const title = (await page.locator('.releaseheader h1 bdi').first().textContent()).trim();
  // stand-ins: First Contact (the update, and a reader), and a Platform Check that finds nothing
  await page.evaluate(({ release, url, n, title }) => {
    const send = (type, d) => document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(d) }));
    const rel = { url, title, barcode: '4006381333931', credit: [{ name: 'X', join: '' }], types: ['Album'], labels: [{ name: 'Artoffact Records', catno: 'AOF 801' }], date: { year: 2008, month: 8, day: 29 }, country: 'XW', urls: [{ url, linkType: 74 }],
      mediums: [{ format: 'Digital Media', tracks: Array.from({ length: n }, (v, i) => ({ title: 'T' + i, lengthMs: 200000 + i, credit: [] })) }] };
    document.documentElement.dataset.fcUpdate = JSON.stringify({ v: 1, token: 't801', created: Date.now(), mbid: release, source: 'presto', sourceName: 'Presto Music', platform: { id: 'presto', name: 'Presto Music', abbr: 'pr' }, url, rel });
    document.addEventListener('mc:probe', e => { const d = JSON.parse(e.detail); if (d.only.includes('pc')) setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, release, findings: [] }), 50); });
    document.addEventListener('mc:discover', () => {
      send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, release, capabilities: ['probe', 'apply'] });
      send('mc:provider', { id: 'fc', name: 'First Contact', version: 1, capabilities: ['read'] });
    });
    window.__mcReads = [];
    document.addEventListener('mc:read', e => window.__mcReads.push(JSON.parse(e.detail).url));
  }, { release: RELEASE, url: PRESTO, n, title });
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.waitForSelector('#mc-root', { timeout: 10_000 });
  check(await page.evaluate(() => location.hash === ''), 'the token leaves the address');
  const after = await page.evaluate(() => window.__mcTest.after());
  check(after && after.compare && after.source && after.source.key === 'presto' && after.source.url === PRESTO, `the update is noted with its album (${JSON.stringify(after && after.source && { key: after.source.key, url: after.source.url })})`);
  const fc = await until(() => page.evaluate(() => window.__mcTest.results().fc), r => r && r.state === 'done', { timeout: 30_000 });
  check(fc && /1 platform read/.test(fc.summary), `the release is compared with the album, though Platform Check found nothing (${fc && fc.summary})`);
  const cmp = await page.evaluate(() => window.__mcTest.cmp());
  check(cmp.sources.length === 1 && cmp.sources[0].key === 'presto' && cmp.sources[0].take && cmp.sources[0].read === 'done', `the album is the comparison's source, read already (${JSON.stringify(cmp.sources)})`);
  check(await page.evaluate(() => window.__mcReads.length === 0), 'nothing is read again');
  check(cmp.cons && cmp.cons.barcode === '4006381333931' && cmp.cons.urls.some(u => u.url === PRESTO), `its barcode and link are offered (${JSON.stringify(cmp.cons && { barcode: cmp.cons.barcode, urls: cmp.cons.urls })})`);
});

test('#801: an update for another release is dropped', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/release/${RELEASE}#fc-update=t802`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { document.documentElement.dataset.fcUpdate = JSON.stringify({ token: 't802', created: Date.now(), mbid: '00000000-0000-0000-0000-000000000801', platform: { id: 'deezer' }, url: 'https://www.deezer.com/album/1', rel: { title: 'x', mediums: [] } }); });
  await inject('mission_control', { waitFor: '__mcTest' });
  await until(() => page.evaluate(() => location.hash), h => h === '');
  check(!(await page.locator('#mc-root').count()), 'Mission Control stays shut');
});
