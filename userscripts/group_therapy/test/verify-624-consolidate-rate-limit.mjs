// #624 (majkinetor): "RG Consolidation reports no RG due to error/rate limit — when there are
// obviously 3 of them". The dialog's WS2 reads never looked at the response: a throttled 503 is JSON
// too ({"error": …}), so it parsed as "No release group". Same class, same dialog: a release whose
// credits could not be read was stored as "no credits", so every credit looked missing on it.
//
// test.musicbrainz.org, read-only (every write endpoint is aborted). MusicBrainz throttling is
// reproduced with page routes: the release-group lookup and the group's release list answer
// 503 {"error": …} / Retry-After: 0 the first two times; one release's credits fail (HTTP 500)
// until the test lets them through. Fixture: "Going Places" (3 releases; only the one being
// edited has release-level credits). GT_SRC=<old build> to watch it say "No release group".
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.GT_SRC || resolve(HERE, '..', 'group_therapy.user.js'), 'utf8');

const HOST = 'https://test.musicbrainz.org';
const REL = 'fd8ba202-e570-40b5-9885-ccb74f9ef72d';      // the release being edited (8 release-level credits)
const UNREAD = 'ed10483f-1f70-4772-b491-743ecac24599';   // its credits "fail" until let through
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1000 } });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d; window.GM_setValue = (k, v) => s.set(k, v); window.GM_deleteValue = k => s.delete(k);
  window.GM_openInTab = () => null; window.GM_info = { script: { name: 'Group Therapy', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const log = (...a) => console.log('[verify-624]', ...a);

// never write anything
await page.route(u => /\/ws\/js\/edit\//.test(u.pathname), r => r.abort());   // the edit API — Apply is never pressed, but just in case
page.on('request', r => { if (r.method() === 'POST' && /musicbrainz\.org\//.test(r.url())) log('POST to MusicBrainz seen (should be none):', r.url()); });
// MusicBrainz throttling, reproduced
const hits = { rgLookup: 0, list: 0, list503: 0, unread: 0 };
const THROTTLES = process.env.THROTTLES != null ? +process.env.THROTTLES : 2;   // THROTTLES=0: no 503s — lets an old build reach the matrix, to show the unread-release half
const THROTTLED = { status: 503, contentType: 'application/json', headers: { 'Retry-After': '0' }, body: JSON.stringify({ error: 'Your requests are exceeding the allowable rate limit. Please see https://wiki.musicbrainz.org/XMLWebService for more information.' }) };
await page.route(u => /\/ws\/2\/release\/[0-9a-f-]{36}$/.test(u.pathname) && /release-groups/.test(u.search), async r => {
  hits.rgLookup++;
  if (hits.rgLookup <= THROTTLES) return r.fulfill(THROTTLED);
  return r.fulfill({ response: await r.fetch() });
});
await page.route(u => /\/ws\/2\/release$/.test(u.pathname) && /release-group=/.test(u.search), async r => {
  hits.list++;
  if (hits.list <= THROTTLES) { hits.list503++; return r.fulfill(THROTTLED); }
  return r.fulfill({ response: await r.fetch() });
});
let failUnread = true;
await page.route(u => u.pathname === '/ws/js/entity/' + UNREAD, async r => {
  hits.unread++;
  if (failUnread) return r.fulfill({ status: 500, contentType: 'text/plain', body: 'Internal Server Error' });
  return r.fulfill({ response: await r.fetch() });
});

await page.goto(`${HOST}/release/${REL}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => { try { return !!window.MB.relationshipEditor.state.entity; } catch { return false; } }, null, { timeout: 60000 });
await page.addScriptTag({ content: code });
await page.waitForSelector('button.gt-clone-btn:has-text("Consolidate RG")', { timeout: 20000 });
await page.click('button.gt-clone-btn:has-text("Consolidate RG")');
// settle: the matrix (or a final message) — the retries take a few seconds by design
await page.waitForFunction(() => {
  const b = document.querySelector('.gt-cons-body'); if (!b) return false;
  if (b.querySelector('.gt-cons-tbl')) return true;
  const t = b.textContent;
  return /release group|Need at least|Could not load|None of the selected/i.test(t) && !/Loading|Reading/i.test(t);
}, null, { timeout: 90000 }).catch(() => {});
const state = () => page.evaluate(() => {
  const b = document.querySelector('.gt-cons-body'); if (!b) return null;
  const cols = [...b.querySelectorAll('th.gt-cons-col')];
  const failIdx = cols.findIndex(th => th.classList.contains('gt-fail'));
  const rows = [...b.querySelectorAll('tr.gt-cons-row')];
  return {
    note: ((b.querySelector('.gt-pop-note') || {}).textContent || '').trim(),
    legend: [...b.querySelectorAll('.gt-cons-legi b')].map(x => x.textContent),
    cols: cols.length, failIdx, rows: rows.length,
    failBanner: ((b.querySelector('.gt-cons-fail') || {}).textContent || '').trim(),
    failCells: b.querySelectorAll('.gt-cons-cell.gt-fail').length,
    // what the unread column would get proposed (its cells), after Auto select
    propByCol: cols.map((th, i) => rows.filter(tr => (tr.children[2 + i] || {}).classList && tr.children[2 + i].classList.contains('gt-prop')).length),
    unreadProposed: failIdx < 0 ? null : rows.filter(tr => (tr.children[2 + failIdx] || {}).classList && tr.children[2 + failIdx].classList.contains('gt-prop')).length,
  };
});
const s1 = await state();
log('dialog:', JSON.stringify(s1), '| hits:', JSON.stringify(hits));
ck(s1 && !/no release group/i.test(s1.note), `it does not say "No release group" (${s1 && (s1.note || 'matrix shown')})`);
ck(s1 && s1.legend.length === 3, `all 3 releases of the group are listed despite two throttled replies (${s1 && s1.legend.join(',')})`);
ck(hits.rgLookup === 0, `the release group comes from the page — no WS2 lookup for it (${hits.rgLookup})`);
ck(hits.list503 === 2 && hits.list >= 3, `the throttled release list was retried until it answered (${hits.list} requests, ${hits.list503} throttled)`);
ck(s1 && s1.cols === 3 && s1.rows >= 8, `the matrix shows all three columns and the 8 credits (${s1 && s1.cols} cols, ${s1 && s1.rows} rows)`);
ck(s1 && s1.failIdx >= 0 && s1.failCells === s1.rows && /Could not read/.test(s1.failBanner), `the release whose credits failed is "?" throughout, with a warning: "${s1 && s1.failBanner}"`);

// Auto select must propose nothing on the unread release
if (await page.$('.gt-cons-foot button:has-text("Auto select")')) await page.click('.gt-cons-foot button:has-text("Auto select")');
const s2 = await state();
log('proposed per column after Auto select:', JSON.stringify(s2 && s2.propByCol));
ck(s2 && s2.unreadProposed === 0, `Auto select proposes nothing on the unread release (${s2 && s2.unreadProposed} cells)`);

// Retry once the release can be read
failUnread = false;
if (await page.$('.gt-cons-fail .gt-cons-retry')) await page.click('.gt-cons-fail .gt-cons-retry');
await page.waitForFunction(() => !document.querySelector('.gt-cons-fail') && !!document.querySelector('.gt-cons-tbl'), null, { timeout: 30000 }).catch(() => {});
const s3 = await state();
log('after retry:', JSON.stringify(s3));
ck(s3 && !s3.failBanner && s3.failCells === 0 && s3.failIdx < 0, 'Retry reads it, and the "?" column becomes a normal one');

await page.keyboard.press('Escape');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
