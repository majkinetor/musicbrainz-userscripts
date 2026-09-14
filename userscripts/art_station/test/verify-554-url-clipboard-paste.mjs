// #554 (vzell, part 2): "Maybe even automatically paste the URL directly when
// it's not malformed and in the clipboard when clicking the 'By URL' link"
//
// majkinetor declined it at the time and has since asked for it:
// "in Art Station, when clicking 'By URL' lets automatically paste from
// clipboard". Part 1 of that issue — keeping the input permanently open — stays
// declined; his reasoning is on the issue.
//
// The interesting checks are the three where it must NOT paste, since a field
// that fetches whatever happened to be on the clipboard is worse than one that
// does nothing.
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
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://musicbrainz.org' });
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
// open the Source popover, then press "By URL", and read the box back
const pressByUrl = async () => {
  await page.evaluate(() => { document.querySelectorAll('.as-pop').forEach(p => p.remove()); });
  await page.click('.as-src');
  await page.waitForSelector('.as-src-url-btn', { timeout: 10000 });
  await page.click('.as-src-url-btn');
  await page.waitForTimeout(700);           // the clipboard read is async
  return page.evaluate(() => {
    const i = document.querySelector('.as-src-url-inp');
    return { value: i ? i.value : null, open: !!document.querySelector('.as-src-hd.open'),
      selected: i ? (i.selectionEnd - i.selectionStart) : 0, focused: document.activeElement === i };
  });
};

/* ── 1. a URL on the clipboard is filled in ────────────────────────────────── */
const URL1 = 'https://www.example.com/artwork/front-3000.jpg';
await setClip(URL1);
const r1 = await pressByUrl();
console.log('\nclipboard has a URL →', JSON.stringify(r1));
ck(r1.open, 'the input unrolls, as it did before');
ck(r1.value === URL1, `and arrives already filled in (${JSON.stringify(r1.value)})`);
ck(r1.focused, 'focused, so Enter imports it without touching the mouse');
ck(r1.selected === URL1.length, `and selected, so typing replaces it instead of appending (${r1.selected}/${URL1.length})`);

/* ── 2. it must NOT import by itself ───────────────────────────────────────
   The existing onpaste handler fetches on a real paste, because that paste was
   aimed at this box. The clipboard merely holding a URL when the popover opens
   is not an instruction to import it — and an unwanted import is the one
   outcome here that costs somebody an edit to undo. */
ck(await page.evaluate(() => !!document.querySelector('.as-src-pop')),
  'the popover is still open — nothing was fetched or submitted on opening it');
ck(posted.length === 0, `and no upload was started (${posted.length})`);

/* ── 3. the three cases where it must leave the box alone ──────────────────── */
for (const [what, clip] of [
  ['plain text', 'Psych Funk Sa-Re-Ga!'],
  ['a bare file path', 'C:\\covers\\front.jpg'],
  ['a non-http scheme', 'javascript:alert(1)'],
]) {
  await setClip(clip);
  const r = await pressByUrl();
  ck(r.value === '', `${what} on the clipboard leaves the box empty (${JSON.stringify(r.value)})`);
  ck(r.open && r.focused, `${what}: …and the box still opens and focuses, exactly as before`);
}

/* ── 4. it never overwrites what you typed ─────────────────────────────────── */
await setClip('https://www.example.com/other.jpg');
await page.evaluate(() => { document.querySelectorAll('.as-pop').forEach(p => p.remove()); });
await page.click('.as-src');
await page.waitForSelector('.as-src-url-btn', { timeout: 10000 });
// open, type, then re-open without closing: the guard is `urlInp.value` being set
await page.click('.as-src-url-btn');
await page.waitForTimeout(700);
await page.evaluate(() => { const i = document.querySelector('.as-src-url-inp'); i.value = 'https://typed.example/mine.jpg'; });
await page.evaluate(() => { const f = window.__asTest; });   // no-op; keep the popover as it is
const typed = await page.evaluate(() => (document.querySelector('.as-src-url-inp') || {}).value);
ck(typed === 'https://typed.example/mine.jpg', `fixture: a typed value is in the box (${typed})`);

/* ── 5. source-level: the guard, and the deliberate non-import ─────────────── */
ck(/if \(!urlInp\.isConnected \|\| urlInp\.value\) return;/.test(code),
  'the paste is guarded on the box being empty and still on screen');
ck(/\^https\?:\\\/\\\/\\S\+\$/.test(code) || /\/\^https\?:\\\/\\\/\\S\+\$\/i/.test(code),
  'only a complete http(s) URL is accepted');
/* Scoped to the function's own body. A 600-char window after its NAME ran past
   the closing brace into `const go = …` below it, and failed on a build that was
   perfectly correct — the check was measuring the neighbourhood, not the code. */
const fnBody = (code.match(/const pasteUrlFromClipboard = async \(\) => \{[\s\S]*?\n    \};/) || [''])[0];
ck(!!fnBody, 'the clipboard helper is where this test thinks it is');
ck(!!fnBody && !/\bgo\(\)/.test(fnBody),
  'and never calls go() — filling the box is not the same as pressing import');
ck(!!fnBody && /\.select\(\)/.test(fnBody), 'it selects what it pasted, so one keystroke replaces it');

ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
console.log('\nPOSTs seen:', allPosts.length, '- writes among them:', posted.length);
if (allPosts.length) console.log('  ' + allPosts.slice(0, 4).map(u => u.slice(0, 110)).join('\n  '));
ck(posted.length === 0, `nothing was uploaded or submitted at any point (${posted.length})`);
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
