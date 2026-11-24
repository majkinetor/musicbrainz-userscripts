// #1105: Add link only opens the release's edit page, and First Contact types the album's link there, with its link
// types and an edit note. The release editor ignores links and a note in its address, so they go through storage.
//
// Fixture: a sandbox release (54b7bca2…) without the Apple Music link. Nothing is submitted.
import { test, check, SANDBOX } from '../../../dev/test/harness.mjs';

const MBID = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';
const URL_ = 'https://music.apple.com/gb/album/my-existence-single/6774744840';

test.use({ gm: { name: 'First Contact', persist: 'tabs', values: { 'fc.settings': { server: 'test.musicbrainz.org', archive: false } } } });

test('Add link only types the link, both its types and the edit note into the release editor', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
  test.setTimeout(120_000);
  const token = 'ltest' + Date.now().toString(36);
  const note = 'Apple Music: ' + URL_ + '\nfrom the #1105 test';
  await page.goto(`${SANDBOX}/release/${MBID}/edit#fc-links=${token}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([k, v]) => GM_setValue(k, v), ['fc.handoff.links.' + token,
    { v: 1, token, created: Date.now(), mbid: MBID, urls: [{ url: URL_, linkType: 980 }, { url: URL_, linkType: 74 }], note }]);
  await inject('first_contact', { waitFor: '__fcTest' });
  await page.waitForFunction(() => window.__fcLinksDone, null, { timeout: 60_000 });
  const done = await page.evaluate(() => window.__fcLinksDone);
  check(done.token === token && done.added === 1, `one link added (${JSON.stringify(done)})`);
  const r = await page.evaluate(u => {
    const row = [...document.querySelectorAll('#external-links-editor tr.external-link-item')].find(t => { const a = t.querySelector('a[href]'); return a && a.href.includes('6774744840'); });
    const types = [];
    for (let s = row && row.nextElementSibling; s && !s.classList.contains('external-link-item'); s = s.nextElementSibling) {
      const sel = s.classList.contains('relationship-item') && s.querySelector('select.link-type');
      if (sel) types.push(sel.value);
    }
    const ta = document.querySelector('#edit-note-text, textarea.edit-note, textarea[name="edit-note"]');
    return { row: !!row, types, note: ta && ta.value };
  }, URL_);
  check(r.row, 'the link has its row');
  check(r.types.includes('980') && r.types.includes('74'), `with both link types (${r.types})`);
  check(r.note && r.note.includes('#1105 test'), `the edit note is filled (${r.note})`);
  check(await page.evaluate(k => GM_getValue(k, null), 'fc.handoff.links.' + token) === null, 'the links are taken out of the storage');
});
