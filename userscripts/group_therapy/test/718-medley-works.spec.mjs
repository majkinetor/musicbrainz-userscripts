// #718: a recording of a medley ("Mulato Bamba / Mulata Fuzarqueira / João Ninguém") is based
// on several works. MusicBrainz's title guideline separates them with " / ", so the work
// matcher splits such a title into one row per part, matches each, and Apply links the
// recording to every part's work. "Split on /" in the matcher's toolbar turns it off.
//
// The sandbox release is a copy of a19111d0 (Noel Rosa songs, many medleys). Nothing is
// submitted: every POST to /edit is aborted and asserted zero at the end.
import { test, check, until, loadFunctions, frames } from '../../../dev/test/harness.mjs';
import { blockEdits, openRelEditor } from './gt.mjs';

const MEDLEYS = '647c0fd7-b4cf-47c1-bb2f-d841f4daae1a';

test('only a slash with spaces around it splits a title', { tag: ['@unit'] }, async () => {
  const { wmMedleyParts } = await loadFunctions('group_therapy', ['WM_MEDLEY_RE', 'wmMedleyParts']);
  const eq = (got, exp, msg) => { const g = JSON.stringify(got), e = JSON.stringify(exp); check(g === e, g === e ? msg : `${msg} — got ${g}, expected ${e}`); };
  eq(wmMedleyParts('Land of Hope and Dreams / People Get Ready'), ['Land of Hope and Dreams', 'People Get Ready'], 'two works');
  eq(wmMedleyParts('A / B / C'), ['A', 'B', 'C'], 'three works');
  eq(wmMedleyParts('AC/DC'), null, 'a slash without spaces is part of the title');
  eq(wmMedleyParts('Either/Or / Neither'), ['Either/Or', 'Neither'], 'only the spaced slash splits');
  eq(wmMedleyParts('Plain Song'), null, 'no slash, no split');
  eq(wmMedleyParts(' / Song'), null, 'an empty part is no medley');
});

test('the work matcher gives a medley a row per work and links them all', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(240000);
  await openRelEditor(page, inject, MEDLEYS);
  const posts = await blockEdits(page);

  const medley = await page.evaluate(() => window.__groupTherapy.wmRecordings().filter(r => r.parts).map(r => `${r.pos}:${r.part}/${r.parts} ${r.title}`));
  console.log('medley rows: ' + JSON.stringify(medley));
  check(medley.length >= 2, 'the release\'s medley tracks split into part rows');

  await page.getByRole('button', { name: '◎ Match works…' }).click();
  const split = page.locator('.gt-wm-split input');
  check(await split.isChecked(), 'Split on / is on by default');

  // the first medley: its title cell spans its part rows; each part has its own work cell
  const first = await until(() => page.evaluate(() => {
    const tkt = [...document.querySelectorAll('.gt-wm-tbl td.gt-wm-tkt')].find(td => td.rowSpan > 1);
    if (!tkt) return null;
    return { title: tkt.firstChild.textContent, span: tkt.rowSpan, tag: (tkt.querySelector('.gt-wm-medtag') || {}).textContent,
      parts: [...document.querySelectorAll('.gt-wm-pt')].slice(0, tkt.rowSpan).map(e => e.textContent) };
  }), v => !!v);
  console.log('first medley: ' + JSON.stringify(first));
  check(first && first.span === 3 && first.tag === 'medley · 3 works', 'a three-work medley spans three rows, tagged');
  check(first && first.parts.join('|') === 'part 1 · “Mulato Bamba”|part 2 · “Mulata Fuzarqueira”|part 3 · “João Ninguém”', 'each row names its part');

  // match, then give every still-unresolved part a new work, so Apply has all parts
  await page.getByRole('button', { name: '⚡ Match' }).click();
  await until(() => page.locator('.gt-wm-amstatus').textContent(), t => /^matched/.test(t), { timeout: 180000 });
  const picked = await page.evaluate(() => [...document.querySelectorAll('.gt-wm-row')].slice(1, 4).map(tr => (tr.querySelector('.gt-wm-wa, .gt-wm-newtag, .gt-wm-none') || {}).textContent));
  console.log('track 2 parts after match: ' + JSON.stringify(picked));
  await page.getByRole('button', { name: '＋ New work for unresolved' }).click();
  const plan = await page.locator('.gt-cons-plan').textContent();
  console.log('plan: ' + plan);

  await page.getByRole('button', { name: 'Apply' }).click();
  // track 2's recording now carries three performance relationships (staged)
  const works = await until(() => page.evaluate(() => {
    const gt = window.__groupTherapy;
    const tr = [...document.querySelectorAll('tr.track')].find(t => /Mulato Bamba \/ Mulata Fuzarqueira/.test(t.textContent));
    return tr ? gt.recordingRels(tr).filter(r => !r.removed && r.other && r.other.entityType === 'work').map(r => r.other.name) : null;
  }), v => v && v.length >= 3);
  console.log('track 2 works: ' + JSON.stringify(works));
  check(works && works.length === 3, 'Apply links the medley recording to one work per part');

  // turning the split off gives one row per track again
  await page.getByRole('button', { name: '◎ Match works…' }).click();
  await page.locator('.gt-wm-split input').uncheck();
  await frames(page, 2);
  const spans = await page.evaluate(() => [...document.querySelectorAll('.gt-wm-tbl td.gt-wm-tkt')].filter(td => td.rowSpan > 1).length);
  check(spans === 0 && !(await page.locator('.gt-wm-pt').count()), 'Split off: no part rows');
  await page.locator('.gt-wm-split input').check();
  check(posts.length === 0, 'nothing was submitted');
});
