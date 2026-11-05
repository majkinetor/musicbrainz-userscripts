// #908 — merge any entity type. Two fresh entities per type: the first comes in
// from the add menu (Ctrl+click on Fusion's corner icon, on its own page), the
// second is pasted into the board. One group is built, Merge is clicked, and MB
// is asked whether the merge edit exists. REAL merges on test.musicbrainz.org.
import { test, check, until, pristine } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Fusion' } });

for (const type of ['artist', 'release']) {
  test(`a ${type} group merges through MB's merge form`, { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    const a = await pristine(page, type, type === 'release' ? { tracks: 1 } : {}), b = await pristine(page, type, type === 'release' ? { tracks: 1 } : {});
    await page.goto(`https://test.musicbrainz.org/${type}/${a.mbid}`, { waitUntil: 'domcontentloaded' });
    await inject('fusion', { waitFor: '__fusion' });
    await until(() => page.locator('#fs-launch').count(), n => n === 1);
    await page.click('#fs-launch', { modifiers: ['Control'] });
    await page.waitForSelector('#fs-addmenu');
    check(await page.locator('#fs-addmenu input:checked').count() === 0, 'nothing in the add menu is preselected');
    await page.check('#fs-addmenu input[data-i="0"]');
    await page.click('#fs-addmenu [data-a="add"]');
    await until(() => page.locator(`#fs-launch-ctrs .fs-ctr[data-type="${type}"]`).count(), n => n === 1);
    await page.click(`#fs-launch-ctrs .fs-ctr[data-type="${type}"]`);
    await page.click('#fs-em-pool-hdr .fs-addbtn');   // the pool header's + unrolls the paste field
    await page.fill('#fs-em-input', `https://test.musicbrainz.org/${type}/${b.mbid}`);
    await page.press('#fs-em-input', 'Enter');
    await until(() => page.locator('#fs-em-pool .fs-pcard').count(), n => n === 2, { timeout: 30000 });
    await page.press('#fs-em-input', 'Escape');   // fold the paste field, which covers the header's buttons
    await page.click('#fs-em-overlay [data-act="newgroup"]');
    check(await page.locator('#fs-em-groups .fs-grow').count() === 2, 'one group of two');
    await page.click('#fs-em-groups [data-act="merge-group"]');
    await page.waitForSelector('#fs-em-groups .fs-mbtn.fs-done, #fs-em-groups .fs-mbtn.fs-err', { timeout: 90000 });
    const err = await page.locator('#fs-em-groups .fs-mbtn.fs-err').getAttribute('data-tip').catch(() => null);
    if (err) console.log((await page.evaluate(() => window.__fusion.getLogLines())).filter(l => /merge|POST|Merge/.test(l)).join('\n'));
    check(!err, 'merged without an error: ' + err);
    const ok = await until(() => page.evaluate(async gids => {
      for (const gid of gids) { const j = await fetch('/ws/js/entity/' + gid).then(r => r.ok ? r.json() : null).catch(() => null); if (!j || !(j.editsPending || j.gid !== gid)) return false; }
      return true;
    }, [a.mbid, b.mbid]), Boolean, { timeout: 30000, every: 2000 });
    check(ok, 'MB shows the merge edit on both');
  });
}
