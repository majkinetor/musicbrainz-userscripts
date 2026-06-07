// Verify #143: a dated external-link relationship takes the full grid row, so "type (begin – end)" fits
// on one line, doesn't overlap the neighbouring type's remove-✗, and the ＋ / controls stay visible —
// tested on a multi-type link (purchase for download + streaming page) in a narrowed column.
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
  // narrow column so multi-type rows would otherwise collide
  await page.addStyleTag({ content: '#tc-ri-rightcol{flex:0 0 470px !important;max-width:470px !important;min-width:470px !important}' });
  await page.waitForTimeout(300);

  // add year-month begin date to a "purchase for download" on a link that also has "streaming page"
  await page.evaluate(() => {
    const rel = [...document.querySelectorAll('#external-links-editor tr.relationship-item')].find(r => /purchase for download/i.test(r.textContent||'') && r.querySelector('button.edit-item'));
    if (rel) rel.querySelector('button.edit-item').click();
  });
  await page.waitForTimeout(450);
  const vis = page.locator('.dialog.popover, .bubble, [role="dialog"]').filter({ has: page.locator('input[name="period.begin_date.year"]') }).filter({ visible: true }).first();
  for (const [n, v] of [['begin_date.year','1213'],['begin_date.month','01'],['end_date.year','1233']]) await vis.locator(`input[name="period.${n}"]`).fill(v).catch(()=>{});
  await page.waitForTimeout(120);
  await vis.locator('button').filter({ hasText: /^\s*Done\s*$/ }).first().click().catch(()=>{});
  await page.waitForTimeout(700);

  const res = await page.evaluate(() => {
    const rectOf = e => { const r = e.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) }; };
    const dated = [...document.querySelectorAll('#external-links-editor tr.relationship-item')].find(r => r.querySelector('.date-period'));
    if (!dated) return 'no dated';
    const col = document.getElementById('tc-ri-rightcol');
    const name = dated.querySelector('.relationship-name');
    const lineH = parseFloat(getComputedStyle(name).lineHeight) || 16;
    // the neighbouring relationship (same link) and any add-item +
    const sibs = [...document.querySelectorAll('#external-links-editor tr.relationship-item')];
    const plus = document.querySelector('#external-links-editor button.add-item');
    return {
      datedGridColumn: getComputedStyle(dated).gridColumn,
      datedRect: rectOf(dated), colRect: col ? rectOf(col) : null,
      datedFitsColumn: col ? (dated.getBoundingClientRect().right <= col.getBoundingClientRect().right + 1) : null,
      typeOneLine: name.getBoundingClientRect().height <= lineH * 1.6,
      dpText: dated.querySelector('.date-period').textContent.trim(),
      anyPlusVisible: plus ? (plus.getBoundingClientRect().width > 0 && plus.getBoundingClientRect().left < (col ? col.getBoundingClientRect().right : 1e9)) : 'no plus',
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  console.log('RESULT:', JSON.stringify(res, null, 2));
  const col = await page.$('#tc-ri-rightcol'); if (col) await col.screenshot({ path: resolve(LOG, 'issue4c-narrow.png') }).catch(()=>{});
  if (!HEADED) await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
