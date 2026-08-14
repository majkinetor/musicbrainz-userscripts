// Verify #423 — injecting a Bandcamp URL whose scanned format includes DIGITAL seeds
// TWO relationships on the same URL (85 'stream for free' + 74 'purchase for download');
// a physical-only Bandcamp format seeds only 85. Read-only (never submits).
//
//   node test/verify-423.mjs [--headed]
import { chromium }      from 'playwright';
import { readFile }      from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE        = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(HERE, '..', 'platform_check.user.js');
const headed      = process.argv.includes('--headed');
const MBID = 'ec116461-5b0d-4c98-bb44-a4de5de63076';
const BC_URL = 'https://remycaset.bandcamp.com/album/la-minerve';

const context = await chromium.launchPersistentContext(resolve(HERE, '..', '..', '..', '.pw-profile'), { headless: !headed, viewport: { width: 1600, height: 1100 } });
const userJs = await readFile(SCRIPT_PATH, 'utf8');

async function run(format) {
  const page = await context.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(({ MBID, BC_URL, format }) => {
    // #501 follow-up: pc:pending:*/pc:cache:v2:* now live in real localStorage,
    // not GM storage — seed there instead of the (still-real, for genuine
    // settings) GM mock below.
    localStorage.setItem(`pc:pending:${MBID}`, JSON.stringify({ bandcamp: BC_URL }));
    localStorage.setItem(`pc:cache:v2:bandcamp:${MBID}`, JSON.stringify({ url: BC_URL, tracks: 8, format, source: 'test' }));
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => { store.set(k, v); };
    window.GM_xmlhttpRequest = () => {};
    window.GM_info = { script: { name: 'platform_check (test)', version: 'test' } };
    window.unsafeWindow = window;
  }, { MBID, BC_URL, format });
  await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#release-editor', { timeout: 40000 });
  await page.waitForTimeout(2500);
  await page.addScriptTag({ content: userJs });
  // wait for the inject to settle (URL row + typed rel)
  await page.waitForFunction(BC_URL => [...document.querySelectorAll('tr.external-link-item a[href]')].some(a => a.href.includes('remycaset')), BC_URL, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const urlRow = [...document.querySelectorAll('tr.external-link-item')].find(tr => tr.querySelector('a[href*="remycaset"]'));
    const types = [];
    let n = urlRow?.nextElementSibling;
    while (n && n.classList.contains('relationship-item')) {
      const sel = n.querySelector('select.link-type');
      types.push(sel ? sel.value : (n.textContent.match(/stream for free|purchase for download|download for free/) || ['fixed'])[0]);
      n = n.nextElementSibling;
    }
    return { types, summary: document.querySelector('.pc-inline-summary, .pc-inject-summary')?.textContent?.slice(0, 200) || '' };
  });
  await page.close();
  return { r, errs };
}

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

console.log('── digital included ("Digital, CD") ──');
const A = await run('Digital, CD');
console.log('   rel types:', JSON.stringify(A.r.types));
ck(A.r.types[0] === '85', 'first rel typed 85 (stream for free)');
ck(A.r.types[1] === '74', 'second rel added and typed 74 (purchase for download)');
ck(A.errs.length === 0, 'no page errors: ' + JSON.stringify(A.errs.slice(0, 2)));

console.log('── physical-only ("Vinyl") ──');
const B = await run('Vinyl');
console.log('   rel types:', JSON.stringify(B.r.types));
ck(B.r.types[0] === '85', 'first rel typed 85');
ck(B.r.types.length === 1, 'no second rel for a physical-only Bandcamp page');
ck(B.errs.length === 0, 'no page errors: ' + JSON.stringify(B.errs.slice(0, 2)));

await context.close();
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
