// #564 (majkinetor: "AS dark gallery mode buttons top right not visible … image type
// (front) hardly visible … and download btn").
//
// The lightbox is an always-dark overlay whose controls are light-on-dark <button>s:
// Play, ✕, the type chip, Download and its caret. kellnerd's dark userstyle applies
// `filter: var(--invert-value)` to every button on the page, so all of them came out
// near-black on the near-black backdrop. A computed-colour check can't see that (the
// filter applies at paint time); what it can see is the filter itself.
//
// test.musicbrainz.org, read-only, with kellnerd's current stylesheet (fetched from
// GitHub) loaded: no control in the lightbox may be inverted.
import { test, check, expect, attachShot, until, frames } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

const STYLE_URL = 'https://raw.githubusercontent.com/kellnerd/userstyles/main/musicbrainz-dark.user.css';
test.use({ gm: { name: 'Art Station' } });

test("the lightbox's controls are not inverted by a dark userstyle", { tag: ['@cosmetic', '@sandbox', '@web'] }, async ({ page, inject }, testInfo) => {
  // A UserCSS keeps everything inside an @-moz-document block, which Chromium drops
  // wholesale: injected as is, it applies nothing and the check passes for nothing.
  const raw = await (await fetch(STYLE_URL)).text();
  const at = raw.indexOf('@-moz-document');
  expect(at, "kellnerd's userstyle still has its @-moz-document wrapper").toBeGreaterThanOrEqual(0);
  const css = raw.slice(raw.indexOf('{', at) + 1, raw.lastIndexOf('}'));

  await openArtStation(page, inject, { before: () => page.addStyleTag({ content: css }) });
  // until Art Station has recognised the dark userstyle
  await until(() => page.evaluate(() => document.documentElement.getAttribute('data-mbu-theme')), t => t === 'dark');

  // the fixture: the userstyle really inverts MusicBrainz's own buttons
  const pageBtn = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => !x.closest('#as-root, #as-lb, #as-setup')); return b ? getComputedStyle(b).filter : null; });
  check(pageBtn && pageBtn !== 'none', `the stylesheet inverts MusicBrainz's own buttons (${pageBtn}), so the fixture reproduces`);

  const opened = await page.evaluate(() => { const th = document.querySelector('.as-thumb'); if (!th) return false; th.click(); return !!document.getElementById('as-lb'); });
  check(opened, 'the lightbox opens from a cover');
  await page.waitForSelector('#as-lb .as-lb-x', { timeout: 10000 }).catch(() => {});
  await frames(page);
  const items = await page.evaluate(() => {
    const lb = document.getElementById('as-lb');
    return ['.as-lb-play', '.as-lb-x', '.as-lb-type', '.as-lb-dl', '.as-lb-dlcaret', '.as-lb-nav'].map(sel => {
      const el = lb && lb.querySelector(sel);
      if (!el) return { sel, missing: true };
      const cs = getComputedStyle(el);
      return { sel, filter: cs.filter, color: cs.color };
    }).filter(i => !i.missing);
  });
  check(items.length >= 4, `${items.length} lightbox controls measured (a check that measures nothing must not pass)`);
  for (const it of items) check(it.filter === 'none', `${it.sel} is not inverted (filter: ${it.filter}, color: ${it.color})`);
  await attachShot(testInfo, page, 'lightbox');
});
