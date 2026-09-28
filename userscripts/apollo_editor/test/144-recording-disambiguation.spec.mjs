// #144: a recording's disambiguation shows in the Recordings table and in its picker,
// and the picker's header reads "title - artist … length", the length right-aligned.
// The disambiguation comes from the linked recording's own `comment` (no extra fetch), so
// one is given to the first recording here.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm, toTab } from './ap.mjs';

test.use({ gm: apolloGm() });
const REL = '51bdb849-5dfc-40c0-9fcb-f49fe7395cc7';   // Mozart piano concertos: 9 linked recordings

test('the disambiguation shows in the table and the picker', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { release: REL });
  await page.evaluate(() => {
    const u = v => (typeof v === 'function' ? v() : v), recs = [];
    u(u(MB.releaseEditor.rootField.release).mediums).forEach(m => u(m.tracks).forEach(t => { const r = u(t.recording); if (r && u(r.gid)) recs.push(r); }));
    if (recs[0]) recs[0].comment = 'original mix';
  });
  await toTab(page, 'recordings');
  const cell = '.tc-rectbl tbody tr.tc-recrow td.tc-recname';
  await page.waitForSelector(cell, { timeout: 30000 });
  const table = await page.evaluate(cell => document.querySelector(cell).querySelector('.tc-rec-disamb')?.textContent || '', cell);
  check(/original mix/.test(table), `the table shows it (${table})`);

  await page.evaluate(cell => document.querySelector(cell).click(), cell);
  await page.waitForSelector('.tc-recpop .tc-rpk-hd', { timeout: 10000 });
  await page.waitForTimeout(120);
  const p = await page.evaluate(() => {
    const cur = document.querySelector('.tc-recpop .tc-rpk-cur'), hd = document.querySelector('.tc-recpop .tc-rpk-hd'), len = document.querySelector('.tc-recpop .tc-rpk-hdlen');
    return {
      cur: cur && cur.querySelector('.tc-rpk-cmt')?.textContent || '',
      display: hd ? getComputedStyle(hd).display : '', main: !!(hd && hd.querySelector('.tc-rpk-hdmain')),
      gap: hd && len ? Math.round(hd.getBoundingClientRect().right - len.getBoundingClientRect().right) : 999,
    };
  });
  check(/original mix/.test(p.cur), `the picker's current recording shows it (${p.cur})`);
  check(p.display === 'flex' && p.main, 'the header is title - artist, then the length');
  check(p.gap <= 14, `the length sits at the right (${p.gap}px from the edge)`);
});
