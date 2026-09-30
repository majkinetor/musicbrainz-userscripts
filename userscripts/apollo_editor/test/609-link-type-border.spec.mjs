// #609 (NicolasPL64): a newly added URL with no relationship type yet shows only a chevron
// — "I can't see where I'm supposed to click to add the relationship type". majkinetor:
// "Regarding combo, I will add a border." A URL MusicBrainz can't type by itself is added
// to a sandbox release's editor; nothing is submitted.
import { test, check, attachShot, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm(), deviceScaleFactor: 3 });

test('an untyped link has a visible type combo', { tag: ['@cosmetic', '@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  const submitted = await openApollo(page, inject, { release: '3a37a35f-1e06-457f-9b2a-46155c5c03ce' });
  await page.waitForFunction(() => document.body.classList.contains('tc-ri-on'), null, { timeout: 20000 });
  const input = page.locator('#external-links-editor input[type=url]').last();
  await input.fill('https://example.org/some-page-609');
  await input.press('Tab');
  const sel = await until(() => page.evaluate(() => {
    const row = [...document.querySelectorAll('#external-links-editor tr.external-link-item')].find(tr => /example\.org\/some-page-609/.test(tr.textContent + [...tr.querySelectorAll('input')].map(i => i.value).join(' ')));
    let s = null;
    for (let tr = row && row.nextElementSibling; tr && !tr.classList.contains('external-link-item'); tr = tr.nextElementSibling) { s = tr.querySelector('select'); if (s) break; }
    if (!s) return null;
    s.scrollIntoView({ block: 'center' });
    const cs = getComputedStyle(s), r = s.getBoundingClientRect();
    return { value: s.value, border: cs.borderTopWidth + ' ' + cs.borderTopStyle, width: Math.round(r.width), height: Math.round(r.height) };
  }), s => !!s);   // until MusicBrainz has put the row's type select up
  check(!!sel, 'the new link has a relationship-type combo');
  if (!sel) return;
  check(!sel.value, 'with no type chosen yet (the #609 state)');
  check(/^1px solid/.test(sel.border), `it has a border (${sel.border})`);
  check(sel.width >= 60 && sel.height >= 16, `and is a real click target (${sel.width}×${sel.height})`);
  await attachShot(testInfo, page.locator('#external-links-editor'), 'link type combo');
  check(submitted.length === 0, 'nothing submitted');
});
