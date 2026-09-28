// #456: the pattern Track parser's window (its engine is in pattern-engine.spec.mjs).
//
// It opens seeded with the current tracklist and the native parser's "#. T - A (L)"; the
//   pattern and each row's override have a clear-✕; the paste box resizes vertically; a
//   raw cell shows its whole text, selectable.
// Split on first/last: the toggle flips which of a repeated separator splits.
// Selecting a span of a raw cell pops a field-chip bar (on <body>, so the modal's
//   transform doesn't misplace it) that binds the span to a field as a slice.
// Freeze matched: rows the pattern already matches keep it, so a new pattern only
//   solves what is left.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

async function openParser(page, inject) {
  await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
  await page.evaluate(() => window.__apolloEditor.openTrackPatternParser(0));
  await page.waitForSelector('#tc-tpppop');
}
const source = (page, pattern, text) => page.evaluate(() => document.querySelector('#tc-tpppop .tc-tpp-src').classList.remove('tc-collapsed'))
  .then(() => page.fill('#tc-tpppop .tc-tpp-pi', pattern)).then(() => page.fill('#tc-tpppop .tc-tpp-ta', text));   // it renders as each input is handled
const cells = (page, row = 0) => page.evaluate(row => [...document.querySelectorAll('#tc-tpppop tbody tr')[row].querySelectorAll('.tc-tpp-c')].map(c => c.textContent), row);

test('it opens on the tracklist; clear buttons, resizing, whole raw text', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openParser(page, inject);
  const seeded = await page.evaluate(() => ({ pat: document.querySelector('#tc-tpppop .tc-tpp-pi').value, lines: document.querySelector('#tc-tpppop .tc-tpp-ta').value.split('\n').filter(Boolean).length, rows: document.querySelectorAll('#tc-tpppop tbody tr').length }));
  check(seeded.pat === '#. T - A (L)', `the native parser's pattern (${seeded.pat})`);
  check(seeded.lines > 0 && seeded.rows === seeded.lines, `the paste box holds the tracklist (${seeded.lines} lines, ${seeded.rows} rows)`);
  check(await page.evaluate(() => document.querySelector('.tc-tpp-chipbar')?.parentElement === document.body), 'the chip bar lives on <body>');

  await page.fill('#tc-tpppop tbody tr:nth-child(1) .tc-tpp-ov', 'T[1:.]');
  check(await until(() => page.evaluate(() => document.querySelector('#tc-tpppop tbody tr:nth-child(1) .tc-tpp-ovwrap').classList.contains('has'))), "a row's override shows its ✕");
  await page.click('#tc-tpppop tbody tr:nth-child(1) .tc-tpp-ovclr');
  check(await until(() => page.evaluate(() => document.querySelector('#tc-tpppop tbody tr:nth-child(1) .tc-tpp-ov').value === '')), '…which clears it');

  const clr = () => page.evaluate(() => ({ val: document.querySelector('#tc-tpppop .tc-tpp-pi').value, shown: getComputedStyle(document.querySelector('#tc-tpppop .tc-tpp-piclr')).display !== 'none' }));
  check((await clr()).shown, "the pattern's ✕ shows while it has a value");
  await page.click('#tc-tpppop .tc-tpp-piclr');
  const c = await until(clr, c => c.val === '' && !c.shown);
  check(c.val === '' && !c.shown, '…and clears it, and hides');
  check(await page.evaluate(() => getComputedStyle(document.querySelector('#tc-tpppop .tc-tpp-ta')).resize === 'vertical'), 'the paste box resizes vertically');

  await source(page, '#. T', '01 A very very very very very very very very long garbage raw line that would otherwise be truncated');
  const rs = await page.evaluate(() => { const c = document.querySelector('#tc-tpppop tbody tr .tc-tpp-raw'), s = getComputedStyle(c); return { ws: s.whiteSpace, to: s.textOverflow, whole: c.scrollWidth <= c.clientWidth + 1 }; });
  check(rs.ws === 'normal' && rs.to !== 'ellipsis' && rs.whole, `a raw cell shows all of its text (${JSON.stringify(rs)})`);
});

test('split on the first or the last separator', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openParser(page, inject);
  await source(page, '# A - T', '1 a - b - c');
  const first = await cells(page);
  check(first[1] === 'a' && first[2] === 'b - c', `first: A=${first[1]} T=${first[2]}`);
  await page.click('#tc-tpppop .tc-tpp-split');
  const last = await until(() => cells(page), c => c[1] === 'a - b');
  check(last[1] === 'a - b' && last[2] === 'c', `last: A=${last[1]} T=${last[2]}`);
  check(/last/.test(await page.textContent('#tc-tpppop .tc-tpp-split')), 'the toggle says so');
});

test('a selected span binds to a field', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openParser(page, inject);
  await source(page, '#. T', 'GARBAGE So What GARBAGE');
  await page.evaluate(() => {
    const tn = document.querySelector('#tc-tpppop tbody tr .tc-tpp-raw').firstChild, i = tn.textContent.indexOf('So What');
    const r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + 7);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    document.querySelector('#tc-tpppop tbody').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  check(await until(() => page.evaluate(() => getComputedStyle(document.querySelector('.tc-tpp-chipbar')).display !== 'none')), 'the chip bar pops up');
  await page.click('.tc-tpp-chipbar button[data-g="T"]');
  const ov = await until(() => page.inputValue('#tc-tpppop tbody tr .tc-tpp-ov'), v => /^T\[/.test(v));
  check(/^T\[\d+-\d+\]$/.test(ov), `the row's override is a title slice (${ov})`);
  check((await cells(page))[2] === 'So What', 'and the title is the span');
});

test('Freeze matched keeps solved rows while the pattern changes', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openParser(page, inject);
  await source(page, '#. T', '1. Alpha\n2. Beta\nGARBAGE Gamma GARBAGE');
  await page.click('#tc-tpppop .tc-tpp-freeze');
  const ov = await until(() => page.evaluate(() => [...document.querySelectorAll('#tc-tpppop tbody tr')].map(tr => tr.querySelector('.tc-tpp-ov').value)), o => o[0] !== '');
  check(ov[0] === '#. T' && ov[1] === '#. T' && ov[2] === '', `the two matched rows keep the pattern, the third stays open (${JSON.stringify(ov)})`);
  await page.fill('#tc-tpppop .tc-tpp-pi', 'GARBAGE T GARBAGE');
  const titles = await until(() => page.evaluate(() => [...document.querySelectorAll('#tc-tpppop tbody tr')].map(tr => tr.querySelectorAll('.tc-tpp-c')[2].textContent)), t => t[2] === 'Gamma');
  check(JSON.stringify(titles) === '["Alpha","Beta","Gamma"]', `the new pattern solves the third, the frozen two keep theirs (${JSON.stringify(titles)})`);
});
