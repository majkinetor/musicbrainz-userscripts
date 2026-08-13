// #487 (vzell/chaban-mb): the "Internet Archive is currently experiencing difficulties"
// warning MB itself shows on /add-cover-art (and /add-event-art) never surfaced through
// Art Station's own gallery. Root cause: #367 replaced a live text-scan with a ONE-TIME
// snapshot of `.caa-warning`'s visibility taken at mount() — but MB reveals that warning
// asynchronously (an inline <script> queries s3.us.archive.org, then does
// `$(".caa-warning").parent().toggle()` once that resolves), almost always AFTER our
// mount() snapshot already ran. The snapshot read "not shown yet" and was never
// re-checked, so the warning was permanently invisible through Art Station.
//
// Fix: detectIaNotice() now reads `.caa-warning`'s live visibility on every call instead
// of a frozen flag, and the MutationObserver that re-triggers it now watches `attributes`
// too (jQuery's .toggle() flips an inline style attribute, not childList/characterData).
//
// This test simulates MB's own reveal mechanism (inject the hidden wrapper, then flip its
// inline style off exactly like jQuery's .toggle() would) and confirms Art Station's own
// banner appears afterward.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'art_station.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 }, bypassCSP: true });
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
// /cover-art (view, no edit) needs no login and has the same #content/tabs/h1 structure
// mount() and detectIaNotice() operate on — the IA-warning markup itself doesn't exist
// natively here (that's the separate, out-of-scope /cover-art gap), so we inject a fake
// one below regardless of which route we're on.
await page.goto('https://musicbrainz.org/release/1bfa31f9-b196-4eb1-a805-e747a610372d/cover-art', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(400);
await page.addScriptTag({ content: code });
await page.waitForSelector('#as-root', { timeout: 15000 });
await page.waitForTimeout(500);   // let mount()'s watchIaNotice() settle
console.log('Art Station mounted on /cover-art');

// MB's real markup: <div style="display:none"><div class="warning caa-warning">...</div></div>,
// injected AFTER mount — same as MB's own async reveal timing relative to our mount() snapshot.
await page.evaluate(() => {
  const wrap = document.createElement('div');
  wrap.id = 'test-ia-wrap';
  wrap.style.display = 'none';
  wrap.innerHTML = '<div class="warning caa-warning">Warning: The Internet Archive is currently experiencing difficulties. Adding images is unlikely to work at the moment.</div>';
  (document.getElementById('content') || document.body).appendChild(wrap);
});

const beforeReveal = await page.evaluate(() => !!document.querySelector('.as-ia.as-ia-warn'));
ck(beforeReveal === false, 'no warning banner shown while MB\'s wrapper is still display:none (as expected)');

// Reveal exactly like jQuery's $(".caa-warning").parent().toggle() would: flip the wrapper's
// inline style attribute. This is an ATTRIBUTE mutation, not childList/characterData.
await page.evaluate(() => { document.getElementById('test-ia-wrap').style.display = ''; });
await page.waitForTimeout(600);   // past the observer's 200ms debounce

const after = await page.evaluate(() => {
  const el = document.querySelector('.as-ia.as-ia-warn');
  return el ? (el.textContent || '').trim() : null;
});
console.log('after MB reveals the warning:', JSON.stringify(after));
ck(!!after && /experiencing difficulties/i.test(after), `Art Station's own banner appears once MB reveals the warning (got ${JSON.stringify(after)})`);

// #487 follow-up (majkinetor, live: MB's own native warning genuinely showed,
// but Art Station's own banner never did): traced it on a real occurrence —
// MB reveals `.caa-warning` via jQuery within ~1-2s (fast, confirmed live),
// but a React re-render of that same region moments later replaces the node
// wholesale, resetting it back to display:none — jQuery's one-shot toggle
// never gets reapplied. A purely live snapshot read flickers true-then-false
// within the same second. Simulate exactly that: reveal, then reset it back
// to hidden (as the React re-render does), and confirm Art Station's own
// banner LATCHES rather than disappearing again.
await page.evaluate(() => { document.getElementById('test-ia-wrap').style.display = 'none'; });
await page.waitForTimeout(600);
const afterReset = await page.evaluate(() => {
  const el = document.querySelector('.as-ia.as-ia-warn');
  return el ? (el.textContent || '').trim() : null;
});
console.log('after MB\'s own re-render resets the wrapper back to hidden:', JSON.stringify(afterReset));
ck(!!afterReset && /experiencing difficulties/i.test(afterReset), `Art Station's banner stays latched instead of disappearing again (got ${JSON.stringify(afterReset)})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
