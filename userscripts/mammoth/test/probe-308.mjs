// #308 — the baby pins / badge / settings header must use the vector mammoth
// (no 🦣 emoji that tofus in Chrome). Verify pins render an <svg>, not text.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'mammoth.user.js');
const ORIGIN = 'https://musicbrainz.org';
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || 'aa6c4473-3528-41c2-b55b-d9e18bdba4ff';
const shim = `(() => { const s = new Map(); window.GM_getValue=(k,d)=>s.has(k)?s.get(k):d; window.GM_setValue=(k,v)=>{s.set(k,v);}; window.unsafeWindow=window; })();`;

const main = async () => {
  const userJs = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1500, height: 1100 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForSelector('input[id^="label-"]', { timeout: 60000 });
  await page.evaluate(shim);
  await page.addScriptTag({ content: userJs });
  await page.waitForTimeout(1800);

  const info = await page.evaluate(() => {
    const pins = [...document.querySelectorAll('.mmthf-pin')];
    return {
      pinCount: pins.length,
      pinsWithSvg: pins.filter(p => p.querySelector('svg')).length,
      pinHasEmoji: pins.some(p => /🦣/.test(p.textContent || '')),
    };
  });
  console.log('[308] baby pins:', info.pinCount, '| with <svg>:', info.pinsWithSvg, '| any still using emoji text:', info.pinHasEmoji);
  console.log('[308] EXPECT: pinsWithSvg === pinCount > 0, pinHasEmoji=false');
  console.log('[308] console errors:', errs.length ? JSON.stringify(errs.slice(0, 5)) : 'none');
  await ctx.close();
};
main().catch(e => { console.error(e); process.exit(2); });
