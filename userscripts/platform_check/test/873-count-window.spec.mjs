import { test, check, until, answerGm, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Platform Check', values: { 'pc:links-count': true } } });
const RELEASE = '9d290316-dcd3-4d7e-a62b-392ab2396f27';

test('the dock follows artist and label selections while the table is open', { tag: '@sandbox' }, async ({ page, context, inject }) => {
  answerGm(context, ({ url }) => /\/ws\/2\/url\?/.test(url) ? { status: 404, body: '' } : /musicbrainz\.org/.test(url) ? null : { status: 404, body: '' });
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('platform_check', { waitFor: '__pcTest680' });
  await page.evaluate(() => window.__pcTest680.scanDone());
  await page.evaluate(release => {
    const t = window.__pcTest680;
    t.cacheSet(release, 'beatport', { url: 'https://www.beatport.com/release/x/740', tracks: 5, source: 'search',
      credits: { artists: [], labels: [{ name: 'Artoffact Records', url: 'https://www.beatport.com/label/test/9999999' }], tracks: null } });
    t.updateRow('beatport', { url: 'https://www.beatport.com/release/x/740', mbTracks: 5, remoteTracks: 5, source: 'search' });
    document.getElementById('mb-links-btn').click();
  }, RELEASE);
  await page.waitForSelector('#pc-links-ov .pc-lk-new');
  const dock = () => page.locator('#mb-pc-dock').getAttribute('data-mb-corner-status');
  const before = await until(dock, s => /\/1$/.test(s || ''), 6000);
  check(/\/1$/.test(before || ''), `the dock counts the one selected link (${before})`);
  await page.locator('#pc-links-ov .pc-lk-new').first().click({ button: 'right' });
  const after = await until(dock, s => !!s && !/\/1$/.test(s), 6000);
  check(!!after && !/\/1$/.test(after), `leaving the link out removes it from the dock count (${after})`);
  check((await page.locator('#pc-links-ov .pc-lk-send').first().textContent()).includes('Run 0'), 'the table also shows zero selected links');
});

test('a completed scan shows its count even when a provider request fails', { tag: '@sandbox' }, async ({ page, context, inject }) => {
  let first = true;
  answerGm(context, ({ url }) => {
    if (/musicbrainz\.org/.test(url)) return null;
    const status = first ? 503 : 404; first = false;
    return { status, body: '' };
  });
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('platform_check', { waitFor: '__pcTest680' });
  await page.evaluate(() => window.__pcTest680.scanDone());
  const status = await page.locator('#mb-pc-dock').getAttribute('data-mb-corner-status');
  check(status !== '?', `completed scan displays its count (${status})`);
  check(await page.locator('#pc-stale-note').count() === 0, 'no persistent refresh message');
});
