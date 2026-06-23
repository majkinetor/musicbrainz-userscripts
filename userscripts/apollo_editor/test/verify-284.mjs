// Verifies #284 hover-highlight, now an opt-in Appearance setting (off by default):
//   - with DEFAULT settings, hovering an artist does NOTHING (feature off);
//   - with the setting ON: hovering a multi-instance artist lights all its
//     instances; a one-off clears the previous highlight; re-hover re-lights;
//     an empty slot keeps the current highlight (sticky).
//
// Release: The Journey Aflame (Akua Naru) — main artist repeats across tracks,
// other guests appear once.
//
//   node test/verify-284.mjs [--headed] [MBID]
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const ORIGIN = 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '89efad71-65d2-4f96-bc55-d69ad147bae2';
const SKEY = 'apolloEditor.settings.v1';

const main = async () => {
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1000 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

  // `setting`: 'default' clears the key (→ default off); 'on' enables hoverHighlight.
  async function load(setting) {
    await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
    await page.evaluate(([k, s]) => { if (s === 'on') localStorage.setItem(k, JSON.stringify({ hoverHighlight: true })); else localStorage.removeItem(k); }, [SKEY, setting]);
    await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
    await page.addScriptTag({ content: scriptCode });
    await page.waitForTimeout(1000);
    await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#tracklist"]'); if (a) a.click(); });
    await page.waitForSelector('.tc-aslot', { timeout: 30000 });
    await page.waitForTimeout(500);
  }

  // 1) DEFAULT settings → hovering a multi-instance artist does nothing (off)
  await load('default');
  const off = await page.evaluate(async () => {
    const slots = [...document.querySelectorAll('.tc-aslot')];
    const counts = new Map();
    for (const s of slots) { const id = s.dataset.art; if (id && id !== 'n:' && id !== 'g:') counts.set(id, (counts.get(id) || 0) + 1); }
    const multiId = [...counts].find(([, n]) => n >= 2)?.[0];
    if (!multiId) return { err: 'no multi-instance artist' };
    slots.find(s => s.dataset.art === multiId).dispatchEvent(new MouseEvent('mouseenter'));
    await new Promise(r => setTimeout(r, 30));
    return { lit: document.querySelectorAll('.tc-aslot.tc-arthl').length, multiCount: counts.get(multiId) };
  });
  check(!off.err, off.err || 'multi-instance artist present');
  check(off.lit === 0, `default: hover does NOT highlight (lit=${off.lit}, off by default)`);

  // 2) setting ON → the highlight behaviours work
  await load('on');
  const on = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const out = { steps: [], ok: true };
    const fail = m => { out.ok = false; out.steps.push('FAIL: ' + m); };
    const slots = [...document.querySelectorAll('.tc-aslot')];
    const counts = new Map();
    for (const s of slots) { const id = s.dataset.art; if (id && id !== 'n:' && id !== 'g:') counts.set(id, (counts.get(id) || 0) + 1); }
    const multiId = [...counts].find(([, n]) => n >= 2)?.[0];
    const singleId = [...counts].find(([, n]) => n === 1)?.[0];
    if (!multiId || !singleId) { fail('need a multi- and a single-instance artist'); return out; }
    const lit = () => document.querySelectorAll('.tc-aslot.tc-arthl').length;
    const hover = id => slots.find(s => s.dataset.art === id).dispatchEvent(new MouseEvent('mouseenter'));
    hover(multiId); await sleep(20);
    out.steps.push(`multi hover → ${lit()} lit (expected ${counts.get(multiId)})`); if (lit() !== counts.get(multiId)) fail('multi hover wrong');
    hover(singleId); await sleep(20);
    if (lit() !== 0) fail(`single hover left ${lit()} lit`); else out.steps.push('single hover → cleared ✓');
    hover(multiId); await sleep(20);
    if (lit() !== counts.get(multiId)) fail('re-hover multi not re-lit'); else out.steps.push('re-hover multi → re-lit ✓');
    return out;
  });
  on.steps.forEach(s => console.log('     ' + s));
  check(on.ok, 'setting ON: hover-highlight behaviours work');

  console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
  await ctx.close();
  process.exit(fail ? 0 + (fail ? 1 : 0) : 0);
};
main().catch(e => { console.error(e); process.exit(2); });
