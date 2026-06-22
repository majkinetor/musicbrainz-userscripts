// #280 visual smoke: configurable tools bar. Loads the editor, opens Tracklist,
// shoots: (1) default bar, (2) Customize popover, (3) bar with 2 pinned panels +
// an active tool's inline params. Also reports console errors.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const DEV = resolve(HERE, '..', '..', '..', 'dev');
const ORIGIN = 'https://musicbrainz.org';
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '06278b3f-1b45-4355-9b1e-368c5016b831';

const main = async () => {
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2.5 });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#tracklist"]'); if (a) a.click(); });
  await page.waitForSelector('.tc-toolbtns', { timeout: 30000 });
  await page.waitForTimeout(1500);

  const shotBar = async (name) => { const w = await page.$('#tc-mirror-wrap'); await w.screenshot({ path: resolve(DEV, name) }); };

  // 1) default bar
  await shotBar('_i280_default.png');

  // 2) open Customize popover (from the Tools label)
  await page.click('.tc-toolslabel');
  await page.waitForSelector('#tc-toolcfg', { timeout: 5000 });
  await page.screenshot({ path: resolve(DEV, '_i280_config.png'), clip: await page.evaluate(() => { const p = document.getElementById('tc-toolcfg'); const r = p.getBoundingClientRect(); return { x: Math.max(0, r.left - 6), y: Math.max(0, r.top - 6), width: r.width + 12, height: r.height + 12 }; }) });

  // pin guesscase + sr from the popover
  for (const act of ['guesscase', 'sr']) {
    const pin = await page.$(`#tc-toolcfg .tc-tc-row[data-act="${act}"] button.tc-tc-pin`);
    if (pin) await pin.click();
    await page.waitForTimeout(150);
  }
  // close popover, then make "cols" the active tool (inline params on row 1)
  await page.click('#tc-bar', { position: { x: 5, y: 5 } });
  await page.waitForTimeout(200);
  const cols = await page.$('.tc-toolbtn[data-act="cols"]'); if (cols) await cols.click();
  await page.waitForTimeout(400);
  await shotBar('_i280_pinned.png');

  const state = await page.evaluate(() => ({
    buttons: [...document.querySelectorAll('.tc-toolbtns .tc-toolbtn')].map(b => b.dataset.act || b.textContent),
    row2: [...document.querySelectorAll('#tc-bar2 .tc-opt')].map(o => o.dataset.tool),
    row2visible: getComputedStyle(document.getElementById('tc-bar2')).display !== 'none',
    inline: !!document.querySelector('.tc-toolopts .tc-colso'),
    barHeight: document.getElementById('tc-bar').getBoundingClientRect().height,
  }));
  console.log('[280] state:', JSON.stringify(state));
  console.log('[280] console errors:', errs.length ? JSON.stringify(errs.slice(0, 5)) : 'none');
  await ctx.close();
};
main().catch(e => { console.error(e); process.exit(2); });
