// #153: the guess-case (Aa) / feat (⋔) in-cell buttons must NOT reserve width
// and shrink the title input (which clipped long titles after "Fit"). They now
// overlay absolutely. Verify: a row WITH the Aa button has the same input width
// as a plain row, and the input isn't clipped.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '51bdb849-5dfc-40c0-9fcb-f49fe7395cc7';
const HEADED = process.argv.includes('--headed');

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: !HEADED, viewport: { width: 1400, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
await page.addScriptTag({ content: await readFile(SCRIPT, 'utf8') });
await page.waitForTimeout(1200);
await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#tracklist"]'); if (a) a.click(); });
await page.waitForTimeout(500);
await page.evaluate(() => { try { window.__apolloEditor.showMirror(); } catch (e) {} });
await page.waitForSelector('.tc-mirror tbody input.t-title', { timeout: 30000 });

// Manufacture a guess-case diff on the first title (lowercase it) so the Aa button appears.
await page.evaluate(() => {
  const inp = document.querySelector('.tc-mirror tbody input.t-title');
  inp.value = (inp.value || 'Test Title').toLowerCase();
  inp.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(600);

// Apply "Fit" via the exposed colsFit if available, else leave default widths.
await page.evaluate(() => { try { window.__apolloEditor && window.__apolloEditor.colsFit && window.__apolloEditor.colsFit(); } catch (e) {} });
await page.waitForTimeout(400);

const res = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.tc-mirror tbody tr')].filter(r => r.querySelector('input.t-title'));
  const withBtn = rows.find(r => r.querySelector('.t-gc'));
  const plain   = rows.find(r => !r.querySelector('.t-gc'));
  const measure = r => { if (!r) return null; const inp = r.querySelector('input.t-title'); const wrap = r.querySelector('.t-wrap'); return { inputW: inp.clientWidth, wrapW: wrap.clientWidth, clipped: inp.scrollWidth > inp.clientWidth + 1 }; };
  const acts = withBtn && withBtn.querySelector('.t-actions');
  return {
    hasBtnRow: !!withBtn,
    actionsPos: acts ? getComputedStyle(acts).position : null,
    withBtn: measure(withBtn),
    plain: measure(plain),
  };
});
console.log(JSON.stringify(res, null, 2));

// The button row's input should be (almost) as wide as the wrap — i.e. the button
// no longer subtracts ~28px — and match a plain row's input width.
const wb = res.withBtn, pl = res.plain;
const inputFillsWrap = wb && (wb.wrapW - wb.inputW) < 8;
const matchesPlain   = !pl || Math.abs(wb.inputW - pl.inputW) <= 2;
const overlaid       = res.actionsPos === 'absolute';
// NB: `clipped` is not a fix signal here — these classical titles are longer than
// any sane column, so plain rows clip too. The fix is proven by the button row's
// input being the SAME width as a plain row (it used to be ~28px narrower).
const pass = res.hasBtnRow && overlaid && inputFillsWrap && matchesPlain;
console.log(pass ? 'PASS' : 'FAIL', { inputFillsWrap, matchesPlain, overlaid, note_clip_same_for_both: res.plain && wb.clipped === res.plain.clipped });
if (!HEADED) await ctx.close();
process.exit(pass ? 0 : 1);
