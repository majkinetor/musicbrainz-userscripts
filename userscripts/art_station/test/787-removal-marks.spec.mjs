// #787: a cover marked for removal stays in its place in the gallery, on red with a REMOVE ribbon, and a cover whose
// remove edit is open for votes shows a chip linking to that edit (read from the release's open-edits page, by its
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

test('#787: a removal stays in place, and an open removal links to its edit', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
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

  // another cover marked for removal: in its place, on red with the REMOVE ribbon, no section of its own
  const before = await page.evaluate(() => [...document.querySelectorAll('#as-root .as-card')].map(c => c.dataset.id));
  const other = before.find(id => id !== first);
  await page.evaluate(id => { const c = document.querySelector(`.as-card[data-id="${id}"]`); c.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2 })); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 2 })); }, other);
  await until(() => page.evaluate(() => !!document.querySelector('.as-bk-rm')), Boolean);
  await page.evaluate(() => document.querySelector('.as-bk-rm').click());
  const after = await until(() => page.evaluate(id => ({
    ids: [...document.querySelectorAll('#as-root .as-card')].map(c => c.dataset.id),
    rm: !!document.querySelector(`.as-card.rm[data-id="${id}"] .as-rmban`),
    keep: !!document.querySelector(`.as-card.rm[data-id="${id}"] .as-undo`),
    sec: !!document.querySelector('.as-sec-del:not(.as-sec-more)'),
  }), other), v => v.rm);
  console.log(JSON.stringify(after));
  check(after.rm && after.keep, `the marked cover has the REMOVE ribbon and keep (${JSON.stringify(after)})`);
  check(JSON.stringify(after.ids) === JSON.stringify(before), 'it stays in its place');
  check(!after.sec, 'no Marked for removal section');
  await page.locator('#as-root').screenshot({ path: 'test-results/as-787.png' });
});
