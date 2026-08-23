// #535 (majkinetor): "One cool test would be to load a random release on
// test.musicbrainz and create 2 translations in different locales for the all
// recordings, using a single JSON (also provide JSON)."
//
// That is exactly what this does, and it is a REAL run — Falcon submits actual
// edits on test.musicbrainz and every alias is read back from the API
// afterwards. Nothing is intercepted.
//
// The JSON it builds is written to test/_535-aliases.json so it can be handed
// over as the worked example.
//
// Sandbox only: refuses to run against any host but test.musicbrainz.org.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

const HOST = 'https://test.musicbrainz.org';
if (!/test\.musicbrainz\.org$/.test(new URL(HOST).hostname)) { console.log('REFUSING: sandbox only'); process.exit(2); }
const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const UA = { 'User-Agent': 'Falcon-verify-535/1.0 ( https://github.com/majkinetor/musicbrainz-userscripts )', Accept: 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

async function ws2(path) {
  for (let a = 1; a <= 6; a++) {
    try { const r = await fetch(`${HOST}/ws/2/${path}`, { headers: UA }); if (r.ok) return await r.json(); }
    catch (e) { /* the sandbox drops connections under load */ }
    await sleep(2500 * a);
  }
  return null;
}

// ── build the JSON: two locales per recording, one file ─────────────────────
const rel = await ws2(`release/${RELEASE}?inc=recordings&fmt=json`);
if (!rel) { console.log('could not read the release'); process.exit(3); }
const recs = (rel.media || []).flatMap(m => (m.tracks || []).map(t => ({ id: t.recording.id, title: t.recording.title })));
console.log(`release "${rel.title}" — ${recs.length} recording(s)`);
// A stamp keeps re-runs distinguishable; MB rejects an identical alias twice.
const STAMP = new Date().toISOString().slice(11, 16).replace(':', '');
const payload = {
  falcon: 'example',
  exported: new Date().toISOString(),
  items: recs.map(r => ({
    entityType: 'recording', mbid: r.id, name: r.title, note: 'Falcon #535 alias proof',
    urls: [],
    aliases: [
      { name: `${r.title} (wersja polska ${STAMP})`, locale: 'pl', type: 'Recording name', primary: true },
      { name: `${r.title} (deutsche Fassung ${STAMP})`, locale: 'de', type: 'Recording name', primary: true },
    ],
  })),
};
const SAMPLE = resolve(HERE, '_535-aliases.json');
await writeFile(SAMPLE, JSON.stringify(payload, null, 2), 'utf8');
console.log(`wrote ${SAMPLE} — ${payload.items.length} item(s), ${payload.items.length * 2} alias(es)`);

const beforeCounts = {};
for (const r of recs) {
  const j = await ws2(`recording/${r.id}?inc=aliases&fmt=json`);
  beforeCounts[r.id] = ((j && j.aliases) || []).length;
  await sleep(1200);
}
console.log('aliases BEFORE: ' + JSON.stringify(beforeCounts));

// ── run it through Falcon, for real ─────────────────────────────────────────
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_deleteValue = k => s.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
for (let a = 1; ; a++) {
  try { await page.goto(`${HOST}/release/${RELEASE}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 3) throw e; await page.waitForTimeout(5000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1200);
await page.addScriptTag({ content: code });
await page.waitForTimeout(600);

// the JSON really is the interface: import the file as written
const imported = await page.evaluate(t => window.__falconTest.importQueueJson(t, '_535-aliases.json'), JSON.stringify(payload));
console.log('import: ' + JSON.stringify(imported));
ck(imported.added === recs.length, `the single JSON imported every recording (${imported.added}/${recs.length})`);
const queuedAliases = await page.evaluate(() => window.__falconTest.getQueue().reduce((n, i) => n + (i.aliases || []).length, 0));
ck(queuedAliases === recs.length * 2, `carrying two aliases each (${queuedAliases}/${recs.length * 2})`);

await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 15000 });
await page.waitForTimeout(500);
await page.evaluate(() => window.__falconTest.start());
await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 300000 }).catch(() => {});
const outcome = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ n: i.name, s: i.status, a: i.aliasResults, e: i.error })));
console.log('run outcome:');
outcome.forEach(o => console.log(`  ${o.s.padEnd(8)} ${o.a ? `${o.a.ok}/${o.a.total} aliases` : 'no alias run'}  ${o.n}${o.e ? '  — ' + o.e : ''}`));
ck(outcome.every(o => o.s === 'done'), 'every row reports done');
ck(outcome.every(o => o.a && o.a.ok === 2 && !o.a.errors.length), 'and each added both of its aliases');
await ctx.close();

// ── read every alias back from MusicBrainz ──────────────────────────────────
// An added alias is an auto-edit, so it should be live immediately.
let withBoth = 0;
const missing = [];
for (const r of recs) {
  const j = await ws2(`recording/${r.id}?inc=aliases&fmt=json`);
  const list = (j && j.aliases) || [];
  const pl = list.find(a => a.locale === 'pl' && a.name.includes(STAMP));
  const de = list.find(a => a.locale === 'de' && a.name.includes(STAMP));
  if (pl && de) withBoth++; else missing.push(`${r.title}: pl=${!!pl} de=${!!de}`);
  console.log(`  ${r.title}: ${list.length} alias(es) total, this run -> pl:${pl ? JSON.stringify(pl.name) : 'MISSING'} de:${de ? JSON.stringify(de.name) : 'MISSING'}`);
  if (pl) ck(pl.type === 'Recording name' && pl.primary === true, `  the pl alias kept its type and primary flag (type=${pl.type}, primary=${pl.primary})`);
  await sleep(1200);
}
ck(withBoth === recs.length, `all ${recs.length} recording(s) now carry both translations (${withBoth})`);
if (missing.length) missing.forEach(m => console.log('  MISSING ' + m));
// ── re-running the SAME JSON must add nothing ───────────────────────────────
// majkinetor: "One scary issue is that MB allows total duplicates, so spamming
// is possible." Confirmed — MB creates a second identical alias without a
// murmur. This is the guard against it, and it is checked against the API
// (alias COUNT before and after), not just against what Falcon reports.
{
  const countAliases = async () => {
    let n = 0;
    for (const r of recs) { const j = await ws2(`recording/${r.id}?inc=aliases&fmt=json`); n += ((j && j.aliases) || []).length; await sleep(1200); }
    return n;
  };
  const countBefore = await countAliases();
  const rerunCtx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
  await rerunCtx.addInitScript(() => {
    const s = new Map();
    window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
    window.GM_setValue = (k, v) => s.set(k, v);
    window.GM_deleteValue = k => s.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const rp = rerunCtx.pages()[0] || await rerunCtx.newPage();
  for (let a = 1; ; a++) {
    try { await rp.goto(`${HOST}/release/${RELEASE}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 3) throw e; await rp.waitForTimeout(5000); }
  }
  await rp.waitForTimeout(1000);
  await rp.addScriptTag({ content: code });
  await rp.waitForTimeout(500);
  await rp.evaluate(t => window.__falconTest.importQueueJson(t, 'rerun'), JSON.stringify(payload));
  await rp.click('#falcon-launcher');
  await rp.waitForSelector('#falcon-panel', { timeout: 15000 });
  await rp.evaluate(() => window.__falconTest.start());
  await rp.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 300000 }).catch(() => {});
  const rerun = await rp.evaluate(() => window.__falconTest.getQueue().map(i => ({ s: i.status, a: i.aliasResults })));
  console.log('re-run outcome: ' + JSON.stringify(rerun));
  await rerunCtx.close();
  ck(rerun.every(o => o.a && o.a.ok === 0 && o.a.dupes === 2), 'a second run of the same JSON submits nothing — every alias is recognised as already present');
  ck(rerun.every(o => o.s === 'skipped'), 'and the rows report skipped, not done');
  const countAfter = await countAliases();
  console.log(`alias count across the ${recs.length} recordings: before re-run ${countBefore}, after ${countAfter}`);
  ck(countAfter === countBefore, `MusicBrainz gained no duplicates (${countBefore} -> ${countAfter})`);
}

// ── aliases are not a recording-only feature ────────────────────────────────
// majkinetor: "I think they work the same on all entities although some have
// different enums (e.g. recordings doesn't have legal name type)". Proving one
// other type end-to-end, with a type name that ONLY exists there, catches the
// case where the type <select> is read from the wrong entity's form.
const ARTIST = '82ca9599-5a15-4ff5-90d5-59ac8afaf5c7';
const ctx2 = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx2.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_deleteValue = k => s.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const p2 = ctx2.pages()[0] || await ctx2.newPage();
const errs2 = []; p2.on('pageerror', e => errs2.push(e.message));
for (let a = 1; ; a++) {
  try { await p2.goto(`${HOST}/artist/${ARTIST}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 3) throw e; await p2.waitForTimeout(5000); }
}
await p2.waitForTimeout(1000);
await p2.addScriptTag({ content: code });
await p2.waitForTimeout(500);

// "Legal name" exists for an artist and does NOT for a recording
const typeProbe = await p2.evaluate(async (mbid) => {
  const out = {};
  for (const [kind, seg, id] of [['artist', 'artist', mbid], ['recording', 'recording', '2bea9225-3cee-4a23-b8f3-cd705bed3d06']]) {
    const html = await fetch(`${location.origin}/${seg}/${id}/add-alias`, { credentials: 'same-origin' }).then(r => r.text());
    const doc = new DOMParser().parseFromString(html, 'text/html');
    out[kind] = window.__falconTest.resolveAliasTypeId(doc, 'Legal name');
  }
  return out;
}, ARTIST);
console.log('type resolution: ' + JSON.stringify(typeProbe));
ck(!!typeProbe.artist.id, 'an artist alias can be typed "Legal name"');
ck(!typeProbe.recording.id && /unknown alias type/i.test(typeProbe.recording.why || ''), 'a recording cannot, and says so instead of guessing an id');

// "Artist name", not "Search hint" — only a name-type alias keeps a locale.
const artistAlias = `Falcon Test Artist Alias ${STAMP}`;
const artistRun = await p2.evaluate(async ({ mbid, name }) => {
  const item = { id: 'a1', entityType: 'artist', mbid, name: null, note: 'Falcon #535 alias proof', urls: [], disambiguation: '', isrcs: [], video: false, cover: [], aliases: [{ name, locale: 'pl', type: 'Artist name', primary: false, sortName: '', begin: '', end: '', ended: false }], status: 'queued', error: '' };
  return await window.__falconTest.runAliasItem(item, '[test]', null);
}, { mbid: ARTIST, name: artistAlias });
console.log('artist alias run: ' + JSON.stringify(artistRun));
ck(artistRun.ok === 1 && !artistRun.errors.length, 'an artist alias submits through the same path');

// ── MB silently drops locale on a Search hint ───────────────────────────────
// Measured on the sandbox: the identical POST stores locale "pl" under type
// "Artist name" and null under "Search hint" — MB says nothing about it. Falcon
// warns and stops sending the field, so the queue never shows a localised alias
// that MusicBrainz actually stored locale-less.
const hintName = `Falcon Test Search Hint ${STAMP}`;
const hintRun = await p2.evaluate(async ({ mbid, name }) => {
  const logBefore = window.__falconTest.getLog().length;
  const item = { id: 'a3', entityType: 'artist', mbid, name: null, note: 'Falcon #535 alias proof (search hint)', urls: [], disambiguation: '', isrcs: [], video: false, cover: [], aliases: [{ name, locale: 'pl', type: 'Search hint', primary: true, sortName: '', begin: '', end: '', ended: false }], status: 'queued', error: '' };
  const res = await window.__falconTest.runAliasItem(item, '[test]', null);
  // the log is an array of plain strings
  return { res, warned: window.__falconTest.getLog().slice(logBefore).filter(l => /ignores locale/i.test(String(l))) };
}, { mbid: ARTIST, name: hintName });
console.log('search-hint run: ' + JSON.stringify(hintRun.res) + '  warnings: ' + JSON.stringify(hintRun.warned));
ck(hintRun.res.ok === 1, 'a Search hint alias still submits');
ck(hintRun.warned.length === 1, 'and Falcon warns that MusicBrainz will not keep its locale');
await ctx2.close();

const artistBack = await ws2(`artist/${ARTIST}?inc=aliases&fmt=json`);
const found = ((artistBack && artistBack.aliases) || []).find(a => a.name === artistAlias);
console.log('artist alias read back: ' + JSON.stringify(found && { name: found.name, locale: found.locale, type: found.type }));
ck(!!found && found.type === 'Artist name' && found.locale === 'pl', 'and MusicBrainz stored it with the right type and locale');

ck(errs2.length === 0, 'no page errors on the artist pass (' + errs2.join(' | ') + ')');
ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
