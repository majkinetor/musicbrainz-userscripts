// Verifies #281 (round 2): a model REBUILD mid-check (MB lazy-loads the rest of
// the tracks after we start) no longer leaves the Discogs badge blank. The
// rebuilt model is re-checked and the badge settles to links / "all OK" — WITHOUT
// a reload. (Old bug: the second tagDiscogsForAll was dropped by the running
// guard, so the rebuilt model was never checked → blank until reload.)
//
// The default release lazy-loads 9 → 18 tracks, which is exactly the race.
//
//   node test/verify-281b.mjs [--headed] [MBID]
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const ORIGIN = 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '06278b3f-1b45-4355-9b1e-368c5016b831';
const LOG_DIR = resolve(HERE, 'logs', 'verify-281b');

const out = [];
const say = (...a) => { const s = a.join(' '); out.push(s); console.log('[281b]', s); };

const main = async () => {
  await mkdir(LOG_DIR, { recursive: true });
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1000 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  let grew = false;
  page.on('console', m => { if (/snapshot \+ \d+ newly loaded/.test(m.text())) { grew = true; say('observed lazy-load rebuild:', m.text().replace(/^\S+ /, '')); } });

  await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#tracklist"]'); if (a) a.click(); });
  await page.waitForSelector('.tc-discstat', { timeout: 30000 }).catch(() => {});

  // Wait for the badge to SETTLE (no "checking…", and the same value twice in a row),
  // WITHOUT reloading. Then assert it is a real result, not blank.
  let settled = null, prevTxt = null, stableFor = 0;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(700);
    const b = await page.$$eval('.tc-discstat', els => els.map(e => ({ t: e.textContent, cls: e.className }))).catch(() => []);
    const txt = (b[0] && b[0].t) || '', cls = (b[0] && b[0].cls) || '';
    const checking = /checking|re-checking/.test(txt);
    if (!checking && txt === prevTxt) { stableFor++; } else { stableFor = 0; }
    prevTxt = txt;
    if (!checking && stableFor >= 2) { settled = { txt, cls }; break; }   // ~2.1s stable
  }
  say('lazy-load rebuild seen:', grew);
  say('settled badge:', JSON.stringify(settled));

  const cls = (settled && settled.cls) || '';
  const nonBlank = /tc-disc-badge|tc-disc-ok|tc-disc-pend/.test(cls);   // links / all-OK / retry — anything but blank
  const links = /tc-disc-badge/.test(cls);
  // The bug is the BLANK end-state; pass requires a real settled result (ideally links).
  const pass = !!settled && nonBlank;
  say(pass ? `PASS — badge settled to a real result without reload (${links ? 'links' : 'non-blank'})`
           : 'FAIL — badge settled BLANK (the rebuilt model was not re-checked)');
  await page.screenshot({ path: resolve(LOG_DIR, 'settled.png') }).catch(() => {});
  await writeFile(resolve(LOG_DIR, 'result.txt'), out.join('\n'));
  await ctx.close();
  process.exit(pass ? 0 : 1);
};
main().catch(e => { console.error(e); process.exit(2); });
