// Probe #208 — join-phrase spacing visibility.
// Opens a multi-artist release, injects Apollo, and (a) confirms correct joins
// (" & ", " feat. ") get NO markers, (b) injects bad joins into the tracklist
// join inputs to confirm ␣ / ␣?␣ markers appear, (c) screenshots both the
// Tracklist and Recordings views. Needs the shared logged-in profile.
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE        = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const HEADED      = process.argv.includes('--headed');
const ORIGIN      = 'https://musicbrainz.org';
const RELEASE     = 'ec116461-5b0d-4c98-bb44-a4de5de63076';   // Daft Punk — RAM (feat. credits → multi-artist joins)
const LOG_DIR     = resolve(HERE, 'logs', '208');
const log = (...a) => console.log('[probe-208]', ...a);

async function main() {
  await mkdir(LOG_DIR, { recursive: true });
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !HEADED, viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 2,
  });
  ctx.on('page', async p => { try { const u = p.url(); if (/\/(artist|label)\/(add|create)/.test(u || '')) await p.close(); } catch {} });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.on('pageerror', e => log('[pageerror]', e.name, e.message));

  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('Not logged in in .pw-profile.'); await ctx.close(); process.exit(3); }
  await page.evaluate(() => {
    const KEY = 'apolloEditor.settings.v1';
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    s.apolloEnabled = true; s.replaceTracklist = true; s.replaceRecordings = true; s.recPunctSize = 3;
    localStorage.setItem(KEY, JSON.stringify(s));
  });
  log('opening release edit…');
  await page.goto(`${ORIGIN}/release/${RELEASE}/edit`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    try { const e = window.MB?.releaseEditor; return e && e.rootField && e.rootField.release && e.rootField.release(); } catch { return false; }
  }, null, { timeout: 120000 }).catch(() => log('editor not ready'));
  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(2500);

  // Switch to the Tracklist tab.
  await page.evaluate(() => {
    const a = [...document.querySelectorAll('a, button')].find(x => /^\s*Tracklist\s*$/i.test(x.textContent || ''));
    if (a) a.click();
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(LOG_DIR, '1-tracklist-baseline.png'), fullPage: true });
  const joinCount = await page.evaluate(() => document.querySelectorAll('.tc-join').length);
  log('tc-join inputs found:', joinCount);

  // Inject bad joins into the first few join inputs to trigger the markers.
  const injected = await page.evaluate(() => {
    const ins = [...document.querySelectorAll('.tc-join')];
    const bad = ['&', ' &', '& ', ''];
    const done = [];
    ins.slice(0, 4).forEach((inp, i) => {
      inp.value = bad[i % bad.length];
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      done.push({ val: JSON.stringify(bad[i % bad.length]), cls: inp.closest('.tc-joinwrap')?.className });
    });
    return done;
  });
  log('injected bad joins:', JSON.stringify(injected, null, 2));
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(LOG_DIR, '2-tracklist-badjoins.png'), fullPage: true });

  // Switch to Recordings view → acLinks join marking (baseline: real joins).
  await page.evaluate(() => {
    const a = [...document.querySelectorAll('a, button')].find(x => /^\s*Recordings\s*$/i.test(x.textContent || ''));
    if (a) a.click();
  });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: resolve(LOG_DIR, '3-recordings.png'), fullPage: true });
  const jpRec = await page.evaluate(() => document.querySelectorAll('.tc-jp').length);
  log('.tc-jp markers in Recordings view:', jpRec);

  log('artifacts in', LOG_DIR);
  await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
