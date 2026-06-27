// #305 — a Mammoth baby-pop dismiss (outside mousedown) must NOT let the
// completing click activate a link/button that was underneath the pop. Repro:
// open the label baby-pop, drop a target=_blank anchor in a spot that is outside
// the pop, then dispatch mousedown+click there. The dismiss must swallow the
// click (defaultPrevented), so the anchor never navigates.
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
  await page.addInitScript({ content: shim });   // (already navigated; also inject directly)
  await page.evaluate(shim);
  await page.addScriptTag({ content: userJs });
  await page.waitForTimeout(1500);

  const result = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const pin = document.querySelector('.mmthf-pin');
    if (!pin) return { error: 'no baby pin found' };
    pin.click();                       // open the label baby-pop
    await sleep(150);
    const pop = document.querySelector('.mmthf-pop');
    if (!pop) return { error: 'pop did not open' };
    const pr = pop.getBoundingClientRect();

    // place a target=_blank anchor in a spot OUTSIDE the pop (just to its right)
    const a = document.createElement('a');
    a.href = 'https://example.com/cover-art'; a.target = '_blank'; a.textContent = 'COVER';
    a.style.cssText = 'position:fixed;width:120px;height:60px;z-index:1;background:#eee;left:' + Math.min(window.innerWidth - 130, pr.right + 20) + 'px;top:' + (pr.top + 10) + 'px';
    document.body.appendChild(a);
    let navigated = false;
    a.addEventListener('click', e => { if (!e.defaultPrevented) navigated = true; });
    const ar = a.getBoundingClientRect();
    const x = Math.round(ar.left + ar.width / 2), y = Math.round(ar.top + ar.height / 2);
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window };
    // the real sequence: mousedown (dismisses pop) → mouseup → click (would navigate)
    a.dispatchEvent(new MouseEvent('mousedown', opts));
    a.dispatchEvent(new MouseEvent('mouseup', opts));
    a.dispatchEvent(new MouseEvent('click', opts));
    await sleep(50);
    return { popClosedAfter: !document.querySelector('.mmthf-pop'), navigated };
  });

  console.log('[305] repro result:', JSON.stringify(result));
  console.log('[305] EXPECT: popClosedAfter=true, navigated=false (click swallowed)');
  console.log('[305] console errors:', errs.length ? JSON.stringify(errs.slice(0, 5)) : 'none');
  await ctx.close();
};
main().catch(e => { console.error(e); process.exit(2); });
