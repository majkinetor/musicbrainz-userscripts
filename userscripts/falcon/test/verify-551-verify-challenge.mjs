// #551 (chaban-mb): "Sometimes MusicBrainz will present a small proof-of-work
// challenge instead of the requested page. If that happens the Falcon session
// from Harmoy is briefly run and after being served the requested page the
// session is 'lost', i.e. the dialog is not shown again."
//
// This reproduces the bug rather than testing around it: the FIRST load of the
// seeded URL is answered with MusicBrainz's real challenge HTML (taken verbatim
// from the issue), and the second load — the one the challenge's own POST leads
// to — gets the real page. Without the fix Falcon boots on the interstitial,
// consumes and deletes the pending token, and the real page then has nothing to
// show. With it, the interstitial is a no-op and the queue appears on the real
// page exactly as if no challenge had happened.
//
// Read-only: every POST is aborted and asserted at zero.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const REC = 'a5b3a1a0-0000-0000-0000-000000000001';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// verbatim from the issue, minus the auto-submitting script (Playwright drives
// the second navigation itself — running the real solver would just add a
// SHA-256 grind and a POST to a /__meb_verify that does not exist here).
const CHALLENGE_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Verifying your browser</title>
<style>body{display:flex;justify-content:center;align-items:center;min-height:80vh}</style>
</head><body><div class="box"><div class="spinner"></div>
<p>Verifying your browser, please wait…</p>
<noscript><p><b>JavaScript is required to access this page.</b></p></noscript>
</div><script>
(async()=>{const c="b95869824e0b42f53ed52ed0423acb9ffad38eabb059c5282c8ac36590b7c7ea",t="1787939449",d=5;
/* the real page builds a form posting to /__meb_verify here */
const F="/__meb_verify";})()
</script></body></html>`;

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  // A real GM store, shared across loads in this context — the whole bug is
  // about a value being deleted on one load and missing on the next, so an
  // in-memory-per-page mock would make it impossible to observe.
  window.GM_getValue = (k, d) => { const v = localStorage.getItem('gmtest:' + k); return v === null ? d : JSON.parse(v); };
  window.GM_setValue = (k, v) => localStorage.setItem('gmtest:' + k, JSON.stringify(v));
  window.GM_deleteValue = k => localStorage.removeItem('gmtest:' + k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const posted = [];

let serveChallenge = false;
await page.route(() => true, async route => {
  const r = route.request();
  if (r.method() === 'POST') { posted.push(r.url()); return route.abort(); }
  if (serveChallenge && r.isNavigationRequest() && /\/release\/[0-9a-f-]{36}\?falcon=/.test(r.url())) {
    serveChallenge = false;                    // exactly once, like the real thing
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: CHALLENGE_HTML });
  }
  return route.continue();
});

const goto = async (url) => {
  for (let a = 1; ; a++) {
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); return; }
    catch (e) { if (a >= 4) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
  }
};

// ── plant a pending token, the way the Harmony button does ──────────────────
await goto(`https://test.musicbrainz.org/release/${RELEASE}`);
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
const TOKEN = 'tok551test';
const PAYLOAD = JSON.stringify([{ entityType: 'recording', mbid: REC, url: 'https://example.com/x', name: 'Seeded row' }]);
await page.evaluate(({ t, p }) => window.GM_setValue('falcon:pending:' + t, p), { t: TOKEN, p: PAYLOAD });
const planted = await page.evaluate(t => window.GM_getValue('falcon:pending:' + t, null), TOKEN);
ck(planted === PAYLOAD, 'a pending Harmony token is really in GM storage before we start');

// ── load 1: MusicBrainz answers with the challenge instead of the page ──────
serveChallenge = true;
const seedUrl = `https://test.musicbrainz.org/release/${RELEASE}?falcon=${TOKEN}`;
await goto(seedUrl);
await page.addScriptTag({ content: code });
await page.waitForTimeout(1200);

const onChallenge = await page.evaluate(() => ({
  title: document.title,
  isChallenge: !!(window.__falconTest && window.__falconTest.isVerifyInterstitial()),
  launcher: !!document.getElementById('falcon-launcher'),
  panel: !!document.getElementById('falcon-panel'),
  queue: (window.__falconTest && window.__falconTest.getQueue().length) || 0,
}));
console.log('on the challenge page: ' + JSON.stringify(onChallenge));
ck(onChallenge.title === 'Verifying your browser', 'the challenge page really was served (otherwise nothing below is a test)');
ck(onChallenge.isChallenge, 'Falcon recognises it as the verification interstitial');
ck(!onChallenge.launcher && !onChallenge.panel, 'and mounts nothing on it — no launcher, no panel');
ck(onChallenge.queue === 0, 'and queues nothing');

const stillThere = await page.evaluate(t => window.GM_getValue('falcon:pending:' + t, null), TOKEN);
console.log('token after the challenge page: ' + (stillThere ? 'still there' : 'CONSUMED'));
ck(stillThere === PAYLOAD, 'THE BUG: the pending session survives the challenge instead of being eaten by it');

// ── load 2: the challenge clears and the real page is served ────────────────
await goto(seedUrl);
await page.addScriptTag({ content: code });
await page.waitForTimeout(1500);

const onReal = await page.evaluate(() => ({
  title: document.title.slice(0, 40),
  isChallenge: !!(window.__falconTest && window.__falconTest.isVerifyInterstitial()),
  launcher: !!document.getElementById('falcon-launcher'),
  panelShown: (() => { const p = document.getElementById('falcon-panel'); return !!p && getComputedStyle(p).display !== 'none'; })(),
  queue: (window.__falconTest && window.__falconTest.getQueue().map(i => i.name || i.mbid)) || [],
}));
console.log('on the real page: ' + JSON.stringify(onReal));
ck(!onReal.isChallenge, 'the real MusicBrainz page is not mistaken for the interstitial');
ck(onReal.launcher, 'Falcon mounts normally there');
ck(onReal.panelShown, 'and the panel is shown — the session is NOT lost');
ck(onReal.queue.length === 1 && /Seeded row/.test(onReal.queue[0]), 'with the seeded row in the queue — ' + JSON.stringify(onReal.queue));

const consumed = await page.evaluate(t => window.GM_getValue('falcon:pending:' + t, null), TOKEN);
ck(consumed === null || consumed === undefined, 'and the token is consumed exactly once, on the page that actually used it');

// ── the detector must not fire on ordinary MusicBrainz pages ────────────────
await page.evaluate(t => window.GM_deleteValue('falcon:pending:' + t), TOKEN);
const falsePositives = [];
for (const u of [`https://test.musicbrainz.org/release/${RELEASE}`, 'https://test.musicbrainz.org/', `https://test.musicbrainz.org/release/${RELEASE}/edit`]) {
  await goto(u);
  await page.addScriptTag({ content: code });
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => ({ t: document.title.slice(0, 30), c: window.__falconTest.isVerifyInterstitial() }));
  if (r.c) falsePositives.push(u + ' (' + r.t + ')');
}
console.log('false positives: ' + (falsePositives.length ? falsePositives.join(', ') : 'none'));
ck(falsePositives.length === 0, 'no ordinary MusicBrainz page is mistaken for the challenge');

console.log('POSTs: ' + JSON.stringify(posted.filter(u => /musicbrainz/.test(u))));
ck(posted.filter(u => /musicbrainz/.test(u)).length === 0, 'nothing was submitted');
ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
