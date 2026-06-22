// Verifies #279: tracklist keyboard navigation carries the caret COLUMN to the
// destination field instead of selecting the whole field (jesus2099-style).
//
// Loads a real release editor, injects the script, opens the Apollo Tracklist,
// puts the caret mid-word in a title input, presses ArrowDown, and asserts the
// next row's title input is focused with a COLLAPSED caret at the same column
// (clamped to its length) — not a full selection.
//
//   node test/verify-279.mjs [--headed] [MBID]
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const ORIGIN = 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '51bdb849-5dfc-40c0-9fcb-f49fe7395cc7';
const LOG_DIR = resolve(HERE, 'logs', 'verify-279');

const main = async () => {
  await mkdir(LOG_DIR, { recursive: true });
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1000 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  const out = [];
  const say = (...a) => { const s = a.join(' '); out.push(s); console.log('[279]', s); };

  await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN — re-auth .pw-profile'); await ctx.close(); process.exit(3); }
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(1200);

  // open the Tracklist tab so the Apollo mirror mounts
  await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#tracklist"]'); if (a) a.click(); });
  await page.waitForSelector('.tc-medsec .t-title, #tc-panel .t-title', { timeout: 30000 });
  const nTitles = await page.$$eval('.t-title', els => els.length);
  say('title inputs found:', nTitles);
  if (nTitles < 2) { console.error('need >=2 title rows to test vertical nav'); await ctx.close(); process.exit(4); }

  // Put the caret at column 3 in the first title input, then ArrowDown.
  const COL = 3;
  const res = await page.evaluate((col) => {
    const titles = [...document.querySelectorAll('.t-title')];
    const a = titles[0];
    a.focus();
    a.setSelectionRange(col, col);
    return { srcLen: (a.value || '').length, srcVal: a.value };
  }, COL);
  say('source field value:', JSON.stringify(res.srcVal), 'caret col:', COL);

  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);

  const after = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || !el.classList || !el.classList.contains('t-title')) return { focusedTitle: false, cls: el ? el.className : null };
    const titles = [...document.querySelectorAll('.t-title')];
    return {
      focusedTitle: true,
      idx: titles.indexOf(el),
      val: el.value,
      len: (el.value || '').length,
      selStart: el.selectionStart,
      selEnd: el.selectionEnd,
      selectedAll: el.selectionStart === 0 && el.selectionEnd === (el.value || '').length && (el.value || '').length > 0,
    };
  });
  say('after ArrowDown:', JSON.stringify(after));

  const expectCol = Math.min(COL, after.len ?? 0);
  const pass =
    after.focusedTitle === true &&
    after.idx === 1 &&
    after.selStart === after.selEnd &&            // collapsed caret, NOT a selection
    after.selStart === expectCol &&               // same column, clamped
    after.selectedAll === false;

  say(pass ? 'PASS — caret carried to the destination (collapsed, same column), no select-all'
           : 'FAIL — expected collapsed caret at col ' + expectCol + ' on row idx 1');

  await page.screenshot({ path: resolve(LOG_DIR, 'after.png') }).catch(() => {});
  await writeFile(resolve(LOG_DIR, 'result.txt'), out.join('\n'));
  await ctx.close();
  process.exit(pass ? 0 : 1);
};
main().catch(e => { console.error(e); process.exit(2); });
