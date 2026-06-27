// #303 visual: Recordings tab should show a video marker on video recordings (tracks 2 & 3).
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const DEV = resolve(HERE, '..', '..', '..', 'dev');
const ORIGIN = 'https://musicbrainz.org';
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || 'e06f19f3-2299-44da-bf6d-714dde0b2211';

const main = async () => {
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 2.5 });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(800);
  // open the Recordings tab
  await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#recordings"]'); if (a) a.click(); });
  await page.waitForSelector('#tc-recwrap .tc-recrow', { timeout: 30000 });
  await page.waitForTimeout(1200);

  const info = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#tc-recwrap .tc-recrow')].map(tr => ({
      num: tr.querySelector('.c-n')?.textContent,
      rec: tr.querySelector('.tc-recname')?.textContent?.trim().slice(0, 40),
      video: !!tr.querySelector('.tc-recname .tc-rec-video'),
    }));
    return { rows, marks: rows.filter(r => r.video).map(r => r.num) };
  });
  console.log('[303] video markers on track #:', JSON.stringify(info.marks));
  console.log('[303] rows:', JSON.stringify(info.rows.slice(0, 6)));
  console.log('[303] console errors:', errs.length ? JSON.stringify(errs.slice(0, 5)) : 'none');

  const w = await page.$('#tc-recwrap');
  await w.screenshot({ path: resolve(DEV, '_i303_recordings.png') });
  await ctx.close();
};
main().catch(e => { console.error(e); process.exit(2); });
