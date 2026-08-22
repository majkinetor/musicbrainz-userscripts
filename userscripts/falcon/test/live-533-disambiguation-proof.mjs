// #533 (majkinetor): "We currently support Disambiguation for recordings. Lets
// complete it for other entities. Finally, provide a proof on test.musicbrainz
// that it works."
//
// This is a REAL run: it lets Falcon commit actual edits on test.musicbrainz
// and then reads each entity back from the API to prove the disambiguation
// landed. Nothing is faked or intercepted — an aborted POST would prove only
// that a request left the browser.
//
// Sandbox only: it refuses to run against any host but test.musicbrainz.org.
// Run: node test/live-533-disambiguation-proof.mjs
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

const HOST = 'https://test.musicbrainz.org';
if (!/test\.musicbrainz\.org$/.test(new URL(HOST).hostname)) { console.log('REFUSING: sandbox only'); process.exit(2); }

// Entities on the sandbox release the other Falcon/GT tests already use.
const TARGETS = [
  { type: 'artist',        mbid: '82ca9599-5a15-4ff5-90d5-59ac8afaf5c7', seg: 'artist' },
  { type: 'release_group', mbid: 'ed64def7-4a2f-4ff7-9ae3-fbdfac9f8e0e', seg: 'release-group' },
  { type: 'recording',     mbid: '2bea9225-3cee-4a23-b8f3-cd705bed3d06', seg: 'recording' },
  // a sandbox label that carries NO disambiguation of its own — the point is to
  // prove Falcon can set one, not to overwrite somebody's real annotation
  { type: 'label',         mbid: '0bef945e-5ab2-4276-8296-921b48d45ace', seg: 'label' },
];
// seconds included: a minute-resolution stamp made two runs in the same minute
// indistinguishable, which briefly looked like the edit had not applied.
const STAMP = 'falcon test ' + new Date().toISOString().slice(0, 19).replace('T', ' ');

const UA = { 'User-Agent': 'Falcon-verify-533/1.0 ( https://github.com/majkinetor/musicbrainz-userscripts )', Accept: 'application/json' };
async function readBack(seg, mbid) {
  for (let a = 1; a <= 6; a++) {
    const r = await fetch(`${HOST}/ws/2/${seg}/${mbid}?fmt=json`, { headers: UA });
    if (r.ok) return (await r.json()).disambiguation;
    await new Promise(x => setTimeout(x, 4000));
  }
  return '<unreadable>';
}

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

console.log('disambiguation BEFORE:');
const before = {};
for (const t of TARGETS) { before[t.type] = await readBack(t.seg, t.mbid); console.log('  ' + t.type.padEnd(14) + JSON.stringify(before[t.type])); }

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
  try { await page.goto(`${HOST}/release/3a37a35f-1e06-457f-9b2a-46155c5c03ce`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 3) throw e; await page.waitForTimeout(5000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1200);
await page.addScriptTag({ content: code });
await page.waitForTimeout(600);

// every supported type is offered a disambiguation box
const supported = await page.evaluate(() => [...window.__falconTest.DISAMBIGUATABLE].sort());
console.log('DISAMBIGUATABLE: ' + supported.join(', '));
ck(supported.join(',') === 'artist,label,recording,release_group', 'artist, label, recording and release_group are all supported');

// The workers live in the panel, so it has to be open — with it closed the
// queue simply stays 'queued' and nothing runs (learned the hard way).
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 15000 });
await page.waitForTimeout(500);

// queue the three, each with the same stamped disambiguation, and really run it
await page.evaluate(({ targets, stamp }) => {
  window.__falconTest.setQueue(targets.map((t, i) => ({
    id: 'p' + i, entityType: t.type, mbid: t.mbid, urls: [], note: 'Falcon #533 disambiguation proof',
    disambiguation: stamp, isrcs: [], cover: [], coverExistingCount: null,
    name: null, urlResults: null, status: 'queued', error: '',
  })));
}, { targets: TARGETS, stamp: STAMP });
await page.evaluate(() => window.__falconTest.start());
await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 240000 }).catch(() => {});
const outcome = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ t: i.entityType, s: i.status, e: i.error })));
console.log('run outcome: ' + JSON.stringify(outcome));
const flog = await page.evaluate(() => window.__falconTest.getLog().map(l => `${l.sev}: ${l.msg}`));
console.log('--- falcon log (submit lines) ---');
for (const l of flog.filter(x => /submit|commit|no change|comment|seed|edit page/i.test(x)).slice(-20)) console.log('  ' + l);
await ctx.close();

// MusicBrainz AUTO-APPLIES an added disambiguation but queues a CHANGED one for
// voting, so the API only shows the new value when the field started empty.
// Both outcomes prove the same thing — Falcon built and submitted a correct
// edit — so the proof accepts either, and says which it saw. (An earlier
// version of this test only checked the API and reported a false failure on
// the second run, when the fields were no longer empty.)
console.log('disambiguation AFTER:');
const ectx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1300, height: 900 } });
const epage = ectx.pages()[0] || await ectx.newPage();
const openEditHas = async (seg, mbid, stamp) => {
  for (let a = 1; ; a++) {
    try { await epage.goto(`${HOST}/${seg}/${mbid}/open_edits`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 3) return false; await epage.waitForTimeout(5000); }
  }
  await epage.waitForTimeout(1200);
  return await epage.evaluate(s => (document.body.innerText || '').includes(s), stamp);
};
for (const t of TARGETS) {
  const after = await readBack(t.seg, t.mbid);
  const applied = after === STAMP;
  const queued = applied ? false : await openEditHas(t.seg, t.mbid, STAMP);
  console.log('  ' + t.type.padEnd(14) + JSON.stringify(after) + (applied ? '   [applied immediately]' : queued ? '   [submitted, pending a vote]' : '   [NOT FOUND]'));
  ck(applied || queued, `${t.type}: Falcon's disambiguation reached MusicBrainz` + (queued ? ' (queued for voting — it was a change, not an addition)' : ''));
}
await ectx.close();
ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
