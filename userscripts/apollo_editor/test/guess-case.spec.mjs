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
  const tick = (i, on) => page.evaluate(([i, on]) => { const c = document.querySelectorAll('.tc-gco button.tc-gc-tg')[i]; if (c.classList.contains('on') !== on) c.click(); }, [i, on]);

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

test('#785: in Auto a Cyrillic title, or a part of one, gets Sentence; the separator is an option', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
  await page.waitForSelector('.tc-gco select.tc-gc-lang', { state: 'attached', timeout: 10000 });
  await page.evaluate(() => { const el = document.querySelector('.tc-gco select.tc-gc-lang'); el.value = 'auto'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.evaluate(() => window.MB.releaseEditor.rootField.release().mediums()[0].tracks()[0].name('love story / история любви'));
  const guess = () => page.evaluate(() => { const t = window.__apolloEditor.model.tracks.find(x => /история/i.test(x.title || '')); return t ? t.guessTitle : null; });
  const split = await until(guess, g => g === 'Love Story / История любви');
  check(split === 'Love Story / История любви', `the Latin part in the release's mode, the Cyrillic part in Sentence (${split})`);
  await page.evaluate(() => { const i = document.querySelector('.tc-gco input.tc-gc-sep'); i.value = '|'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  const whole = await until(guess, g => g === 'Love story / История любви');
  check(whole === 'Love story / История любви', `another separator: the title is one, mostly Cyrillic, so Sentence (${whole})`);
  check(await page.evaluate(() => window.__apolloEditor.settings.gcSep) === '|', 'the separator is kept in the settings');
});

// #804: in Auto each title is looked at on its own: a Latin one of three words or more in the language
// lande is sure of, a short one in the release's mode, a Greek one in Sentence
test('#804: in Auto a title gets its own language, Greek gets Sentence', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
  await page.waitForSelector('.tc-gco select.tc-gc-lang', { state: 'attached', timeout: 10000 });
  await page.evaluate(() => { const el = document.querySelector('.tc-gco select.tc-gc-lang'); el.value = 'auto'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  const want = {
    'tous les garçons et les filles': 'Tous les garçons et les filles',   // French, sure: French on an English release
    'take on me': 'Take on Me',                                         // lande says Estonian: not a language with a mode, so the release's
    'το τρένο φεύγει στις οχτώ': 'Το τρένο φεύγει στις οχτώ',           // Greek: Sentence
  };
  const n = await page.evaluate(titles => {
    const r = window.MB.releaseEditor.rootField.release();
    r.languageID(120);   // English
    const ts = r.mediums()[0].tracks(); titles.slice(0, ts.length).forEach((t, i) => ts[i].name(t)); return Math.min(ts.length, titles.length);
  }, Object.keys(want));
  check(n === 3, `the release has three tracks to try (${n})`);
  for (const [t, w] of Object.entries(want).slice(0, n)) {
    const g = await until(() => page.evaluate(t => { const x = window.__apolloEditor.model.tracks.find(y => y.title === t); return x ? x.guessTitle : null; }, t), v => v === w);
    check(g === w, `${t} → ${w} (got ${g})`);
  }
});

test("#785: MusicBrainz's own guess-case buttons give Apollo's guess", { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
  await page.waitForSelector('.tc-gco select.tc-gc-lang', { state: 'attached', timeout: 10000 });
  await page.evaluate(() => { const el = document.querySelector('.tc-gco select.tc-gc-lang'); el.value = 'Dutch'; el.dispatchEvent(new Event('change', { bubbles: true })); });

  // a track's and a medium's: the editor's own methods, as its buttons call them (Dutch's IJ is ours alone)
  const r = await page.evaluate(() => {
    const ed = window.MB.releaseEditor, m = ed.rootField.release().mediums()[0], t = m.tracks()[0];
    t.name('ijsland'); m.name('ijs en weder');
    ed.guessCaseTrackName(t, { type: 'mouseenter', buttons: 0 });
    const preview = t.previewName();
    ed.guessCaseTrackName(t, { type: 'click' });
    ed.guessCaseMediumName(m, { type: 'click' });
    return { preview, track: t.name(), medium: m.name(), modified: t.nameModified() };
  });
  check(r.preview === 'IJsland', `a track's Aa previews Apollo's guess (${r.preview})`);
  check(r.track === 'IJsland' && r.modified, `and sets it (${r.track})`);
  check(r.medium === 'IJs en weder', `a medium's Aa too (${r.medium})`);

  // the release title's Aa (jQuery's) and MusicBrainz's options dialog
  const title = await page.evaluate(() => {
    const i = document.querySelector('input#name'), b = i.parentElement.querySelector('button.guesscase-title');
    i.value = 'ijsland live'; i.dispatchEvent(new Event('input', { bubbles: true }));
    b.click();
    return window.MB.releaseEditor.rootField.release().name();
  });
  check(title === 'IJsland live', `the release title's Aa (${title})`);
  const dlg = await page.evaluate(() => { const box = document.querySelector('#guesscase-options'); const s = box && box.querySelector('select.tc-gc-lang'); return { ours: s ? s.value : null, mbHidden: !!box && box.querySelector('select:not(.tc-gc-lang)').style.display === 'none' }; });
  check(dlg.ours === 'Dutch' && dlg.mbHidden, `MusicBrainz's options show Apollo's mode list (${JSON.stringify(dlg)})`);
  const pop = await page.evaluate(() => {
    const b = document.querySelector('input#name').parentElement.querySelector('button.guesscase-title');
    b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    const p = document.querySelector('.tc-gcpop'), s = p && p.querySelector('select.tc-gc-lang');
    return { open: !!p, mode: s ? s.value : null, mbDialog: !!(document.querySelector('#guesscase-options') || {}).offsetParent };
  });
  check(pop.open && pop.mode === 'Dutch' && !pop.mbDialog, `right-click on the title's Aa opens Apollo's options (${JSON.stringify(pop)})`);
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

// #803: the mode list's casings (no guessing), and a guess mode marked as the default runs on every
// track when the Tracklist opens
test('#803: casings, and the list in two columns with the default on guess modes only', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
  await page.evaluate(() => window.MB.releaseEditor.rootField.release().mediums()[0].tracks()[0].name('the QUICK brown fox of KoRn'));
  const guess = () => page.evaluate(() => { const t = window.__apolloEditor.model.tracks.find(x => /QUICK/i.test(x.title || '')); return t ? t.guessTitle : null; });
  await until(guess, g => !!g);
  await page.waitForSelector('.tc-gco .tc-gc-combo .tc-gc-cb', { state: 'attached', timeout: 10000 });
  const pick = v => page.evaluate(v => { const el = document.querySelector('.tc-gco select.tc-gc-lang'); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  const abc = on => page.evaluate(on => { const c = document.querySelector('.tc-gco button.tc-gc-tg'); if (c.classList.contains('on') !== on) c.click(); }, on);

  await abc(true); await pick('lowercase');
  check(await until(guess, g => g === 'the quick brown fox of korn') === 'the quick brown fox of korn', 'lowercase, ABC on or not');
  const dis = await page.evaluate(() => [...document.querySelectorAll('.tc-gco button.tc-gc-tg')].map(b => b.disabled).concat(document.querySelector('.tc-gco input.tc-gc-sep').disabled));
  check(JSON.stringify(dis) === '[true,true,true]', `a casing greys out ABC, IV and the separator (${dis})`);
  await pick('UPPERCASE');
  check(await until(guess, g => g === 'THE QUICK BROWN FOX OF KORN') === 'THE QUICK BROWN FOX OF KORN', 'UPPERCASE');
  check(!(await page.evaluate(() => [...document.querySelectorAll('.tc-gco select.tc-gc-lang option')].some(o => o.value === 'Title Case'))), 'no Title Case in the list');

  // the list (here in the release title's options): two columns, and ○ on the guess modes only
  await page.evaluate(() => document.querySelector('input#name').parentElement.querySelector('button.guesscase-title').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
  await page.click('.tc-gcpop .tc-gc-cb');
  const list = await until(() => page.evaluate(() => {
    const l = document.querySelector('.tc-gc-list'); if (!l) return null;
    const rows = [...l.querySelectorAll('.tc-gc-row')].map(r => ({ m: r.querySelector('.tc-gc-pick').dataset.gcMode, def: !!r.querySelector('.tc-gc-def') }));
    return { cols: l.querySelectorAll('.tc-gc-col').length, heads: [...l.querySelectorAll('.tc-gc-gh')].map(h => h.textContent), rows };
  }), v => !!v);
  check(await page.evaluate(() => [...document.querySelectorAll('.tc-gcpop .tc-gc-tg')].every(b => b.disabled)), 'a box opened under UPPERCASE shows ABC and IV greyed out');
  check(list && list.cols === 2 && list.heads.join() === 'Guess,Casing,Languages', `two columns: Guess and Casing, Languages (${JSON.stringify(list && list.heads)})`);
  check(list && list.rows.filter(r => /lowercase|UPPERCASE/.test(r.m)).every(r => !r.def) && list.rows.filter(r => /^(auto|Sentence|Dutch)$/.test(r.m)).every(r => r.def), 'casings have no ○, guess modes have one');
  await page.evaluate(() => { const r = [...document.querySelectorAll('.tc-gc-list .tc-gc-row')].find(x => x.querySelector('.tc-gc-pick').dataset.gcMode === 'Dutch'); r.querySelector('.tc-gc-def').click(); });
  check(await until(() => page.evaluate(() => window.__apolloEditor.settings.gcDefault), v => v === 'Dutch') === 'Dutch', 'a ○ makes the mode the default');
  await page.evaluate(() => { const r = [...document.querySelectorAll('.tc-gc-list .tc-gc-row')].find(x => x.querySelector('.tc-gc-pick').dataset.gcMode === 'Dutch'); r.querySelector('.tc-gc-pick').click(); });
  const shown = await until(() => page.evaluate(() => ({ mode: window.__apolloEditor.settings.gcMode, cb: document.querySelector('.tc-gcpop .tc-gc-cb').textContent, open: !!document.querySelector('.tc-gc-list') })), v => v.mode === 'Dutch');
  check(shown.mode === 'Dutch' && shown.cb === 'Dutch◉' && !shown.open, `picking a mode closes the list; the default shows its ◉ (${JSON.stringify(shown)})`);
});

test.describe('#803: the default', () => {
  test.use({ gm: apolloGm({ gcDefault: 'Sentence', gcMode: 'UPPERCASE' }) });
  test('runs on every track when the Tracklist opens, in its own mode', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
    const name = await until(() => page.evaluate(() => window.MB.releaseEditor.rootField.release().mediums()[0].tracks()[10].name()), n => n === 'Anh đâu em đó');
    check(name === 'Anh đâu em đó', `the title in Sentence, not in the picked UPPERCASE (${name})`);
  });
});
