// #798 (majkinetor): "[] Use MB name as credit". Off, a credit keeps the text's
// spelling as its credited-as name when it differs from MusicBrainz's; on, it is
// credited by the MusicBrainz name. Checked on what Apply stages; never submits.
import { test, check, until, frames } from '../../../dev/test/harness.mjs';
import { openRelEditor, blockEdits, installRelReader } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy', persist: true } });

test('the text parser: Use MB name as credit', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(300000);
  const posts = await blockEdits(page);

  // stage "Mastering: bob ludwig" with the option set as asked; → the staged credit
  const stage = async (mbName) => {
    await openRelEditor(page, inject);
    await installRelReader(page);
    await page.click('.gt-clone-btn:has-text("Text parser")');
    const cb = page.locator('.gt-tp-mbname input');
    if (await cb.isChecked() !== mbName) await cb.click();
    await page.fill('.gt-tp-ta', 'Mastering: bob ludwig');
    await page.dispatchEvent('.gt-tp-ta', 'input');
    await until(() => page.evaluate(() => /1 credit ready/.test(document.querySelector('.gt-tp-cnt').textContent)), Boolean, { timeout: 120000 });
    const tip = await page.getAttribute('.gt-tp-ename', 'data-tip');
    await page.click('.gt-tp .gt-cons-apply');
    await frames(page);
    const credit = await until(() => page.evaluate(() => {
      for (const it of document.querySelectorAll('#release-rels .relationship-item')) {
        const r = window.__rel(it);
        if (!r || r._status !== 1) continue;
        const [e, c] = r.entity0.entityType === 'artist' ? [r.entity0, r.entity0_credit] : [r.entity1, r.entity1_credit];
        if (e && e.name === 'Bob Ludwig') return { credit: c || '' };
      }
      return null;
    }), Boolean);
    return { tip, credit: credit && credit.credit };
  };

  const off = await stage(false);
  console.log('off: ' + JSON.stringify(off));
  check(off.credit === 'bob ludwig', `off: credited as the text spells it (${JSON.stringify(off.credit)})`);
  check(/Credited as “bob ludwig”/.test(off.tip) && /Right-click: credit as “Bob Ludwig”/.test(off.tip), `off: the name's tooltip says so, and offers the MusicBrainz name (${off.tip})`);

  const on = await stage(true);
  console.log('on: ' + JSON.stringify(on));
  check(on.credit === '', `on: credited by the MusicBrainz name, no credited-as (${JSON.stringify(on.credit)})`);
  check(/Credited as “Bob Ludwig”, the MusicBrainz name/.test(on.tip), `on: the tooltip says the MusicBrainz name (${on.tip})`);

  check(posts.length === 0, `nothing was submitted (${posts.length})`);
});
