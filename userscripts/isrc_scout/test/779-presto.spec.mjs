// #779: Presto Music as an ISRC source. Its streaming app's API has every track's ISRC, by the
// shop's product number, so a shop link (CD or download) and a streaming link both work.
//
// Lester Young with the Oscar Peterson Trio, the 1997 Verve CD on the sandbox, is Presto's 8621347 in
// the same order: 4 of its 14 recordings carry the ISRC Presto gives, the others older ones.
//
// test.musicbrainz.org, read-only (nothing is submitted); Presto is live.
import { test, check } from '../../../dev/test/harness.mjs';
import { openScout, logText } from './is.mjs';

const LY = '95418a35-9e96-4933-8396-9a2ac73af815';
const SHOP = 'https://www.prestomusic.com/jazz/products/8621347--lester-young-with-the-oscar-peterson-trio';
test.use({ gm: { name: 'ISRC Scout' } });

test('a pasted Presto link imports its 14 ISRCs, from the shop or the streaming app', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  await openScout(page, inject, { release: LY });
  await page.click('#ii-url-btn');
  await page.waitForSelector('#ii-urladd.open', { timeout: 5000 });
  for (const url of [SHOP, 'https://streaming.prestomusic.com/album/8621347']) {
    await page.fill('#ii-url-input', url);
    await page.dispatchEvent('#ii-url-input', 'input');
    check((await page.evaluate(() => document.getElementById('ii-url-btn')?.dataset.tip || '')).includes('Presto'), `the + button recognises ${url}`);
  }
  await page.fill('#ii-url-input', SHOP);
  await page.press('#ii-url-input', 'Enter');
  await page.waitForFunction(() => /Presto done/i.test(window.__isrcScoutLog?.() || ''), null, { timeout: 30000 }).catch(() => {});
  const log = await logText(page);
  check(/Presto album 8621347: 14 track\(s\)/.test(log), '14 tracks came back from Presto');
  const m = log.match(/Presto done — (\d+) filled, (\d+) already present/i);
  check(m && +m[1] === 10 && +m[2] === 4, `10 filled, 4 already on their recordings (${m && m[0]})`);
  const first = await page.evaluate(() => document.querySelector('#ii-tbody tr[data-idx="0"] .ii-input')?.value || '');
  check(/^US-?PR3-?52-?52001$/.test(first.replace(/\s/g, '')), `track 1 gets Presto's ISRC: ${first}`);
  check(!/implausible/i.test(log), 'no fill flagged: the lengths agree');
});

test('a product Presto doesn\'t stream gives no ISRCs, and says why', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  await openScout(page, inject, { release: LY });
  await page.click('#ii-url-btn');
  await page.waitForSelector('#ii-urladd.open', { timeout: 5000 });
  await page.fill('#ii-url-input', 'https://www.prestomusic.com/classical/products/9959653--beethoven-string-quartets-op-59-no-3-op-95-op-133');
  await page.press('#ii-url-input', 'Enter');
  await page.waitForFunction(() => /Presto failed/i.test(window.__isrcScoutLog?.() || ''), null, { timeout: 30000 }).catch(() => {});
  const log = await logText(page);
  check(/Presto failed: Presto: The record is not yet available/i.test(log), `Presto's own reason is logged: ${(log.match(/^.*Presto.*$/gm) || []).slice(-2).join(' / ')}`);
});
