// #621 (majkinetor): "Allow empty tracks in length parser — I should be able to commit this
// (3 tracks missing len)". The length parser treated an empty row as invalid, so a source that
// simply has no length for a few tracks could never be applied.
//
// Now an empty row is allowed and leaves its track's length AS IT IS (nothing is cleared); only
// a non-empty value that isn't a time blocks Apply.
//
// test.musicbrainz.org, nothing submitted: a seeded /release/add with 5 tracks, tracks 2 and 4
// already carrying lengths (1:11, 2:22). Paste lengths for 1, 3, 5 only, insert empty rows for
// 2 and 4, Apply → 1/3/5 get the pasted lengths, 2/4 keep theirs.
// APOLLO_SRC=<old build> to watch it refuse.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = process.env.APOLLO_SRC || resolve(HERE, '..', 'apollo_editor.user.js');
const ORIGIN = 'https://test.musicbrainz.org';
const log = (...a) => console.log('[verify-621]', ...a);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 3 });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
// belt and braces: this test must never submit anything
await page.route('**/ws/js/edit/**', r => { log('BLOCKED write', r.request().method(), r.request().url()); return r.abort(); });

await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN on', ORIGIN); await ctx.close(); process.exit(3); }

const seed = {
  name: 'Apollo 621 test ' + Date.now(),
  'artist_credit.names.0.name': 'Apollo Test Artist',
  type: ['album'],
  'mediums.0.format': 'CD',
  edit_note: '#621 verification',
};
['one', 'two', 'three', 'four', 'five'].forEach((t, i) => {
  seed[`mediums.0.track.${i}.name`] = 'track ' + t;
  seed[`mediums.0.track.${i}.artist_credit.names.0.name`] = 'Apollo Test Artist';
});
seed['mediums.0.track.1.length'] = '1:11';   // already has a length → must be kept
seed['mediums.0.track.3.length'] = '2:22';
await page.evaluate(({ origin, params }) => {
  const f = document.createElement('form'); f.method = 'POST'; f.action = origin + '/release/add'; f.style.display = 'none';
  const add = (n, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = n; i.value = v; f.appendChild(i); };
  for (const [k, v] of Object.entries(params)) Array.isArray(v) ? v.forEach(x => add(k, x)) : add(k, v);
  document.body.appendChild(f); f.submit();
}, { origin: ORIGIN, params: seed });
await page.waitForLoadState('domcontentloaded');
if (await page.locator('h1', { hasText: /Confirm form submission/i }).count().catch(() => 0)) {
  await page.locator('button[type=submit]', { hasText: /Continue/i }).first().click();
  await page.waitForLoadState('domcontentloaded');
}
await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums()[0].tracks().length === 5; } catch { return false; } }, null, { timeout: 60000 });
await page.addScriptTag({ content: scriptCode });
await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 15000 });
await page.waitForTimeout(1500);

const lengths = () => page.evaluate(() => window.MB.releaseEditor.rootField.release().mediums()[0].tracks().map(t => t.formattedLength() || ''));
const before = await lengths();
log('before:', JSON.stringify(before));
ck(before[1] === '1:11' && before[3] === '2:22', 'seeded: tracks 2 and 4 already have lengths');

await page.evaluate(() => window.__apolloEditor.openLengthParser(0));
await page.waitForSelector('#tc-lppop .tc-lp-ta');
await page.evaluate(() => { const ta = document.querySelector('#tc-lppop .tc-lp-ta'); ta.value = '1. track one (3:01)\n3. track three (3:03)\n5. track five (3:05)'; ta.dispatchEvent(new Event('input', { bubbles: true })); });
// empty rows for tracks 2 and 4: "+" under row 1, then under the (shifted) row 3
await page.locator('#tc-lppop .tc-lp-row').nth(0).locator('.tc-lp-add').click();
await page.locator('#tc-lppop .tc-lp-row').nth(2).locator('.tc-lp-add').click();
const state = () => page.evaluate(() => {
  const p = document.getElementById('tc-lppop');
  return {
    vals: [...p.querySelectorAll('.tc-lp-val')].map(i => i.value),
    bad: p.querySelectorAll('.tc-lp-val.bad').length,
    ok: { disabled: p.querySelector('.tc-lp-ok').disabled, text: p.querySelector('.tc-lp-ok').textContent },
    foot: p.querySelector('.tc-lp-cnt').textContent,
    badge: getComputedStyle(p.querySelector('.tc-lp-err')).display !== 'none',
    emptyTip: (p.querySelectorAll('.tc-lp-val')[1] || {}).title || '',
  };
});
const s1 = await state();
log('list:', JSON.stringify(s1));
ck(JSON.stringify(s1.vals) === JSON.stringify(['3:01', '', '3:03', '', '3:05']), 'rows: 3:01 · (empty) · 3:03 · (empty) · 3:05');
ck(s1.bad === 0 && !s1.badge, 'empty rows are not marked invalid, and no "invalid" badge in the header');
ck(!s1.ok.disabled && /Apply 3 to Medium 1/.test(s1.ok.text), `Apply is enabled and counts only what it writes: "${s1.ok.text}"`);
ck(/2 empty — left as is/.test(s1.foot), `footer says so: "${s1.foot}"`);
ck(/keeps its current length/.test(s1.emptyTip), `an empty row explains itself: "${s1.emptyTip}"`);
await page.locator('#tc-lppop').screenshot({ path: resolve(HERE, '..', 'screenshots', 'len_parser_empty.png') });

// a non-empty value that isn't a time still blocks — and emptying it again unblocks
const row2 = page.locator('#tc-lppop .tc-lp-val').nth(1);
await row2.fill('9:99');
const s2 = await state();
ck(s2.bad === 1 && s2.ok.disabled && s2.badge, `"9:99" is still invalid and blocks Apply (${s2.ok.text})`);
await row2.fill('');
const s3 = await state();
ck(s3.bad === 0 && !s3.ok.disabled, 'clearing it again makes it an empty row, and Apply is back');

const okBtn = page.locator('#tc-lppop .tc-lp-ok');
if (await okBtn.isDisabled()) ck(false, 'Apply is disabled with empty rows — nothing can be applied');
else await okBtn.click();
await page.waitForTimeout(600);
const after = await lengths();
log('after:', JSON.stringify(after));
ck(after[0] === '3:01' && after[2] === '3:03' && after[4] === '3:05', 'tracks 1, 3, 5 got the pasted lengths');
ck(after[1] === '1:11' && after[3] === '2:22', 'tracks 2 and 4 kept theirs — an empty row never clears');
ck(!(await page.$('#tc-lppop')), 'the parser closed after Apply');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
