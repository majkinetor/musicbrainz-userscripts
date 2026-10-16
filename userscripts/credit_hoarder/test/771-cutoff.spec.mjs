// #771: the review table's match cutoff. Each automatic match gets a confidence dot; a match
// below the cutoff is offered as the row's first candidate but not selected; changing the
// cutoff re-applies it to every row you haven't touched; the matches used are counted by
// level for the edit note.
//
// test.musicbrainz.org, read-only: the table is fed made-up results through the test hook
// (no lookups), and "Start import" only resolves the table's promise; nothing is dispatched.
import { test, check } from '../../../dev/test/harness.mjs';
import { withShim, openEditor } from './ch.mjs';

const REL = '51df3142-ff64-4ad1-bc67-37bf2767b9d7';   // any release: the table needs the relationship editor
test.use({ gm: false });

test('the match cutoff selects only matches at or above it', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
  test.setTimeout(5 * 60_000);
  await openEditor(page, REL);
  // the shim's GM storage remembers nothing, so the cutoff starts at its default (Strong)
  await inject('credit_hoarder', { waitFor: '__creditHoarder', transform: withShim });

  await page.evaluate(() => {
    const C = window.__creditHoarder;
    const ul = document.createElement('ul'); ul.id = 'ch-771'; document.body.prepend(ul);
    C.setReviewContainer(ul);
    const gid = n => `00000000-0000-4000-8000-00000000000${n}`;
    const row = (name, n, via) => {
      const mbUrl = `//test.musicbrainz.org/artist/${gid(n)}`;
      return { type: 'resolved', entityType: 'artist', entity: { name, anv: '', resource_url: '' }, displayName: name, discogsHref: '',
        mbUrl, mbName: name, mbDisambig: '', logEntry: { displayName: name, discogsHref: '', mbUrl, mbName: name, mbDisambig: '', via, fromCache: false }, _roles: [] };
    };
    const results = [row('Exact One', 1, 'both'), row('Strong Two', 2, 'url'), row('Unique Three', 3, 'name'), row('Weak Four', 4, 'cred'), row('Picked Five', 5, 'user')];
    window.__ch771 = C.showReviewTable(results, new Map(), new Map(), { sourceName: 'Tidal' });
  });

  const tr = name => page.locator(`#ch-771 tr[data-entity-key="_nourl_${name}"]`);
  const state = async () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#ch-771 tr[data-entity-key]')].map(t => [
    t.dataset.entityKey.replace('_nourl_', ''),
    /below cutoff/.test(t.textContent) ? 'below' : t.querySelector('a[style*="bold"]')?.textContent.startsWith('✓') ? 'selected' : 'open',
  ])));
  const setCutoff = async key => {
    await page.locator('#ch-771 .ch-cutoff-chip').click();
    await page.locator(`.ch-cutoff-menu .ch-cutoff-mi[data-level="${key}"]`).click();
    await page.waitForTimeout(200);
  };

  await tr('Exact One').waitFor({ timeout: 30_000 });
  check((await page.locator('#ch-771 .ch-cutoff-chip').textContent()).includes('Strong'), 'the cutoff starts at Strong');
  let s = await state();
  check(s['Exact One'] === 'selected' && s['Strong Two'] === 'selected', `Exact and Strong matches are selected (${JSON.stringify(s)})`);
  check(s['Unique Three'] === 'below' && s['Weak Four'] === 'below', 'Unique name and Weak matches are offered, not selected');
  check(s['Picked Five'] === 'selected', 'your own pick is always selected');
  check(await tr('Weak Four').locator('.ch-level-dot').count() === 1, 'a below-cutoff candidate carries its dot');
  check(/below cutoff: co-credit/.test(await tr('Weak Four').textContent()), '…and says why it was not taken');
  check(await tr('Exact One').locator('.ch-level-dot').count() === 1, 'an automatic match carries its dot');

  await setCutoff('weak');
  s = await state();
  check(['Exact One', 'Strong Two', 'Unique Three', 'Weak Four'].every(n => s[n] === 'selected'), `cutoff Weak: every automatic match is selected (${JSON.stringify(s)})`);

  await setCutoff('exact');
  s = await state();
  check(s['Exact One'] === 'selected' && s['Strong Two'] === 'below' && s['Unique Three'] === 'below', `cutoff Exact: only the Exact match stays selected (${JSON.stringify(s)})`);

  // pick the demoted Strong match by hand; a later cutoff change leaves it alone
  await tr('Strong Two').locator('button', { hasText: '✓' }).first().click();
  await setCutoff('strong');
  s = await state();
  check(s['Strong Two'] === 'selected', 'a match you picked stays picked when the cutoff changes');
  check(s['Unique Three'] === 'below' && s['Weak Four'] === 'below', 'cutoff Strong again: Unique name and Weak are offered, not selected');

  await page.locator('#ch-771 button', { hasText: 'Start import' }).click();
  const counts = await page.evaluate(async () => (await window.__ch771).matchCounts);
  check(JSON.stringify(counts) === JSON.stringify({ levels: [1, 0, 0, 0], user: 2, cutoff: 'Strong' }), `the edit note counts 1 exact and 2 by you (${JSON.stringify(counts)})`);
});
