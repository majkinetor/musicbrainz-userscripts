// #554 (vzell, part 2): "Maybe even automatically paste the URL directly when
// it's not malformed and in the clipboard when clicking the 'By URL' link"
//
// majkinetor declined it, then asked for it, then corrected the shape of it:
// "Revert that. It first shows 'Paste' button, then it pastes clipboad and
// leaves input open. What I want is this: clipboard is immediately used, and no
// edit is shown. Rename by URL to Paste URL. So, you click it and it goes
// loading image from clipboard without ceremony."
//
// So the button IS the action. The checks that matter are that one click both
// imports AND leaves no input behind, and that a clipboard holding something
// which is not a URL still cannot start an import.
//
// Chromium can actually grant clipboard-read, so this drives the real API rather
// than a stub. Nothing is ever uploaded: every write endpoint is asserted unused.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.AS_SRC || resolve(HERE, '..', 'art_station.user.js'), 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const RELEASE = 'https://musicbrainz.org/release/55530bc0-97ec-4256-97fc-e6058958c251/cover-art';
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: !process.argv.includes('--headed'), viewport: { width: 1500, height: 1000 },
});
// clipboard-write only to begin with: the point of the first section is what
// happens when clipboard-READ is still in its default "prompt" state, which is
// the state that makes Chrome show its "Paste" chip.
await ctx.grantPermissions(['clipboard-write'], { origin: 'https://musicbrainz.org' });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const posted = [];
const allPosts = [];
page.on('request', r => {
  if (r.method() !== 'POST' && r.method() !== 'PUT') return;
  allPosts.push(r.method() + ' ' + r.url());
  /* ⚠ Only WRITES count. A first version counted every POST and reported 2
     "uploads" that were MusicBrainz's own telemetry — the same mistake the #566
     fixture made when it counted cover-art thumbnails as uploads. */
  if (/\/ws\/2\/|\/cover-art-archive\/|archive\.org|\/edit\/|\/ws\/js\/edit/i.test(r.url())) posted.push(r.method() + ' ' + r.url());
});

await page.goto(RELEASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.addScriptTag({ content: code });
const booted = await page.waitForSelector('.as-src', { timeout: 25000 }).then(() => true).catch(() => false);
ck(booted, 'fixture: Art Station mounted its toolbar (otherwise nothing below means anything)');
if (!booted) { await ctx.close(); console.log(`\n${fail} FAILED`); process.exit(1); }

const setClip = t => page.evaluate(v => navigator.clipboard.writeText(v), t);
// open the Source popover, press "Paste URL", and report what that ONE click did
const pressPasteUrl = async () => {
  await page.evaluate(() => { document.querySelectorAll('.as-pop').forEach(p => p.remove()); if (window.__asTest) window.__asTest.lastSource = null; });
  await page.click('.as-src');
  await page.waitForSelector('.as-src-url-btn', { timeout: 10000 });
  const label = await page.evaluate(() => document.querySelector('.as-src-url-btn').textContent.trim());
  await page.click('.as-src-url-btn');
  await page.waitForTimeout(900);           // the clipboard read is async
  return page.evaluate((lbl) => {
    const i = document.querySelector('.as-src-url-inp');
    return {
      label: lbl,
      popoverGone: !document.querySelector('.as-src-pop'),
      boxShown: !!document.querySelector('.as-src-hd.open'),
      value: i ? i.value : null,
      focused: !!i && document.activeElement === i,
      sourced: (window.__asTest && window.__asTest.lastSource) || null,
    };
  }, label);
};

/* ── 1. permission NOT granted: the clipboard must never be read ───────────
   majkinetor: "there is a second click again" / "That '&Paste' button should go
   away". That chip is Chrome's clipboard-read permission prompt, raised by
   readText() while the permission is in its default "prompt" state. A page
   script cannot dismiss or pre-approve it — so the only way to remove it is to
   not make the call. */
const readCalls = await page.evaluate(() => {
  window.__readCalls = 0;
  const real = navigator.clipboard.readText.bind(navigator.clipboard);
  navigator.clipboard.readText = (...a) => { window.__readCalls++; return real(...a); };
  return navigator.permissions.query({ name: 'clipboard-read' }).then(s => s.state).catch(() => 'unknown');
});
console.log('\nclipboard-read permission state:', readCalls);
/* "prompt" is the state a real Chrome starts in and the one that raises the
   chip; Playwright reports "denied" here because grantPermissions() implicitly
   denies everything not listed. The code treats both the same — read only when
   "granted" — so the check is that it is NOT granted. Asserting === 'prompt'
   failed on a correct build for a reason that has nothing to do with Art
   Station. */
ck(readCalls !== 'granted', `fixture: clipboard-read is not granted (${readCalls}) — otherwise this proves nothing`);

await setClip('https://www.example.com/artwork/front-3000.jpg');
const r1 = await pressPasteUrl();
console.log('not granted →', JSON.stringify(r1));
ck(r1.label === 'Paste URL', `the control is called "Paste URL" (${JSON.stringify(r1.label)})`);
ck(await page.evaluate(() => window.__readCalls) === 0,
  'readText() is never called while the permission is only "prompt" — so Chrome has nothing to raise its chip for');
ck(r1.boxShown && r1.focused, 'instead the box opens focused, ready for the paste gesture');

/* ── 2. …and the paste gesture imports, with no permission involved ────────── */
const pasted = await page.evaluate(async () => {
  if (window.__asTest) window.__asTest.lastSource = null;
  const i = document.querySelector('.as-src-url-inp');
  i.focus();
  const dt = new DataTransfer();
  dt.setData('text', 'https://www.example.com/pasted.jpg');
  i.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  i.value = 'https://www.example.com/pasted.jpg';           // what the browser would do
  await new Promise(r => setTimeout(r, 400));
  return (window.__asTest && window.__asTest.lastSource) || null;
});
ck(pasted === 'https://www.example.com/pasted.jpg', `Ctrl+V in the box imports straight away (${JSON.stringify(pasted)})`);

/* ── 3. paste anywhere on the gallery — no button at all ───────────────────── */
const anywhere = await page.evaluate(async () => {
  document.querySelectorAll('.as-pop').forEach(p => p.remove());
  if (window.__asTest) window.__asTest.lastSource = null;
  const dt = new DataTransfer();
  dt.setData('text', 'https://www.example.com/anywhere.jpg');
  document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 400));
  return (window.__asTest && window.__asTest.lastSource) || null;
});
ck(anywhere === 'https://www.example.com/anywhere.jpg',
  `pasting a URL onto the gallery imports it with no button and no prompt (${JSON.stringify(anywhere)})`);

// …but it must not eat a paste aimed at a real field
const notStolen = await page.evaluate(async () => {
  if (window.__asTest) window.__asTest.lastSource = null;
  const inp = document.createElement('input');
  document.body.appendChild(inp); inp.focus();
  const dt = new DataTransfer();
  dt.setData('text', 'https://www.example.com/typed-into-a-field.jpg');
  inp.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 300));
  const v = (window.__asTest && window.__asTest.lastSource) || null;
  inp.remove();
  return v;
});
ck(notStolen === null, `a paste aimed at some other input is left alone (${JSON.stringify(notStolen)})`);

/* ── 4. permission GRANTED: one click, read silently, no box ───────────────── */
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://musicbrainz.org' });
await page.evaluate(() => { window.__readCalls = 0; });
const URL1 = 'https://www.example.com/artwork/front-3000.jpg';
await setClip(URL1);
const r4 = await pressPasteUrl();
console.log('granted →', JSON.stringify(r4));
ck(r4.popoverGone, 'with the permission granted, one click closes the panel and gets on with it');
ck(!r4.boxShown, 'no input is shown — "no edit is shown", as asked');
ck(r4.sourced === URL1, `and the import ran on the clipboard URL (${JSON.stringify(r4.sourced)})`);
ck(await page.evaluate(() => window.__readCalls) === 1, 'the clipboard is read exactly once, and only now that it is allowed');

/* ── 5. still nothing usable → no import ───────────────────────────────────── */
for (const [what, clip] of [
  ['plain text', 'Psych Funk Sa-Re-Ga!'],
  ['a non-http scheme', 'javascript:alert(1)'],
]) {
  await setClip(clip);
  const r = await pressPasteUrl();
  ck(r.sourced === null, `${what}: starts no import`);
  ck(r.boxShown, `${what}: falls back to the box so it can still be used by hand`);
}

/* ── 6. source-level ───────────────────────────────────────────────────────── */
ck(/const clipboardGranted = async/.test(code), 'the permission is checked before the clipboard is touched');
ck(!/>By URL</.test(code), 'the old "By URL" label is gone');
ck(/document\.addEventListener\('paste'/.test(code), 'and a paste anywhere on the gallery is handled');

ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
console.log('\nPOSTs seen:', allPosts.length, '- writes among them:', posted.length);
if (allPosts.length) console.log('  ' + allPosts.slice(0, 4).map(u => u.slice(0, 110)).join('\n  '));
ck(posted.length === 0, `nothing was uploaded or submitted at any point (${posted.length})`);
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
