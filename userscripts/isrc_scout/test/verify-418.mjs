// Verify #418 — Qobuz ISRC import must work WITHOUT a Platform Check login:
// album/get is geo-gated, not session-gated, so ISRC Scout now tries the
// anonymous call first and only falls back to the shared session token.
//
// Scenario A (anonymous works, chaban's case): no token, album/get answers 200
// (the real response body from the #418 HAR) → the 13 ISRCs must import, the
// request must carry NO X-User-Auth-Token, and no login error may appear.
// Scenario B (geo-blocked + no token, the old #353 case): album/get answers 404
// → the error must explain the geo dimension and point at the PC login.
// Scenario C (logged in): the session token is PREFERRED — one token'd call, no
// anonymous probe first (chaban's review suggestion).
// Scenario D (stale session in a served country): token'd call 401s → falls
// back to anonymous and still delivers.
//
//   node test/verify-418.mjs
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');
const fixture = await readFile(resolve(HERE, 'fixture-418-albumget.json'), 'utf8');
const MBID = 'bb10044f-d50e-4d76-b3cc-ec7edd1a9704';   // Move Positive — has a Qobuz URL rel

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1000 }, bypassCSP: true });
await ctx.exposeBinding('__gmFetch', async (_s, opts) => {
  try {
    const resp = await ctx.request.fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, maxRedirects: 20 });
    return { status: resp.status(), responseText: await resp.text(), finalUrl: resp.url() };
  } catch (e) { return { status: 0, responseText: '', finalUrl: opts.url }; }
});

async function run({ anonStatus, tokenStatus = 200, withToken = false }) {
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(({ fixture, anonStatus, tokenStatus, withToken }) => {
    window.__qbRequests = [];
    window.GM_getValue = (k, d) => d; window.GM_setValue = () => {};
    window.GM_info = { script: { name: 'ISRC Scout', version: 't', homepageURL: 'x' } };
    window.unsafeWindow = window;
    window.GM_xmlhttpRequest = (o) => {
      const done = (status, text) => setTimeout(() => o.onload && o.onload({ status, responseText: text, finalUrl: o.url }), 20);
      if (/qobuz\.com\/api\.json/.test(o.url)) {
        window.__qbRequests.push({ url: o.url, headers: o.headers || {} });
        const status = (o.headers && o.headers['X-User-Auth-Token']) ? tokenStatus : anonStatus;
        return done(status, status === 200 ? fixture : '{"status":"error","code":' + status + ',"message":"stub"}');
      }
      // everything else goes out for real via the binding
      window.__gmFetch({ method: o.method || 'GET', url: o.url, headers: o.headers || {} }).then(r => o.onload && o.onload(r)).catch(() => o.onerror && o.onerror({ status: 0 }));
    };
    if (withToken) window.localStorage.setItem('mbtools:qobuz', JSON.stringify({ token: 'fake-session-token' }));
    else window.localStorage.removeItem('mbtools:qobuz');
  }, { fixture, anonStatus, tokenStatus, withToken });
  await page.goto(`https://musicbrainz.org/release/${MBID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.addScriptTag({ content: code });
  await page.waitForSelector('#ii-btn', { timeout: 20000 });
  await page.click('#ii-btn');
  await page.waitForSelector('#ii-qz-all', { timeout: 20000 });
  // wait until the release fetch populated the provider ids (otherwise the click derefs null)
  await page.waitForFunction(() => /Release "/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.click('#ii-qz-all');
  await page.waitForFunction(() => /Qobuz album|Qobuz failed|Qobuz \d+/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  const out = await page.evaluate(() => ({
    log: document.getElementById('ii-log-out')?.textContent || '',
    reqs: window.__qbRequests,
    pendingIsrcs: [...document.querySelectorAll('input[id^="in-"]')].map(i => i.value).filter(Boolean).length,
  }));
  await page.close();
  return { out, errs };
}

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

console.log('── Scenario A: anonymous album/get answers 200 (no login anywhere) ──');
const A = await run({ anonStatus: 200 });
const aq = A.out.reqs.filter(r => /album\/get/.test(r.url));
console.log('   qobuz requests:', A.out.reqs.map(r => r.url.replace(/^.*api\.json/, '…')).join(' | '));
console.log('   log tail:', A.out.log.split('\n').filter(l => /Qobuz/i.test(l)).join(' ⏎ '));
ck(aq.length === 1, 'exactly one album/get call');
ck(aq.every(r => !('X-User-Auth-Token' in r.headers)), 'anonymous — no X-User-Auth-Token header sent');
ck(/Qobuz album "Move Positive": 13 track/i.test(A.out.log), '13 tracks parsed from the anonymous response');
ck(!/not logged in|sign in to Qobuz/i.test(A.out.log), 'no login demand anywhere');
// this release already carries all 13 ISRCs in MB, so they count as "already present"
const doneM = A.out.log.match(/Qobuz done — (\d+) filled, (\d+) already present/);
ck(doneM && (+doneM[1] + +doneM[2]) === 13, `all 13 ISRCs accounted for (${doneM && doneM[0]})`);
ck(A.errs.length === 0, 'no page errors: ' + JSON.stringify(A.errs.slice(0, 2)));

console.log('── Scenario B: geo-blocked 404 + no token ──');
const B = await run({ anonStatus: 404 });
console.log('   log tail:', B.out.log.split('\n').filter(l => /Qobuz/i.test(l)).join(' ⏎ '));
ck(/countries Qobuz serves/i.test(B.out.log), 'error explains the geo dimension');
ck(/sign in to Qobuz in Platform Check/i.test(B.out.log), 'error still points at the PC login');
ck(B.errs.length === 0, 'no page errors: ' + JSON.stringify(B.errs.slice(0, 2)));

console.log('── Scenario C: logged in (geo-blocked or not) — session token PREFERRED ──');
const C = await run({ anonStatus: 404, tokenStatus: 200, withToken: true });
const cq = C.out.reqs.filter(r => /album\/get/.test(r.url));
console.log('   log tail:', C.out.log.split('\n').filter(l => /Qobuz/i.test(l) && !/NET/.test(l)).join(' ⏎ '));
ck(cq.length === 1, 'exactly ONE album/get call — no anonymous probe when logged in');
ck(cq[0] && cq[0].headers['X-User-Auth-Token'] === 'fake-session-token', 'the single call carries the session token');
ck(/Qobuz album "Move Positive": 13 track/i.test(C.out.log), 'session call delivered the 13 tracks');
ck(C.errs.length === 0, 'no page errors: ' + JSON.stringify(C.errs.slice(0, 2)));

console.log('── Scenario D: stale session (401) in a served country — anonymous fallback ──');
const D = await run({ anonStatus: 200, tokenStatus: 401, withToken: true });
const dq = D.out.reqs.filter(r => /album\/get/.test(r.url));
console.log('   log tail:', D.out.log.split('\n').filter(l => /Qobuz/i.test(l) && !/NET/.test(l)).join(' ⏎ '));
ck(dq.length === 2, 'session try then anonymous fallback (2 album/get calls)');
ck(dq[0] && dq[0].headers['X-User-Auth-Token'] === 'fake-session-token' && dq[1] && !('X-User-Auth-Token' in dq[1].headers), 'first call token, fallback anonymous');
ck(/Qobuz album "Move Positive": 13 track/i.test(D.out.log), 'anonymous fallback delivered the 13 tracks');
ck(/re-login in Platform Check/i.test(D.out.log), 'stale session surfaced as a warning');
ck(D.errs.length === 0, 'no page errors: ' + JSON.stringify(D.errs.slice(0, 2)));

await ctx.close();
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
