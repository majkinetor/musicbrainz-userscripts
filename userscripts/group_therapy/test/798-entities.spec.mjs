// #798 (majkinetor): "redesign the text pattern interface. It currently opens in
// pop-up, but credit hoarder inlines its interface ... inside the native page"
// and "those pre-picked several entities should have their own part on the
// screen, like in credit hoarder", with matching on the release's evidence.
//
// The parser in the page; an Entities table with a row per name, its candidates
// with their type, life span, area and reasons; ✓ / ✕; the cutoff; and a pick
// remembered for the release artist across a reload. Never submits.
import { test, check, until, frames, attachShot } from '../../../dev/test/harness.mjs';
import { openRelEditor, blockEdits } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy', persist: true } });

test('the text parser: in the page, entities with candidates, cutoff, remembered picks', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  test.setTimeout(300000);
  const posts = await blockEdits(page);
  await openRelEditor(page, inject);
  const relArtist = await page.evaluate(() => window.MB.relationshipEditor.state.entity.artistCredit.names[0].artist.name);

  const open = async () => { await page.click('.gt-clone-btn:has-text("Text parser")'); await page.waitForSelector('.gt-tp'); };
  // no Match button: matching runs by itself after a change; done when nothing says "Matching…"
  const match = async () => {
    await until(() => page.evaluate(() => !document.querySelector('.gt-tp-busy').textContent && !/Matching…/.test(document.querySelector('.gt-tp').innerText) && !!document.querySelector('.gt-tp-erow')), Boolean, { timeout: 120000 });
    await frames(page);
  };
  const ents = () => page.evaluate(() => [...document.querySelectorAll('.gt-tp-erow')].map(tr => ({
    name: tr.querySelector('.gt-tp-ename').textContent,
    picked: !!tr.querySelector('.gt-tp-cand-on'),
    level: ((tr.querySelector('.gt-tp-cand-on .gt-tp-lvl') || {}).className || '').replace(/.*gt-tp-lvl-/, ''),
    cands: tr.querySelectorAll('.gt-tp-cand-pick').length,
    list: [...tr.querySelectorAll('.gt-tp-cand:not(.gt-tp-cand-on) .gt-tp-cand-main')].map(m => m.textContent).join(' | '),
    metas: [...tr.querySelectorAll('.gt-tp-cand-meta')].map(m => m.textContent),
    why: [...tr.querySelectorAll('.gt-tp-why')].map(w => w.textContent),
    below: !!tr.querySelector('.gt-tp-below'),
  })));
  const row = (list, name) => list.find(e => e.name === name) || {};

  await open();
  const inline = await page.evaluate(() => {
    const p = document.querySelector('.gt-tp');
    return { afterBar: document.querySelector('.gt-toolbar').nextElementSibling === p, overlay: !!document.querySelector('.gt-cons-ov') };
  });
  check(inline.afterBar && !inline.overlay, `the parser opens in the page, under the toolbar (${JSON.stringify(inline)})`);
  await page.click('.gt-tp-ta');
  await page.keyboard.press('Escape');
  await frames(page);
  check(await page.locator('.gt-tp').count() === 1, 'Escape does not close it (✕ does)');

  await page.fill('.gt-tp-ta', [`Producer: ${relArtist}`, 'Guitar: John Smith', 'Mastering: Bob Ludwig'].join('\n'));
  await page.dispatchEvent('.gt-tp-ta', 'input');
  await page.selectOption('.gt-tp-cut-sel', 'unique');
  check(!(await page.locator('.gt-tp-resolve').count()), 'no Match button');
  await match();
  let list = await ents();
  console.log('after Match: ' + JSON.stringify(list));
  check(list.length === 3, `a row per name (${list.length})`);
  const pills = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-cnt .gt-tp-pill')].map(p => p.className.replace('gt-tp-pill ', '') + ':' + p.textContent));
  check(JSON.stringify(pills) === '["gt-tp-pill-todo:1 name"]', `the status is one pill per thing left: one name to pick (${JSON.stringify(pills)})`);
  await page.locator('.gt-tp-top').screenshot({ path: 'dev/_798-p.png' });
  const ra = row(list, relArtist);
  check(ra.picked && ra.level === 'strong' && ra.why.some(w => /on release/.test(w)), `the release artist is picked as Strong, saying why (${JSON.stringify(ra)})`);
  const js = row(list, 'John Smith');
  check(!js.picked && js.cands >= 2, `a common name is left with its candidates (${js.cands})`);
  check(js.metas.some(m => /Person/.test(m)), 'each candidate says its type, life span and area');
  const bl = row(list, 'Bob Ludwig');
  check(bl.picked && bl.level === 'unique', `the only holder of a name is picked as Unique name (${JSON.stringify(bl)})`);
  await attachShot(testInfo, page.locator('.gt-tp'), 'i798-entities');

  // the cutoff: Strong leaves the unique name waiting, below the cutoff
  await page.selectOption('.gt-tp-cut-sel', 'strong');
  await frames(page);
  list = await ents();
  check(!row(list, 'Bob Ludwig').picked && row(list, 'Bob Ludwig').below, 'at Strong, the unique name waits on its row, below the cutoff');
  check(row(list, relArtist).picked, 'and the Strong pick stays');
  await page.selectOption('.gt-tp-cut-sel', 'unique');
  await until(ents, l => row(l, 'Bob Ludwig').picked);

  // ✓ picks a candidate for every row with the name; the line table follows
  const jsTr = page.locator('.gt-tp-erow', { has: page.locator('.gt-tp-ename', { hasText: 'John Smith' }) });
  const firstName = await jsTr.locator('.gt-tp-cand-name').first().textContent();
  check(!(await page.locator('.gt-tp-tbl').count()), 'one table: the lines are not a table of their own');
  await jsTr.locator('.gt-tp-cand-pick').first().click();
  list = await until(ents, l => row(l, 'John Smith').picked);
  check(row(list, 'John Smith').picked && row(list, 'John Smith').level === 'you', `✓ picks it, marked as yours (${JSON.stringify(row(list, 'John Smith'))})`);
  const picked = await jsTr.locator('.gt-tp-cand-on .gt-tp-cand-name').textContent();
  check(picked === firstName, `the pick is the candidate ticked (${picked})`);
  const cntText = await page.textContent('.gt-tp-cnt');
  check(cntText === '✓ all picked', `the toolbar says all is picked (${cntText})`);

  // the line the credit came from sits under it: its text and its pattern on one row
  check(await jsTr.locator('.gt-tp-line .gt-tp-raw').inputValue() === 'Guitar: John Smith', 'the line is under its credit, for editing');
  check(await jsTr.locator('.gt-tp-line .gt-tp-ov').count() === 1, 'with its pattern beside it');
  await page.locator('.gt-tp').screenshot({ path: 'dev/_798-d.png' });

  // ✕ brings the candidates back, and nothing re-picks it on its own
  await jsTr.locator('.gt-tp-cand-x').click();
  list = await until(ents, l => !row(l, 'John Smith').picked);
  check(!row(list, 'John Smith').picked && row(list, 'John Smith').cands >= 2, '✕ shows the candidates again');
  // a pick from your own search: ✕ brings those results back, no second search
  await jsTr.locator('.gt-tp-esrch-q').fill('John Smith UK');
  await jsTr.locator('.gt-tp-esrch-q').press('Enter');
  const found = row(await until(ents, l => row(l, 'John Smith').cands > 0 && !/Searching/.test(JSON.stringify(l))), 'John Smith').list;
  await jsTr.locator('.gt-tp-cand-pick').first().click();
  await until(ents, l => row(l, 'John Smith').picked);
  check(row(await ents(), 'John Smith').cands === 0, 'the results hide under the pick');
  await jsTr.locator('.gt-tp-cand-x').click();
  list = await until(ents, l => !row(l, 'John Smith').picked);
  check(found && row(list, 'John Smith').list === found, `✕ shows the search's results again\n  got:  ${row(list, 'John Smith').list}\n  want: ${found}`);
  await jsTr.locator('.gt-tp-cand-pick').first().click();
  await until(ents, l => row(l, 'John Smith').picked);

  // remembered for the release artist: a reload, the same text, Match → picked again
  await openRelEditor(page, inject);
  await open();
  await page.fill('.gt-tp-ta', 'Guitar: John Smith');
  await page.dispatchEvent('.gt-tp-ta', 'input');
  await match();
  list = await ents();
  const again = row(list, 'John Smith');
  console.log('after reload: ' + JSON.stringify(again));
  check(again.picked && again.why.some(w => /your pick/.test(w)), `your pick comes back on the next Match, as your earlier pick (${JSON.stringify(again)})`);

  check(posts.length === 0, `nothing was submitted (${posts.length})`);
});
