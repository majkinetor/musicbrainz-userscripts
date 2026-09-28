// #607 (chaban-mb): "The ISRC count status button continues to show the question after
// the dialog has been opened and release data loaded". The page-load release lookup hit
// MusicBrainz's rate limit (503), so the button showed "?"; the dialog then loaded the
// release, but nothing told the button.
//
// test.musicbrainz.org (a copy of the release from the issue), with production's data
// (fixtures/ws-607.json.gz); the first release lookup is answered 503.
import { test, check, answerGm } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

test('the button shows the real count once the dialog has loaded the release', { tag: ['@sandbox'] }, async ({ page, context, inject }) => {
  let calls = 0;
  const ws = await openScout(page, inject, {
    release: '603bf0b9-df73-431c-8047-f2d8a1d108ee', replay: new URL('./fixtures/ws-607.json.gz', import.meta.url), open: false,
    // asked before the replay: the page-load lookup is throttled
    before: () => answerGm(context, ({ url }) => (/\/ws\/2\/release\/[0-9a-f-]{36}\?/.test(url) && ++calls === 1 ? { status: 503, body: '{"error": "Your requests are exceeding the allowable rate limit."}' } : null)),
  });
  await page.waitForFunction(() => document.getElementById('ii-btn-status')?.textContent !== '⏳', null, { timeout: 30000 });
  const before = await page.evaluate(() => document.getElementById('ii-btn-status').textContent);
  check(before === '?', `the throttled page load leaves "?" (${before})`);
  await page.evaluate(() => document.getElementById('ii-btn').click());
  await page.waitForFunction(() => !/Loading release/.test(document.getElementById('ii-modal')?.innerText || 'Loading release'), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const after = await page.evaluate(() => ({ status: document.getElementById('ii-btn-status').textContent, title: document.getElementById('ii-btn').title, rows: document.querySelectorAll('#ii-modal tbody tr').length }));
  check(after.rows > 1, `the dialog loaded the release (${after.rows} rows)`);
  check(/^[✓⚠] \d+\/\d+$/.test(after.status) && !/Could not load/.test(after.title), `the button shows the count now ("${after.status}")`);
  await ws.done();
});
