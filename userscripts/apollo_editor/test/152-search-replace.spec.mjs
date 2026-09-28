// #152: Search & Replace has an RE toggle (regex, with $N) and saved patterns (★: save,
// load, remove; #375). The real S&R tool on a seeded release.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, toTab, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('Search & Replace: literal and regex modes, and templates', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const submitted = await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
  await page.waitForFunction(() => { const r = document.querySelector('.tc-mirror tbody tr .t-title'); return r && r.offsetParent !== null; }, null, { timeout: 20000 });
  // set a deterministic title on the first track, then open the S&R tool (snapshots current titles)
  await page.evaluate(() => {
    const inp = document.querySelector('.tc-mirror tbody tr .t-title');
    inp.value = 'Artist - Song'; inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // S&R sits on the tools bar with its fields out (#280)
  await page.waitForSelector('.tc-sr-find', { timeout: 10000 });

  const t0 = () => page.evaluate(() => window.__apolloEditor.model.tracks[0].title);
  const setFR = (f, r) => page.evaluate(({ f, r }) => {
    const fi = document.querySelector('.tc-sr-find'), re = document.querySelector('.tc-sr-rep');
    fi.value = f; fi.dispatchEvent(new Event('input', { bubbles: true }));
    re.value = r; re.dispatchEvent(new Event('input', { bubbles: true }));
  }, { f, r });
  const reOn = () => page.evaluate(() => document.querySelector('.tc-sr-re').classList.contains('on'));
  const toggleRE = () => page.evaluate(() => document.querySelector('.tc-sr-re').click());

  const R = {};

  // (1) literal mode: "$1" in replace is literal, not a backref
  await setFR('Song', '$1');
  R.literalDollar = await until(t0, t => t === 'Artist - $1');

  // (2) regex mode with $N
  if (!await reOn()) await toggleRE();
  await until(reOn);
  await setFR('^(.+?) - (.+)$', '$2 ($1)');
  R.regexBackref = await until(t0, t => t === 'Song (Artist)');

  // (3) invalid regex → field flagged, no throw, title unchanged from prior valid state
  await setFR('(', 'x');
  R.invalidFlagged = await until(() => page.evaluate(() => document.querySelector('.tc-sr-find').classList.contains('tc-sr-bad')));
  R.invalidTitle = await t0();

  // (4) saved patterns (★, #375): save the current regex pattern as "Spotify ETI"
  await setFR('^(.+?) - (.+)$', '$2 ($1)');
  await until(() => page.evaluate(() => !document.querySelector('.tc-sr-find').classList.contains('tc-sr-bad')));
  const star = () => page.evaluate(() => document.querySelector('.tc-sr-star').click());
  await star();
  await page.waitForSelector('.tc-srtpl', { timeout: 5000 });
  await page.evaluate(() => document.querySelector('.tc-srtpl .tc-srtpl-savebtn:not(.tc-srtpl-chainbtn)').click());
  await page.evaluate(() => {
    const n = document.querySelector('.tc-srtpl-name'); n.value = 'Spotify ETI'; n.dispatchEvent(new Event('input', { bubbles: true }));
    n.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  R.savedTemplates = await until(() => page.evaluate(() => (window.__apolloEditor.settings.srTemplates || []).map(t => ({ name: t.name, find: t.find, replace: t.replace, re: t.re }))), l => l.some(t => t.name === 'Spotify ETI'));

  // (5) load: empty fields and RE off, then the saved row restores and applies them
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const p = document.querySelector('.tc-srtpl'); if (p) p.remove(); });
  await setFR('', ''); if (await reOn()) await toggleRE();
  await until(reOn, on => !on);
  await star();
  await page.waitForSelector('.tc-srtpl', { timeout: 5000 });
  await page.evaluate(() => { const r = [...document.querySelectorAll('.tc-srtpl-row')].find(x => x.querySelector('.tc-srtpl-nm')?.textContent === 'Spotify ETI'); if (r) r.click(); });
  R.afterLoad = await until(() => page.evaluate(() => ({ find: document.querySelector('.tc-sr-find').value, rep: document.querySelector('.tc-sr-rep').value, re: document.querySelector('.tc-sr-re').classList.contains('on') })), a => a.find !== '' && a.re);
  R.afterLoad.title = await until(t0, t => t === 'Song (Artist)');

  // (6) remove it
  if (!(await page.$('.tc-srtpl'))) await star();
  await page.waitForSelector('.tc-srtpl', { timeout: 5000 });
  await page.evaluate(() => { const r = [...document.querySelectorAll('.tc-srtpl-row')].find(x => x.querySelector('.tc-srtpl-nm')?.textContent === 'Spotify ETI'); if (r) r.querySelector('.tc-srtpl-x').click(); });
  R.afterRemove = await until(() => page.evaluate(() => (window.__apolloEditor.settings.srTemplates || []).map(t => t.name)), l => !l.includes('Spotify ETI'));

  check(R.literalDollar === 'Artist - $1', `literal mode: "$1" is literal (${R.literalDollar})`);
  check(R.regexBackref === 'Song (Artist)', `regex mode: $N back-references (${R.regexBackref})`);
  check(R.invalidFlagged === true && R.invalidTitle === 'Song (Artist)', `an invalid regex is flagged, and changes nothing (${R.invalidTitle})`);
  check(R.savedTemplates.some(t => t.name === 'Spotify ETI' && t.re === true && t.find === '^(.+?) - (.+)$'), `a pattern is saved with its mode (${JSON.stringify(R.savedTemplates)})`);
  check(R.afterLoad.find === '^(.+?) - (.+)$' && R.afterLoad.re === true && R.afterLoad.title === 'Song (Artist)', `loading it restores the fields and the mode, and applies (${JSON.stringify(R.afterLoad)})`);
  check(!R.afterRemove.includes('Spotify ETI'), 'a pattern is removed');
  check(submitted.length === 0, 'nothing submitted');
});
