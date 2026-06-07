// Verify #143 issue 4 (grow-and-push): a dated external-link relationship keeps "type (begin – end)"
// on ONE line and grows the type cell to push the following controls right — in both a wide and a
// moderately narrow column. Also screenshots so the favicon size revert can be eyeballed.
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
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1050 }, deviceScaleFactor: 2 });
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

  // add a full begin+end date to a "stream for free" relationship (longest type, worst case)
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#external-links-editor tr.relationship-item')];
    const rel = rows.find(r => /stream for free/i.test(r.textContent||'') && r.querySelector('button.edit-item')) || rows.find(r => r.querySelector('button.edit-item'));
    if (rel) rel.querySelector('button.edit-item').click();
  });
  await page.waitForTimeout(500);
  const vis = page.locator('.dialog.popover, .bubble, [role="dialog"]').filter({ has: page.locator('input[name="period.begin_date.year"]') }).filter({ visible: true }).first();
  for (const [n, v] of [['period.begin_date.year','1111'],['period.begin_date.month','11'],['period.begin_date.day','11'],['period.end_date.year','1112'],['period.end_date.month','11'],['period.end_date.day','11']]) {
    await vis.locator(`input[name="${n}"]`).fill(v).catch(()=>{});
  }
  await page.waitForTimeout(150);
  await vis.locator('button').filter({ hasText: /^\s*Done\s*$/ }).first().click().catch(()=>{});
  await page.waitForTimeout(800);

  const measure = async (label) => {
    const r = await page.evaluate(() => {
      const rel = [...document.querySelectorAll('#external-links-editor tr.relationship-item')].find(r => r.querySelector('.date-period'));
      if (!rel) return 'no dated rel';
      const name = rel.querySelector('.relationship-name');
      const dp = rel.querySelector('.date-period');
      const col = document.getElementById('tc-ri-rightcol');
      const lineH = parseFloat(getComputedStyle(name).lineHeight) || 16;
      const attr = rel.querySelector('.attribute-container');
      return {
        nameH: Math.round(name.getBoundingClientRect().height), oneLine: name.getBoundingClientRect().height <= lineH * 1.6,
        dpText: (dp.textContent||'').trim(),
        col1W: getComputedStyle(rel.querySelector('td:last-child')).gridTemplateColumns,
        attrLeft: attr ? Math.round(attr.getBoundingClientRect().left) : null,
        nameRight: Math.round(name.getBoundingClientRect().right),
        relRight: Math.round(rel.getBoundingClientRect().right),
        colRight: col ? Math.round(col.getBoundingClientRect().right) : null,
        docScrollW: document.documentElement.scrollWidth, winW: window.innerWidth,
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    console.log(label, JSON.stringify(r));
    const col = await page.$('#tc-ri-rightcol');
    if (col) await col.screenshot({ path: resolve(LOG, `issue4b-${label}.png`) }).catch(()=>{});
  };
  await measure('wide');
  await page.addStyleTag({ content: '#tc-ri-rightcol{flex:0 0 360px !important;max-width:360px !important;min-width:360px !important}' });
  await page.waitForTimeout(300);
  await measure('narrow');
  if (!HEADED) await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
