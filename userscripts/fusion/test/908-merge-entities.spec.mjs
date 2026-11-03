// #908 — merge any entity type. Two fresh entities per type go into Fusion's pool
// through the mbu-fusion-add event (Event Horizon's button), one group is built
// from the window's buttons, Merge is clicked, and MB is asked whether the merge
// edit exists. REAL merges on test.musicbrainz.org (the sandbox).
import { test, check, until, pristine } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Fusion' } });

for (const type of ['artist', 'release']) {
  test(`a ${type} group merges through MB's merge form`, { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    const a = await pristine(page, type, type === 'release' ? { tracks: 1 } : {}), b = await pristine(page, type, type === 'release' ? { tracks: 1 } : {});
    await page.goto('https://test.musicbrainz.org/', { waitUntil: 'domcontentloaded' });
    await inject('fusion', { waitFor: '__fusion' });
    for (const x of [a, b]) {
      const prevented = await page.evaluate(d => { const e = new CustomEvent('mbu-fusion-add', { cancelable: true, detail: JSON.stringify(d) }); document.dispatchEvent(e); return e.defaultPrevented; }, { type, gid: x.mbid, name: x.name });
      check(prevented, 'Fusion answered the add event');
    }
    await until(() => page.locator('#fs-launch').count(), n => n === 1);
    await page.click('#fs-launch');
    await page.click(`#fs-em-overlay [data-tab="${type}"]`);
    check(await page.locator('#fs-em-pool .fs-em-row').count() === 2, 'both are in the pool');
    await page.click('#fs-em-overlay [data-act="newgroup"]');
    check(await page.locator('#fs-em-groups .fs-em-row').count() === 2, 'one group of two');
    await page.click('#fs-em-groups [data-act="merge"]');
    await page.waitForSelector('#fs-em-groups .fs-em-ok, #fs-em-groups .fs-em-err', { timeout: 90000 });
    const err = await page.locator('#fs-em-groups .fs-em-err').textContent().catch(() => null);
    if (err) console.log((await page.evaluate(() => window.__fusion.getLogLines())).filter(l => /merge|POST|Merge/.test(l)).join('\n'));
    check(!err, 'merged without an error: ' + err);
    const ok = await until(() => page.evaluate(async gids => {
      for (const gid of gids) { const j = await fetch('/ws/js/entity/' + gid).then(r => r.ok ? r.json() : null).catch(() => null); if (!j || !(j.editsPending || j.gid !== gid)) return false; }
      return true;
    }, [a.mbid, b.mbid]), Boolean, { timeout: 30000, every: 2000 });
    check(ok, 'MB shows the merge edit on both');
  });
}
