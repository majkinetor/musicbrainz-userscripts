// Verifies #284 highlight behaviour after majkinetor's fix request:
//   - hovering a MULTI-instance artist lights all its instances;
//   - hovering a DIFFERENT artist that appears only ONCE clears the previous
//     highlight (the bug: it used to linger on the prior artist);
//   - hovering back onto the multi-instance artist re-lights it;
//   - hovering an EMPTY slot keeps the current highlight (sticky over gaps).
//
// Release: The Journey Aflame (Akua Naru) — main artist repeats across tracks,
// African Footprint / other guests appear once.
//
//   node test/verify-284.mjs [--headed] [MBID]
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const ORIGIN = 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '89efad71-65d2-4f96-bc55-d69ad147bae2';
const LOG_DIR = resolve(HERE, 'logs', 'verify-284');

const main = async () => {
  await mkdir(LOG_DIR, { recursive: true });
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1000 } });
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#tracklist"]'); if (a) a.click(); });
  await page.waitForSelector('.tc-aslot', { timeout: 30000 });
  await page.waitForTimeout(500);

  const result = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const out = { steps: [], ok: true };
    const fail = m => { out.ok = false; out.steps.push('FAIL: ' + m); };
    const note = m => out.steps.push(m);

    const slots = [...document.querySelectorAll('.tc-aslot')];
    const counts = new Map();
    for (const s of slots) { const id = s.dataset.art; if (!id) continue; counts.set(id, (counts.get(id) || 0) + 1); }
    const realId = id => id && id !== 'n:' && id !== 'g:';
    const multiId = [...counts].find(([id, n]) => realId(id) && n >= 2)?.[0];
    const singleId = [...counts].find(([id, n]) => realId(id) && n === 1)?.[0];
    note(`slots=${slots.length} distinctArtists=${counts.size} multi=${multiId ? counts.get(multiId) + '×' : 'none'} single=${singleId ? 'yes' : 'none'}`);
    if (!multiId || !singleId) { fail('need both a multi-instance and a single-instance artist on this release'); return out; }

    const lit = () => document.querySelectorAll('.tc-aslot.tc-arthl').length;
    const slotFor = id => slots.find(s => s.dataset.art === id);
    const hover = el => { el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false })); };

    // a. hover multi → all its instances lit
    hover(slotFor(multiId)); await sleep(20);
    if (lit() !== counts.get(multiId)) fail(`multi hover lit ${lit()} (expected ${counts.get(multiId)})`);
    else note(`multi hover → ${lit()} lit ✓`);

    // b. hover single → previous highlight CLEARED (single has nothing to show)
    hover(slotFor(singleId)); await sleep(20);
    if (lit() !== 0) fail(`single hover left ${lit()} lit (expected 0 — stale highlight not cleared)`);
    else note('single hover → previous highlight cleared ✓');

    // c. hover multi again → re-lit
    hover(slotFor(multiId)); await sleep(20);
    if (lit() !== counts.get(multiId)) fail(`re-hover multi lit ${lit()} (expected ${counts.get(multiId)})`);
    else note('re-hover multi → re-lit ✓');

    // d. sticky: hover an EMPTY slot keeps the current highlight
    const emptySlot = slots.find(s => s.dataset.art === 'n:' || s.dataset.art === 'g:');
    if (emptySlot) {
      hover(emptySlot); await sleep(20);
      if (lit() !== counts.get(multiId)) fail(`hovering empty slot changed highlight (${lit()} lit, expected ${counts.get(multiId)})`);
      else note('hover empty slot → highlight stays (sticky) ✓');
    } else { note('(no empty slot to test stickiness — skipped)'); }

    return out;
  }).catch(e => ({ ok: false, steps: ['evaluate threw: ' + e.message] }));

  console.log(JSON.stringify(result, null, 2));
  await page.screenshot({ path: resolve(LOG_DIR, 'final.png') }).catch(() => {});
  await writeFile(resolve(LOG_DIR, 'result.json'), JSON.stringify(result, null, 2));
  await ctx.close();
  process.exit(result.ok ? 0 : 1);
};
main().catch(e => { console.error(e); process.exit(2); });
