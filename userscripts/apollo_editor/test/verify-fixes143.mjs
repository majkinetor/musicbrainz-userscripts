// Verify the three fixes from majkinetor's #143 review on the release he tested:
//  1) oversized favicon (Discogs) no longer overflows its cell
//  2) checkbox labels are not bold/intrusive
//  3) switching Apollo→Original doesn't leave a mispositioned native bubble visible
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const ORIGIN = process.env.TC_ORIGIN || 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || 'ce9529d6-b490-4010-b8ff-5e1fb0f8441e';
const LOG = resolve(HERE, 'logs');
async function main() {
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1050 }, deviceScaleFactor: 2 });
  const page = ctx.pages()[0] || await ctx.newPage();
  const cons = []; page.on('console', m => cons.push(`${m.type()} ${m.text()}`)); page.on('pageerror', e => cons.push(`pageerror ${e.message}`));
  await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForFunction(() => { try { const r = window.MB.releaseEditor.rootField.release(); return r.mediums().length > 0; } catch { return false; } }, null, { timeout: 180000 });
  // reset the persisted setting so Apollo + RI takeover are on (an earlier test had toggled Apollo off in this profile)
  await page.evaluate(() => { try { const k='apolloEditor.settings.v1'; const s=JSON.parse(localStorage.getItem(k)||'{}'); s.apolloEnabled=true; s.replaceReleaseInfo=true; localStorage.setItem(k, JSON.stringify(s)); } catch(e){} });
  await page.addScriptTag({ content: scriptCode });
  await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 15000 });
  await page.evaluate(() => { try { window.__apolloEditor.settings.apolloEnabled = true; window.__apolloEditor.settings.replaceReleaseInfo = true; window.__apolloEditor.applyView(); } catch(e){} });
  await page.evaluate(() => { const t = [...document.querySelectorAll('a,button,li')].find(e => /^\s*release information\s*$/i.test(e.textContent || '')); if (t) (t.querySelector('a')||t).click(); });
  await page.waitForFunction(() => document.body.classList.contains('tc-ri-on'), null, { timeout: 15000 }).catch(()=>{});
  await page.waitForTimeout(800);

  const checks = await page.evaluate(() => {
    const out = {};
    // 1) favicon size + cell overflow
    const fav = document.querySelector('#external-links-editor .favicon');
    const cell = fav && fav.closest('td');
    out.favicon = fav ? { tag: fav.tagName, w: Math.round(fav.getBoundingClientRect().width), h: Math.round(fav.getBoundingClientRect().height), cellOverflow: cell ? getComputedStyle(cell).overflow : null, cellW: cell ? Math.round(cell.getBoundingClientRect().width) : null } : 'no favicon';
    // 2/3) label weights — only Title + Artist should be bold; all other field + checkbox labels normal
    out.labels = [...document.querySelectorAll('#information table.row-form label')].map(l => ({
      text: (l.textContent||'').trim().slice(0,34), forAttr: l.getAttribute('for'), hasInput: !!l.querySelector('input'),
      weight: getComputedStyle(l).fontWeight,
    })).filter(x => x.text);
    return out;
  });
  console.log('apollo-view checks:', JSON.stringify(checks, null, 2));
  await page.screenshot({ path: resolve(LOG, 'fix-apollo.png') });

  // 3) switch Apollo OFF and immediately check no native bubble is left visible/mispositioned
  await page.evaluate(() => { const l = document.querySelector('#tc-launch .tc-launch-lbl'); if (l) l.click(); });
  await page.waitForFunction(() => !document.body.classList.contains('tc-ri-on'), null, { timeout: 8000 }).catch(()=>{});
  await page.waitForTimeout(150);   // immediately after switch, before any focus
  const afterSwitch = await page.evaluate(() => {
    const doc = document.querySelector('#information > div.documentation');
    const visible = doc ? [...doc.querySelectorAll('.bubble')].filter(b => b.offsetParent !== null).map(b => ({ db: b.getAttribute('data-bind'), left: b.style.left, w: b.style.width })) : [];
    return { visibleBubbles: visible };
  });
  console.log('right-after-switch visible native bubbles:', JSON.stringify(afterSwitch));
  await page.screenshot({ path: resolve(LOG, 'fix-after-switch.png') });

  console.log('--- console tail ---'); cons.slice(-8).forEach(l => console.log(l));
  if (!HEADED) await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
