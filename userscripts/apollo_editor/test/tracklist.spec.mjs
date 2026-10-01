// Apollo's tracklist: the table that replaces MusicBrainz's own, and drives its model.
// (Replaces the old mirror.mjs and integration.mjs tours.)
//
// It hides the native tracklist, only inside the Tracklist tab (#114: the Recordings tab's
// table of the same shape is left alone); hideMirror gives the native one back. Dragging a
// row, ✕, ＋N (new tracks blank, not copying the previous credit) and a second medium all
// reach MusicBrainz's model. On load, auto-matching resolves the artists it can prove, a
// changed row shows ↺ and a marker, and reverting it clears both.
//
// A seeded release on the sandbox; MusicBrainz's data replayed from production
// (RECORD_WS=1 to re-record). Nothing is submitted.
import { test, check, until, idle, replayWs } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm, mbTracks } from './ap.mjs';

const ROWS = '.tc-medsec .tc-mirror tbody tr[data-tk]';

test.describe('editing', () => {
  test.use({ gm: apolloGm({ autoMatch: false, autoMatchRec: false, autoMatchLabel: false, autoMatchArtist: false, discogsUrlMatch: false }) });

  test('the table stands in for the native one, and edits reach MusicBrainz', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
    const submitted = await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
    await page.waitForSelector(ROWS, { timeout: 60000 });
    const hidden = await page.evaluate(() => {
      const tl = document.getElementById('tracklist');
      const outside = [...document.querySelectorAll('table')].filter(t => t.querySelector('tr.track') && !tl.contains(t));
      return { native: [...tl.querySelectorAll('table')].filter(t => t.querySelector('tr.track')).every(t => t.style.display === 'none'), outside: outside.every(t => t.style.display !== 'none'), tools: (document.getElementById('tracklist-tools') || { style: {} }).style.display === 'none' };
    });
    check(hidden.native && hidden.tools, 'the native tracklist and its tools are hidden');
    check(hidden.outside, '#114: a table of that shape outside the Tracklist tab is not');
    const shown = await page.evaluate(() => { window.__apolloEditor.hideMirror(); const tbl = [...document.querySelectorAll('#tracklist table')].find(x => x.querySelector('tr.track')); return tbl && tbl.style.display !== 'none'; });
    check(shown, 'hideMirror gives the native one back');
    await page.evaluate(() => window.__apolloEditor.showMirror());
    await page.waitForSelector(ROWS, { timeout: 30000 });

    const titles = async () => (await mbTracks(page)).map(t => t.name);
    const before = await titles();
    await page.evaluate(rows => {
      const r = [...document.querySelectorAll(rows)], dt = new DataTransfer(), handle = r[0].querySelector('.tc-drag'), box = r[2].getBoundingClientRect();
      handle.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
      r[2].dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, clientY: box.bottom - 2 }));   // lower half: after it
      r[2].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, clientY: box.bottom - 2 }));
      handle.dispatchEvent(new DragEvent('dragend', { dataTransfer: dt, bubbles: true }));
    }, ROWS);
    const moved = await until(titles, t => t[0] !== before[0]);
    check(moved[2] === before[0] && moved[0] === before[1], `dragging row 1 below row 3 moves the track there (${moved.slice(0, 3).join(' | ')})`);

    const last = page.locator(ROWS).last();
    await last.hover();
    // #654: the hover's ↺/✕ have their own column after Match, two icons wide, so they never
    // cover the pills; ✕ keeps its x whether or not ↺ shows
    const acts = await last.evaluate(tr => {
      const b = tr.querySelector('td.c-badge').getBoundingClientRect(), a = tr.querySelector('td.c-act'), ab = a.getBoundingClientRect();
      const rm = a.querySelector('.rm').getBoundingClientRect(), rev = a.querySelector('.trev').getBoundingClientRect();
      const xs = [...document.querySelectorAll('.tc-mirror tbody tr[data-tk] td.c-act .rm')].map(x => Math.round(x.getBoundingClientRect().left));
      return { after: ab.left >= b.right - 1, width: Math.round(ab.width), inside: rm.left >= ab.left - 1 && rm.right <= ab.right + 1 && rev.left >= ab.left - 1,
        visible: getComputedStyle(a.querySelector('.rm')).visibility, xs: [...new Set(xs)].length };
    });
    check(acts.after && acts.inside && acts.width <= 48, `the hover's ↺/✕ sit in their own column after Match, two icons wide (${JSON.stringify(acts)})`);
    check(acts.visible === 'visible' && acts.xs === 1, `✕ shows on hover, at one x in every row (${acts.xs})`);
    // #654: the Match header sits over its centred pills, and the boundary before the actions
    // column is no resize handle (a press there used to leave the cursor stuck as a resize arrow)
    const hdr = await page.evaluate(() => {
      const th = document.querySelector('.tc-mirror thead th.c-badge'), b = th.getBoundingClientRect();
      const tbl = th.closest('table');
      const opts = { bubbles: true, clientX: b.right, clientY: b.top + b.height / 2 };
      tbl.dispatchEvent(new MouseEvent('mousemove', opts));
      const over = tbl.style.cursor;
      tbl.dispatchEvent(new MouseEvent('mousedown', opts)); tbl.dispatchEvent(new MouseEvent('mouseup', opts));
      tbl.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: b.left + b.width / 2, clientY: opts.clientY }));
      return { align: getComputedStyle(th).textAlign, over, after: tbl.style.cursor };
    });
    check(hdr.align === 'center', `the Match header is centred (${hdr.align})`);
    check(hdr.over !== 'col-resize' && hdr.after !== 'col-resize', `no resize handle before the actions column, and no stuck cursor (${JSON.stringify(hdr)})`);
    await last.locator('.rm').click();
    check((await until(titles, t => t.length === before.length - 1)).length === before.length - 1, '✕ removes a track');

    const added = await page.evaluate(async () => {
      const eventually = async f => { for (let i = 0; i < 400 && !f(); i++) await new Promise(r => setTimeout(r, 25)); return f(); };
      const n = () => MB.releaseEditor.rootField.release().mediums()[0].tracks().length, b = n();
      document.querySelector('.tc-medsec .tc-addn').value = '2';
      document.querySelector('.tc-medsec .tc-addbtn').click();
      await eventually(() => n() === b + 2 && document.querySelectorAll('.tc-medsec .tc-mirror tbody tr[data-tk]').length === b + 2);
      const credits = MB.releaseEditor.rootField.release().mediums()[0].tracks().slice(-2).map(t => (t.artistCredit().names || []).map(x => x.name || (x.artist && x.artist.name) || '').join('').trim());
      return { b, a: n(), rows: document.querySelectorAll('.tc-medsec .tc-mirror tbody tr[data-tk]').length, credits };
    });
    check(added.a === added.b + 2 && added.rows === added.a, `＋2 adds two tracks, shown (${added.b} → ${added.a}, ${added.rows} rows)`);
    check(added.credits.every(c => c === ''), `new tracks are blank, not copies of the previous credit (${JSON.stringify(added.credits)})`);

    const media = await page.evaluate(async () => {
      const eventually = async f => { for (let i = 0; i < 400 && !f(); i++) await new Promise(r => setTimeout(r, 25)); return f(); };
      const addBtn = () => [...document.querySelectorAll('button')].find(b => /add medium/i.test(b.textContent) && b.getAttribute('data-click') === 'addMedium');
      [...document.querySelectorAll('button')].find(b => /add medium/i.test(b.textContent) && b.getAttribute('data-click') === 'open')?.click();
      await eventually(addBtn);
      addBtn()?.click();
      await eventually(() => MB.releaseEditor.rootField.release().mediums().length === 2 && document.querySelectorAll('.tc-medsec').length === 2);
      return { n: MB.releaseEditor.rootField.release().mediums().length, sections: [...document.querySelectorAll('.tc-medsec')].map(s => { const hdr = s.closest('fieldset.advanced-medium')?.querySelector('table.advanced-format'); return !!(hdr && hdr.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) && !!s.querySelector('.tc-addbtn'); }) };
    });
    check(media.n === 2 && media.sections.length === 2 && media.sections.every(Boolean), `a second medium gets its own table, under its format header, with its own ＋ (${JSON.stringify(media)})`);
    check(submitted.length === 0, 'nothing submitted');
  });
});

test.describe('matching on load', () => {
  test.use({ gm: apolloGm({ autoMatch: true, autoMatchRec: false, autoMatchLabel: false, discogsUrlMatch: false }) });

  test('artists it can prove are linked; a changed row can be reverted', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
    const ws = await replayWs(page, new URL('./fixtures/ws-tracklist.json.gz', import.meta.url), { paths: /^\/ws\/(2|js\/entity)\// });
    const submitted = await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
    await page.waitForSelector(ROWS, { timeout: 60000 });
    await page.waitForFunction(() => { const m = window.__apolloEditor.model; return m && m.tracks.length && m.tracks.every(t => t.slots.every(s => !s._pending)); }, null, { timeout: 120000 });
    await idle(page);
    const r = await page.evaluate(() => {
      const m = window.__apolloEditor.model, ko = MB.releaseEditor.rootField.release().mediums()[0].tracks();
      const slots = m.tracks.flatMap(t => t.slots.map(s => ({ t, s })));
      const resolved = slots.filter(x => x.s.committed && x.s.gid);
      // a resolved slot is MusicBrainz's too: the credit names that artist
      const inMb = resolved.filter(({ t, s }) => (ko[t.ti].artistCredit().names || []).some(n => n.artist && n.artist.gid === s.gid));
      return { slots: slots.length, resolved: resolved.length, inMb: inMb.length };
    });
    check(r.resolved > 0, `auto-matching linked artists (${r.resolved} of ${r.slots} slots)`);
    check(r.inMb === r.resolved, `each is in MusicBrainz's credit too (${r.inMb} of ${r.resolved})`);
    const rev = await page.evaluate(async () => {
      const A = window.__apolloEditor, t = A.model.tracks.find(x => A.trackChanged(x));
      if (!t) return null;
      const tk = t.mi + ':' + t.ti, row = () => document.querySelector(`.tc-medsec tr[data-tk="${tk}"]`);
      const before = { revert: !!row().querySelector('.trev:not(.void)'), marked: row().classList.contains('tc-changed') };
      const eventually = async f => { for (let i = 0; i < 400 && !f(); i++) await new Promise(r => setTimeout(r, 25)); return f(); };
      A.revertTrack(t);
      await eventually(() => !A.trackChanged(A.model.tracks.find(x => x.mi + ':' + x.ti === tk)) && !row().classList.contains('tc-changed'));
      const t2 = A.model.tracks.find(x => x.mi + ':' + x.ti === tk);
      const after = { changed: A.trackChanged(t2), revert: !!row().querySelector('.trev:not(.void)'), marked: row().classList.contains('tc-changed') };
      const cred = row().querySelector('.tc-cred');
      cred.value = 'Zzz Changed Credit'; cred.dispatchEvent(new Event('change', { bubbles: true }));
      await eventually(() => row().classList.contains('tc-changed') && !!row().querySelector('.trev:not(.void)'));
      return { before, after, edited: row().classList.contains('tc-changed') && !!row().querySelector('.trev:not(.void)') };
    });
    check(rev, 'a row changed by matching');
    if (rev) {
      check(rev.before.revert && rev.before.marked, 'it shows ↺ and the changed marker');
      check(!rev.after.changed && !rev.after.revert && !rev.after.marked, `↺ puts it back, and both go (${JSON.stringify(rev.after)})`);
      check(rev.edited, 'editing its credited-as marks it changed again, at once');
    }
    check(submitted.length === 0, 'nothing submitted');
    await ws.done();
  });
});
