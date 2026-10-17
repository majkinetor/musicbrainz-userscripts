// Apollo on a phone: MusicBrainz's page is 780px wide there (its body's min-width), wider than the
// screen, and the browser panned the screen sideways to a focused field, cutting the editor's left
// off. On the editor's page the page keeps to the screen: no tab is wider, nothing is panned.
// Read only: nothing is submitted.
import { test, check, attachShot } from '../../../dev/test/harness.mjs';
import { apolloGm, openApollo, toTab } from './ap.mjs';

test.use({ gm: apolloGm(), viewport: { width: 414, height: 846 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

test('every tab fits a phone screen', { tag: ['@sandbox', '@cosmetic'] }, async ({ page, inject }, testInfo) => {
  await openApollo(page, inject, { release: 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c', tab: 'tracklist' });
  for (const tab of ['tracklist', 'release', 'recordings']) {
    await toTab(page, tab);
    await attachShot(testInfo, page, tab);
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const out = [...document.querySelectorAll('#release-editor *')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.ui-dialog, [hidden]'))
        .map(e => [e.tagName + '.' + (e.id || String(e.className).slice(0, 30)), e.getBoundingClientRect()]).filter(([, b]) => b.width && b.right > vw + 1)
        .map(([c, b]) => c + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
      return { vw, iw: innerWidth, pan: visualViewport.offsetLeft, out };
    });
    console.log(tab, JSON.stringify(r));
    check(r.iw === r.vw && r.pan === 0, `${tab}: the page is the screen's width, not panned (${r.iw}px page, ${r.vw}px screen, panned ${r.pan}px)`);
    check(r.out.length === 0, `${tab}: nothing in the editor runs past the screen's right edge (${r.out.slice(0, 8).join(' · ')})`);
  }
});
