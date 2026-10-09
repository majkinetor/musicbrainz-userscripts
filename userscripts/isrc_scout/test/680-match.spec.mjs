// #680 Match: one click imports ISRCs from the fastest source the release links
// (the next one if it fails or gives none), then runs Find links with them.
// The sandbox copy of Mocky's "Music Will Explain" links Deezer and has no ISRCs.
// The providers are live. Nothing is submitted.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openScout, logText } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

test('#680: Match imports ISRCs, then finds links', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  await openScout(page, inject, { release: '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda' });
  check(!/\btracks\b/.test(await page.locator('#ii-summary').textContent()), 'the footer no longer repeats the track count');
  check(await page.evaluate(() => { const b = document.getElementById('ii-find-all'); return !!b.closest('#ii-tools') && b.previousElementSibling?.id === 'ii-links-btn'; }),
    'Match sits in the toolbar, right after Find links');
  await page.click('#ii-find-all');
  const log = await until(() => logText(page), t => /Match: Find links/.test(t) && /Match: \S+ filled [1-9]/.test(t), { timeout: 120000 });
  check(/Match: ISRC sources in order \S/.test(log), 'it lists the sources it will try');
  await until(() => page.evaluate(() => !document.getElementById('ii-find-all').disabled), x => x, { timeout: 120000 });
  const r = await page.evaluate(() => ({
    isrcs: [...document.querySelectorAll('#ii-tbody tr[data-idx] input')].filter(i => /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(i.value.trim())).length,
    links: document.querySelectorAll('#ii-modal .ii-tl.new').length,
  }));
  check(r.isrcs > 0, `ISRCs were filled in (${r.isrcs})`);
  check(r.links > 0, `links were found with them (${r.links})`);
  await page.screenshot({ path: 'test-results/is-680-match.png' });
});
