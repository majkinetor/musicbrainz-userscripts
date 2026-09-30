// The Guess case tool, in the tracklist.
//
// #156: its "Keep uppercased" checkbox proxies MusicBrainz's own (a cookie), and flipping
//   it really changes the guess.
// #153: a title's Aa / feat in-cell buttons overlay the input instead of taking width
//   from it (they clipped long titles after "Fit").
import { test, check, until, frames } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('#156: "Keep uppercased" changes the guess', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
  await page.evaluate(() => window.MB.releaseEditor.rootField.release().mediums()[0].tracks()[0].name('the QUICK BROWN fox ABC'));
  await page.waitForFunction(() => window.__apolloEditor.model.tracks.some(x => /QUICK BROWN/i.test(x.title || '') && x.guessTitle), null, { timeout: 10000 });
  await page.waitForSelector('.tc-gco label input[type=checkbox]', { state: 'attached', timeout: 10000 });   // on the tools bar (#280)
  const read = () => page.evaluate(() => {
    const t = window.__apolloEditor.model.tracks.find(x => /QUICK BROWN/i.test(x.title || ''));
    const chk = document.querySelector('.tc-gco label input[type=checkbox]');   // the first: Keep uppercased
    const m = document.cookie.match(/guesscase_keepuppercase=([^;]*)/);
    return { guess: t ? t.guessTitle : null, checked: chk ? chk.checked : null, cookie: m ? m[1] : null };
  });
  // the box flips as it is clicked; the toggle has been handled once MusicBrainz's cookie
  // and the guess follow it
  const settled = r => r.cookie === String(r.checked) && (r.checked ? /QUICK BROWN/ : /Quick Brown/).test(r.guess || '');
  const toggle = async () => { await page.evaluate(() => document.querySelector('.tc-gco label input[type=checkbox]').click()); await until(read, settled); };
  const before = await read();
  if (before.checked === false) { await toggle(); Object.assign(before, await read()); }   // start from ON
  await toggle();
  const off = await read();
  await toggle();
  const on = await read();
  check(before.checked === true && before.cookie === 'true' && /QUICK BROWN/.test(before.guess), `on: uppercase words kept (${JSON.stringify(before)})`);
  check(off.checked === false && off.cookie === 'false' && /Quick Brown/.test(off.guess), `off: MusicBrainz's cookie follows, and the guess changes (${JSON.stringify(off)})`);
  check(on.checked === true && on.cookie === 'true' && on.guess === before.guess, `on again: back to the first guess (${JSON.stringify(on)})`);
});

test('#153: the in-cell title buttons take no width from the title', { tag: ['@cosmetic', '@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
  // a guess-case difference on the first title, so its Aa button shows
  await page.evaluate(() => {
    const inp = document.querySelector('.tc-mirror tbody input.t-title');
    inp.value = (inp.value || 'Test Title').toLowerCase();
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await until(() => page.evaluate(() => !!document.querySelector('.tc-mirror tbody tr .t-gc')));
  await page.evaluate(() => { try { window.__apolloEditor.colsFit && window.__apolloEditor.colsFit(); } catch (e) {} });
  await frames(page);
  const r = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.tc-mirror tbody tr')].filter(r => r.querySelector('input.t-title'));
    const withBtn = rows.find(r => r.querySelector('.t-gc')), plain = rows.find(r => !r.querySelector('.t-gc'));
    // the title shows as text until it is focused, then as the input: whichever is shown
    const measure = r => r && { inputW: Math.max(r.querySelector('input.t-title').clientWidth, r.querySelector('.t-title-disp')?.clientWidth || 0), wrapW: r.querySelector('.t-wrap').clientWidth };
    const acts = withBtn && withBtn.querySelector('.t-actions');
    return { hasBtnRow: !!withBtn, actionsPos: acts ? getComputedStyle(acts).position : null, withBtn: measure(withBtn), plain: measure(plain) };
  });
  check(r.hasBtnRow, 'a row shows the Aa button');
  if (!r.hasBtnRow) return;
  check(r.actionsPos === 'absolute', `the buttons overlay the input (${r.actionsPos})`);
  check(r.withBtn.wrapW - r.withBtn.inputW < 8, `the input fills its cell (${r.withBtn.inputW} of ${r.withBtn.wrapW})`);
  check(!r.plain || Math.abs(r.withBtn.inputW - r.plain.inputW) <= 2, `as wide as a row without the button (${r.withBtn.inputW} vs ${r.plain && r.plain.inputW})`);
});
