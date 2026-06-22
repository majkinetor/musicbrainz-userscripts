// Verifies #279: tracklist keyboard navigation caret behavior + its toggle.
//
//   Default (Keep caret position ON):  ↓ carries the caret COLUMN to the next
//     row's field (collapsed caret, clamped), never a select-all.
//   Toggle OFF:                        ↓ selects the whole destination field
//     (the old behavior), so the next keystroke overwrites it.
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
const SKEY = 'apolloEditor.settings.v1';
const LOG_DIR = resolve(HERE, 'logs', 'verify-279');
const COL = 3;

const out = [];
const say = (...a) => { const s = a.join(' '); out.push(s); console.log('[279]', s); };

async function pass(page, scriptCode, keepCaret) {
  // set the toggle BEFORE injecting so the script loads with it
  await page.evaluate(({ k, keep }) => { const s = JSON.parse(localStorage.getItem(k) || '{}'); s.keepCaretColumn = keep; localStorage.setItem(k, JSON.stringify(s)); }, { k: SKEY, keep: keepCaret });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#tracklist"]'); if (a) a.click(); });
  await page.waitForSelector('.t-title', { timeout: 30000 });

  await page.evaluate((col) => { const t = document.querySelectorAll('.t-title')[0]; t.focus(); t.setSelectionRange(col, col); }, COL);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  return page.evaluate(() => {
    const el = document.activeElement; const titles = [...document.querySelectorAll('.t-title')];
    return { idx: titles.indexOf(el), len: (el.value || '').length, selStart: el.selectionStart, selEnd: el.selectionEnd };
  });
}

const main = async () => {
  await mkdir(LOG_DIR, { recursive: true });
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1000 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }

  const on = await pass(page, scriptCode, true);
  say('keepCaret ON  → moved to row', on.idx, 'caret', on.selStart + '/' + on.selEnd, '(len ' + on.len + ')');
  const onOk = on.idx === 1 && on.selStart === on.selEnd && on.selStart === Math.min(COL, on.len);

  const off = await pass(page, scriptCode, false);
  say('keepCaret OFF → moved to row', off.idx, 'caret', off.selStart + '/' + off.selEnd, '(len ' + off.len + ')');
  const offOk = off.idx === 1 && off.selStart === 0 && off.selEnd === off.len && off.len > 0;   // select-all

  const okPass = onOk && offOk;
  say(okPass ? 'PASS — ON preserves the caret column; OFF selects the whole field' : `FAIL — onOk=${onOk} offOk=${offOk}`);
  await writeFile(resolve(LOG_DIR, 'result.txt'), out.join('\n'));
  await ctx.close();
  process.exit(okPass ? 0 : 1);
};
main().catch(e => { console.error(e); process.exit(2); });
