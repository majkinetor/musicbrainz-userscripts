// #119 Phase 1 verification: inject Apollo, go to the Recordings tab, open the preview panel,
// assert it renders rows + confidence dots, screenshot it.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const ORIGIN = 'https://musicbrainz.org';
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || 'b2b6dc32-77a3-4a89-8af0-99d4b6f1a9ad';
const HEADED = process.argv.includes('--headed');
const LOG_DIR = resolve(HERE, 'logs', 'rec-p1-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 2 });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(`${e.name}: ${e.message}`));
await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums()[0].tracks().length; } catch { return false; } }, null, { timeout: 120000 });
await page.addScriptTag({ content: await readFile(SCRIPT_PATH, 'utf8') });
await page.waitForFunction(() => !!window.__trackCannon, null, { timeout: 15000 });

// go to the Recordings tab so the launcher appears
await page.locator('a, button, li', { hasText: /^Recordings$/ }).first().click().catch(() => {});
await page.waitForSelector('#tc-rec-launch', { timeout: 15000 });
await page.click('#tc-rec-launch');
await page.waitForSelector('#tc-recpanel .tc-rectbl tbody tr', { timeout: 15000 });
await page.waitForTimeout(600);

const out = await page.evaluate(() => {
  const rows = window.__trackCannon.readRecordings();
  const panel = document.getElementById('tc-recpanel');
  const trs = [...panel.querySelectorAll('.tc-rectbl tbody tr')];
  const dotColors = trs.map(tr => { const d = tr.querySelector('.tc-rec-dot'); return d ? (d.style.background || (d.style.visibility === 'hidden' ? 'hidden' : '')) : null; });
  return {
    modelRows: rows.length,
    withRecording: rows.filter(r => r.recGid).length,
    withoutRecording: rows.filter(r => !r.recGid && !r.isNew).length,
    confidenceBreakdown: rows.reduce((m, r) => { const k = r.conf ? r.conf.level : (r.recGid ? 'perfect' : 'none'); m[k] = (m[k] || 0) + 1; return m; }, {}),
    domRows: trs.length,
    dotColorsSample: dotColors.slice(0, 5),
    warnShown: !!panel.querySelector('.tc-rec-warn'),
    firstRow: rows[0] ? { num: rows[0].number, title: rows[0].title, rec: rows[0].recName, len: rows[0].recLen, sugg: rows[0].suggCount } : null,
  };
});
await page.locator('#tc-recpanel').screenshot({ path: resolve(LOG_DIR, 'rec-panel.png') }).catch(async () => { await page.screenshot({ path: resolve(LOG_DIR, 'rec-panel.png') }); });
await ctx.close();
console.log(JSON.stringify(out, null, 2));
console.log('pageerrors:', errs.length ? errs : 'none');
console.log('screenshot:', resolve(LOG_DIR, 'rec-panel.png'));
const pass = out.modelRows > 0 && out.domRows === out.modelRows && errs.length === 0;
console.log(pass ? '\n✅ PASS' : '\n❌ FAIL');
process.exit(pass ? 0 : 1);
