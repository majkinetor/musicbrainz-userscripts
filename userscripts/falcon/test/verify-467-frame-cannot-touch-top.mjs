// #467 — the structural guarantee that keeps majkinetor's tab alive.
//
// A seeded MusicBrainz edit page closes itself and returns to the invoking page
// after a successful commit (the behaviour he recognised from other scripts).
// Falcon loads those same pages in its worker frames, so that "close and go
// back" kept reaching out of the frame and taking the whole tab with it.
//
// Blocking window.close() covered only the close half. A top-level NAVIGATION is
// the same bug wearing a different hat, and his next log showed exactly that:
// the run completed cleanly, the summary was written, no BLOCKED line — and the
// tab still went away.
//
// So the fix stopped trying to guess the mechanism. The worker iframes carry a
// sandbox WITHOUT allow-top-navigation, which makes it impossible for the frame
// to navigate or close the top window at all — the browser refuses, whichever
// route MB takes. This test pins both the attribute and the behaviour, because
// the attribute alone is easy to weaken by accident later.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { firefox } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const ctx = await firefox.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile-ff', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(600);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 15000 });
await page.evaluate(() => document.getElementById('falcon-launcher').click());

// spin up a worker so a real worker iframe exists
await page.evaluate(() => {
  window.__falconTest.setQueue([{ id: 'sb', entityType: 'recording', mbid: 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7', urls: [{ url: 'https://music.apple.com/gb/song/999000111', linkTypeId: '254' }], name: null, urlResults: null, status: 'queued', error: '' }]);
  window.__falconTest.cfg.workers = 1;
  window.__falconTest.start();
});
await page.waitForFunction(() => !!document.querySelector('#falcon-workers iframe'), null, { timeout: 20000 });

const attr = await page.evaluate(() => {
  const f = document.querySelector('#falcon-workers iframe');
  return f ? f.getAttribute('sandbox') : null;
});
console.log('worker iframe sandbox:', JSON.stringify(attr));
ck(!!attr, 'worker iframes are sandboxed at all');
ck(!/allow-top-navigation/.test(attr || ''), 'and the sandbox does NOT grant allow-top-navigation — that is the whole point');
ck(!/allow-popups/.test(attr || ''), 'nor allow-popups');
// the capabilities Falcon genuinely needs must still be there, or nothing works
ck(/allow-same-origin/.test(attr || ''), 'it keeps allow-same-origin (reading and filling the form, staying logged in)');
ck(/allow-scripts/.test(attr || ''), 'it keeps allow-scripts (MB renders and validates the form itself)');
ck(/allow-forms/.test(attr || ''), 'it keeps allow-forms (the edit has to submit)');

// Behaviour, not just the attribute — and it has to be attempted from INSIDE the
// frame. Running `top.location = ...` in the parent's own context is just the
// parent navigating itself, which is always allowed and proves nothing; the
// sandbox only constrains code executing within the frame, which is where MB's
// "close and go back" actually runs.
const topUrlBefore = page.url();
// newIframeIn creates the element before assigning .src, so the frame sits on
// about:blank for a moment — wait for it to actually be on an MB page.
let workerFrame = null;
for (let i = 0; i < 40 && !workerFrame; i++) {
  workerFrame = page.frames().find(fr => fr !== page.mainFrame() && /musicbrainz\.org\/(recording|artist|label)\//.test(fr.url()));
  if (!workerFrame) await page.waitForTimeout(500);
}
console.log('frames present:', page.frames().map(fr => (fr === page.mainFrame() ? 'MAIN:' : 'sub:') + fr.url().slice(0, 70)));
ck(!!workerFrame, `the worker frame is reachable to run code in (${workerFrame ? workerFrame.url().slice(0, 60) : 'not found'})`);
const attempt = workerFrame ? await workerFrame.evaluate(() => {
  const out = { navThrew: false, closeThrew: false };
  try { top.location.href = 'https://musicbrainz.org/doc/About'; } catch (e) { out.navThrew = true; }
  try { top.close(); } catch (e) { out.closeThrew = true; }
  return out;
}).catch(e => ({ evalError: e.message.slice(0, 60) })) : null;
await page.waitForTimeout(2000);
console.log('attempt from inside the frame:', JSON.stringify(attempt), '| top url now:', page.url());
ck(page.url() === topUrlBefore, `the top window did not move (${topUrlBefore} -> ${page.url()})`);
ck(!page.isClosed(), 'and the tab is still open');

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
