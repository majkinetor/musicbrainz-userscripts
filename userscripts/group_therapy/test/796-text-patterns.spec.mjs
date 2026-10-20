// #796 a pattern written into the pasted text: a `{{E - R}}` line sets the pattern for
// the lines after it, `{{}}` goes back to the parser's own, and `{{…}}` anywhere else in
// a line sets it for that line. Art Station's AI scan asks for these, so one paste can carry
// credits printed in several shapes.
import { test, check, frames, loadFunctions } from '../../../dev/test/harness.mjs';
import { blockEdits, openRelEditor } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('{{…}} reads as a block or a line pattern, and nothing else does', { tag: ['@unit'] }, async () => {
  const { txpDirective } = await loadFunctions('group_therapy', ['txpDirective']);
  const j = x => JSON.stringify(x);
  check(j(txpDirective('{{E - R}}')) === j({ block: 'E - R' }), 'a line of only {{…}} is a block pattern');
  check(j(txpDirective('  {{ R: E[,] }}  ')) === j({ block: 'R: E[,]' }), 'trimmed inside and out');
  check(j(txpDirective('{{}}')) === j({ block: '' }), '{{}} is an empty block (back to the parser\'s pattern)');
  check(j(txpDirective('Nick Robbins - Mastering {{E - R}}')) === j({ text: 'Nick Robbins - Mastering', inline: 'E - R' }), 'a trailing {{…}} is the line\'s pattern, cut off the text');
  check(txpDirective('Mastering: Nick Robbins') === null, 'a plain credit has none');
  check(txpDirective('Guitar [tracks 1-3]: Alice') === null, 'brackets are not braces');
  check(j(txpDirective('Ron Paz - Percussion {{E - R}} (PERSONNEL)')) === j({ text: 'Ron Paz - Percussion (PERSONNEL)', inline: 'E - R' }), 'a mid-line {{…}} is the line\'s pattern too, cut out of the text');
  check(j(txpDirective('{{R: E}} Bass: Bob')) === j({ text: 'Bass: Bob', inline: 'R: E' }), 'a leading {{…}} on a line with text is the line\'s pattern, not a block');
});

test('the parser follows the text\'s patterns, and a hand-set one still wins', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const posts = await blockEdits(page);
  await openRelEditor(page, inject);
  await page.evaluate(() => window.__groupTherapy.openTextParser());
  await frames(page);
  await page.fill('.gt-tp-pat', 'R: E');
  await page.fill('.gt-tp-ta', [
    'Mastering: Nick Robbins',
    '{{E - R[,]}}',
    'Cameron Allen - Flute, Tenor Saxophone',
    '{{}}',
    'Mixed By: Alice',
    'Bob / Bass {{E / R}}',
  ].join('\n'));
  await frames(page);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-row')].map(tr => [...tr.querySelectorAll('.gt-tp-c')].slice(0, 2).map(td => td.textContent).join(' | ')));
  console.log(rows);
  const want = ['Mastering | Nick Robbins', 'Flute | Cameron Allen', 'Tenor Saxophone | Cameron Allen', 'Mixed By | Alice', 'Bass | Bob'];
  check(JSON.stringify(rows) === JSON.stringify(want), 'each line parsed by its pattern, directive lines make no row — ' + JSON.stringify(rows));

  const ph = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-ov')].map(i => i.placeholder));
  check(JSON.stringify(ph) === JSON.stringify(['R: E', 'E - R[,]', 'R: E', 'E / R']), 'a line\'s pattern box shows the pattern the text set — ' + JSON.stringify(ph));

  // freezing pins only lines on the parser's own pattern
  await page.click('.gt-tp-freeze');
  const ov = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-ov')].map(i => i.value));
  check(JSON.stringify(ov) === JSON.stringify(['R: E', '', 'R: E', '']), 'freeze leaves the text-set lines alone — ' + JSON.stringify(ov));

  // a pattern typed in a line's box beats the text's
  await page.locator('.gt-tp-ov').nth(1).fill('R - E[,]');
  await frames(page);
  const r2 = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-row')].map(tr => [...tr.querySelectorAll('.gt-tp-c')].slice(0, 2).map(td => td.textContent).join(' | ')));
  check(r2[1] === 'Cameron Allen | Flute', 'the hand-set pattern wins — ' + JSON.stringify(r2));
  check(posts.length === 0, 'nothing submitted');
});
