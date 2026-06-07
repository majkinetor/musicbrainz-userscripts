// Verify #143: dated relationships span 2 cells (not the whole row), so multiple dated types share a
// wide row; the type stays one line and a long date wraps inside the cell without overlapping neighbours.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const ORIGIN = process.env.TC_ORIGIN || 'https://beta.musicbrainz.org';
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || 'd39b6cab-6ae6-4de8-b782-528865f4e832';
const HEADED = process.argv.includes('--headed');
const LOG = resolve(HERE, 'logs');
async function main() {
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1700, height: 1050 }, deviceScaleFactor: 2 });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length > 0; } catch { return false; } }, null, { timeout: 180000 });
  await page.evaluate(() => { try { const k='apolloEditor.settings.v1'; const s=JSON.parse(localStorage.getItem(k)||'{}'); s.apolloEnabled=true; s.replaceReleaseInfo=true; localStorage.setItem(k, JSON.stringify(s)); } catch(e){} });
  await page.addScriptTag({ content: scriptCode });
  await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 15000 });
  await page.evaluate(() => { try { window.__apolloEditor.settings.apolloEnabled = true; window.__apolloEditor.settings.replaceReleaseInfo = true; window.__apolloEditor.applyView(); } catch(e){} });
  await page.evaluate(() => { const t = [...document.querySelectorAll('a,button,li')].find(e => /^\s*release information\s*$/i.test(e.textContent || '')); if (t) (t.querySelector('a')||t).click(); });
  await page.waitForFunction(() => document.body.classList.contains('tc-ri-on'), null, { timeout: 15000 }).catch(()=>{});
  await page.waitForTimeout(700);

  // add a date to BOTH types of a multi-type link (purchase for download + streaming page)
  const addDateToNth = async (n, parts) => {
    const ok = await page.evaluate((n) => {
      const rels = [...document.querySelectorAll('#external-links-editor tr.relationship-item')].filter(r => r.querySelector('button.edit-item') && /purchase for download|streaming page/i.test(r.textContent||''));
      // pick the nth distinct type within the apple link group (first link that has 2 such types)
      if (rels[n]) { rels[n].querySelector('button.edit-item').click(); return true; } return false;
    }, n);
    if (!ok) return;
    await page.waitForTimeout(450);
    const vis = page.locator('.dialog.popover, .bubble, [role="dialog"]').filter({ has: page.locator('input[name="period.begin_date.year"]') }).filter({ visible: true }).first();
    for (const [k, v] of Object.entries(parts)) await vis.locator(`input[name="period.${k}"]`).fill(v).catch(()=>{});
    await page.waitForTimeout(120);
    await vis.locator('button').filter({ hasText: /^\s*Done\s*$/ }).first().click().catch(()=>{});
    await page.waitForTimeout(650);
  };
  await addDateToNth(0, { 'begin_date.year': '1111', 'begin_date.month':'11','begin_date.day':'11','end_date.year': '1112','end_date.month':'11','end_date.day':'11' });
  await addDateToNth(1, { 'begin_date.year': '1233', 'end_date.year': '1234' });

  const res = await page.evaluate(() => {
    const rectOf = e => { const r = e.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), w: Math.round(r.width) }; };
    const dated = [...document.querySelectorAll('#external-links-editor tr.relationship-item')].filter(r => r.querySelector('.date-period'));
    const col = document.getElementById('tc-ri-rightcol');
    const colR = col ? col.getBoundingClientRect().right : 1e9;
    // overlap check: do any two dated rects on the same visual row intersect horizontally?
    let overlap = false;
    for (let i=0;i<dated.length;i++) for (let j=i+1;j<dated.length;j++){ const a=dated[i].getBoundingClientRect(), b=dated[j].getBoundingClientRect(); if (Math.abs(a.top-b.top)<6 && a.left < b.right && b.left < a.right) overlap = true; }
    const tops = [...new Set(dated.map(d => Math.round(d.getBoundingClientRect().top)))];
    return {
      count: dated.length,
      items: dated.map(d => ({ span: getComputedStyle(d).gridColumn, dp: d.querySelector('.date-period').textContent.trim(), rect: rectOf(d), fits: d.getBoundingClientRect().right <= colR + 1 })),
      sameRow: tops.length < dated.length,   // at least two share a row
      distinctRows: tops.length,
      overlap,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  console.log('RESULT:', JSON.stringify(res, null, 2));
  const col = await page.$('#tc-ri-rightcol'); if (col) await col.screenshot({ path: resolve(LOG, 'issue4d-share.png') }).catch(()=>{});
  if (!HEADED) await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
