// #787: a cover marked for removal waits under the gallery, in Marked for removal, on red with a REMOVE ribbon, and
// can be selected there to be kept; a cover whose remove edit is open for votes shows a chip linking to that edit (read from the release's open-edits page, by its
// structure). The open-edits page is a stand-in naming the gallery's first cover; nothing is entered.
import { test, check, until, requireLogin, SANDBOX, idle } from '../../../dev/test/harness.mjs';
import { RELEASE, blockPosts } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

const openEdits = (rel, id, edit) => `<!doctype html><html><body><div id="page"><div class="edit-list">
<div class="edit-header open edit-remove remove-cover-art"><div class="edit-description"><table><tbody><tr>
<td class="edit-expiration" colspan="2"><strong>Abstimmung:</strong> endet in <span class="tooltip" title="2099-01-01 12:00 UTC">vielen Tagen</span></td></tr></tbody></table></div>
<h2><a href="/edit/${edit}"><bdi>Bearbeitung #${edit} - Cover-Art entfernen</bdi></a></h2></div>
<div class="edit-details"><table class="details remove-cover-art"><tbody><tr><th>Cover-Art:</th><td class="edit-cover-art">
<a class="artwork-image" href="//coverartarchive.org/release/${rel}/${id}.jpg"></a></td></tr></tbody></table></div></div></div></body></html>`;

test('#787: a removal waits on red under the gallery, a selection of them is kept, and an open removal links to its edit', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await blockPosts(page);
  let first = null;
  await page.route(u => u.pathname === `/release/${RELEASE}/open_edits`, r => r.fulfill({ status: 200, contentType: 'text/html', body: openEdits(RELEASE, first, 787000001) }));
  await page.goto(`${SANDBOX}/release/${RELEASE}/cover-art`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page); await idle(page);
  first = await page.evaluate(() => (document.querySelector('.artwork-cont a[href*="/edit-cover-art/"]')?.getAttribute('href').match(/(\d+)$/) || [])[1]);
  await inject('art_station');
  await page.waitForSelector('#as-root .as-card', { timeout: 20000 });

  // the open removal: a chip on its card, linking to the edit
  const chip = await until(() => page.evaluate(id => { const a = document.querySelector(`.as-card.rmopen[data-id="${id}"] .as-rmopen`); return a ? { href: a.getAttribute('href'), text: a.textContent } : null; }, first), Boolean);
  console.log(JSON.stringify({ first, chip }));
  check(chip && chip.href === '/edit/787000001', `the open removal links to its edit (${JSON.stringify(chip)})`);
  check(chip && /removal open · \d+ days/.test(chip.text), `and says how long it's open (${chip && chip.text})`);
  // its text stays white once the edit was opened (MusicBrainz colours visited links)
  const col = await page.evaluate(id => {
    const a = document.querySelector(`.as-card[data-id="${id}"] .as-rmopen`), s = document.createElement('style');
    s.textContent = 'a:visited,a:link{color:rgb(1,2,3)}'; document.head.appendChild(s);
    const c = getComputedStyle(a).color; s.remove(); return c;
  }, first);
  check(col !== 'rgb(1, 2, 3)', `a page's link colour doesn't reach the chip (${col})`);

  // two covers marked for removal: under the gallery, in Marked for removal, on red with the REMOVE ribbon
  const before = await page.evaluate(() => [...document.querySelectorAll('#as-root .as-grid .as-card')].map(c => c.dataset.id));
  const marked = before.filter(id => id !== first).slice(0, 2), other = marked[0];
  const paint = ids => page.evaluate(ids => {
    const cs = ids.map(id => document.querySelector(`#as-root .as-card[data-id="${id}"]`));
    cs[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2, buttons: 2 }));
    cs.slice(1).forEach(c => c.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, buttons: 2 })));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 2 }));
  }, ids);
  await paint(marked);
  await until(() => page.evaluate(() => !!document.querySelector('.as-bk-rm')), Boolean);
  await page.evaluate(() => document.querySelector('.as-bk-rm').click());
  const after = await until(() => page.evaluate(ids => ({
    under: ids.every(id => document.querySelector(`.as-sec-del:not(.as-sec-more) + .as-grid .as-card.rm[data-id="${id}"] .as-rmban`)),
    keep: ids.every(id => document.querySelector(`.as-card.rm[data-id="${id}"] .as-undo`)),
    inGrid: ids.filter(id => [...document.querySelectorAll('#as-root .as-grid')][0].querySelector(`.as-card[data-id="${id}"]`)).length,
  }), marked), v => v.under);
  console.log(JSON.stringify(after));
  check(after.under && after.keep && !after.inGrid, `the marked covers wait under the gallery with the REMOVE ribbon and keep (${JSON.stringify(after)})`);
  const two = page.locator(`#as-root .as-card[data-id="${first}"]`), mark = page.locator(`#as-root .as-card[data-id="${other}"]`);
  await two.screenshot({ path: 'test-results/as-787-open.png' }); await mark.screenshot({ path: 'test-results/as-787-rm.png' });

  // they are selected by dragging, as any cover, and Keep keeps the selection
  await paint(marked);
  const sel = await until(() => page.evaluate(() => ({ n: document.querySelector('.as-selcnt')?.textContent || '', keep: !!document.querySelector('.as-bk-keep') })), v => v.keep);
  check(sel.keep && /^2 selected/.test(sel.n), `the two marked covers are selected, with Keep (${JSON.stringify(sel)})`);
  await page.evaluate(() => document.querySelector('.as-bk-keep').click());
  const back = await until(() => page.evaluate(ids => ({ rm: ids.filter(id => document.querySelector(`.as-card.rm[data-id="${id}"]`)).length, sec: !!document.querySelector('.as-sec-del:not(.as-sec-more)') }), marked), v => !v.rm);
  check(!back.rm && !back.sec, `Keep brings both back, and the section goes (${JSON.stringify(back)})`);
});
