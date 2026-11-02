import { test, check, until, settled, requireLogin, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

const RG = 'ed64def7-4a2f-4ff7-9ae3-fbdfac9f8e0e';

// the entity icon copies the MBID on every entity; on a release it also sends to Picard, nothing else it can load
test('the entity icon copies the MBID and sends to Picard', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://test.musicbrainz.org' });
  await page.goto(`https://test.musicbrainz.org/release-group/${RG}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  await settled(page);
  await inject('event_horizon');
  const icon = page.locator('section.hero .kicker .kmk');
  check(await until(() => icon.count(), n => n === 1) === 1, 'a release group has the icon');
  check(await icon.getAttribute('data-copy') === RG, 'and it holds the MBID');
  check(await icon.getAttribute('data-picard') === null, 'with nothing to send to Picard');
  await icon.click();
  const copied = await until(() => page.locator('#toast').textContent(), t => /Cop/.test(t)); check(copied === 'Copied the MBID', 'a click copies the MBID, got ' + copied);

  const rel = (await (await page.request.get(`https://test.musicbrainz.org/ws/2/release?release-group=${RG}&limit=1&fmt=json`)).json()).releases[0].id;
  await page.goto(`https://test.musicbrainz.org/release/${rel}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await inject('event_horizon');
  check(await until(() => icon.count(), n => n === 1) === 1, 'a release has the icon');
  check(await icon.getAttribute('data-copy') === rel, 'with its own MBID, though it has no MBID fact');
  check(await icon.getAttribute('data-picard') === `openalbum?id=${rel}`, 'a right-click would open this release');
  await icon.click({ button: 'right' });
  // no Picard in the test run: the answer says the request went and failed
  check(/Picard/.test(await until(() => page.locator('#toast').innerText(), t => /Picard/.test(t))), 'and the toast reports on Picard');
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: 'event_horizon', cancelable: true })));
  await page.locator('.mbu-cfg-log').click();
  const logged = await until(() => page.locator('.mbu-logpop').innerText(), t => /reachable|Sent to|answered/.test(t));
  check(logged.includes(`Send to Picard: http://127.0.0.1:8000/openalbum?id=${rel}`), 'the Activity log has the send, got ' + logged);
  check(/Picard is not reachable|Sent to Picard|Picard answered/.test(logged), 'and its outcome');
});
