// The Label field in Apollo's Release information view: MusicBrainz's lookup is switched
// off there (Apollo's picker replaces it), but MusicBrainz's recent-items list, opened on a
// click in the empty field, bypassed that and showed greyed out over the form. It stays shut.
//
// A sandbox copy of the release it was reported on (no labels); nothing is submitted.
import { test, check, idle, frames } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm({ apolloEnabled: true, replaceReleaseInfo: true }) });

test('a click in the empty Label field opens no greyed-out recent-items list', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  // one recent label (Atlantic), so MusicBrainz has a list to show
  await page.addInitScript(() => { try { localStorage.setItem('recentAutocompleteEntities', JSON.stringify({ label: ['50c384a2-0b44-401b-b893-8181173339c7'] })); } catch (e) {} });
  await openApollo(page, inject, { release: '3368eb56-bdec-472b-a1d2-5bda329d7e17' });
  await page.evaluate(() => { const t = [...document.querySelectorAll('a,button,li')].find(e => /^\s*release information\s*$/i.test(e.textContent || '')); if (t) (t.querySelector('a') || t).click(); });
  await page.waitForFunction(() => document.body.classList.contains('tc-ri-on'), null, { timeout: 15000 });
  await idle(page); await frames(page);
  // MusicBrainz shows the list once it has resolved the recent MBIDs (a /ws/js/entities read)
  const read = page.waitForResponse(r => /\/ws\/js\/entities\//.test(r.url()), { timeout: 15000 }).catch(() => null);
  await page.locator('#label-0').click();
  await read; await frames(page, 3);
  const menus = await page.evaluate(() => [...document.querySelectorAll('ul.ui-autocomplete')]
    .filter(u => u.dataset.inputId === 'label-0' && u.offsetParent !== null && getComputedStyle(u).display !== 'none').map(u => u.className));
  check(menus.length === 0, `no MusicBrainz menu under the Label field (${JSON.stringify(menus)})`);
});
