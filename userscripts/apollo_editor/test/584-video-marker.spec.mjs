// #584 (majkinetor): "In recordings editor the video icons are displayed after
// the titles. While in the original editor they shown before titles. The latter
// makes it easier to scan and notice videos in the list (because titles rarely
// have same lengths)." Follow-up: "also show in recording table."
//
// So two things: the marker LEADS the title, and it appears in the tracklist
// too — which is where you actually need it (#586 on this same release is about
// pushing exactly these three video tracks into the data section, and the
// tracklist showed no sign of which ones they were).
//
// Both checks are positional, not just "the element exists": DOM order AND
// geometry, since a leading element that CSS floats to the right would satisfy
// the first alone.
//
// Pre-fix build: the tracklist has zero markers, and the recordings table's sit
// after the title — both halves fail.
import { test, check, settled, frames } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });
const MBID = '55530bc0-97ec-4256-97fc-e6058958c251';

test('the video marker leads the title, in both tables', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const posted = await openApollo(page, inject, { release: MBID });
  const tab = async n => {
    await page.evaluate(x => { const b = [...document.querySelectorAll('#tc-nav-bar button, #tc-nav-bar a')].find(e => e.textContent.trim().toLowerCase().startsWith(x)); if (b) b.click(); }, n);
    await settled(page);   // the tab has loaded what it shows, and rendered
    await frames(page);
  };

  // how many of this release's recordings really are videos — the number to expect
  const videos = await page.evaluate(() => window.__apolloEditor.readRecordings().filter(r => r.recVideo).length);
  check(videos === 3, `fixture: ${videos} video recordings (his three video karaoke tracks)`);

  await tab('tracklist');
  const tl = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.tc-mirror tr[data-tk]')];
    const marked = rows.filter(r => r.querySelector('.tc-rec-video'));
    return {
      rows: rows.length, marked: marked.length,
      leads: marked.length > 0 && marked.every(r => {
        const mk = r.querySelector('.tc-rec-video'), inp = r.querySelector('.t-title');
        if (!mk || !inp) return false;
        if (!(mk.compareDocumentPosition(inp) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
        /* When title enlargement is on the input rests behind a .t-title-disp span
           and can measure as an empty box, so compare against whichever of the two
           is actually painted. */
        const disp = r.querySelector('.t-title-disp');
        const shown = [disp, inp].filter(e => e && e.getBoundingClientRect().width > 1)[0];
        return !!shown && mk.getBoundingClientRect().right <= shown.getBoundingClientRect().left + 1;
      }),
      geom: marked.map(r => {
        const mk = r.querySelector('.tc-rec-video'), inp = r.querySelector('.t-title'), disp = r.querySelector('.t-title-disp');
        const rr = e => (e ? [Math.round(e.getBoundingClientRect().left), Math.round(e.getBoundingClientRect().right)] : null);
        return { mk: rr(mk), disp: rr(disp), inp: rr(inp) };
      }),
      numbers: marked.map(r => r.querySelector('.t-num') && r.querySelector('.t-num').value),
    };
  });
  check(tl.rows > 0, `the tracklist mirror rendered (${tl.rows} rows)`);
  check(tl.marked === videos, `the tracklist marks all ${videos} video tracks (${tl.marked}) — "also show in recording table"`);
  check(tl.leads, 'in the tracklist the marker is before the title, in DOM order and on screen');

  await tab('recording');
  const rec = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#tc-recwrap tr.tc-recrow')];
    const marked = rows.filter(r => r.querySelector('.tc-rec-video'));
    return {
      rows: rows.length, marked: marked.length,
      lead: marked.filter(r => r.querySelector('.tc-rec-video.lead')).length,
      leads: marked.length > 0 && marked.every(r => {
        const cell = r.querySelector('.tc-recname'), mk = cell && cell.querySelector('.tc-rec-video');
        if (!cell || !mk) return false;
        /* Measure against the title's PAINTED extent, text nodes included. An
           earlier version compared only element children and the recording title
           is often a bare text node, so it had nothing to compare against and
           passed on the broken build with the marker sitting after the title. */
        const rest = [...cell.childNodes].filter(n => n !== mk && !(n.nodeType === 1 && n.classList.contains('tc-rec-rev')));
        let left = Infinity;
        for (const n of rest) {
          let box;
          if (n.nodeType === 1) box = n.getBoundingClientRect();
          else { const rg = document.createRange(); rg.selectNodeContents(n); box = rg.getBoundingClientRect(); }
          if (box.width > 0) left = Math.min(left, box.left);
        }
        if (left === Infinity) return false;   // nothing painted to be in front of — not a real check
        return mk.getBoundingClientRect().right <= left + 1;
      }),
    };
  });
  check(rec.marked === videos, `the recordings table marks all ${videos} (${rec.marked})`);
  check(rec.lead === videos, `each carries the leading-spacing class (${rec.lead})`);
  check(rec.leads, 'in the recordings table the marker is before the title, in DOM order and on screen');

});
