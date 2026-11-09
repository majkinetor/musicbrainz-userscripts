import { test, check, requireLogin, idle, until, loadFunctions, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Apollo Editor' } });

// #960: a whole date pasted into MB's year/month/day boxes, typed through, copied and cleared
const AR = 'https://test.musicbrainz.org/artist/a74b1b7f-71a5-4011-9441-d0b5e4122711/edit';
const Y = "input.partial-date-year[name*='begin_date']", EY = "input.partial-date-year[name*='end_date']";

const paste = (page, sel, text) => page.evaluate(([sel, text]) => {
  const el = document.querySelector(sel); el.focus();
  const dt = new DataTransfer(); dt.setData('text/plain', text);
  el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}, [sel, text]);
const date = (page, part) => page.evaluate(part => ['year', 'month', 'day'].map(p => document.querySelector(`input.partial-date-${p}[name*='${part}']`).value).join('-'), part);

test('the parser reads whole dates and refuses ambiguous ones', { tag: '@unit' }, async () => {
  const { dpParse } = await loadFunctions('apollo_editor', ['dpParse', 'dpMonths', 'dpValid', 'dpYear', 'sfNorm']);
  const r = t => { const v = dpParse(t); return v ? `${v.y}-${v.m}-${v.d}` : null; };
  check(r('2025-02-25T10:00:00Z') === '2025-2-25', 'ISO with a time');
  check(r('25.02.98') === '1998-2-25', 'D.M.YY, a year above 28 in the 1900s');
  check(r('20250225') === '2025-2-25', 'YYYYMMDD');
  check(r('Released: 25th February 2025 (CD)') === '2025-2-25', 'a month name, an ordinal and text around it');
  check(r('02.2025') === '2025-2-', 'M.YYYY');
  check(r('03/04/2025') === null, 'either way round: nothing');
  check(r('31.02.2025') === null, 'an impossible day: nothing');
});

test('a pasted date fills all three boxes, Alt+C copies it, the x clears it', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.goto(SANDBOX + '/', { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await page.goto(AR, { waitUntil: 'domcontentloaded' });
  await requireLogin(page); await idle(page);
  await inject('apollo_editor');
  await paste(page, Y, '25 February 1998');
  check(await until(() => date(page, 'begin_date'), v => v === '1998-2-25') === '1998-2-25', 'begin date filled from the paste');
  await page.locator(Y).focus();
  await page.keyboard.press('Alt+KeyC');
  check(await until(() => date(page, 'end_date'), v => v === '1998-2-25') === '1998-2-25', 'Alt+C copies begin to end');
  await page.locator(EY).locator('xpath=ancestor::*[.//input[contains(@class,"partial-date-day")]][1]').locator('.tc-dp-x').click();
  check(await until(() => date(page, 'end_date'), v => v === '--') === '--', 'the x clears the end date');
  await paste(page, EY, '03/04/2025');
  check(await date(page, 'end_date') === '--', 'an ambiguous paste fills nothing');
  check(await page.locator(EY).evaluate(el => el.classList.contains('tc-dp-bad')), 'and marks the box');
  await page.locator(EY).fill('');
  await page.locator(EY).pressSequentially('20010215');
  check(await until(() => date(page, 'end_date'), v => v === '2001-2-15') === '2001-2-15', 'typing goes through all three boxes without losing a digit');
});
