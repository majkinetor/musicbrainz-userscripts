// #144: show recording disambiguation in the table + picker, and reformat the
// picker header to "title - artist … sec" (sec right-aligned). Disambiguation is
// read from the linked recording's plain `comment` field (no extra fetch), so we
// manufacture one to drive the rendering.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '51bdb849-5dfc-40c0-9fcb-f49fe7395cc7';
const HEADED = process.argv.includes('--headed');
const OUT = resolve(HERE, 'logs', 'shots'); await (await import('node:fs/promises')).mkdir(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: !HEADED, viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
await page.addScriptTag({ content: await readFile(SCRIPT, 'utf8') });
await page.waitForTimeout(1000);
await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#recordings"]'); if (a) a.click(); });
await page.waitForTimeout(500);

// Manufacture a disambiguation on the first linked recording, then render.
await page.evaluate(() => {
  const u = v => typeof v === 'function' ? v() : v;
  const recs = []; u(u(MB.releaseEditor.rootField.release).mediums).forEach(m => u(m.tracks).forEach(t => { const r = u(t.recording); if (r && u(r.gid)) recs.push(r); }));
  if (recs[0]) recs[0].comment = 'original mix';
  window.__apolloEditor.showRecMirror();
});
await page.waitForSelector('.tc-rectbl tbody tr.tc-recrow td.tc-recname', { timeout: 30000 });

const table = await page.evaluate(() => {
  const cell = document.querySelector('.tc-rectbl tbody tr.tc-recrow td.tc-recname');
  return { html: cell.innerHTML, hasDisamb: !!cell.querySelector('.tc-rec-disamb'), disambText: cell.querySelector('.tc-rec-disamb')?.textContent || '' };
});

// Open the picker for that row and inspect the current-selection + header.
await page.evaluate(() => { document.querySelector('.tc-rectbl tbody tr.tc-recrow td.tc-recname').click(); });
await page.waitForSelector('.tc-recpop .tc-rpk-hd', { timeout: 10000 });
await page.waitForTimeout(120);
const popCount = await page.evaluate(() => document.querySelectorAll('.tc-recpop').length);
console.log('popCount after open:', popCount);
const picker = await page.evaluate(() => {
  const cur = document.querySelector('.tc-recpop .tc-rpk-cur');
  const hd = document.querySelector('.tc-recpop .tc-rpk-hd');
  const hdlen = document.querySelector('.tc-recpop .tc-rpk-hdlen');
  return {
    curHasDisamb: !!(cur && cur.querySelector('.tc-rpk-cmt')),
    curDisamb: cur && cur.querySelector('.tc-rpk-cmt')?.textContent || '',
    hdDisplay: hd ? getComputedStyle(hd).display : '',
    hdlenRightGap: (hd && hdlen) ? Math.round(hd.getBoundingClientRect().right - hdlen.getBoundingClientRect().right) : 999,
    hdHasMain: !!(hd && hd.querySelector('.tc-rpk-hdmain')),
    hdText: hd ? hd.textContent.replace(/\s+/g, ' ').trim() : '',
  };
});
await page.locator('.tc-recpop').screenshot({ path: resolve(OUT, 'i144-picker.png') }).catch(() => {});
await page.locator('#tc-recwrap').screenshot({ path: resolve(OUT, 'i144-table.png') }).catch(() => {});

console.log(JSON.stringify({ table, picker }, null, 2));
const pass = table.hasDisamb && /original mix/.test(table.disambText) &&
             picker.curHasDisamb && /original mix/.test(picker.curDisamb) &&
             picker.hdDisplay === 'flex' && picker.hdlenRightGap <= 14 && picker.hdHasMain;
console.log(pass ? 'PASS' : 'FAIL');
if (!HEADED) await ctx.close();
process.exit(pass ? 0 : 1);
