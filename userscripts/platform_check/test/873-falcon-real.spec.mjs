import { test, check, until, answerGm, pristine, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Platform Check', values: { 'pc:respect-barcode': false, 'pc:respect-format': false } } });

test('a real Falcon edit invalidates the PC count after it completes', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {
  test.setTimeout(240000);
  const { mbid } = await pristine(page, 'release');
  answerGm(context, ({ url }) => /musicbrainz\.org/.test(url) ? null : { status: 404, body: '' });
  await page.goto(`${SANDBOX}/release/${mbid}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#sidebar');
  await inject('platform_check', { waitFor: '__pcTest680' });
  await inject('falcon', { waitFor: '__falconTest' });
  await page.evaluate(() => window.__pcTest680.scanDone());
  const url = `https://www.discogs.com/release/8${Date.now()}`;
  const finding = await page.evaluate(({ mbid, url }) => {
    const t = window.__pcTest680;
    t.cacheSet(mbid, 'discogs', { url, tracks: 1, format: 'Digital Media', source: 'search', credits: null });
    t.updateRow('discogs', { url, mbTracks: 1, remoteTracks: 1, format: 'Digital Media', source: 'search' });
    return t.pcMcFinding('discogs');
  }, { mbid, url });
  check(finding.url === url && finding.state !== 'linked' && finding.state !== 'none', 'PC can hand the new link to Falcon');
  await page.evaluate(({ mbid }) => document.dispatchEvent(new CustomEvent('mc:apply', { detail: JSON.stringify({ id: 'pc', release: mbid, run: 'test873', keys: ['discogs'], dry: false }) })), { mbid });
  await page.waitForFunction(() => {
    const q = window.__falconTest.getQueue();
    return q.length && q.every(item => !['queued', 'active'].includes(item.status));
  }, null, { timeout: 120000 });
  const outcome = await page.evaluate(() => window.__falconTest.getQueue());
  check(outcome.some(item => item.status === 'done'), `Falcon completed the real edit: ${JSON.stringify(outcome)}`);
  await page.waitForFunction(id => !!localStorage.getItem(`pc:dirty:${id}`), mbid, { timeout: 15000 });
  check((await page.locator('#mb-pc-dock').getAttribute('data-mb-corner-status')) !== '?', 'an edit is not shown as a failed scan');
  check(await page.locator('#pc-stale-note').count() === 0, 'the completed edit does not show a persistent message');
  const actual = await until(async () => page.evaluate(async id => {
    const r = await fetch(`/ws/2/release/${id}?inc=url-rels&fmt=json`, { headers: { Accept: 'application/json' } });
    return r.ok ? r.json() : null;
  }, mbid), data => !!data && (data.relations || []).some(rel => rel.url?.resource === url), 30000);
  check(!!actual && (actual.relations || []).some(rel => rel.url?.resource === url), 'the submitted URL is present on the sandbox release');
});

test('a real artist edit keeps the release platform count visible', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {
  test.setTimeout(240000);
  const artist = await pristine(page, 'artist');
  const release = await pristine(page, 'release', { 'artist_credit.names.0.mbid': artist.mbid });
  answerGm(context, ({ url }) => /musicbrainz\.org/.test(url) ? null : { status: 404, body: '' });
  await page.goto(`${SANDBOX}/release/${release.mbid}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#sidebar');
  await inject('platform_check', { waitFor: '__pcTest680' });
  await inject('falcon', { waitFor: '__falconTest' });
  await page.evaluate(() => window.__pcTest680.scanDone());
  const artistUrl = `https://www.qobuz.com/us-en/interpreter/test/${Date.now()}`;
  await page.evaluate(({ id, name, artistUrl }) => {
    window.__pcTest680.cacheSet(id, 'beatport', {
      url: 'https://www.beatport.com/release/test/987654321', tracks: 1, source: 'search',
      credits: { artists: [{ name, url: artistUrl }], labels: [], tracks: null },
    });
    return window.__pcTest680.pcScan();
  }, { id: release.mbid, name: artist.name, artistUrl });
  const dock = page.locator('#mb-pc-dock');
  const before = await dock.getAttribute('data-mb-corner-status');
  check(/^1\/1$/.test(before || ''), `one release and one artist link are offered (${before})`);
  await page.click('#mb-links-btn');
  await page.waitForSelector('#pc-links-ov .pc-lk-new');
  await page.locator('#pc-links-ov .pc-lk-send').first().click();
  await page.waitForFunction(() => {
    const q = window.__falconTest.getQueue();
    return q.length && q.every(item => !['queued', 'active'].includes(item.status));
  }, null, { timeout: 120000 });
  const outcome = await page.evaluate(() => window.__falconTest.getQueue());
  check(outcome.some(item => item.status === 'done'), `Falcon completed the artist edit: ${JSON.stringify(outcome)}`);
  await page.waitForFunction(id => !!localStorage.getItem(`pc:dirty:${id}`), release.mbid, { timeout: 15000 });
  check((await dock.getAttribute('data-mb-corner-status')) === '1', 'the release link count remains visible');
  const actual = await until(async () => page.evaluate(async id => {
    const r = await fetch(`/ws/2/artist/${id}?inc=url-rels&fmt=json`, { headers: { Accept: 'application/json' } });
    return r.ok ? r.json() : null;
  }, artist.mbid), data => !!data && (data.relations || []).some(rel => rel.url?.resource === artistUrl), 30000);
  check(!!actual && (actual.relations || []).some(rel => rel.url?.resource === artistUrl), 'the artist link was added on the sandbox');
});
