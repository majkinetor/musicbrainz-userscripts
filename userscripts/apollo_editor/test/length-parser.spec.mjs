// The length parser: lengths pasted (or fetched) from a source, applied to a medium.
//
// #621 (majkinetor): "Allow empty tracks in length parser — I should be able to commit this
//   (3 tracks missing len)". An empty row is allowed and leaves its track's length as it
//   is; only a non-empty value that isn't a time blocks Apply.
// #622 (majkinetor): "Paste link in Length Parser — It would be nice if we can CTRL+v like
//   in AS so external link is parsed the same way release links are parsed." A pasted URL
//   is fetched and read like a favicon click (and credited in the edit note); pasted text
//   goes into the box; a URL pasted into another field, or once the parser is closed, is
//   left alone. The "external page" is answered here and never reaches the network.
//
// Seeded releases on the sandbox; nothing is submitted.
import { test, check, answerGm } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

const seed = (titles, lengths = {}) => {
  const s = { name: 'Apollo length parser', 'artist_credit.names.0.name': 'Apollo Test Artist', type: ['album'], 'mediums.0.format': 'CD' };
  titles.forEach((t, i) => { s[`mediums.0.track.${i}.name`] = 'track ' + t; s[`mediums.0.track.${i}.artist_credit.names.0.name`] = 'Apollo Test Artist'; });
  for (const [i, l] of Object.entries(lengths)) s[`mediums.0.track.${i}.length`] = l;
  return s;
};
const lengths = page => page.evaluate(() => MB.releaseEditor.rootField.release().mediums()[0].tracks().map(t => t.formattedLength() || ''));

test.describe('#621', () => {
  test.use({ gm: apolloGm() });
  test('empty rows are allowed, and keep their tracks\' lengths', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    const submitted = await openApollo(page, inject, { seed: seed(['one', 'two', 'three', 'four', 'five'], { 1: '1:11', 3: '2:22' }), tab: 'tracklist' });
    const before = await lengths(page);
    check(before[1] === '1:11' && before[3] === '2:22', 'tracks 2 and 4 have lengths already');
    await page.evaluate(() => window.__apolloEditor.openLengthParser(0));
    await page.waitForSelector('#tc-lppop .tc-lp-ta');
    await page.evaluate(() => { const ta = document.querySelector('#tc-lppop .tc-lp-ta'); ta.value = '1. track one (3:01)\n3. track three (3:03)\n5. track five (3:05)'; ta.dispatchEvent(new Event('input', { bubbles: true })); });
    // empty rows for tracks 2 and 4: "+" under row 1, then under the shifted row 3
    await page.locator('#tc-lppop .tc-lp-row').nth(0).locator('.tc-lp-add').click();
    await page.locator('#tc-lppop .tc-lp-row').nth(2).locator('.tc-lp-add').click();
    const state = () => page.evaluate(() => {
      const p = document.getElementById('tc-lppop'), ok = p.querySelector('.tc-lp-ok');
      return { vals: [...p.querySelectorAll('.tc-lp-val')].map(i => i.value), bad: p.querySelectorAll('.tc-lp-val.bad').length, disabled: ok.disabled, ok: ok.textContent, foot: p.querySelector('.tc-lp-cnt').textContent, badge: getComputedStyle(p.querySelector('.tc-lp-err')).display !== 'none', tip: (p.querySelectorAll('.tc-lp-val')[1] || {}).title || '' };
    });
    const s = await state();
    check(JSON.stringify(s.vals) === '["3:01","","3:03","","3:05"]', `rows: 3:01 · empty · 3:03 · empty · 3:05 (${JSON.stringify(s.vals)})`);
    check(s.bad === 0 && !s.badge, 'the empty rows are not invalid');
    check(!s.disabled && /Apply 3 to Medium 1/.test(s.ok), `Apply is on, counting what it writes (${s.ok})`);
    check(/2 empty — left as is/.test(s.foot) && /keeps its current length/.test(s.tip), `and says so (${s.foot}; ${s.tip})`);
    const row2 = page.locator('#tc-lppop .tc-lp-val').nth(1);
    await row2.fill('9:99');
    const bad = await state();
    check(bad.bad === 1 && bad.disabled && bad.badge, '"9:99" is invalid and blocks Apply');
    await row2.fill('');
    check(!(await state()).disabled, 'emptied again, Apply is back');
    await page.locator('#tc-lppop .tc-lp-ok').click();
    await page.waitForTimeout(600);
    const after = await lengths(page);
    check(after[0] === '3:01' && after[2] === '3:03' && after[4] === '3:05', `tracks 1, 3, 5 get the pasted lengths (${JSON.stringify(after)})`);
    check(after[1] === '1:11' && after[3] === '2:22', 'tracks 2 and 4 keep theirs');
    check(!(await page.$('#tc-lppop')), 'the parser closes');
    check(submitted.length === 0, 'nothing submitted');
  });
});

test.describe('#622', () => {
  test.use({ gm: apolloGm(null, { xhr: 'node' }) });
  test('a link pasted onto the parser is read like a source', { tag: ['@sandbox', '@login'] }, async ({ page, inject, context }) => {
    const FAKE = 'https://tracklist.example.test/album/622';
    let hits = 0;
    answerGm(context, ({ url }) => {
      if (url !== FAKE) return null;
      hits++;
      const rows = ['3:01', '3:02', '3:03'].map((d, i) => `<tr><td>${i + 1}</td><td>Song ${i + 1}</td><td>${d}</td></tr>`).join('');
      return { status: 200, headers: 'content-type: text/html', body: `<html><body><nav>Home</nav><table>${rows}</table><footer>© 2026</footer></body></html>` };
    });
    const submitted = await openApollo(page, inject, { seed: seed(['one', 'two', 'three']) });
    const paste = (text, selector) => page.evaluate(([text, selector]) => {
      const dt = new DataTransfer(); dt.setData('text/plain', text);
      const target = selector ? document.querySelector(selector) : (document.activeElement || document.body);
      if (selector && target) target.focus();
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      (target || document.body).dispatchEvent(ev);
      return ev.defaultPrevented;
    }, [text, selector || null]);
    const state = () => page.evaluate(() => {
      const p = document.getElementById('tc-lppop'); if (!p) return null;
      return { vals: [...p.querySelectorAll('.tc-lp-val')].map(i => i.value), ta: p.querySelector('.tc-lp-ta').value, foot: p.querySelector('.tc-lp-cnt').textContent, chooser: getComputedStyle(p.querySelector('.tc-lp-choose')).display !== 'none', hint: (p.querySelector('.tc-lp-clbl') || {}).textContent || '' };
    });
    const openIt = async () => { await page.evaluate(() => { document.activeElement?.blur?.(); window.__apolloEditor.openLengthParser(0); }); await page.waitForSelector('#tc-lppop .tc-lp-ta'); };

    await openIt();
    const s0 = await state();
    check(s0.chooser && /Ctrl\+V/.test(s0.hint), `the chooser says a link can be pasted (${s0.hint})`);
    const taken = await paste(FAKE);
    await page.waitForFunction(() => document.querySelectorAll('#tc-lppop .tc-lp-val').length >= 3, null, { timeout: 10000 }).catch(() => {});
    const s1 = await state();
    check(taken && hits === 1, `the paste is taken, and the page fetched once (${hits})`);
    check(JSON.stringify(s1.vals) === '["3:01","3:02","3:03"]', `its lengths, the nav and footer skipped (${JSON.stringify(s1.vals)})`);
    check(/from external link/.test(s1.foot) && !s1.chooser, `read as an external source (${s1.foot})`);
    await page.locator('#tc-lppop .tc-lp-ok').click();
    await page.waitForTimeout(500);
    check(JSON.stringify(await lengths(page)) === '["3:01","3:02","3:03"]', 'applied');
    check((await page.evaluate(() => document.getElementById('edit-note-text')?.value || '')).includes('Track lengths from ' + FAKE), 'the edit note credits the link');

    await openIt();
    await paste('1. a 4:01\n2. b 4:02');
    const s3 = await state();
    check(!s3.chooser && /4:01/.test(s3.ta) && JSON.stringify(s3.vals) === '["4:01","4:02"]' && !/external/.test(s3.foot), `pasted text goes into the box (${JSON.stringify(s3.vals)})`);
    const before = hits;
    check(!(await paste(FAKE, '#name')) && hits === before, 'a link pasted into the release title is left alone');
    await page.evaluate(() => document.querySelector('#tc-lppop .tc-lp-x')?.click());
    await page.waitForTimeout(200);
    check(!(await paste(FAKE)) && hits === before && !(await page.$('#tc-lppop')), 'closed, a paste does nothing');
    check(submitted.length === 0, 'nothing submitted');
  });
});
