// Verifies #280 — configurable Tools bar (inline-params model):
//  - on-bar tools render in order: no-param tools as buttons, param tools as
//    inline groups (icon/name trigger + their params) at their position
//  - no ⋯ button; the Tools label opens a menu of off-bar tools + Customize
//  - no pin / no 2nd row
//  - per-tool icon/text (≥1), no "icon"/"text" words in the config
//  - the toolbar wraps (flex) instead of pushing Match outside the content
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

  // on-bar tools in order; param tools are inline groups carrying their params
  const layout = await page.evaluate(() => ({
    order: [...document.querySelectorAll('.tc-toolbtns > *')].map(e => e.dataset.tool || e.dataset.act),
    guessfeatIsButton: !!document.querySelector('.tc-toolbtns > button.tc-toolbtn[data-act="guessfeat"]'),
    gcGroupHasParams: !!document.querySelector('.tc-opt[data-tool="guesscase"] .tc-gco'),
    srGroupHasParams: !!document.querySelector('.tc-opt[data-tool="sr"] .tc-sro'),
    colsGroupHasParams: !!document.querySelector('.tc-opt[data-tool="cols"] .tc-colso'),
    noRow2: !document.getElementById('tc-bar2'),
    noMore: !document.querySelector('.tc-toolbtns .tc-more'),
  }));
  ok('on-bar order = guess feat, case, S&R, columns', JSON.stringify(layout.order) === JSON.stringify(['guessfeat', 'guesscase', 'sr', 'cols']));
  ok('no-param tool is a button; param tools are inline groups with their params', layout.guessfeatIsButton && layout.gcGroupHasParams && layout.srGroupHasParams && layout.colsGroupHasParams);
  ok('no 2nd row element', layout.noRow2);
  ok('no ⋯ button', layout.noMore);

  // Tools label → menu of off-bar tools + Customize
  await page.click('.tc-toolslabel'); await page.waitForSelector('#tc-menu');
  const menu = await page.evaluate(() => [...document.querySelectorAll('#tc-menu .tc-mi')].map(m => m.dataset.act));
  ok('Tools menu lists off-bar tools + Customize', JSON.stringify(menu) === JSON.stringify(['parser', 'swap', 'resetnum', '__cfg']));
  await page.click('#tc-menu .tc-mi-cfg'); await page.waitForSelector('#tc-toolcfg');

  // no pin control in the config
  ok('no pin control in Customize', await page.evaluate(() => !document.querySelector('#tc-toolcfg .tc-tc-pin')));
  ok('no "icon"/"text" words in the density control', await page.evaluate(() => !/\bicon\b|\btext\b/i.test(document.querySelector('#tc-toolcfg .tc-tc-dens').textContent)));

  // per-tool icon/text state-buttons: turn OFF text on cols → icon-only group label
  await page.click('#tc-toolcfg .tc-tc-row[data-act="cols"] .cb-text'); await page.waitForTimeout(150);
  const colsLab = await page.evaluate(() => { const n = document.querySelector('.tc-opt[data-tool="cols"] .tc-optname'); return { hasIc: !!n.querySelector('.tc-tbic'), hasLab: !!n.querySelector('.tc-tblab') }; });
  ok('icon-only param tool shows just its icon label', colsLab.hasIc && !colsLab.hasLab);
  await page.click('#tc-toolcfg .tc-tc-row[data-act="cols"] .cb-icon').catch(() => {}); await page.waitForTimeout(150);
  ok('cannot drop BOTH icon and text (≥1 enforced)', await page.evaluate(() => { const r = document.querySelector('#tc-toolcfg .tc-tc-row[data-act="cols"]'); return r.querySelector('.cb-icon').classList.contains('on') || r.querySelector('.cb-text').classList.contains('on'); }));

  // wrap: at a narrow width the buttons wrap to >1 row, and Match stays within the content (not pushed past it)
  await page.setViewportSize({ width: 1000, height: 1000 }); await page.waitForTimeout(300);
  const wrap = await page.evaluate(() => { const tb = document.querySelector('.tc-toolbtns'); const one = document.querySelector('.tc-toolbtns > *'); const match = document.querySelector('#tc-bar [data-act="match"]'); const wrapW = document.getElementById('tc-mirror-wrap').clientWidth; return { multiRow: tb.getBoundingClientRect().height > one.getBoundingClientRect().height * 1.5, matchRight: match.getBoundingClientRect().right, wrapW }; });
  ok('toolbar wraps to multiple rows when narrow', wrap.multiRow);
  ok('Match stays within the content width (not pushed past it)', wrap.matchRight <= wrap.wrapW + 1);

  ok('no page errors', errs.length === 0);
  await writeFile(resolve(LOG_DIR, 'result.txt'), out.join('\n'));
  await ctx.close();
  const failed = checks.filter(c => !c[1]);
  console.log(failed.length ? `[280] ${failed.length} FAILED` : '[280] ALL PASS');
  process.exit(failed.length ? 1 : 0);
};
main().catch(e => { console.error(e); process.exit(2); });
