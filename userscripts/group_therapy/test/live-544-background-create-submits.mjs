// #544 follow-up (majkinetor): "When creating in the background, it doesn't
// click Enter in 2nd tab."
//
// A seeded /<kind>/create URL only PRE-FILLS the form. In the foreground you see
// it and press Enter; a background tab just sits there, so the entity is never
// created and the text parser waits out its full ten minutes for a post-back
// that cannot come.
//
// Two halves:
//   1. the guards, with every POST aborted — it must NOT submit a create page
//      the user opened themselves, a stale one, or one it already pressed once;
//   2. a REAL create on test.musicbrainz.org, read back from MusicBrainz, since
//      an intercepted POST only proves a request left the browser.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'group_therapy.user.js'), 'utf8');

const HOST = 'https://test.musicbrainz.org';
const TOKEN = 'tok544' + Math.random().toString(36).slice(2, 7);
const NAME = 'GT Probe ' + Date.now().toString(36);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 950 } });
await ctx.addInitScript(() => {
  // real, shared across loads — the pending record has to survive a navigation
  window.GM_getValue = (k, d) => { const v = localStorage.getItem('gmtest:' + k); return v === null ? d : JSON.parse(v); };
  window.GM_setValue = (k, v) => localStorage.setItem('gmtest:' + k, JSON.stringify(v));
  window.GM_deleteValue = k => localStorage.removeItem('gmtest:' + k);
  window.GM_info = { script: { name: 'Group Therapy', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));

const seedUrl = (extra) => `${HOST}/artist/create?` + new URLSearchParams(Object.assign({
  'edit-artist.name': NAME,
  'edit-artist.sort_name': NAME,
  'edit-artist.type_id': '1',
  'edit-artist.edit_note': 'Group Therapy probe for #544',
}, extra)).toString();

const goto = async (url) => {
  for (let a = 1; ; a++) {
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); return; }
    catch (e) { if (a >= 4) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
  }
};
const setPending = (rec) => page.evaluate(r => window.GM_setValue('gt:pendingCreate', JSON.stringify(r)), rec);
const getPending = () => page.evaluate(() => { try { return JSON.parse(window.GM_getValue('gt:pendingCreate', '') || 'null'); } catch (e) { return null; } });

/* ── half one: the guards, nothing may be submitted ───────────────────────── */
let posts = [];
const blockRoute = route => {
  const r = route.request();
  if (r.method() === 'POST' && /musicbrainz/.test(r.url())) { posts.push(r.url()); return route.abort(); }
  return route.continue();
};
await page.route(() => true, blockRoute);

await goto(`${HOST}/`);
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }

const cases = [
  ['no pending create at all', null, seedUrl({ x_gtcreate: TOKEN })],
  ['a create the user opened by hand (no x_gtcreate)', { kind: 'artist', token: TOKEN, ts: Date.now() }, seedUrl({})],
  ['a different token', { kind: 'artist', token: 'someoneelse', ts: Date.now() }, seedUrl({ x_gtcreate: TOKEN })],
  ['a stale pending create (20 min old)', { kind: 'artist', token: TOKEN, ts: Date.now() - 20 * 60 * 1000 }, seedUrl({ x_gtcreate: TOKEN })],
  ['one it has already pressed once', { kind: 'artist', token: TOKEN, ts: Date.now(), submitted: true }, seedUrl({ x_gtcreate: TOKEN })],
  ['a pending create for a different entity type', { kind: 'label', token: TOKEN, ts: Date.now() }, seedUrl({ x_gtcreate: TOKEN })],
];
for (const [what, pending, url] of cases) {
  posts = [];
  await goto(`${HOST}/`);
  if (pending) await setPending(pending); else await page.evaluate(() => window.GM_deleteValue('gt:pendingCreate'));
  await goto(url);
  await page.addScriptTag({ content: code });
  await page.waitForTimeout(2500);
  ck(posts.length === 0, `does not submit: ${what}` + (posts.length ? ' — POSTed ' + posts[0] : ''));
}

// and the case it SHOULD act on — still with POSTs blocked, so nothing is created
posts = [];
await goto(`${HOST}/`);
await setPending({ kind: 'artist', token: TOKEN, ts: Date.now() });
await goto(seedUrl({ x_gtcreate: TOKEN }));
await page.addScriptTag({ content: code });
await page.waitForTimeout(3000);
console.log('POSTs on the matching case: ' + JSON.stringify(posts));
ck(posts.length === 1, `it DOES press Enter on the create it opened itself (${posts.length} POST)`);
// ⚠ Read the record from a REAL page. Aborting the form POST leaves an
// opaque-origin error document behind, where localStorage access throws — which
// silently read back as "no pending record" and looked like a product bug.
await goto(`${HOST}/`);
const after = await getPending();
console.log('pending after the click: ' + JSON.stringify(after));
ck(!!after && after.submitted === true, 'and marks it submitted, so a duplicate-check page cannot make it click again');

/* ── half two: a real create, read back from MusicBrainz ──────────────────── */
await page.unrouteAll();
const created = [];
page.on('framenavigated', f => { if (f === page.mainFrame()) created.push(f.url()); });
await goto(`${HOST}/`);
await setPending({ kind: 'artist', token: TOKEN, ts: Date.now() });
await goto(seedUrl({ x_gtcreate: TOKEN }));
await page.addScriptTag({ content: code });
await page.waitForURL(/\/artist\/[0-9a-f-]{36}/, { timeout: 60000 }).catch(() => {});
const landed = page.url();
console.log('landed on: ' + landed);
const gid = (landed.match(/\/artist\/([0-9a-f-]{36})/) || [])[1];
ck(!!gid, 'pressing Enter really created the artist — MusicBrainz redirected to its page');

if (gid) {
  const ws = await page.evaluate(async (g) => {
    const r = await fetch(`/ws/2/artist/${g}?fmt=json`, { headers: { Accept: 'application/json' } });
    return r.ok ? r.json() : null;
  }, gid);
  console.log('MusicBrainz says: ' + JSON.stringify(ws && { id: ws.id, name: ws.name, sort: ws['sort-name'], type: ws.type }));
  ck(!!ws && ws.name === NAME, `and MusicBrainz has it under the seeded name — ${JSON.stringify(ws && ws.name)}`);
  ck(!!ws && ws.type === 'Person', 'with the seeded type');
}

console.log('nav trail: ' + JSON.stringify(created.slice(-3)));
ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
