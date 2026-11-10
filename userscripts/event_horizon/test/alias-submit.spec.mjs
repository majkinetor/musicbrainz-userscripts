import { test, check, SANDBOX, pristine, requireLogin } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('alias additions from the redesigned page persist on MusicBrainz', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const { mbid } = await pristine(page, 'artist');
  await page.goto(`${SANDBOX}/artist/${mbid}/aliases`); await requireLogin(page); await inject('event_horizon');
  for (const name of ['First Submitted Alias', 'Second Submitted Alias']) await page.locator('#tc-alias .tc-al-row').last().locator('.tc-al-n').fill(name);
  const posted = page.waitForRequest(r => r.method() === 'POST' && new URL(r.url()).pathname === `/artist/${mbid}/add-alias`);
  await page.locator('#tc-al-enter').click(); await posted;
  await page.screenshot({ path: 'dev/_aliases-submitting.png' });
  await page.locator('#tc-alias .tc-al-row').nth(2).waitFor();
  await page.waitForFunction(() => document.querySelector('#s-ali .count')?.textContent.trim() === '2');
  await page.reload(); await inject('event_horizon');
  await page.locator('#tc-alias .tc-al-row').nth(2).waitFor();
  const names = await page.locator('#tc-alias .tc-al-n').evaluateAll(es => es.map(e => e.value).filter(Boolean).sort());
  check(JSON.stringify(names) === JSON.stringify(['First Submitted Alias', 'Second Submitted Alias']), 'both aliases persist after reloading the redesigned page');
});
