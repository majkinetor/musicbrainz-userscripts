// Probe #555 — "Inconsistent recording search results".
//
// Root cause: MB answers a throttled /ws/2 request with HTTP 503 and a body of
// {"error":"…"} (no `recordings` key). searchRecordings did
// `fetch(url).then(r => r.json())` and read `j.recordings` → undefined → [] →
// the picker painted "no matches", with nothing at all in the Activity log.
//
// This probe forces that condition: the first N /ws/2/recording?query= calls are
// answered with a real 503 throttle envelope, the rest pass through. Before the
// fix the picker shows "no matches" and logs nothing; after it, the request is
// retried with backoff, results appear, and the log names the throttle.
//
// Read-only: the release edit page is never submitted, and only GET /ws/2 search
// URLs are routed (never an edit endpoint).
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || 'f9df1b8e-5228-4096-bafa-d4d89ff1e668';
const HEADED = process.argv.includes('--headed');
const THROTTLE_FIRST = 2;   // how many search calls to answer with a 503
const OUT = resolve(HERE, 'logs', 'shots'); await mkdir(OUT, { recursive: true });
const log = (...a) => console.log('[probe-555]', ...a);

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: !HEADED, viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));

// Only the recording SEARCH endpoint, and only GETs. Everything else untouched.
let throttled = 0, passed = 0, arming = false;   // armed only once the picker under test is open
await page.route(url => {
  const s = url.toString();
  return s.includes('/ws/2/recording') && s.includes('query=');
}, async route => {
  if (route.request().method() !== 'GET') return route.continue();
  if (arming && throttled < THROTTLE_FIRST) {
    throttled++;
    return route.fulfill({
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': '0' },
      body: JSON.stringify({ error: 'The MusicBrainz web server is currently busy. Please try again later.' }),
    });
  }
  passed++;
  return route.continue();
});

await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
await page.addScriptTag({ content: await readFile(SCRIPT, 'utf8') });
await page.waitForTimeout(1200);
await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#recordings"]'); if (a) a.click(); });
await page.waitForTimeout(600);
await page.evaluate(() => window.__apolloEditor.showRecMirror());
await page.waitForSelector('.tc-rectbl tbody tr.tc-recrow td.tc-recname', { timeout: 30000 });

// Open a picker on the first track that actually produces suggestions, so the
// count assertions aren't vacuous; fall back to track 1 if none of them do.
const nRows = await page.evaluate(() => document.querySelectorAll('.tc-rectbl tbody tr.tc-recrow td.tc-recname').length);
let pickedRow = 0;
for (let i = 0; i < Math.min(nRows, 8); i++) {
  await page.evaluate(() => { const p = document.querySelector('.tc-recpop'); if (p) p.remove(); });
  await page.evaluate(i => document.querySelectorAll('.tc-rectbl tbody tr.tc-recrow td.tc-recname')[i].click(), i);
  await page.waitForSelector('.tc-recpop .tc-rpk-q', { timeout: 10000 });
  const got = await page.waitForFunction(() => {
    const b = document.querySelector('.tc-recpop .tc-rpk-sugg');
    return !!(b && b.querySelectorAll('.tc-rpk-row').length);
  }, null, { timeout: 8000 }).then(() => true).catch(() => false);
  if (got) { pickedRow = i; log('track row', i + 1, 'has suggestions — using it'); break; }
}
if (!await page.$('.tc-recpop .tc-rpk-q')) {
  await page.evaluate(() => document.querySelector('.tc-rectbl tbody tr.tc-recrow td.tc-recname').click());
  await page.waitForSelector('.tc-recpop .tc-rpk-q', { timeout: 10000 });
}
await page.waitForTimeout(300);
arming = true;   // from here on, the next 2 searches get a 503
await page.fill('.tc-recpop .tc-rpk-q', '');
await page.type('.tc-recpop .tc-rpk-q', 'doh', { delay: 60 });

// snapshot the interim state (should say "throttling … retrying", never "no matches")
await page.waitForTimeout(900);
const interim = await page.evaluate(() => (document.querySelector('.tc-recpop .tc-rpk-res') || {}).textContent || '');

// then let the retry land
await page.waitForFunction(() => {
  const b = document.querySelector('.tc-recpop .tc-rpk-res');
  return b && b.querySelectorAll('.tc-rpk-row').length > 0;
}, null, { timeout: 30000 }).catch(() => {});

const out = await page.evaluate(() => {
  const res = document.querySelector('.tc-recpop .tc-rpk-res');
  const sec = document.querySelector('.tc-recpop .tc-rpk-suggsec');
  const n = document.querySelector('.tc-recpop .tc-rpk-suggn');
  const sugg = document.querySelector('.tc-recpop .tc-rpk-sugg');
  return {
    rows: res ? res.querySelectorAll('.tc-rpk-row').length : -1,
    resText: res ? res.textContent.slice(0, 120) : '',
    suggLabel: sec ? sec.textContent.replace(/\s+/g, ' ').trim() : '',
    suggCountSpan: n ? n.textContent : '(missing)',
    suggRows: sugg ? sugg.querySelectorAll('.tc-rpk-row').length : -1,
    log: window.__apolloEditor.logMarkdown(),
  };
});

const logText = out.log || '';
await page.locator('.tc-recpop').screenshot({ path: resolve(OUT, 'i555-picker.png') }).catch(() => {});

// also exercise the collapsed label — the count is the point of the second ask
await page.evaluate(() => { const s = document.querySelector('.tc-recpop .tc-rpk-suggsec'); if (s) s.click(); });
await page.waitForTimeout(200);
const collapsed = await page.evaluate(() => {
  const pop = document.querySelector('.tc-recpop'), sec = pop.querySelector('.tc-rpk-suggsec');
  return { isCollapsed: pop.classList.contains('tc-sugg-collapsed'), label: sec.textContent.replace(/\s+/g, ' ').trim() };
});
await page.locator('.tc-recpop').screenshot({ path: resolve(OUT, 'i555-collapsed.png') }).catch(() => {});

log('503s injected:', throttled, '| passed through:', passed);
log('interim result box:', JSON.stringify(interim));
log(JSON.stringify({ rows: out.rows, resText: out.resText, suggLabel: out.suggLabel, suggCountSpan: out.suggCountSpan, suggRows: out.suggRows, collapsed }, null, 2));
log('--- log lines mentioning search / throttle ---');
console.log(logText.split('\n').filter(l => /throttl|recording search|superseded/i.test(l)).join('\n'));

const checks = {
  'injected the throttle':        throttled === THROTTLE_FIRST,
  'retried past it (rows shown)': out.rows > 0,
  'no silent "no matches"':       !/no matches/.test(out.resText),
  'throttle is in the log':       /throttled by MusicBrainz/.test(logText),
  'search is logged at all':      /recording search/.test(logText),
  'suggestion count rendered':    out.suggRows <= 0 || /\(\s*\d+\s*\)/.test(out.suggCountSpan),
  'count survives collapse':      out.suggRows <= 0 || (collapsed.isCollapsed && /\(\d+\)/.test(collapsed.label)),
};
Object.entries(checks).forEach(([k, v]) => log(v ? 'PASS' : 'FAIL', '-', k));
const pass = Object.values(checks).every(Boolean);
log(pass ? 'PASS' : 'FAIL');
if (!HEADED) await ctx.close();
process.exit(pass ? 0 : 1);
