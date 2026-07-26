// #467 (majkinetor, repeatedly and in capitals): "DO NOT, EVER, CLOSE THE TAB",
// "LEAVE THE TAB OPEN WHEN FALCON IS DONE."
//
// His own observation is what cracked it:
//
//   "Isnt this something maybe integrated in browser, something I have seen when
//    other scripts open mb via URL to lets say add cover page, after it is
//    commited, it closes after sucess and returns back to invoking page"
//
// Exactly that. A seeded MusicBrainz edit page closes itself after a successful
// commit and returns to whatever invoked it. Falcon loads those same seeded edit
// pages inside worker iframes, and `top.close()` from a frame closes the TAB.
//
// It is permitted to, because a tab opened by window.open() — which is how the
// Harmony button launches Falcon — is script-closeable. And a close fires NO
// beforeunload and NO pagehide, which is the exact signature of his last log:
// truncated mid-line, no unload marker. I had read that as a content-process
// crash and gone looking for memory bugs.
//
// It never reproduced across five attempts here for one reason, which this test
// makes explicit by checking BOTH halves: a Playwright page opened with goto()
// is NOT script-closeable, so Firefox silently ignores close() on it. The
// identical call was a no-op in my environment and fatal in his. Hence the
// baseline below — it opens a real window.open() tab first and proves the close
// genuinely works there, so the second half is testing a live threat and not a
// tautology.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { firefox } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');
const ctx = await firefox.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile-ff', { headless: true });
await ctx.addInitScript(() => { const s=new Map(); window.GM_getValue=(k,d)=>s.has(k)?s.get(k):d; window.GM_setValue=(k,v)=>s.set(k,v); window.GM_deleteValue=k=>s.delete(k); window.GM_info={script:{name:'Falcon',version:'t'}}; });
const opener = ctx.pages()[0] || await ctx.newPage();
await opener.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });

// 1. baseline: a script-OPENED tab closes itself just fine (no Falcon)
const [t1] = await Promise.all([ctx.waitForEvent('page'), opener.evaluate(() => window.open('https://musicbrainz.org/?probe=1', '_blank'))]);
await t1.waitForLoadState('domcontentloaded');
let closed1 = false; t1.on('close', () => { closed1 = true; });
await t1.evaluate(() => window.close()).catch(() => {});
await new Promise(r => setTimeout(r, 1500));
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log('WITHOUT Falcon — script-opened tab closed by window.close():', closed1);

// 2. with Falcon loaded, the same call must be refused
const [t2] = await Promise.all([ctx.waitForEvent('page'), opener.evaluate(() => window.open('https://musicbrainz.org/?probe=2', '_blank'))]);
await t2.waitForLoadState('domcontentloaded');
await t2.waitForTimeout(600);
await t2.addScriptTag({ content: code });
await t2.waitForFunction(() => !!window.__falconTest, { timeout: 15000 });
let closed2 = false; t2.on('close', () => { closed2 = true; });
// call it the way MusicBrainz's own page would, from inside a child frame
await t2.evaluate(() => { const f = document.createElement('iframe'); f.src = 'https://musicbrainz.org/?child=1'; document.body.appendChild(f); });
await t2.waitForTimeout(2500);
await t2.evaluate(() => { try { document.querySelector('iframe').contentWindow.top.close(); } catch (e) { window.close(); } }).catch(() => {});
await new Promise(r => setTimeout(r, 1800));
ck(closed1, 'baseline: a script-opened tab really IS closeable by window.close() (else this test proves nothing)');
ck(!closed2, `with Falcon loaded, top.close() from a child frame does NOT close the tab (closed=${closed2})`);
if (!closed2) {
  const log = await t2.evaluate(() => window.__falconTest.getLog().filter(l => /BLOCKED an attempt to CLOSE/.test(l))).catch(() => []);
  console.log('blocked-and-logged:', log.length > 0, log[0] ? '| ' + log[0].slice(0, 90) : '');
  ck(log.length > 0, 'and the attempt is recorded in the log, so it is visible rather than silent');
}
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
