// #550 (majkinetor): "Apply and clear annotation should do clearing in the
// background. It is weird to double check empty field. … It should also add
// appropriate edit note."
//
// A real proof on test.musicbrainz.org, not a mock: this SETS an annotation on a
// sandbox release, clears it through the shipped code path, and then reads the
// annotation back from a fresh page load to confirm it is actually gone — and
// reads the resulting edit out of MusicBrainz's own edit list to confirm the
// note landed on it. A 200 from a form POST proves only that the request left
// the browser.
//
// Sandbox only. It writes, deliberately, and only there.
import { test, check, expect, requireLogin, SANDBOX, idle, settled } from '../../../dev/test/harness.mjs';
import { RELEASE } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('Apply & clear annotation really clears it, with an edit note', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const HOST = SANDBOX;
  const MARKER = 'GT #550 probe ' + new Date().toISOString();
  const ANNOTATION = `Copyright: (C) 2017 Global\n(P) 2017 Global\n\n${MARKER}`;

  const goto = async (url) => {
    for (let a = 1; ; a++) {
      try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); return; }
      catch (e) { if (a >= 4) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
    }
  };

  // ── set up: give the release an annotation to clear ─────────────────────────
  await goto(`${HOST}/release/${RELEASE}/edit_annotation`);
  await requireLogin(page);
  await page.fill('textarea[name="edit-annotation.text"]', ANNOTATION);
  await page.fill('textarea[name="edit-annotation.edit_note"]', 'setting up a #550 test fixture');
  await Promise.all([
    page.waitForNavigation({ timeout: 60000 }).catch(() => {}),
    page.evaluate(() => {
      const ta = document.querySelector('textarea[name="edit-annotation.text"]');
      const f = ta.closest('form');
      const btn = [...f.querySelectorAll('button[type=submit], input[type=submit]')].find(b => !/preview/i.test(b.name || ''));
      (btn || f).click ? (btn || f).click() : f.submit();
    }),
  ]);
  await settled(page);

  const readAnnotation = async () => {
    await goto(`${HOST}/release/${RELEASE}/edit_annotation`);
    return page.evaluate(() => (document.querySelector('textarea[name="edit-annotation.text"]') || {}).value || '');
  };
  const before = await readAnnotation();
  console.log('annotation before: ' + JSON.stringify(before.slice(0, 60)) + ` (${before.length} chars)`);
  expect(before.includes(MARKER), 'the fixture annotation is really on the release (otherwise the clear below proves nothing)').toBe(true);

  // ── the actual thing: clear it through the shipped code ─────────────────────
  await goto(`${HOST}/release/${RELEASE}/edit-relationships`);
  await settled(page);
  await inject('group_therapy');
  await idle(page);
  const hook = await page.evaluate(() => !!(window.__groupTherapy && window.__groupTherapy.txpClearAnnotation));
  check(hook, 'the shipped script exposes the clear path');

  const note = await page.evaluate((gid) => window.__groupTherapy.txpClearAnnotationNote(2, ' on the release'), RELEASE);
  console.log('edit note: ' + JSON.stringify(note));
  check(/Group Therapy/.test(note), 'the note identifies the script');
  check(/2 relationships/.test(note), 'says how many relationships replaced the text — ' + JSON.stringify(note.split('\n').pop()));
  check(/on the release/.test(note), 'and names the scope, matching the relationship edit\'s own note');

  const out = await page.evaluate(async ({ gid, note }) =>
    window.__groupTherapy.txpClearAnnotation(gid, note, 'Credits moved to relationships')
      .then(r => ({ ok: true, r })).catch(e => ({ ok: false, err: e.message })), { gid: RELEASE, note });
  console.log('clear result: ' + JSON.stringify(out));
  check(out.ok, 'the clear ran without throwing — ' + (out.err || ''));
  check(out.ok && out.r.cleared, 'and reports it cleared something (not "already empty")');
  check(out.ok && out.r.was === before.trim().length, `reporting the size it removed (${out.ok && out.r.was} vs ${before.trim().length})`);

  // ── and clearing an already-empty annotation is a no-op, not a fake edit ────
  const again = await page.evaluate(async ({ gid }) =>
    window.__groupTherapy.txpClearAnnotation(gid, 'should never be submitted', '')
      .then(r => ({ ok: true, r })).catch(e => ({ ok: false, err: e.message })), { gid: RELEASE });
  console.log('second clear: ' + JSON.stringify(again));
  check(again.ok && again.r.skipped, 'clearing an already-empty annotation is reported as skipped, not submitted');

  // ── proof: read it back from a fresh page load ──────────────────────────────
  const after = await readAnnotation();
  console.log('annotation after : ' + JSON.stringify(after));
  check(after.trim() === '', 'the annotation is REALLY gone, read back from a fresh load of the page');

  // ── proof: the edit exists on MusicBrainz, carrying our note ────────────────
  await goto(`${HOST}/release/${RELEASE}/edits`);
  await settled(page);
  const edit = await page.evaluate(() => {
    // Find the edit by OUR note and then read ITS OWN header — picking the first
    // header that merely mentions "annotation" matched an unrelated "Add release"
    // edit whose container happened to include ours further down the page.
    const heads = [...document.querySelectorAll('.edit-header')];
    for (const h of heads) {
      let body = '', n = h.nextElementSibling;
      while (n && !n.classList.contains('edit-header')) { body += ' ' + n.textContent; n = n.nextElementSibling; }
      if (/Cleared the annotation/.test(body)) {
        // the TITLE carries the edit type ("Edit #N - Add release annotation");
        // the header's own textContent leads with vote/status chrome and would
        // truncate the type away.
        const t = h.querySelector('.edit-title, a');
        return { title: (t ? t.textContent : h.textContent).replace(/\s+/g, ' ').trim(),
                 body: body.replace(/\s+/g, ' '), cls: [...h.classList].join(' ') };
      }
    }
    return null;
  });
  console.log('the edit carrying our note: ' + JSON.stringify(edit && edit.title) + '  [' + (edit && edit.cls) + ']');
  check(!!edit, 'MusicBrainz recorded an edit carrying our note');
  check(!!edit && /add-release-annotation/.test(edit.cls), 'and MusicBrainz typed it as a release-annotation edit — ' + JSON.stringify(edit && edit.title));
  check(!!edit && /Group Therapy/.test(edit.body), 'the note identifies the script');
  check(!!edit && /credits were entered as/.test(edit.body), 'and says why the annotation went');
});
