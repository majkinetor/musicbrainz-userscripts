// #554 (vzell, part 2): "Maybe even automatically paste the URL directly when
// it's not malformed and in the clipboard when clicking the 'By URL' link"
//
// Settled shape, after several rounds with majkinetor: "Revert the button and
// input to previous and keep ctrl + v."
//
// So the popover's "By URL" button and its input are exactly as they were before
// any of this — click to unroll, type or paste, Enter or a pasted URL imports —
// and the ONE thing #554 adds is a page-level Ctrl+V.
//
// That is the shape that needs no clipboard permission and therefore raises no
// browser prompt: a paste GESTURE carries its own data, whereas reading the
// clipboard from a click does not, which is what Chrome's "Paste" chip was.
//
// Nothing is ever uploaded: every write endpoint is asserted unused.
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
// open the Source popover, press "Paste URL", and report what that ONE click did.
// `.as-src-url-inp` no longer exists — the lookups for it stay so the checks can
// assert its ABSENCE rather than silently passing on a selector that matches
// nothing either way.
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

/* ── 1. the button and input are back to what they were ───────────────────── */
ck(/>By URL</.test(code), 'the control is called "By URL" again');
ck(/class="as-src-url-inp"/.test(code), 'its input is back in the markup');
ck(!/pasteUrlAndGo|clipboardGranted/.test(code), 'and no clipboard reading is left behind');
ck(!/navigator\.clipboard\.readText/.test(code),
  'readText() is not called anywhere — so no browser permission prompt can be raised');

const ui = await page.evaluate(async () => {
  document.querySelectorAll('.as-pop').forEach(p => p.remove());
  document.querySelector('.as-src').click();
  await new Promise(r => setTimeout(r, 600));
  const before = !!document.querySelector('.as-src-hd.open');
  document.querySelector('.as-src-url-btn').click();
  await new Promise(r => setTimeout(r, 300));
  const i = document.querySelector('.as-src-url-inp');
  return { label: document.querySelector('.as-src-url-btn').textContent.trim(),
    closedBefore: !before, opensOnClick: !!document.querySelector('.as-src-hd.open'),
    focused: document.activeElement === i };
});
console.log('\nbutton behaviour:', JSON.stringify(ui));
ck(ui.label === 'By URL', `the label is "By URL" (${JSON.stringify(ui.label)})`);
ck(ui.closedBefore && ui.opensOnClick, 'clicking it unrolls the input, as it always did');
ck(ui.focused, 'and focuses it');

/* ── 2. the one thing #554 keeps: Ctrl+V anywhere ─────────────────────────── */
const anywhere = await page.evaluate(async () => {
  document.querySelectorAll('.as-pop').forEach(p => p.remove());
  if (window.__asTest) window.__asTest.lastSource = null;
  const dt = new DataTransfer();
  dt.setData('text', 'https://www.example.com/anywhere.jpg');
  document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 350));
  return (window.__asTest && window.__asTest.lastSource) || null;
});
ck(anywhere === 'https://www.example.com/anywhere.jpg',
  `Ctrl+V on the gallery imports, with no button and no prompt (${JSON.stringify(anywhere)})`);

// …and it must not steal a paste meant for a field — including the URL box,
// which has its own handler and would otherwise import twice
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
ck(notStolen === null, `a paste aimed at an input is left to that input (${JSON.stringify(notStolen)})`);

// non-URL text on the gallery does nothing at all
const junk = await page.evaluate(async () => {
  if (window.__asTest) window.__asTest.lastSource = null;
  for (const t of ['Psych Funk Sa-Re-Ga!', 'javascript:alert(1)', 'C:\covers\front.jpg']) {
    const dt = new DataTransfer();
    dt.setData('text', t);
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }
  await new Promise(r => setTimeout(r, 350));
  return (window.__asTest && window.__asTest.lastSource) || null;
});
ck(junk === null, `pasting something that is not an http(s) URL does nothing (${JSON.stringify(junk)})`);

ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
console.log('\nPOSTs seen:', allPosts.length, '- writes among them:', posted.length);
if (allPosts.length) console.log('  ' + allPosts.slice(0, 4).map(u => u.slice(0, 110)).join('\n  '));
ck(posted.length === 0, `nothing was uploaded or submitted at any point (${posted.length})`);
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
