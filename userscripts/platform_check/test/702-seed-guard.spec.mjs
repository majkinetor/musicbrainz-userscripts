// #702: Platform Check's seed mode is for Mission Control's consolidation page only
// (/release/add#mc=<token>). There it waits, out of sight, for a seed probe and ignores a probe
// for a release; on the release editor without #mc= it doesn't run at all. The seed scan itself
// is in Mission Control's 702 spec.
import { test, check, requireLogin, settled } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Platform Check' } });

test('#702: on the consolidation page Platform Check waits for a seed, out of sight', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const url = 'https://test.musicbrainz.org/release/add#mc=t702guard' + Date.now().toString(36);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  if (!/#mc=/.test(page.url())) await page.goto(url, { waitUntil: 'domcontentloaded' });
  await settled(page);
  await page.evaluate(() => {
    window.__got = [];
    for (const t of ['mc:findings', 'mc:progress']) document.addEventListener(t, e => window.__got.push([t, JSON.parse(e.detail)]));
  });
  await inject('platform_check', { waitFor: '__pcTest702' });
  check(await page.evaluate(() => { const s = document.getElementById('mb-pc-seed-host'); return !!s && s.hidden; }), 'the panel is built out of sight');
  await page.waitForTimeout(1500);
  check(await page.evaluate(() => !window.__got.length), 'it scans nothing before Mission Control sends the album');
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('mc:probe', { detail: JSON.stringify({ run: 'r0', release: '00000000-0000-0000-0000-000000000000' }) })));
  await page.waitForTimeout(1000);
  check(await page.evaluate(() => !window.__got.length), 'a probe for a release is not for this page');
});

test('#702: the release editor without #mc= gets no Platform Check', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/release/add', { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await settled(page);
  await inject('platform_check');
  await page.waitForTimeout(1500);
  check(await page.evaluate(() => !document.getElementById('mb-pc-seed-host') && !document.getElementById('mb-pc-panel') && !window.__pcTest702), 'no panel, no scan');
});
