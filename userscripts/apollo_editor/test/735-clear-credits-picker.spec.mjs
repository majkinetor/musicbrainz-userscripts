// #735: right-click on a credited-as × clears every credited-as on the tracklist (an import's
// lowercase credits beside the matched artists), and the artist picker stays on screen on the
// last tracks (it opens above its input when there's no room below).
import { test, check, until, replayWs } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

const ROWS = '.tc-medsec .tc-mirror tbody tr[data-tk]';

test.describe('credited-as and the picker', () => {
  test.use({ gm: apolloGm({ autoMatch: true, autoMatchRec: false, autoMatchLabel: false, discogsUrlMatch: false }) });

  test('right-click on a credited-as × clears them all', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    const ws = await replayWs(page, new URL('./fixtures/ws-tracklist.json.gz', import.meta.url), { paths: /^\/ws\/(2|js\/entity)\// });
    const submitted = await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
    await page.waitForSelector(ROWS, { timeout: 60000 });
    await page.waitForFunction(() => { const m = window.__apolloEditor.model; return m && m.tracks.length && m.tracks.every(t => t.slots.every(s => !s._pending)); }, null, { timeout: 120000 });

    // give three matched slots a lowercase credited-as, the way an import leaves them
    const set = await page.evaluate(async () => {
      const A = window.__apolloEditor, eventually = async f => { for (let i = 0; i < 400 && !f(); i++) await new Promise(r => setTimeout(r, 25)); return f(); };
      const picks = A.model.tracks.filter(t => t.slots.some(s => s.committed && s.gid && s.name)).slice(0, 3);
      for (const t of picks) {
        const row = () => document.querySelector(`.tc-medsec tr[data-tk="${t.mi}:${t.ti}"]`);
        const s = t.slots.find(x => x.committed && x.gid && x.name), cred = row().querySelector('.tc-cred');
        cred.value = s.name.toLowerCase() + ' x'; cred.dispatchEvent(new Event('change', { bubbles: true }));
        await eventually(() => A.model.tracks.find(x => x.mi === t.mi && x.ti === t.ti).slots.some(y => y.creditedAs === s.name.toLowerCase() + ' x'));
      }
      const over = A.model.tracks.flatMap(t => t.slots).filter(s => s.name && s.creditedAs && s.creditedAs !== s.name);
      return { picked: picks.length, overrides: over.length };
    });
    check(set.picked === 3 && set.overrides >= 3, `three credited-as overrides to clear (${JSON.stringify(set)})`);

    const clr = page.locator('.tc-has-cred .tc-cred-clr').first();
    await clr.dispatchEvent('contextmenu', { button: 2 });
    const after = await until(() => page.evaluate(() => {
      const A = window.__apolloEditor, ko = MB.releaseEditor.rootField.release().mediums()[0].tracks();
      const slots = A.model.tracks.flatMap(t => t.slots.map(s => ({ t, s }))).filter(x => x.s.name);
      const left = slots.filter(x => x.s.creditedAs && x.s.creditedAs !== x.s.name).length;
      // MusicBrainz's own credit reads the artist's name too
      const koLeft = slots.filter(({ t, s }) => (ko[t.ti].artistCredit().names || []).some(n => n.artist && n.artist.gid === s.gid && n.name !== s.name)).length;
      return { left, koLeft, shown: document.querySelectorAll('.tc-has-cred').length };
    }), r => r.left === 0);
    check(after.left === 0 && after.koLeft === 0, `no credited-as override is left, in Apollo or MusicBrainz (${JSON.stringify(after)})`);
    check(after.shown === 0, 'and none shows');
    check(submitted.length === 0, 'nothing submitted');
    await ws.done();
  });
});

test.describe('the picker near the bottom', () => {
  test.use({ gm: apolloGm() });

  test('the artist picker opens above its input when there is no room below', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await page.setViewportSize({ width: 1400, height: 700 });
    await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
    await page.waitForSelector(ROWS, { timeout: 60000 });
    // the last row, scrolled to just above the bottom edge of the window, its search focused
    const at = await page.evaluate(sel => {
      const rows = document.querySelectorAll(sel), i = rows[rows.length - 1].querySelector('.tc-search input.nm');
      const r = i.getBoundingClientRect(); window.scrollBy(0, r.bottom - (innerHeight - 40));
      i.focus(); i.select();
      return { top: Math.round(i.getBoundingClientRect().top), vh: innerHeight, focused: document.activeElement === i };
    }, ROWS);
    check(at.focused && at.vh - at.top < 120, `the last track's artist search, near the bottom (${JSON.stringify(at)})`);
    // the first keystroke un-links a matched slot (the row redraws); then search like in the report, on an unresolved slot
    await page.keyboard.type('x', { delay: 30 });
    await page.waitForTimeout(500);
    await page.evaluate(sel => { const rows = document.querySelectorAll(sel), i = rows[rows.length - 1].querySelector('.tc-search input.nm'); i.focus(); i.select(); }, ROWS);
    await page.keyboard.type('helen', { delay: 30 });
    const box = await until(() => page.evaluate(() => {
      const p = document.querySelector('.tc-acpop'); if (!p) return null;
      const r = p.getBoundingClientRect(), i = document.activeElement.getBoundingClientRect();
      return { rows: p.querySelectorAll('.tc-acrow:not(.none)').length, top: Math.round(r.top), bottom: Math.round(r.bottom), inTop: Math.round(i.top), inBottom: Math.round(i.bottom), vh: innerHeight };
    }), b => b && b.rows > 0, { timeout: 20000 });
    check(box && box.rows > 0, `the picker lists artists (${JSON.stringify(box)})`);
    check(box && box.bottom <= box.vh && box.top >= 0, 'it fits in the window');
    check(box && box.bottom <= box.inTop + 1, 'above its input, since there is no room below');
  });
});
