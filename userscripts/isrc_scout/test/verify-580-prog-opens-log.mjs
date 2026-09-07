// majkinetor, on the ⚠ status line: "In ISRC scout, lets also add click to 'see
// log' message like in Fusion, so it opens a log window", with the element:
//   <span class="ii-prog err" id="ii-prog">⚠ SoundCloud failed — see Log</span>
//
// A message that names the log should BE the way there. Fusion does this with
// .fs-toLog on its header status texts; the equivalent here is the log pane.
//
// Two things are worth asserting and they are different: that an error message
// opens the log, and that an ordinary progress line does NOT look clickable —
// an affordance on text that does nothing is worse than no affordance.
//
// Driven through setProg on a real modal rather than by poking classes, because
// what changed is that function's contract.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.II_SRC || resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');
const log = (...a) => console.log('[verify-580]', ...a);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const REL = '1bbbe273-7dd9-44e8-940f-75a92aa3a2b0';
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1600, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_info = { script: { name: 'ISRC Scout', version: 't' } };
  window.GM_xmlhttpRequest = (o) => {
    const done = r => { try { (o.onload || (() => {}))(r); } catch (e) {} };
    fetch(o.url, { method: o.method || 'GET', headers: o.headers || {}, body: o.data })
      .then(async r => done({ status: r.status, statusText: r.statusText, responseText: await r.text(), finalUrl: r.url, responseHeaders: '' }))
      .catch(e => { try { (o.onerror || (() => {}))(e); } catch (_) {} });
    return { abort() {} };
  };
});
const posted = [];
await page.route(() => true, r => { if (r.request().method() === 'POST') { posted.push(r.request().url()); return r.abort(); } return r.fallback(); });
await page.goto(`https://musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#ii-btn', { timeout: 25000, state: 'attached' });
await page.evaluate(() => document.getElementById('ii-btn').click());
await page.waitForSelector('#ii-prog', { timeout: 25000, state: 'attached' });
await page.waitForTimeout(1200);

// Guarded so a build without the hook reports that, instead of dying inside
// page.evaluate with an unreadable "cannot read properties of undefined".
if (!await page.evaluate(() => !!(window.__isrcScoutTestProg && window.__isrcScoutTestProg.setProg))) {
  ck(false, 'setProg is exposed for testing — this build predates the change');
  console.log(String.fromCharCode(10) + '1 FAIL'); await ctx.close(); process.exit(1);
}

const probe = () => page.evaluate(() => {
  const el = document.getElementById('ii-prog');
  const pane = document.getElementById('ii-log-pane');
  return {
    text: el.textContent.trim(),
    tolog: el.classList.contains('tolog'),
    err: el.classList.contains('err'),
    cursor: getComputedStyle(el).cursor,
    title: el.title,
    hasClick: typeof el.onclick === 'function',
    paneOpen: !!pane && pane.classList.contains('open'),
  };
});

// an ordinary progress line: no affordance, nothing to open
await page.evaluate(() => window.__isrcScoutTestProg.setProg('reading tracklist…', false));
const plain = await probe();
log('plain:', JSON.stringify(plain));
ck(!plain.tolog && !plain.hasClick, `a plain progress line is not clickable (${JSON.stringify([plain.tolog, plain.hasClick])})`);
ck(plain.cursor !== 'pointer', `…and does not pretend to be (cursor ${plain.cursor})`);

// the message from his screenshot
await page.evaluate(() => window.__isrcScoutTestProg.setProg('⚠ SoundCloud failed — see Log', true));
const bad = await probe();
log('error:', JSON.stringify(bad));
ck(bad.err && bad.tolog, `the failure message is marked as a route to the log (${JSON.stringify([bad.err, bad.tolog])})`);
ck(bad.cursor === 'pointer', `it looks clickable (cursor ${bad.cursor})`);
ck(/log/i.test(bad.title), `and says what it will do (title ${JSON.stringify(bad.title)})`);
ck(!bad.paneOpen, 'the log pane is still shut before anything is clicked');

await page.evaluate(() => document.getElementById('ii-prog').click());
await page.waitForTimeout(400);
const opened = await probe();
ck(opened.paneOpen, 'clicking it opens the log pane');

// clicking again must not put it away: "see Log" that hides the log on a second
// click would be its own small bug
await page.evaluate(() => document.getElementById('ii-prog').click());
await page.waitForTimeout(400);
const again = await probe();
ck(again.paneOpen, 'clicking a second time leaves it open rather than toggling it shut');

// and a later non-error message takes the affordance away again
await page.evaluate(() => window.__isrcScoutTestProg.setProg('done', false));
const after = await probe();
log('after:', JSON.stringify(after));
ck(!after.tolog && !after.hasClick, `a following ordinary message clears the click (${JSON.stringify([after.tolog, after.hasClick])})`);

const writes = posted.filter(u => { try { return /(^|\.)musicbrainz\.org$/.test(new URL(u).hostname); } catch (e) { return true; } });
ck(writes.length === 0, `nothing was submitted to MusicBrainz (${writes.length})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
