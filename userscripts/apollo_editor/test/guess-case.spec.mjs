// The Guess case tool, in the tracklist.
//
// #785: the guess is the shared guess case's (dev/guesscase), not MusicBrainz's editor-only one:
//   its mode (Auto from the release's language, or picked) and its options are Apollo's own
//   settings, each changes the guess, and Aa applies it to the track.
// #153: a title's Aa / feat in-cell buttons overlay the input instead of taking width
//   from it (they clipped long titles after "Fit").
import { test, check, until, frames } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('#785: the mode and options change the guess, and Aa applies it', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
  await page.evaluate(() => window.MB.releaseEditor.rootField.release().mediums()[0].tracks()[0].name('the QUICK BROWN fox by KoRn (Official Music Video)'));
  const guess = () => page.evaluate(() => { const t = window.__apolloEditor.model.tracks.find(x => /QUICK BROWN/i.test(x.title || '')); return t ? t.guessTitle : null; });
  await until(guess, g => !!g);
  await page.waitForSelector('.tc-gco select.tc-gc-lang', { state: 'attached', timeout: 10000 });
  const pick = (sel, v) => page.evaluate(([sel, v]) => { const el = document.querySelector(sel); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
  const tick = (i, on) => page.evaluate(([i, on]) => { const c = document.querySelectorAll('.tc-gco label input[type=checkbox]')[i]; if (c.checked !== on) c.click(); }, [i, on]);

  const opts = await page.evaluate(() => [...document.querySelectorAll('.tc-gco select.tc-gc-lang option')].map(o => o.value));
  check(opts[0] === 'auto' && ['English', 'French', 'Sentence', 'Spanish', 'Dutch', 'Turkish'].every(m => opts.includes(m)), `the mode list: Auto, then the modes (${opts})`);

  await pick('.tc-gco select.tc-gc-lang', 'English'); await tick(0, true);
  const english = await until(guess, g => g === 'The QUICK BROWN Fox by KoRn (official music video)');
  check(english === 'The QUICK BROWN Fox by KoRn (official music video)', `English, keep uppercased: capitals and KoRn kept, the version words lowercased (${english})`);
  await tick(0, false);
  const lower = await until(guess, g => g === 'The Quick Brown Fox by Korn (official music video)');
  check(lower === 'The Quick Brown Fox by Korn (official music video)', `keep uppercased off: capitalised as words (${lower})`);
  await pick('.tc-gco select.tc-gc-lang', 'Sentence');
  const sentence = await until(guess, g => g === 'The quick brown fox by korn (official music video)');
  check(sentence === 'The quick brown fox by korn (official music video)', `Sentence: a capital only at the start (${sentence})`);
  const saved = await page.evaluate(() => window.__apolloEditor && window.__apolloEditor.settings ? { gcMode: window.__apolloEditor.settings.gcMode, gcKeepUC: window.__apolloEditor.settings.gcKeepUC } : null);
  check(saved && (saved.gcMode === 'Sentence' && saved.gcKeepUC === false), `kept in Apollo's settings (${JSON.stringify(saved)})`);

  // Aa applies the guess to the track
  await page.evaluate(() => { const row = [...document.querySelectorAll('.tc-mirror tbody tr')].find(r => /QUICK BROWN/i.test((r.querySelector('input.t-title') || {}).value || '')); row.querySelector('.t-gc').click(); });
  const name = await until(() => page.evaluate(() => window.MB.releaseEditor.rootField.release().mediums()[0].tracks()[0].name()), n => n === sentence);
  check(name === sentence, `Aa sets the track's title to the guess (${name})`);
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
