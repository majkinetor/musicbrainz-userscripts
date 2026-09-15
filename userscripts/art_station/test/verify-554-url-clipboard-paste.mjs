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

/* ── 1. one click imports, with nothing left on screen ─────────────────────
   The whole point of his correction: no box, no Enter, no second click. */
const URL1 = 'https://www.example.com/artwork/front-3000.jpg';
await setClip(URL1);
const r1 = await pressPasteUrl();
console.log('\nclipboard has a URL -> ' + JSON.stringify(r1));
ck(r1.label === 'Paste URL', `the control is called "Paste URL" (${JSON.stringify(r1.label)})`);
ck(r1.popoverGone, 'one click closes the panel and gets on with it');
ck(!r1.boxShown, 'no input is shown — "no edit is shown", as asked');
ck(r1.sourced === URL1, `and the import ran on the clipboard URL (${JSON.stringify(r1.sourced)})`);

/* ── 2. nothing usable on the clipboard: the box, not an import ────────────
   A field that fetches whatever happened to be on the clipboard is worse than
   one that does nothing, so these must NOT start anything. */
for (const [what, clip] of [
  ['plain text', 'Psych Funk Sa-Re-Ga!'],
  ['a bare file path', 'C:\\covers\\front.jpg'],
  ['a non-http scheme', 'javascript:alert(1)'],
]) {
  await setClip(clip);
  const r = await pressPasteUrl();
  ck(r.sourced === null, `${what}: starts no import`);
  ck(r.boxShown && r.focused, `${what}: falls back to the box, focused, so it can still be used by hand`);
  ck(r.value === '', `${what}: and the box is empty rather than carrying junk (${JSON.stringify(r.value)})`);
}

/* ── 3. source-level: the button is the action ─────────────────────────────── */
const fnBody = (code.match(/const pasteUrlAndGo = async \(\) => \{[\s\S]*?\n    \};/) || [''])[0];
ck(!!fnBody, 'the clipboard helper is where this test thinks it is');
ck(!!fnBody && /sourceFromUrl\(txt\)/.test(fnBody),
  'it imports directly rather than filling a box for you to confirm');
ck(!!fnBody && !/urlInp\.value = /.test(fnBody),
  'and never writes the URL into the input — that was the "leaves input open" complaint');
ck(!/>By URL</.test(code), 'the old "By URL" label is gone');

ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
console.log('\nPOSTs seen:', allPosts.length, '- writes among them:', posted.length);
if (allPosts.length) console.log('  ' + allPosts.slice(0, 4).map(u => u.slice(0, 110)).join('\n  '));
ck(posted.length === 0, `nothing was uploaded or submitted at any point (${posted.length})`);
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
