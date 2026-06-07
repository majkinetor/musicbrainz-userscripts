// Verify #143 issue 4: a dated external-link relationship in a NARROW right column wraps cleanly
// (type on one line, date period on the next) instead of squeezing the type one-word-per-line / overflowing.
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
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN to', ORIGIN); await ctx.close(); process.exit(3); }
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length > 0; } catch { return false; } }, null, { timeout: 180000 });
  await page.evaluate(() => { try { const k='apolloEditor.settings.v1'; const s=JSON.parse(localStorage.getItem(k)||'{}'); s.apolloEnabled=true; s.replaceReleaseInfo=true; localStorage.setItem(k, JSON.stringify(s)); } catch(e){} });
  await page.addScriptTag({ content: scriptCode });
  await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 15000 });
  await page.evaluate(() => { try { window.__apolloEditor.settings.apolloEnabled = true; window.__apolloEditor.settings.replaceReleaseInfo = true; window.__apolloEditor.applyView(); } catch(e){} });
  await page.evaluate(() => { const t = [...document.querySelectorAll('a,button,li')].find(e => /^\s*release information\s*$/i.test(e.textContent || '')); if (t) (t.querySelector('a')||t).click(); });
  await page.waitForFunction(() => document.body.classList.contains('tc-ri-on'), null, { timeout: 15000 }).catch(()=>{});
  await page.waitForTimeout(700);
  // force a NARROW right column to match the maintainer's condition
  await page.addStyleTag({ content: '#tc-ri-rightcol{flex:0 0 300px !important;max-width:300px !important;min-width:300px !important}' });

  // add begin+end year to the first editable relationship
  await page.evaluate(() => { const rel = [...document.querySelectorAll('#external-links-editor tr.relationship-item')].find(r => r.querySelector('button.edit-item')); if (rel) rel.querySelector('button.edit-item').click(); });
  await page.waitForTimeout(500);
  const vis = page.locator('.dialog.popover, .bubble, [role="dialog"]').filter({ has: page.locator('input[name="period.begin_date.year"]') }).filter({ visible: true }).first();
  await vis.locator('input[name="period.begin_date.year"]').fill('2111').catch(e => console.log('fill err', e.message));
  await vis.locator('input[name="period.end_date.year"]').fill('3111').catch(()=>{});
  await page.waitForTimeout(150);
  await vis.locator('button').filter({ hasText: /^\s*Done\s*$/ }).first().click().catch(e => console.log('done err', e.message));
  await page.waitForTimeout(800);

  const res = await page.evaluate(() => {
    const rel = [...document.querySelectorAll('#external-links-editor tr.relationship-item')].find(r => /\d{4}/.test(r.textContent||''));
    if (!rel) return 'no dated rel';
    const content = rel.querySelector('.relationship-content');
    const name = rel.querySelector('.relationship-name');
    const col = document.getElementById('tc-ri-rightcol');
    const lineH = name ? parseFloat(getComputedStyle(name).lineHeight) || 16 : 16;
    return {
      colW: col ? Math.round(col.getBoundingClientRect().width) : null,
      relRight: Math.round(rel.getBoundingClientRect().right),
      colRight: col ? Math.round(col.getBoundingClientRect().right) : null,
      nameH: name ? Math.round(name.getBoundingClientRect().height) : null,
      nameOneLine: name ? (name.getBoundingClientRect().height <= lineH * 1.6) : null,
      contentText: (content?.textContent||'').replace(/\s+/g,' ').trim().slice(0,60),
      overflowsCol: col ? (rel.getBoundingClientRect().right > col.getBoundingClientRect().right + 1) : null,
    };
  });
  console.log('ISSUE4 RESULT:', JSON.stringify(res, null, 2));
  const col = await page.$('#tc-ri-rightcol');
  if (col) await col.screenshot({ path: resolve(LOG, 'issue4-dated-narrow.png') }).catch(()=>{});
  if (!HEADED) await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
