// #587 (majkinetor): "Revert it. If there is no way to get pending status while
// getting ISRC, we wont do any more requests to MB and will not have this
// feature. Add to memory that ANY NEW MB REQUEST MUST BE VERIFIED WITH ME.
// Remembering is not good idea as this is colaborative space."
//
// This replaces the test for the behaviour he rejected. It guards the
// instruction itself, in both halves:
//
//   1. NO extra request. Every URL the script asks for during a removal batch is
//      recorded, and /open_edits (or anything else per-recording beyond the edit
//      form it must POST to) must not be among them.
//   2. NO remembering. The ⏳ is in-session only — after a reload the table comes
//      back with no pending markers and nothing left in storage, because by then
//      only MusicBrainz knows what became of the edit.
//
// Writes are blocked at GM_xmlhttpRequest, the script's only transport: real
// GETs, fabricated POST responses, nothing sent.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.II_SRC || resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const REL = process.env.REL || 'bef3dc66-8cfc-4ff1-9053-0d0a5f30f2b3';   // 10 tracks, 10 ISRCs

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1700, height: 1000 } });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => (s.has(k) ? s.get(k) : d);
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_info = { script: { name: 'ISRC Scout', version: 't' } };
  try { Object.keys(localStorage).filter(k => /pending_removals_/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
  window.__urls = [];     // every URL the script asks for, survives a reload
  try { window.__urls = JSON.parse(sessionStorage.getItem('ii-urls') || '[]'); } catch (e) {}
  const note = u => { window.__urls.push(u); try { sessionStorage.setItem('ii-urls', JSON.stringify(window.__urls)); } catch (e) {} };
  window.GM_xmlhttpRequest = (o) => {
    const done = r => { try { (o.onload || (() => {}))(r); } catch (e) {} };
    note(((o.method || 'GET').toUpperCase()) + ' ' + o.url);
    if ((o.method || 'GET').toUpperCase() === 'POST') {
      setTimeout(() => done({ status: 200, responseText: '<html></html>', finalUrl: String(o.url).replace(/\/edit$/, ''), responseHeaders: '' }), 200);
      return { abort() {} };
    }
    fetch(o.url, { method: 'GET', headers: o.headers || {}, credentials: 'include' })
      .then(async r => done({ status: r.status, responseText: await r.text(), finalUrl: r.url, responseHeaders: '' }))
      .catch(e => { try { (o.onerror || (() => {}))(e); } catch (_) {} });
    return { abort() {} };
  };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.accept());
const escaped = [];
page.on('request', r => { if (r.method() === 'POST' && /musicbrainz\.org/i.test(r.url())) escaped.push(r.url()); });

const openModal = async () => {
  await page.waitForSelector('#ii-btn', { state: 'attached', timeout: 25000 });
  await page.evaluate(() => document.getElementById('ii-btn').click());
  await page.waitForSelector('.ii-ex-del, .ii-ex-pending', { state: 'attached', timeout: 120000 });
  await page.waitForTimeout(1200);
};

await page.goto(`https://musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.addScriptTag({ content: code });
await openModal();

// remove two ISRCs
const picked = await page.evaluate(() => {
  const seen = new Set(); const out = [];
  for (const cb of document.querySelectorAll('.ii-ex-del')) {
    const tr = cb.closest('tr[data-idx]'); if (!tr || seen.has(tr.dataset.idx)) continue;
    seen.add(tr.dataset.idx);
    cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
    out.push(cb.dataset.isrc);
    if (out.length === 2) break;
  }
  return out;
});
ck(picked.length === 2, `checked two ISRCs to remove (${picked.length})`);
await page.evaluate(() => document.querySelector('#ii-delete').click());
await page.waitForFunction(() => !document.querySelector('#ii-delete.ii-busy'), null, { timeout: 60000 });
await page.waitForTimeout(800);

const during = await page.evaluate(() => ({
  pending: document.querySelectorAll('.ii-ex-pending').length,
  urls: window.__urls.slice(),
}));
console.log('\nrequests made during the session:');
during.urls.forEach(u => console.log('   ' + u.slice(0, 120)));
ck(during.pending === 2, `both removals are marked ⏳ in the session that submitted them (${during.pending})`);
ck(!during.urls.some(u => /open_edits/.test(u)), 'no /open_edits request was made — the pending state is not verified against MB');
const perRec = during.urls.filter(u => /\/recording\/[0-9a-f-]{36}\//i.test(u));
ck(perRec.every(u => /\/edit$/.test(u.replace(/^\w+ /, ''))), `the only per-recording requests are the edit forms the removal must POST to (${perRec.length})`);
/* Categorise rather than count to a magic number. The release used to be fetched
   TWICE on open — the overview primes the button on load, and a click while that
   was still in flight started a second identical request. majkinetor: "Dedup it."
   It is now one, and that is asserted rather than noted. */
const gets = during.urls.filter(u => u.startsWith('GET'));
const relGets = gets.filter(u => /\/ws\/2\/release\//.test(u));
const formGets = gets.filter(u => /\/recording\/[0-9a-f-]{36}\/edit$/.test(u));
const otherGets = gets.filter(u => !relGets.includes(u) && !formGets.includes(u));
console.log(`GETs: ${relGets.length} release, ${formGets.length} edit form, ${otherGets.length} other`);
ck(formGets.length === picked.length, `exactly one edit form per removal (${formGets.length} for ${picked.length})`);
ck(otherGets.length === 0, `nothing else was fetched at all (${JSON.stringify(otherGets)})`);
ck(relGets.length === 1, `the release JSON is fetched ONCE, not once per caller (${relGets.length})`);

// …and after a reload the script has forgotten, because only MB knows now
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.addScriptTag({ content: code });
await openModal();
const after = await page.evaluate(() => ({
  pending: document.querySelectorAll('.ii-ex-pending').length,
  stored: Object.keys(localStorage).filter(k => /pending_removals_/.test(k)),
  urls: window.__urls.slice(),
}));
console.log('\nafter reload:', JSON.stringify({ pending: after.pending, stored: after.stored }));
ck(after.pending === 0, `the ⏳ does not survive a reload (${after.pending}) — no local belief about server state`);
ck(after.stored.length === 0, `nothing was written to storage to replay (${JSON.stringify(after.stored)})`);
ck(!after.urls.some(u => /open_edits/.test(u)), 'still no /open_edits request after the reload');

ck(escaped.length === 0, `no POST reached MusicBrainz (${escaped.length})`);
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
