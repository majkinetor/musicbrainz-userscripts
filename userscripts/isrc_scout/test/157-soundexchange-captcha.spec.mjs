// #157: SoundExchange answering 202 {"searchCaptcha":true} is recognised: the toolbar
// shows a captcha helper and link, not a stuck "not found". And SoundExchange is no
// longer called on every fill or keystroke, only on blur of a manual entry or by the
// row's [SX] button.
//
// test.musicbrainz.org, read-only. SoundExchange's answer is faked (the captcha reply),
// and every call to it counted.
import { test, check, answerGm, until, idle } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

test('SoundExchange is asked only on blur or [SX], and its captcha reply is recognised', { tag: ['@sandbox'] }, async ({ page, context, inject }) => {
  let sx = 0;
  answerGm(context, ({ url }) => (/isrc-api\.soundexchange\.com/.test(url) ? (sx++, { status: 202, body: '{"searchCaptcha":true}' }) : null));
  await openScout(page, inject, { release: 'aa6c4473-3528-41c2-b55b-d9e18bdba4ff' });   // Menahan Street Band

  const rows = await page.evaluate(() => document.querySelectorAll('#ii-tbody tr[data-idx]').length);
  const sxBtns = await page.evaluate(() => document.querySelectorAll('#ii-tbody tr[data-idx] button.ii-sx').length);
  check(sxBtns === rows, `every row has an [SX] button (${sxBtns}/${rows})`);
  const states = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#ii-tbody tr[data-idx]')];
    const empty = rows.find(r => !r.querySelector('input.ii-input').value && !r.querySelector('.ii-existing samp'));
    const withExisting = rows.find(r => !r.querySelector('input.ii-input').value && r.querySelector('.ii-existing samp'));
    return { emptyDisabled: empty ? empty.querySelector('button.ii-sx').disabled : 'no row', existingEnabled: withExisting ? !withExisting.querySelector('button.ii-sx').disabled : 'no row',
      sel: '#ii-tbody tr[data-idx="' + (empty || rows[0]).dataset.idx + '"]' };
  });
  check(states.emptyDisabled !== false, `[SX] is disabled on an empty row with no ISRC (${states.emptyDisabled})`);
  check(states.existingEnabled !== false, `…and enabled on one that has an ISRC (${states.existingEnabled})`);

  // typing a valid ISRC, without leaving the field: no call, [SX] enabled
  const sel = states.sel;
  await page.evaluate(s => { const i = document.querySelector(s + ' input.ii-input'); i.focus(); i.value = 'USRC17607830'; i.dispatchEvent(new Event('input', { bubbles: true })); }, sel);
  // the input has been handled once [SX] is enabled; no call by then, nor once the page is idle
  check(await until(() => page.evaluate(s => !document.querySelector(s + ' button.ii-sx').disabled, sel)), 'a valid ISRC enables [SX]');
  await idle(page);
  check(sx === 0, `typing doesn't call SoundExchange (${sx} calls)`);

  // leaving the field: one call, and the captcha is recognised
  await page.evaluate(s => document.querySelector(s + ' input.ii-input').dispatchEvent(new Event('blur', { bubbles: true })), sel);
  await until(() => sx, n => n >= 1);
  check(sx === 1, `leaving the field calls it once (${sx})`);
  const state = await until(() => page.evaluate(s => ({ bullet: (document.querySelector(s + ' .ii-lookup')?.textContent || '').trim(), prog: (document.getElementById('ii-prog')?.textContent || '').trim(), link: !!document.querySelector('#ii-prog a') }), sel), s => /captcha/i.test(s.bullet) && /captcha/i.test(s.prog) && s.link);
  check(/captcha/i.test(state.bullet) && /captcha/i.test(state.prog) && state.link, `the captcha shows on the row and in the status, with a link (${JSON.stringify(state)})`);

  // [SX]: one lookup by ISRC, and no refine panel
  const before = sx;
  await page.evaluate(s => document.querySelector(s + ' button.ii-sx').click(), sel);
  await until(() => sx - before, n => n >= 1);
  await idle(page);   // the answer has been handled: a refine panel would be open by now
  check(sx - before === 1, `[SX] makes one lookup (${sx - before})`);
  check(!(await page.evaluate(() => { const p = document.getElementById('ii-sxpanel'); return !!(p && p.offsetParent !== null); })), '…without opening the refine panel');
});
