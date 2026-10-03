// #668 (majkinetor): "Edit note dominates enter edit so we can't really see most of the
// individual progress. Edit note is rarely changed, and it often holds a lot of text
// from maximization script." Redesign: the note opens folded to a one-line summary,
// each row shows its cover and a progress bar under the label, and Dry run is a menu
// item on Submit edits instead of a footer checkbox.
//
// test.musicbrainz.org, add-cover-art: a dry run sends nothing, and every POST is
// aborted anyway.
import { test, check, until, attachShot } from '../../../dev/test/harness.mjs';
import { openArtStation, blockPosts } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

const NOTE = 'https://www.beatport.com/release/rue-de-paris/20267\n * https://geo-media.beatport.com/image_size/1400x1400/x.jpg\n   → Maximised to https://geo-media.beatport.com/image_size/0x0/x.jpg\nSeeded from https://musicbrainz.org/release/x\n–\nMB: Enhanced Cover Art Uploads\nhttps://github.com/ROpdebee/mb-userscripts';

test('the edit note is folded, rows carry a cover, and Dry run lives in the Submit menu', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }, testInfo) => {
  const posts = await blockPosts(page);
  await openArtStation(page, inject, { path: 'add-cover-art' });
  const opened = await page.evaluate(async () => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
    const dt = new DataTransfer(); dt.items.add(new File([png], 'commit-668.png', { type: 'image/png' }));
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 100)); if (!document.querySelector('.as-commit')?.disabled) break; }
    document.querySelector('.as-commit').click();
    for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 100)); if (document.querySelector('#as-commit .as-cm-nb')) return true; }
    return false;
  });
  check(opened, 'the commit window opened');
  if (!opened) return;

  // a long note, as a sourcing script leaves it
  await page.evaluate(n => { const t = document.querySelector('#as-commit .as-cm-note'); t.value = n; t.dispatchEvent(new Event('input')); }, NOTE);
  const folded = await page.evaluate(() => ({
    hidden: getComputedStyle(document.querySelector('#as-commit .as-cm-nbody')).display === 'none',
    lines: document.querySelector('#as-commit .as-cm-nl').textContent,
    preview: document.querySelector('#as-commit .as-cm-np').textContent,
    noteH: Math.round(document.querySelector('#as-commit .as-cm-nb').getBoundingClientRect().height),
  }));
  check(folded.hidden, 'the note field starts folded');
  check(folded.lines === '7 lines', `the summary counts its lines (${folded.lines})`);
  check(folded.preview.startsWith('beatport.com/release/rue-de-paris'), `…and previews the first one (${folded.preview})`);
  check(folded.noteH < 60, `folded, it takes one row (${folded.noteH}px)`);

  const row = await page.evaluate(() => {
    const op = document.querySelector('#as-commit .as-cm-op');
    const bar = op.querySelector('.as-cm-bar'), lb = op.querySelector('.as-cm-lb');
    return { thumb: !!op.querySelector('.as-cm-th img, .as-cm-th .as-cm-thi'), barBelow: bar.getBoundingClientRect().top >= lb.getBoundingClientRect().bottom - 1 };
  });
  check(row.thumb, 'the row shows the cover it uploads');
  check(row.barBelow, 'its progress bar sits under the label');
  await attachShot(testInfo, page.locator('#as-commit .as-cm-box'), 'folded');

  await page.click('#as-commit .as-cm-ns');
  check(await until(() => page.evaluate(() => getComputedStyle(document.querySelector('#as-commit .as-cm-nbody')).display !== 'none')), 'a click unfolds the note');
  await page.click('#as-commit .as-cm-ns');
  check(await until(() => page.evaluate(() => getComputedStyle(document.querySelector('#as-commit .as-cm-nbody')).display === 'none')), '…and another folds it again');

  check(await page.evaluate(() => !document.querySelector('#as-commit input.as-cm-dryrun')), 'there is no Dry run checkbox any more');
  check(await page.evaluate(() => document.querySelector('#as-commit .as-cm-go').textContent === 'Submit edits'), 'the main button submits');
  // an outside press closes the menu without also closing the dialog under it
  await page.click('#as-commit .as-cm-more');
  check(await page.isVisible('#as-commit .as-cm-menu'), '▾ opens the run menu');
  await page.mouse.click(5, 5);
  check(await page.evaluate(() => !!document.getElementById('as-commit') && document.querySelector('#as-commit .as-cm-menu').hidden), 'a click outside closes the menu, not the dialog');

  await page.click('#as-commit .as-cm-more');
  await page.click('#as-commit .as-cm-dryrun');
  const dry = await until(() => page.evaluate(() => document.querySelector('#as-commit .as-cm-op .as-cm-st')?.textContent === '👁'), Boolean, { timeout: 15000 });
  check(dry, `Dry run previews the operation (${await page.evaluate(() => document.querySelector('#as-commit .as-cm-op .as-cm-st')?.textContent)})`);
  check(await until(() => page.evaluate(() => !document.querySelector('#as-commit .as-cm-go').disabled && !document.querySelector('#as-commit .as-cm-more').disabled)), 'after it, Submit and the menu are available again');
  await attachShot(testInfo, page.locator('#as-commit .as-cm-box'), 'after-dry-run');
  check(!posts.some(u => /edit-cover-art|ws\/js\/edit/.test(u)), `nothing was submitted (${posts.length} POSTs, all aborted)`);
});
