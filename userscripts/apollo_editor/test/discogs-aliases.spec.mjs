import { test, check, SANDBOX, pristine, requireLogin, answerGm, attachShot } from '../../../dev/test/harness.mjs';
import { apolloGm } from './ap.mjs';

test.use({ gm: apolloGm(null, { xhr: 'node' }) });

test('Discogs names are reviewed, deduplicated and submitted as aliases', { tag: ['@sandbox', '@login'] }, async ({ page, inject, context }, testInfo) => {
  const { mbid, name: canonical } = await pristine(page, 'artist');
  await page.goto(`${SANDBOX}/artist/${mbid}/aliases`);
  await requireLogin(page);
  await page.evaluate(() => {
    const ul = document.createElement('ul'); ul.className = 'external_links';
    ul.innerHTML = '<li><a href="https://www.discogs.com/artist/3993694">Discogs</a></li>';
    document.querySelector('#sidebar').append(ul);
  });
  let calls = 0;
  await answerGm(context, ({ url }) => {
    if (!url.startsWith('https://api.discogs.com/artists/3993694')) return null;
    calls++;
    if (calls === 1) return { status: 429, body: '{}' };
    return { status: 200, body: JSON.stringify({ id: 3993694, name: canonical,
      namevariations: [canonical, canonical + ' (2)', 'Original Brothers Band', ' original brothers band ', 'Original Brothers Band (3)', 'Original Brothers International Band Of Imo State (12)'],
      aliases: [{ name: 'Review This Alias (Live) (2)' }] }) };
  });
  await inject('apollo_editor');
  const button = page.getByRole('button', { name: 'Fetch from Discogs', exact: true });
  await button.waitFor();
  check(calls === 0, 'no Discogs request before a click');
  await page.locator('.tc-al-nb:not(.tc-al-import)').click();
  await page.locator('.tc-al-note').fill('Verified names');
  await button.click();
  await page.locator('.tc-al-msg').filter({ hasText: 'HTTP 429' }).waitFor();
  check(await button.isEnabled(), 'a failed request can be retried');
  await button.click();
  await page.locator('.tc-al-msg').filter({ hasText: '3 aliases added for review' }).waitFor();
  const names = () => page.locator('.tc-al-n').evaluateAll(es => es.map(e => e.value).filter(Boolean));
  check(JSON.stringify(await names()) === JSON.stringify(['Original Brothers Band', 'Original Brothers International Band Of Imo State', 'Review This Alias (Live)']), 'Discogs numbers are removed from variations and aliases, with descriptive parentheses preserved');
  check((await page.locator('.tc-al-s').evaluateAll(es => es.map(e => e.value))).every(s => !/\(\d+\)/.test(s)), 'sort names are guessed after removing the Discogs number');
  const sources = await page.locator('.tc-al-source').evaluateAll(es => es.map(e => e.href));
  check(sources.length === 3 && sources.every(u => u === 'https://www.discogs.com/artist/3993694'), 'each imported row links to its Discogs source');
  check((await page.locator('.tc-al-note').inputValue()) === 'Verified names\nAliases and name variations from https://www.discogs.com/artist/3993694', 'source appended without losing the edit note');
  await button.click();
  await page.locator('.tc-al-msg').filter({ hasText: 'No new aliases found' }).waitFor();
  check((await names()).length === 3, 'repeated imports do not duplicate pending rows');
  await page.locator('.tc-al-row').nth(2).locator('.tc-al-x').click();
  await attachShot(testInfo, page.locator('#tc-alias'), 'discogs-alias-review');
  await page.locator('#tc-al-enter').click();
  await page.locator('.tc-al-msg').filter({ hasText: '2 edits entered' }).waitFor();
  await page.goto(`${SANDBOX}/artist/${mbid}/aliases`);
  await inject('apollo_editor');
  await page.locator('.tc-al-row').nth(2).waitFor();
  check(JSON.stringify((await names()).sort()) === JSON.stringify(['Original Brothers Band', 'Original Brothers International Band Of Imo State'].sort()), 'the two reviewed aliases persist on MusicBrainz');
});
