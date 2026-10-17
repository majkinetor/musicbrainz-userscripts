// Apollo on a phone: MusicBrainz's page is 780px wide there (its body's min-width), wider than the
// screen, and the browser panned the screen sideways to a focused field, cutting the editor's left
// off. On the editor's page the page keeps to the screen: no tab is wider, nothing is panned.
// Read only: nothing is submitted.
import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';
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

// A phone's large text (its text scaling, here every font 1.5×) grows the text, not the px widths:
// the track titles were squeezed to nothing and search & replace ran off the screen.
test('the tracklist fits a phone screen under large text', { tag: ['@sandbox', '@cosmetic'] }, async ({ page, inject }, testInfo) => {
  await openApollo(page, inject, { release: 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c', tab: 'tracklist' });
  await page.evaluate(() => { [...document.querySelectorAll('body *')].map(e => [e, parseFloat(getComputedStyle(e).fontSize)]).forEach(([e, f]) => e.style.setProperty('font-size', f * 1.5 + 'px', 'important')); });
  await attachShot(testInfo, page, 'large text');
  const r = await until(() => page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return { out: [...document.querySelectorAll('#release-editor *')].filter(e => e.getClientRects().length && e.getBoundingClientRect().right > vw + 1).slice(0, 8).map(e => String(e.className).slice(0, 25) + ' ' + Math.round(e.getBoundingClientRect().right)),
      titles: [...document.querySelectorAll('.tc-mirror:not(.tc-ri-mirror) td.c-title')].slice(0, 4).map(t => Math.round(t.getBoundingClientRect().width)) };
  }), v => !v.out.length && v.titles.length && v.titles.every(w => w > 100));
  console.log(JSON.stringify(r));
  check(r.out.length === 0, `nothing runs past the screen's right edge (${r.out.join(' · ')})`);
  check(r.titles.length && r.titles.every(w => w > 100), `the titles keep their room (${r.titles})`);
});
