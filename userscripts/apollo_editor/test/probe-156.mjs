// #156 — investigate why toggling the proxied "Keep uppercased" checkbox is non-functional.
// Determine: how MB stores guess-case options (cookie + gc.CFG), and whether a synthetic
// `change` event vs a real `.click()` updates React state / cookie / the guess result.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SEED_PATH = resolve(HERE, 'seed-saigon.local.json');
const ORIGIN = 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');
const LOG_DIR = resolve(HERE, 'logs', '156-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));

async function main() {
  if (!existsSync(SEED_PATH)) { console.error('missing seed'); process.exit(2); }
  await mkdir(LOG_DIR, { recursive: true });
  const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1400, height: 900 } });
  ctx.on('page', async p => { try { const u = p.url(); if (u && u !== 'about:blank' && /\/(artist|label)\/(add|create)/.test(u)) await p.close(); } catch {} });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('not logged in'); await ctx.close(); process.exit(3); }
  await page.evaluate(({ origin, params }) => {
    const f = document.createElement('form'); f.method = 'POST'; f.action = origin + '/release/add'; f.style.display = 'none';
    const add = (n, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = n; i.value = v; f.appendChild(i); };
    for (const [k, v] of Object.entries(params)) Array.isArray(v) ? v.forEach(x => add(k, x)) : add(k, v);
    document.body.appendChild(f); f.submit();
  }, { origin: ORIGIN, params: seed });
  await page.waitForLoadState('domcontentloaded');
  if (await page.locator('h1', { hasText: /Confirm form submission/i }).count().catch(() => 0)) {
    await page.locator('button[type=submit]', { hasText: /Continue/i }).first().click();
    await page.waitForLoadState('domcontentloaded');
  }
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length; } catch { return false; } }, null, { timeout: 120000 });

  const out = await page.evaluate(() => {
    const R = {}, MB = window.MB, ed = MB.releaseEditor;
    const cookie = name => { const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : null; };

    // real guess of medium-1 track-1's name via the same path apollo uses (loads MB.GuessCase lazily)
    const t0 = ed.rootField.release().mediums()[0].tracks()[0];
    const origName = t0.name();
    const realGuess = probe => {
      t0.name(probe);
      try { ed.guessCaseTrackName(t0, { type: 'mouseenter', buttons: 0 }); const g = t0.previewName ? t0.previewName() : null; ed.guessCaseTrackName(t0, { type: 'mouseleave' }); return g == null ? t0.name() : g; }
      catch (e) { return 'ERR ' + e.message; }
      finally { t0.name(origName); }
    };
    const PROBE = 'the QUICK BROWN fox ABC';

    // locate the native fieldset + the keep-uppercased checkbox the script proxies
    const fs = document.querySelector('fieldset.guesscase, .guesscase');
    R.hasFieldset = !!fs;
    if (!fs) return R;
    const checks = [...fs.querySelectorAll('input[type=checkbox]')];
    const txt = c => ((c.closest('label') || {}).textContent || '').toLowerCase();
    R.checkboxes = checks.map(c => ({ label: (c.closest('label') || {}).textContent, checked: c.checked }));
    const keepUC = checks.find(c => txt(c).includes('keep') && txt(c).includes('uppercas')) || checks[0];

    R.before = { checked: keepUC.checked, cookie: cookie('guesscase_keepuppercase'), guess: realGuess(PROBE) };

    // approach A: synthetic — set .checked then dispatch change (what the script does today)
    const target = !keepUC.checked;
    keepUC.checked = target;
    keepUC.dispatchEvent(new Event('change', { bubbles: true }));
    R.afterSyntheticChange = { wanted: target, checked: keepUC.checked, cookie: cookie('guesscase_keepuppercase'), guess: realGuess(PROBE) };

    // reset DOM back, then approach B: real .click()
    keepUC.checked = !target;
    keepUC.dispatchEvent(new Event('change', { bubbles: true }));
    keepUC.click();
    R.afterClick = { checked: keepUC.checked, cookie: cookie('guesscase_keepuppercase'), guess: realGuess(PROBE) };
    keepUC.click();
    R.afterClickBack = { checked: keepUC.checked, cookie: cookie('guesscase_keepuppercase'), guess: realGuess(PROBE) };

    // ── language/mode select: does changing it actually affect the guess? ──
    const lang = fs.querySelector('select');
    R.allCookies = document.cookie.split('; ').filter(c => /guess/i.test(c));
    if (lang) {
      R.langOptions = [...lang.options].map(o => o.value);
      const cur = lang.value;                       // expect "English"
      const sentence = [...lang.options].find(o => /sentence/i.test(o.value));
      if (sentence && sentence.value !== cur) {
        // synthetic value + change (current setNative path)
        lang.value = sentence.value; lang.dispatchEvent(new Event('change', { bubbles: true }));
        R.langSynthetic = { value: lang.value, guess: realGuess(PROBE) };
        // restore + native-setter path
        lang.value = cur; lang.dispatchEvent(new Event('change', { bubbles: true }));
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
        setter.call(lang, sentence.value);
        lang.dispatchEvent(new Event('input', { bubbles: true }));
        lang.dispatchEvent(new Event('change', { bubbles: true }));
        R.langNativeSetter = { value: lang.value, guess: realGuess(PROBE) };
        setter.call(lang, cur); lang.dispatchEvent(new Event('input', { bubbles: true })); lang.dispatchEvent(new Event('change', { bubbles: true }));
        R.langRestored = { value: lang.value, guess: realGuess(PROBE) };
      }
    }
    return R;
  });

  await writeFile(resolve(LOG_DIR, '156.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log('[probe-156] artifacts in', LOG_DIR);
  if (!HEADED) await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
