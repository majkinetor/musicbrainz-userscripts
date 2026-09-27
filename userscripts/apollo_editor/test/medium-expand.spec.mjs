// Expanding collapsed media. MusicBrainz's editor loads a big release's media only when
// asked; Apollo shows each collapsed medium with an expand control and hides the native
// load buttons.
//
// #149: every collapsed medium is shown, and any of them expands (only the first did).
// #616 (majkinetor): "Tracks not visible 10s after expanding medium". The recording
//   auto-match waited up to 15 s for every medium to load (collapsed ones never do) and
//   held the tracklist back meanwhile. A medium's tracks now show as soon as MusicBrainz
//   has them.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.describe('#149', () => {
  test.use({ gm: apolloGm() });
  test('every collapsed medium shows, and each expands', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openApollo(page, inject, { release: '60e810ef-7ef1-4e90-8482-ab4653802786', tab: 'recordings' });   // 4 collapsed media
    await page.waitForSelector('#tc-recwrap .tc-rectbl', { timeout: 30000 });
    const mediums = await page.evaluate(() => MB.releaseEditor.rootField.release().mediums().length);
    const init = await page.evaluate(() => ({
      collapsed: document.querySelectorAll('#tc-recwrap tr.tc-recmed-coll').length,
      buttons: document.querySelectorAll('#tc-recwrap .tc-recmed-exp').length,
      rows: document.querySelectorAll('#tc-recwrap tr.tc-recrow').length,
      nativeShown: [...document.querySelectorAll('#recordings button[data-click="loadTracks"]')].some(b => b.offsetParent !== null),
    }));
    check(mediums >= 2 && init.collapsed === mediums && init.buttons === mediums && init.rows === 0, `all ${mediums} media collapsed, each with its control (${JSON.stringify(init)})`);
    check(!init.nativeShown, "MusicBrainz's own load buttons are hidden");
    const expand = mi => page.evaluate(mi => document.querySelector(`#tc-recwrap tr.tc-recmed-coll[data-mi="${mi}"] .tc-recmed-exp`).click(), mi);
    const rowsOf = mi => page.waitForFunction(mi => document.querySelectorAll(`#tc-recwrap tr.tc-recrow[data-mi="${mi}"]`).length, mi, { timeout: 30000 }).then(h => h.jsonValue()).catch(() => 0);
    await expand(0);
    check(await rowsOf(0) > 0, 'the first medium expands');
    const second = await page.evaluate(() => { const r = document.querySelector('#tc-recwrap tr.tc-recmed-coll'); return r ? +r.dataset.mi : -1; });
    await expand(second);
    check(await rowsOf(second) > 0, `and so does another (medium ${second + 1})`);
  });
});

test.describe('#616', () => {
  test.use({ gm: apolloGm({ autoMatchRec: true }) });   // his setup: that pass held the tracklist
  test('an expanded medium shows at once', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    const BUDGET = 3000;   // ms from MusicBrainz having the tracks to Apollo showing them
    await openApollo(page, inject, { release: 'ade2956c-8d7e-4ab3-b359-b55b5ef603e9', tab: 'tracklist' });   // 14 one-track media
    await page.waitForTimeout(1200);   // the recording auto-match has started waiting by now
    const state = () => page.evaluate(() => ({ rows: document.querySelectorAll('.tc-mirror tbody tr').length, loaded: MB.releaseEditor.rootField.release().mediums().filter(m => m.loaded()).length, total: MB.releaseEditor.rootField.release().mediums().length }));
    const s0 = await state();
    check(s0.total > 3 && s0.loaded < s0.total, `collapsed media (${s0.loaded}/${s0.total} loaded)`);
    const expandAndTime = async ix => {
      const before = (await state()).rows, t0 = Date.now();
      await page.evaluate(ix => { const ms = MB.releaseEditor.rootField.release().mediums(); ix.forEach(i => ms[i] && !ms[i].loaded() && ms[i].loadTracks()); }, ix);
      let loaded = null, firstLoaded = null, shown = null, firstShown = null;
      for (let i = 0; i < 250 && shown == null; i++) {
        const s = await state();
        const [all, some] = await page.evaluate(ix => { const ms = MB.releaseEditor.rootField.release().mediums(); return [ix.every(i => ms[i].loaded()), ix.some(i => ms[i].loaded())]; }, ix);
        if (loaded == null && all) loaded = Date.now() - t0;
        if (firstLoaded == null && some) firstLoaded = Date.now() - t0;
        if (firstShown == null && s.rows > before) firstShown = Date.now() - t0;
        if (s.rows >= before + ix.length) shown = Date.now() - t0; else await page.waitForTimeout(100);
      }
      return { loaded, firstLoaded, shown, firstShown };
    };
    const one = await expandAndTime([1]);
    check(one.shown != null && one.shown - (one.loaded || 0) < BUDGET, `one medium: on screen ${one.shown} ms after expanding; MusicBrainz had it at ${one.loaded} ms`);
    const rest = await page.evaluate(() => MB.releaseEditor.rootField.release().mediums().map((m, i) => (m.loaded() ? -1 : i)).filter(i => i >= 0));
    const all = await expandAndTime(rest);
    check(all.firstShown != null && all.firstShown - (all.firstLoaded || 0) < BUDGET, `all ${rest.length}: the first shows as it loads, not after the rest (${all.firstShown} vs ${all.firstLoaded} ms)`);
    check(all.shown != null && all.shown - (all.loaded || 0) < BUDGET, `all ${rest.length}: on screen within ${BUDGET} ms of loading (${all.shown} vs ${all.loaded} ms)`);
  });
});
