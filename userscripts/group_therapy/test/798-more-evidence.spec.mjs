// #798 step 4: "co-credits alongside the release artist (as Credit Hoarder's),
// credits already entered on other releases of the same release group" — opt-in
// ("More evidence"), as they cost more requests.
//
// MusicBrainz's answers for the release group and the recordings are stubbed here,
// so the evidence points at a candidate the spec chooses: John Smith has several
// holders and nothing on the sandbox release backs any of them. Never submits.
import { test, check, until, frames } from '../../../dev/test/harness.mjs';
import { openRelEditor, blockEdits } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy' } });   // fresh: no remembered picks

test('the text parser: More evidence from the release group and co-credits', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(300000);
  const posts = await blockEdits(page);
  const asked = { group: 0, release: 0, recording: 0 };
  let target = null, mode = 'group';
  await page.route(/\/ws\/2\/release\?release-group=/, r => { asked.group++; r.fulfill({ json: { releases: [{ id: '00000000-0000-4000-8000-000000000001', title: 'Sibling' }] } }); });
  await page.route(/\/ws\/2\/release\/00000000-0000-4000-8000-000000000001/, r => {
    asked.release++;
    r.fulfill({ json: { id: '00000000-0000-4000-8000-000000000001', title: 'Sibling', date: '1999', media: [], 'artist-credit': [],
      relations: mode === 'group' && target ? [{ 'target-type': 'artist', type: 'producer', artist: { id: target, name: 'John Smith' } }] : [] } });
  });
  await page.route(/\/ws\/2\/recording\?query=arid/, r => {
    asked.recording++;
    r.fulfill({ json: { recordings: mode === 'co' && target ? [{ id: 'x', 'artist-credit': [{ name: 'Someone', artist: { id: 'ctx' } }, { name: 'John Smith', artist: { id: target, name: 'John Smith' } }] }] : [] } });
  });

  const open = async () => {
    await openRelEditor(page, inject);
    await page.click('.gt-clone-btn:has-text("Text parser")');
    await page.fill('.gt-tp-ta', 'Producer: John Smith');
    await page.dispatchEvent('.gt-tp-ta', 'input');
    await settle();
  };
  const settle = async () => {
    await page.waitForTimeout(700);
    await until(() => page.evaluate(() => !document.querySelector('.gt-tp-busy').textContent && !/Matching…/.test(document.querySelector('.gt-tp').innerText) && !!document.querySelector('.gt-tp-erow')), Boolean, { timeout: 120000 });
    await frames(page);
  };
  const state = () => page.evaluate(() => {
    const tr = document.querySelector('.gt-tp-erow');
    const on = tr.querySelector('.gt-tp-cand-on');
    return {
      picked: on ? on.querySelector('.gt-tp-cand-name').getAttribute('href').split('/').pop() : null,
      why: [...tr.querySelectorAll(on ? '.gt-tp-cand-on .gt-tp-why' : '.gt-tp-why')].map(w => w.textContent + (w.dataset.tip ? ' {' + w.dataset.tip + '}' : '')),
      cands: [...tr.querySelectorAll('.gt-tp-cand-name')].map(a => a.getAttribute('href').split('/').pop()),
    };
  });

  await open();
  const off = await state();
  console.log('off: ' + JSON.stringify(off));
  check(!off.picked && off.cands.length > 1, `off: several John Smiths, none picked (${off.cands.length})`);
  check(asked.group === 0 && asked.recording === 0, `off: no release group or recording request (${JSON.stringify(asked)})`);
  target = off.cands[off.cands.length - 1];   // the last: the one evidence must lift

  // on: the release group's other release credits the target as producer
  await page.click('.gt-tp-deep');
  await settle();
  const grp = await state();
  console.log('group: ' + JSON.stringify(grp) + ' ' + JSON.stringify(asked));
  check(asked.group >= 1 && asked.release >= 1, 'on: the release group\'s releases are read');
  check(grp.picked === target && grp.why.some(w => /same group/.test(w) && /producer on “Sibling” 1999/.test(w)), `on: the one the release group credits is picked, and says where (${JSON.stringify(grp.why)})`);

  // co-credit: nothing in the group; a recording credits the target beside the release artist
  mode = 'co';
  await open();   // a new page: its caches are gone (and this spec's storage too)
  if (!(await page.evaluate(() => document.querySelector('.gt-tp-deep').classList.contains('on')))) { await page.click('.gt-tp-deep'); await settle(); }
  const co = await state();
  console.log('co: ' + JSON.stringify(co) + ' ' + JSON.stringify(asked));
  check(asked.recording >= 1, 'on: an open name asks who recordings credit beside the release artist');
  check(co.picked === target && co.why.some(w => /co-credit/.test(w) && /on 1 recording\}/.test(w)), `the co-credited one is picked (${JSON.stringify(co.why)})`);

  check(posts.length === 0, `nothing was submitted (${posts.length})`);
});
