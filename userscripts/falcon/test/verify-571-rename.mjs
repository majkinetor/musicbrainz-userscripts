// #571 (majkinetor): "We should be able to change the name of the entity."
//
// The offline half. It guards the wiring, not the edit landing — the live proof
// (live-571-rename-proof.mjs) is what shows a real rename reaching MusicBrainz.
//
// Three things here are easy to get wrong and silent when you do:
//
//  1. Seeding a release. `edit-release.name=` is ignored by the KO editor
//     exactly like `edit-release.comment=` is, so a release that LOOKED seeded
//     would submit a form with no change on it and still report 'done'. That is
//     the #533 bug verbatim, which is why release is absent from NAME_SEEDS and
//     asserted absent from the seed url here.
//  2. A row carrying ONLY a rename must still be routed through the form. The
//     no-work guard skips rows with nothing in them, and a new field that guard
//     does not know about is indistinguishable from an empty row.
//  3. `rename` must not collide with `name`, which already means the entity's
//     CURRENT name everywhere in the queue and the JSON model.
//
// Nothing is submitted: every POST is aborted, and counted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

const HOST = 'https://test.musicbrainz.org';
const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

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

// ⚠ Match on the METHOD, not a url glob — a glob that stops matching once the
// url grows a query string is how real edits once escaped onto production.
let posts = [];
await page.route(() => true, route => {
  const r = route.request();
  if (r.method() === 'POST') { posts.push(r.url()); return route.abort(); }
  return route.continue();
});
const editPosts = () => posts.filter(u => /test\.musicbrainz\.org\/(ws\/js\/edit\/|.*\/edit)/.test(u));

for (let a = 1; ; a++) {
  try { await page.goto(`${HOST}/release/${RELEASE}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 3) throw e; await page.waitForTimeout(5000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1200);
await page.addScriptTag({ content: code });
await page.waitForTimeout(500);

// ── which types can be renamed, and which route each takes ──────────────────
const sets = await page.evaluate(() => ({
  renameable: [...window.__falconTest.RENAMEABLE].sort(),
  seeds: [...window.__falconTest.NAME_SEEDS].sort(),
}));
console.log('RENAMEABLE : ' + sets.renameable.join(', '));
console.log('NAME_SEEDS : ' + sets.seeds.join(', '));
ck(sets.renameable.join(',') === 'artist,label,recording,release,release_group', 'all five entity types can be renamed');
ck(sets.seeds.join(',') === 'artist,label,recording,release_group', 'four are seeded; release is not (its KO editor ignores the param)');

const seeds = await page.evaluate(() => {
  const mk = t => ({ entityType: t, mbid: '00000000-0000-0000-0000-000000000000', urls: [], isrcs: [], rename: 'Renamed X' });
  return {
    artist: window.__falconTest.buildSeedEditUrl(mk('artist')),
    rg: window.__falconTest.buildSeedEditUrl(mk('release_group')),
    release: window.__falconTest.buildSeedEditUrl(mk('release')),
  };
});
ck(seeds.artist.includes('edit-artist.name=Renamed+X'), 'an artist gets the new name seeded into the url');
ck(seeds.rg.includes('edit-release-group.name=Renamed+X'), 'a release group too, under MB\'s hyphenated form name');
ck(!/[?&](edit-release\.)?name=/.test(seeds.release), 'a release does NOT — seeding it would be a silent no-op');

// ── a rename-only row is real work, not an empty row ────────────────────────
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 15000 });
const run = async (item) => {
  await page.evaluate(i => window.__falconTest.setQueue([i]), item);
  await page.evaluate(() => window.__falconTest.start());
  await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 180000 }).catch(() => {});
  return await page.evaluate(() => {
    const i = window.__falconTest.getQueue()[0];
    return { status: i.status, error: i.error };
  });
};
const base = {
  id: 'n1', entityType: 'release', mbid: RELEASE, urls: [], note: 'Falcon #571 routing check',
  disambiguation: '', isrcs: [], cover: [], coverExistingCount: null, name: null,
  urlResults: null, status: 'queued', error: '',
};

posts = [];
const renamed = await run({ ...base, rename: 'falcon rename routing ' + Date.now() });
console.log('rename-only row: status=' + renamed.status + '  edit POSTs=' + editPosts().length);
ck(editPosts().length >= 1, `a release carrying only a rename reaches the edit form (${editPosts().length} attempt(s), all aborted here)`);
ck(renamed.status !== 'done', `and does not report success when the submit never landed (status: ${renamed.status})`);

// ── the run summary has to SAY it renamed something ─────────────────────────
// (majkinetor, on #572: "Renaming not added to status table in log".) The row
// chip, the per-item breakdown in the summary table, and the aggregate
// "worked on" line are three separate lists of the same categories — adding a
// field to one of them and not the others is the easy mistake here.
await page.waitForTimeout(1800);
// getLog() hands back formatted STRINGS, not {sev,msg} objects.
const summary = await page.evaluate(() => window.__falconTest.getLog().map(String).find(l => l.includes('run summary')) || '');
console.log('--- run summary (first lines) ---');
console.log(summary.split(String.fromCharCode(10)).slice(0, 4).join(String.fromCharCode(10)));
const sumLines = summary.split(String.fromCharCode(10));
ck(sumLines.some(l => l.includes(';') && l.includes('rename')), 'the summary table per-item breakdown says the row was renamed');
ck(sumLines.some(l => l.startsWith('worked on:') && l.includes('rename on 1')), 'and the aggregate "worked on" line counts it');

posts = [];
const blank = await run({ ...base, id: 'n2', rename: '' });
console.log('blank row      : ' + JSON.stringify(blank) + '  edit POSTs=' + editPosts().length);
ck(blank.status === 'skipped', 'an untouched row is still skipped');
ck(editPosts().length === 0, 'and never touches MusicBrainz');

// ── the JSON model: rename is importable on its own, and is not `name` ───────
const imported = await page.evaluate(() => {
  window.__falconTest.setQueue([]);
  window.__falconTest.importQueueJson(JSON.stringify({
    items: [
      { entityType: 'release_group', mbid: '11111111-1111-1111-1111-111111111111', rename: 'New RG Name' },
      { entityType: 'artist', mbid: '22222222-2222-2222-2222-222222222222', name: 'Current Artist Name' },
    ],
  }), 'test');
  return window.__falconTest.getQueue().map(i => ({ type: i.entityType, rename: i.rename, name: i.name }));
});
console.log('imported: ' + JSON.stringify(imported));
const rg = imported.find(i => i.type === 'release_group');
ck(!!rg && rg.rename === 'New RG Name', 'a row whose only payload is a rename imports as a real item');
ck(imported.length === 1, '…while a row carrying only `name` (the CURRENT name) is not work and does not import as one');

ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
