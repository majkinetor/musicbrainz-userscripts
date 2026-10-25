import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('an instrument\'s description shows its links, not its HTML, and its picture fits', { tag: '@sandbox' }, async ({ page, inject }) => {
  // test's tamborim has a plain description: it gets production's, which is HTML
  await page.route(/\/ws\/2\/instrument\/a96bbbd1/, async r => {
    const res = await r.fetch(), j = await res.json();
    j.description = 'For the common framedrum with jangles, see <a href="/instrument/4431f7b0-69a4-49ee-b84f-15dda19fb70c">tambourine</a>.<br /> Used in Brazilian samba.';
    await r.fulfill({ response: res, json: j });
  });
  await page.goto('https://test.musicbrainz.org/instrument/a96bbbd1-7e44-4e79-b12e-a03ac232db98'); // tamborim
  await inject('event_horizon');
  const d = page.locator('#app .facts a[href*="/instrument/4431f7b0"]');
  check(await until(() => d.count(), n => n > 0, 15000) > 0, 'the link to tambourine is a link');
  check(!/<a href|<br/.test(await page.locator('#app .facts').innerText()), 'no HTML shows as text');
  check(await page.locator('#app img.ipic').evaluate(i => getComputedStyle(i).objectFit) === 'contain', 'the picture fits, uncropped');
});
