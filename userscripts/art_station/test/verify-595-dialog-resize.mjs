// #595 (vzell): "When trying to resize (make it larger) the 'Submit edits'
// dialog by dragging and releasing the resize handler with the mouse the dialog
// closes immediately as soon as releasing the mouse. When then clicking the
// 'Enter edit' button again, it starts with the original size again."
//
// Cause: the backdrop-close handler was
//
//     ov.onclick = e => { if (e.target === ov && !ov._running) { … ov.remove(); } }
//
// and a `click` whose mousedown and mouseup have DIFFERENT targets is dispatched
// on their nearest COMMON ANCESTOR. Drag the box's resize corner (or a text
// selection) until the pointer is over the backdrop and the pair is
// (box, overlay) — so the click lands on the overlay and `e.target === ov` is
// true for a gesture that began *inside* the dialog.
//
// Two gestures are checked, because they are the same bug wearing different
// clothes and only one of them is easy to drive:
//   · a text-selection drag out of the edit note, released on the backdrop
//   · the reported gesture — the native resize corner
// and then the second half: the size surviving a reopen.
//
// Nothing is ever submitted. The dialog is opened but Run is never pressed, and
// both write endpoints are routed to a local stub that records any attempt.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.AS_SRC || resolve(HERE, '..', 'art_station.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
// GM storage, as verify-501 stubs it. Art Station @grants GM_getValue/GM_setValue
// and persists through them, so without these the size can be saved nowhere and
// the reopen half of this test would be measuring the stub, not the script.
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
});
const page = ctx.pages()[0] || await ctx.newPage();
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const errs = []; page.on('pageerror', e => errs.push(e.message));

// ⚠ narrow routes only — a catch-all route makes production musicbrainz.org
// load as a chrome-error page.
let posts = 0;
await page.route('**/ws/js/edit/create', r => { posts++; r.fulfill({ status: 200, contentType: 'application/json', body: '{"edits":[]}' }); });
await page.route('**/edit-cover-art/**', r => { if (r.request().method() === 'POST') { posts++; return r.fulfill({ status: 200, contentType: 'text/html', body: 'blocked' }); } r.continue(); });

await page.goto('https://musicbrainz.org/release/bafa58c1-e9b3-4ed3-b42d-70a387e411f4/cover-art', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(600);
await page.addScriptTag({ content: code });
await page.waitForSelector('#as-root', { timeout: 15000 });
await page.waitForTimeout(800);

// Stage one harmless change so there is a plan to review, then open the dialog.
const openDialog = async () => {
  await page.evaluate(() => document.getElementById('as-commit')?.remove());
  await page.click('.as-commit');
  await page.waitForSelector('#as-commit .as-cm-box', { timeout: 10000 });
  await page.waitForTimeout(350);
};
await page.click('.as-card:first-child .as-pencil');
await page.waitForTimeout(250);
await page.fill('.as-card:first-child .as-cmt', 'as595-' + Date.now());
await page.locator('.as-card:first-child .as-cmt').blur();
await page.waitForTimeout(350);
ck(await page.evaluate(() => !document.querySelector('.as-commit').disabled), 'a staged change enables the commit button');
await openDialog();
ck(await page.evaluate(() => !!document.getElementById('as-commit')), 'the Submit edits dialog opens');

const boxRect = () => page.evaluate(() => {
  const b = document.querySelector('#as-commit .as-cm-box');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.x, y: r.y, w: Math.round(r.width), h: Math.round(r.height), right: r.right, bottom: r.bottom };
});
const isOpen = () => page.evaluate(() => !!document.getElementById('as-commit'));

// ── 1. a selection drag released on the backdrop ───────────────────────────
// Start inside the edit note, finish well outside the dialog. mousedown on the
// textarea + mouseup on the overlay = click dispatched on the overlay.
let r = await boxRect();
console.log('box: ' + JSON.stringify(r));
const note = await page.locator('#as-commit .as-cm-note').boundingBox();
await page.mouse.move(note.x + 20, note.y + 10);
await page.mouse.down();
await page.mouse.move(r.right + 120, note.y + 10, { steps: 12 });   // out over the backdrop
await page.mouse.up();
await page.waitForTimeout(350);
let open = await isOpen();
console.log('after dragging a selection out of the edit note and releasing on the backdrop: open=' + open);
ck(open, 'THE BUG: a drag that STARTS inside the dialog must not close it when released on the backdrop');

// ── 2. the reported gesture: the native resize corner ──────────────────────
if (!await isOpen()) await openDialog();
r = await boxRect();
const before = { w: r.w, h: r.h };
// The UA resizer lives in the bottom-right ~16px of the box.
await page.mouse.move(r.right - 5, r.bottom - 5);
await page.mouse.down();
await page.mouse.move(r.right + 180, r.bottom + 90, { steps: 16 });
await page.mouse.up();
await page.waitForTimeout(400);
open = await isOpen();
const after = open ? await boxRect() : null;
console.log(`resize drag: ${JSON.stringify(before)} -> ${JSON.stringify(after && { w: after.w, h: after.h })}  open=${open}`);
ck(open, 'THE REPORTED GESTURE: dragging the resize corner and releasing does not close the dialog');
const grew = !!after && (after.w > before.w || after.h > before.h);
ck(grew, `and the box actually got bigger (${before.w}x${before.h} -> ${after && after.w + 'x' + after.h})`);

// ── 3. the size survives a reopen ──────────────────────────────────────────
// "When then clicking the 'Enter edit' button again, it starts with the
// original size again."
if (grew) {
  const resized = await boxRect();
  await openDialog();
  const reopened = await boxRect();
  console.log(`reopened: ${JSON.stringify({ w: reopened.w, h: reopened.h })} (was ${JSON.stringify({ w: resized.w, h: resized.h })})`);
  ck(Math.abs(reopened.w - resized.w) <= 4 && Math.abs(reopened.h - resized.h) <= 4,
    'the resized size is remembered and restored on the next open');
  const stored = await page.evaluate(() => { try { return JSON.parse(window.GM_getValue('artstation:dialogSize', '{}')); } catch (e) { return 'THREW'; } });
  console.log('stored: ' + JSON.stringify(stored));
  ck(!!stored && stored !== 'THREW' && !!stored.commit, 'and it is persisted, not just kept in the page');
} else {
  ck(false, 'could not resize the box, so the reopen half could not be checked');
}

// ── 4. a genuine backdrop click still closes ───────────────────────────────
// The fix must not turn the dialog into something you can only leave by button.
// ⚠ reopen first: against the BROKEN build the earlier steps have already closed
// it, and reading a null rect here aborted the run before the summary printed.
if (!await isOpen()) await openDialog();
r = await boxRect();
await page.mouse.click(Math.max(8, r.x / 2), Math.max(8, r.y / 2));
await page.waitForTimeout(350);
ck(!await isOpen(), 'a real click on the backdrop — down AND up outside — still closes it');

ck(posts === 0, `nothing was submitted (${posts} write attempts)`);
ck(errs.length === 0, 'no page errors (' + errs.slice(0, 2).join(' | ') + ')');
await ctx.close();
console.log(fail ? `\nFAILURES: ${fail}` : '\nALL PASS');
process.exit(fail ? 1 : 0);
