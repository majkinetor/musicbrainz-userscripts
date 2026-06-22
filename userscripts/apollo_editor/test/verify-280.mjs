// Verifies #280 — configurable Tools bar:
//  - default tools render as buttons; rare ones live under ⋯
//  - Customize popover opens from the "Tools" label; 📌 pins params to row 2
//  - per-tool icon/text; at least one must stay on
//  - long toast text left of Match does NOT change the toolbar height (point 2)
//
//   node test/verify-280.mjs [--headed] [MBID]
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const ORIGIN = 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '06278b3f-1b45-4355-9b1e-368c5016b831';
const SKEY = 'apolloEditor.settings.v1';
const LOG_DIR = resolve(HERE, 'logs', 'verify-280');

const out = []; const say = (...a) => { const s = a.join(' '); out.push(s); console.log('[280]', s); };
const checks = []; const ok = (name, cond) => { checks.push([name, !!cond]); say((cond ? 'PASS ' : 'FAIL ') + name); };

const main = async () => {
  await mkdir(LOG_DIR, { recursive: true });
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1000 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  // start from a clean tool config so defaults are deterministic
  await page.addInitScript((k) => { try { const s = JSON.parse(localStorage.getItem(k) || '{}'); delete s.toolCfg; delete s.lastTool; localStorage.setItem(k, JSON.stringify(s)); } catch (e) {} }, SKEY);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#tracklist"]'); if (a) a.click(); });
  await page.waitForSelector('.tc-toolbtns', { timeout: 30000 });
  await page.waitForTimeout(800);

  const bar = await page.evaluate(() => [...document.querySelectorAll('.tc-toolbtns .tc-toolbtn')].map(b => b.dataset.act || ''));
  ok('default bar = guess feat/case, S&R, columns (no ⋯)', JSON.stringify(bar) === JSON.stringify(['guessfeat', 'guesscase', 'sr', 'cols']));

  // point 2: long toast text must not change the toolbar height
  const h0 = await page.evaluate(() => document.getElementById('tc-bar').getBoundingClientRect().height);
  const h1 = await page.evaluate(() => { document.querySelectorAll('.tc-disc-msg').forEach(e => e.textContent = 'added Discogs link to Some Very Long Artist Name Indeed'); document.querySelectorAll('.tc-toast').forEach(e => e.textContent = 'linked “X” — also on 12 matching tracks and more text here to fill'); return document.getElementById('tc-bar').getBoundingClientRect().height; });
  ok('toolbar height unchanged when toast/link text appears (' + h0 + '→' + h1 + ')', h0 === h1);
  await page.evaluate(() => { document.querySelectorAll('.tc-disc-msg,.tc-toast').forEach(e => e.textContent = ''); });

  // the Tools label opens a menu of the off-bar tools + a Customize item (no ⋯ button)
  await page.click('.tc-toolslabel'); await page.waitForSelector('#tc-menu');
  const menu = await page.evaluate(() => ({ items: [...document.querySelectorAll('#tc-menu .tc-mi')].map(m => m.dataset.act), noMoreBtn: !document.querySelector('.tc-toolbtns .tc-more') }));
  ok('no ⋯ button on the bar', menu.noMoreBtn);
  ok('Tools menu lists off-bar tools + Customize', JSON.stringify(menu.items) === JSON.stringify(['parser', 'swap', 'resetnum', '__cfg']));
  // open Customize from the menu, then pin guesscase + sr
  await page.click('#tc-menu .tc-mi-cfg'); await page.waitForSelector('#tc-toolcfg');
  for (const act of ['guesscase', 'sr']) { const p = await page.$(`#tc-toolcfg .tc-tc-row[data-act="${act}"] button.tc-tc-pin`); if (p) await p.click(); await page.waitForTimeout(120); }
  const row2 = await page.evaluate(() => ({ vis: getComputedStyle(document.getElementById('tc-bar2')).display !== 'none', tools: [...document.querySelectorAll('#tc-bar2 .tc-opt')].map(o => o.dataset.tool), noPin: !document.querySelector('#tc-bar2 .tc-tc-pin, #tc-bar2 .tc-opt .pin'), trig: !!document.querySelector('#tc-bar2 .tc-opt .tc-opttrig'), barBtns: [...document.querySelectorAll('.tc-toolbtns .tc-toolbtn')].map(b => b.dataset.act || (b.classList.contains('tc-more') ? '⋯' : '')) }));
  ok('pinning shows the two panels on row 2', row2.vis && JSON.stringify(row2.tools) === JSON.stringify(['guesscase', 'sr']));
  ok('no 📌 glyph on the row-2 panels', row2.noPin);
  ok('pinned tools dropped from the row-1 buttons', JSON.stringify(row2.barBtns) === JSON.stringify(['guessfeat', 'cols']));
  ok('row-2 panel icon is a clickable trigger', row2.trig);

  // per-tool icon/text are icon state-buttons (no "icon"/"text" words): turn OFF text → icon-only
  await page.click('#tc-toolcfg .tc-tc-row[data-act="cols"] .cb-text'); await page.waitForTimeout(150);
  const colsIconOnly = await page.evaluate(() => { const b = document.querySelector('.tc-toolbtn[data-act="cols"]'); return { hasIc: !!b.querySelector('.tc-tbic'), hasLab: !!b.querySelector('.tc-tblab') }; });
  ok('icon-only tool shows icon, no text', colsIconOnly.hasIc && !colsIconOnly.hasLab);
  // try to also turn OFF icon → ≥1 must keep one (it flips to text-only)
  await page.click('#tc-toolcfg .tc-tc-row[data-act="cols"] .cb-icon').catch(() => {}); await page.waitForTimeout(150);
  const colsAfter = await page.evaluate(() => { const b = document.querySelector('.tc-toolbtn[data-act="cols"]'); const r = document.querySelector('#tc-toolcfg .tc-tc-row[data-act="cols"]'); return { icOn: r.querySelector('.cb-icon').classList.contains('on'), txtOn: r.querySelector('.cb-text').classList.contains('on'), hasContent: !!(b.querySelector('.tc-tbic') || b.querySelector('.tc-tblab')) }; });
  ok('cannot drop BOTH icon and text (≥1 enforced)', (colsAfter.icOn || colsAfter.txtOn) && colsAfter.hasContent);
  // the config no longer spams the words "icon"/"text"
  const noWords = await page.evaluate(() => !/\bicon\b|\btext\b/i.test(document.querySelector('#tc-toolcfg .tc-tc-dens').textContent));
  ok('no "icon"/"text" words in the density control', noWords);

  // move parser onto the bar, verify it leaves the ⋯ menu
  await page.check('#tc-toolcfg .tc-tc-row[data-act="parser"] .cb-onbar'); await page.waitForTimeout(150);
  const hasParserBtn = await page.evaluate(() => !!document.querySelector('.tc-toolbtn[data-act="parser"]'));
  ok('toggling a tool On the bar adds its button', hasParserBtn);

  ok('no page errors', errs.length === 0);
  await writeFile(resolve(LOG_DIR, 'result.txt'), out.join('\n'));
  await ctx.close();
  const failed = checks.filter(c => !c[1]);
  console.log(failed.length ? `[280] ${failed.length} FAILED` : '[280] ALL PASS');
  process.exit(failed.length ? 1 : 0);
};
main().catch(e => { console.error(e); process.exit(2); });
