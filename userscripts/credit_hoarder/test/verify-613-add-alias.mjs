// #613 "+ alias" — after a manual pick whose credit isn't the artist's name or an alias.
//
// A. Background submit (right click) — a REAL write, so on test.musicbrainz.org (the
//    sanctioned sandbox) only: submit an alias to a sandbox artist, read it back from
//    the web service — present, and with NO type (majkinetor: "no type should be set").
// B. The button (production, READ-ONLY): the #605 release's review table, pick
//    "George Gershwin" by hand for the credit "George & Ira Gershwin" → "+ alias"
//    appears; a LEFT click opens MB's add-alias form pre-filled in a new tab, which the
//    test only inspects and closes (nothing is submitted on production).
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/credit_hoarder/dist/credit_hoarder.user.js', 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const UA = { 'User-Agent': 'mb-userscripts-test/1.0 ( https://github.com/majkinetor/musicbrainz-userscripts )', Accept: 'application/json' };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'Credit Hoarder', version: 't', author: 'majkinetor', homepageURL: 'https://github.com/majkinetor/musicbrainz-userscripts' } }; window.unsafeWindow = window; });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const posts = []; page.on('request', r => { if (r.method() === 'POST') posts.push(r.url()); });

// ── A. sandbox: background submit ─────────────────────────────────────────────
const SANDBOX_ARTIST = 'c321a13a-1c52-43c0-b60a-3a454cb7f9a2';   // Mocky, on test.musicbrainz.org
const aliasName = 'CH 613 alias ' + new Date().toISOString().replace(/\D/g, '').slice(0, 12);
await page.goto('https://test.musicbrainz.org/release/c16af706-4926-4248-80c5-5faee767d579/edit-relationships', { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN (sandbox)'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(3000);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => window.__creditHoarder, null, { timeout: 20000 });
const units = await page.evaluate(() => {
  const C = window.__creditHoarder;
  return {
    heldByName: C.wantsAliasButton('artist', { id: 'x', name: 'George Gershwin', aliases: [] }, 'george gershwin'),
    heldByAlias: C.wantsAliasButton('artist', { id: 'x', name: 'Abiodun', aliases: ['Don Abi'] }, 'Don Abi'),
    notHeld: C.wantsAliasButton('artist', { id: 'x', name: 'Christophe Voisin', aliases: [{ name: 'C. Voisin' }] }, 'Christophe Voisin-Boisvinet'),
    unknownAliases: C.wantsAliasButton('artist', { id: 'x', name: 'Christophe Voisin' }, 'Christophe Voisin-Boisvinet'),
    label: C.wantsAliasButton('label', { id: 'x', name: 'A', aliases: [] }, 'B'),
    va: C.wantsAliasButton('artist', { id: '89ad4ac3-39f7-470e-963a-56509c546377', name: 'Various Artists', aliases: [] }, 'VA'),
  };
});
console.log('button rules:', JSON.stringify(units));
ck(!units.heldByName && !units.heldByAlias && units.notHeld, 'button only when the credit is neither the name nor an alias');
ck(units.unknownAliases && !units.label && !units.va, 'unknown aliases (cached candidates) → button when the credit differs from the name; never for labels or special-purpose artists');
const sub = await page.evaluate(async ([mbid, name]) => { try { return { ok: true, url: await window.__creditHoarder.submitAliasBackground(mbid, name, 'Credit Hoarder #613 "+ alias" test — test.musicbrainz.org sandbox') }; } catch (e) { return { ok: false, err: e.message }; } }, [SANDBOX_ARTIST, aliasName]);
console.log('background submit:', JSON.stringify(sub));
ck(sub.ok, 'background submit accepted by MusicBrainz (landed off the form)');
await page.waitForTimeout(1500);
const aliases = await fetch(`https://test.musicbrainz.org/ws/2/artist/${SANDBOX_ARTIST}?inc=aliases&fmt=json&_=${Date.now()}`, { headers: UA }).then(r => r.json()).then(j => j.aliases || []).catch(() => []);
const mine = aliases.find(a => a.name === aliasName);
if (mine) {
  ck(true, `alias "${aliasName}" is on the artist (applied)`);
  ck(mine.type == null && !mine['type-id'], `…with no alias type (type=${JSON.stringify(mine.type)})`);
} else {
  const open = await page.evaluate(async mbid => { const h = await fetch(`/artist/${mbid}/open_edits`).then(r => r.text()); return (h.match(/Add artist alias/g) || []).length; }, SANDBOX_ARTIST);
  ck(open > 0, `alias edit is open on the artist (not auto-applied for this account) — ${open} open "Add artist alias" edit(s)`);
}

const again = await page.evaluate(async ([mbid, name]) => { try { return await window.__creditHoarder.submitAliasBackground(mbid, name, 'dup check'); } catch (e) { return { err: e.message }; } }, [SANDBOX_ARTIST, aliasName]);
ck(again && again.already === true, `submitting the same alias again → "already" and nothing submitted (no duplicate) — ${JSON.stringify(again)}`);

const pagesBefore = ctx.pages().length;
const leftDup = await page.evaluate(async ([mbid, name]) => { try { return await window.__creditHoarder.openAddAliasForm(mbid, name, 'dup check'); } catch (e) { return { err: e.message }; } }, [SANDBOX_ARTIST, aliasName]);
await page.waitForTimeout(800);
ck(leftDup && leftDup.already === true && ctx.pages().length === pagesBefore, `left click on an alias the artist already has → "already", the tab it opened is closed again (${JSON.stringify(leftDup)}, tabs ${pagesBefore}→${ctx.pages().length})`);

// ── B. production: the button in the review table (read-only) ───────────────
posts.length = 0;
await page.goto('https://musicbrainz.org/release/aba74013-0e72-4ab9-87ee-7dc82193dc35/edit-relationships', { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(3000);
await page.addScriptTag({ content: code });
await page.waitForSelector('.discogs-bar', { timeout: 30000 });
await page.waitForTimeout(1000);
await page.click('.discogs-src-ico[data-src="Discogs"]').catch(async () => { await page.click('.discogs-src-ico'); });
await page.waitForFunction(() => /Preflight done/.test(document.body.innerText), null, { timeout: 180000 });
await page.waitForTimeout(1500);
// a cached manual pick (an earlier run's) shows the button straight away
const cachedBtn = await page.evaluate(() => { const tr = [...document.querySelectorAll('tbody tr')].find(x => [...x.querySelectorAll('a,span')].some(a => a.textContent.trim() === 'George & Ira Gershwin')); return tr && /user \(cache\)/.test(tr.innerText) ? !!tr.querySelector('.discogs-add-alias') : null; });
if (cachedBtn !== null) ck(cachedBtn, 'a CACHED manual pick shows "+ alias" too');
// start clean: "Refresh from MB" re-resolves without the local cache, so the row can be picked by hand
const doneCount = await page.evaluate(() => (document.body.innerText.match(/Preflight done/g) || []).length);
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /Refresh from MB/.test(b.textContent)).click());
await page.waitForFunction(() => { const tr = [...document.querySelectorAll('tbody tr')].find(x => [...x.querySelectorAll('a,span')].some(a => a.textContent.trim() === 'George & Ira Gershwin')); return tr && !/\(cache\)/.test(tr.innerText) && /George Gershwin/.test(tr.innerText); }, null, { timeout: 180000 });
await page.waitForTimeout(1500);
// pick "George Gershwin" (a candidate on the combined row) by hand
const picked = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tbody tr')].find(x => [...x.querySelectorAll('a,span')].some(a => a.textContent.trim() === 'George & Ira Gershwin'));
  if (!tr) return 'no row';
  const cand = [...tr.querySelectorAll('div')].find(d => d.querySelector('button') && /^George Gershwin/.test((d.querySelector('a') || {}).textContent || ''));
  if (!cand) return 'no candidate: ' + tr.innerText.replace(/\s+/g, ' ').slice(0, 400);
  cand.querySelector('button').click();
  return 'ok';
});
await page.waitForTimeout(800);
const btn = await page.evaluate(() => { const b = document.querySelector('.discogs-add-alias'); if (!b) return null; const td = b.closest('td'), tds = [...td.parentElement.children]; return { text: b.textContent, title: b.title, col: tds.indexOf(td), cols: tds.length }; });
console.log('pick:', picked, '· button:', JSON.stringify(btn));
ck(picked === 'ok' && btn && btn.text === '+ alias', '"+ alias" appears after picking George Gershwin by hand for "George & Ira Gershwin"');
ck(btn && btn.col < btn.cols - 1, `"+ alias" sits in the LEFT (source) column with the other add actions, not the MB-match column (column ${btn && btn.col + 1} of ${btn && btn.cols})`);
if (btn) {
  const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), page.click('.discogs-add-alias')]);
  await popup.waitForURL(/\/add-alias\?/, { timeout: 20000 });   // it opens blank first, then goes to the form once the live-alias check passes
  await popup.waitForLoadState('domcontentloaded');
  const form = await popup.evaluate(() => ({ url: location.pathname, name: (document.querySelector('[name="edit-alias.name"]') || {}).value, sort: (document.querySelector('[name="edit-alias.sort_name"]') || {}).value, type: (document.querySelector('[name="edit-alias.type_id"]') || {}).value, note: ((document.querySelector('[name="edit-alias.edit_note"]') || {}).value || '').slice(0, 90) }));
  console.log('left click opened:', JSON.stringify(form));
  ck(/\/artist\/[0-9a-f-]{36}\/add-alias$/.test(form.url) && form.name === 'George & Ira Gershwin', 'left click: MB add-alias form for the picked artist, name pre-filled');
  ck(form.type === '' || form.type == null, 'left click: no alias type pre-selected');
  await popup.close();   // never submitted
}
ck(!posts.some(u => /musicbrainz\.org\/(artist\/[^/]+\/add-alias|ws\/js\/edit)/.test(u) && !/test\.musicbrainz/.test(u)), 'nothing submitted on production');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
