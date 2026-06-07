// Verify #143: with the real userscript loaded and Apollo's Release-info view on, focusing an entity
// field (release group / label) surfaces a compact popover holding the clickable link to the selected
// entity — the help the maintainer flagged as lost. A non-entity field (barcode) shows nothing.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const ORIGIN = 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '51bdb849-5dfc-40c0-9fcb-f49fe7395cc7';
const LOG = resolve(HERE, 'logs');
async function main() {
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 3 });
  const page = ctx.pages()[0] || await ctx.newPage();
  const cons = []; page.on('console', m => cons.push(`${m.type()} ${m.text()}`)); page.on('pageerror', e => cons.push(`pageerror ${e.message}`));
  await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForFunction(() => { try { return !!(window.MB && window.MB.releaseEditor && window.MB.releaseEditor.rootField.release()); } catch { return false; } }, null, { timeout: 120000 });
  // wait until the release model has actually loaded its data (mediums + release group) — otherwise MB's
  // bubbles have no "You selected" link. Generous timeout so a throttled load still settles.
  await page.waitForFunction(() => { try { const r = window.MB.releaseEditor.rootField.release(); const rg = r.releaseGroup(); const g = rg && (typeof rg.gid === 'function' ? rg.gid() : rg.gid); return r.mediums().length > 0 && !!g; } catch { return false; } }, null, { timeout: 180000 }).catch(()=>{});
  await page.addScriptTag({ content: scriptCode });
  await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 15000 });
  // Release Information tab
  await page.evaluate(() => { const t = [...document.querySelectorAll('a,button,li')].find(e => /^\s*release information\s*$/i.test(e.textContent || '')); if (t) (t.querySelector('a')||t).click(); });
  await page.waitForFunction(() => document.body.classList.contains('tc-ri-on'), null, { timeout: 15000 }).catch(()=>{});
  await page.waitForTimeout(600);

  const findInput = async (re) => page.evaluateHandle((reSrc) => {
    const info = document.getElementById('information'); const r = new RegExp(reSrc, 'i');
    for (const l of info.querySelectorAll('label')) { if (r.test(l.textContent||'')) { const f = l.htmlFor && document.getElementById(l.htmlFor); if (f) return f; const inp = l.parentElement?.querySelector('input,select'); if (inp) return inp; } }
    return null;
  }, re.source);

  const probeField = async (label, re, shot) => {
    const h = await findInput(re);
    const el = h.asElement(); if (!el) { console.log(label, 'NO FIELD'); return; }
    await el.focus();
    await page.waitForTimeout(250);
    const state = await page.evaluate(() => { const p = document.getElementById('tc-ri-help'); return { on: !!(p && p.classList.contains('on')), text: p ? (p.textContent||'').trim().slice(0,140) : null, links: p ? [...p.querySelectorAll('a')].map(a=>({t:a.textContent.trim().slice(0,32),href:a.getAttribute('href'),tgt:a.target})) : [] }; });
    console.log(label, JSON.stringify(state));
    if (shot) await page.screenshot({ path: resolve(LOG, shot), clip: await clipAround(el) });
  };
  const clipAround = async (el) => { const b = await el.boundingBox(); return { x: Math.max(0, b.x-30), y: Math.max(0, b.y-20), width: Math.min(760, 1500-Math.max(0,b.x-30)), height: 360 }; };

  await probeField('release-group', /release group/i, 'help-rg.png');
  await probeField('label', /label/i, 'help-label.png');
  await probeField('barcode', /barcode/i, null);   // no entity → no popover

  console.log('--- console tail ---'); cons.slice(-12).forEach(l => console.log(l));
  if (!HEADED) await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
