// Copies a production release to test.musicbrainz.org, so a spec that needs it can run
// on the sandbox (#625). The copy has the release's title, artist credits, type, date,
// labels, tracklist (titles, lengths, track artists) and URL relationships (so a Discogs
// link comes along), and a video recording is marked as one; not its recordings'
// relationships, which are what the scripts add.
//
//   node dev/test/copy-to-sandbox.mjs <production release mbid> [--dry] [--videos]
//
// Artists and labels are linked by MBID where the sandbox has them. An artist it lacks
// is created there first (name, sort name, type); a label it lacks is left out
// (a label typed but not selected blocks the submission); its catalogue number stays.
// Production is only read, through the web service. The new sandbox MBID is printed
// and recorded in dev/test/sandbox-copies.json.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { mbJson, PROFILE, PROD, SANDBOX, REPO } from './harness.mjs';
import { installProdGuard } from './guard.mjs';

const [mbid] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const dry = process.argv.includes('--dry');
if (!/^[0-9a-f-]{36}$/.test(mbid || '')) { console.error('usage: node dev/test/copy-to-sandbox.mjs <production release mbid> [--dry] [--videos]'); process.exit(2); }
const REGISTRY = resolve(REPO, 'dev/test/sandbox-copies.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const rel = await mbJson(`${PROD}/ws/2/release/${mbid}?inc=artist-credits+labels+recordings+url-rels+release-groups&fmt=json`);
console.log(`production: "${rel.title}" — ${rel.media.length} medium(s), ${rel.media.reduce((n, m) => n + (m.tracks || []).length, 0)} track(s)`);

// every artist the credits name, and whether the sandbox has it
const artists = new Map();
const collect = ac => (ac || []).forEach(c => artists.set(c.artist.id, c.artist));
collect(rel['artist-credit']);
rel.media.forEach(m => (m.tracks || []).forEach(t => collect(t['artist-credit'])));
const onSandbox = async (kind, id) => { await sleep(1100); try { await mbJson(`${SANDBOX}/ws/2/${kind}/${id}?fmt=json`, { tries: 3 }); return true; } catch (e) { return false; } };
const idMap = new Map();   // production artist id → sandbox artist id
// artists an earlier copy created (a new MBID each) are reused, not created again
const createdBefore = JSON.parse(await readFile(REGISTRY, 'utf8').catch(() => '{}')).artists || {};
for (const [id, a] of artists) {
  if (createdBefore[id]) { idMap.set(id, createdBefore[id]); continue; }
  if (await onSandbox('artist', id)) { idMap.set(id, id); continue; }
  idMap.set(id, null);
  console.log(`  artist missing on the sandbox: ${a.name} (${id})`);
}
const labels = [];
for (const li of rel['label-info'] || []) {
  const l = li.label;
  labels.push({ name: l ? l.name : '', mbid: l && await onSandbox('label', l.id) ? l.id : '', catno: li['catalog-number'] || '' });
}
if (dry) { console.log('dry run: nothing created'); process.exit(0); }
if (process.argv.includes('--videos')) {
  const copy = (JSON.parse(await readFile(REGISTRY, 'utf8'))[mbid] || {}).sandbox;
  if (!copy) { console.error('no sandbox copy of ' + mbid + ' in the registry'); process.exit(1); }
  await markVideos(copy);
  process.exit(0);
}

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1500, height: 1000 } });
await installProdGuard(ctx);   // this writes to the sandbox only
const page = ctx.pages()[0] || await ctx.newPage();
const submitForm = (action, fields) => page.evaluate(([action, fields]) => {
  const f = document.createElement('form'); f.method = 'POST'; f.action = action;
  for (const [k, v] of fields) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i); }
  document.body.appendChild(f); f.submit();
}, [action, fields]);
await page.goto(SANDBOX + '/', { waitUntil: 'domcontentloaded' });
if (!(await page.evaluate(() => !!document.querySelector('a[href*="/logout"]')))) { console.error('not logged in to the sandbox (node dev/test/login.mjs)'); await ctx.close(); process.exit(3); }

// create the artists the sandbox lacks
for (const [id, a] of artists) {
  if (idMap.get(id)) continue;
  const full = await mbJson(`${PROD}/ws/2/artist/${id}?fmt=json`);
  const TYPE = { Person: 1, Group: 2, Other: 3, Character: 4, Orchestra: 5, Choir: 6 };
  await page.goto(`${SANDBOX}/artist/create?` + new URLSearchParams({
    'edit-artist.name': full.name, 'edit-artist.sort_name': full['sort-name'] || full.name,
    'edit-artist.comment': full.disambiguation || '', 'edit-artist.type_id': String(TYPE[full.type] || ''),
    'edit-artist.edit_note': `Test fixture: a copy of ${PROD}/artist/${id} for ${PROD}/release/${mbid} (mb-userscripts #625).`,
  }), { waitUntil: 'domcontentloaded' });
  await Promise.all([page.waitForURL(/\/artist\/[0-9a-f-]{36}$/, { timeout: 60000 }), page.click('button.submit, button[type=submit]:has-text("Enter edit")')]);
  const newId = page.url().match(/artist\/([0-9a-f-]{36})/)[1];
  idMap.set(id, newId);
  const reg0 = JSON.parse(await readFile(REGISTRY, 'utf8').catch(() => '{}'));
  (reg0.artists = reg0.artists || {})[id] = newId;
  await writeFile(REGISTRY, JSON.stringify(reg0, null, 2) + '\n');
  console.log(`  created ${full.name} on the sandbox: ${newId}`);
}

// Each url needs its link type, by numeric id. The web service names types by gid; the
// release editor's page maps one to the other.
await page.goto(`${SANDBOX}/release/add`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.MB && MB.linkedEntities && Object.keys(MB.linkedEntities.link_type || {}).length, null, { timeout: 60000 }).catch(() => {});
const urlRels = (rel.relations || []).filter(r => r.url);
const typeIds = await page.evaluate(gids => gids.map(g => { const t = Object.values((window.MB && MB.linkedEntities && MB.linkedEntities.link_type) || {}).find(x => x.gid === g); return t ? t.id : null; }), urlRels.map(r => r['type-id']));

// seed the release editor
const f = [];
const add = (k, v) => { if (v != null && v !== '') f.push([k, String(v)]); };
const acFields = (prefix, ac) => (ac || []).forEach((c, i) => {
  add(`${prefix}.names.${i}.name`, c.name);
  add(`${prefix}.names.${i}.mbid`, idMap.get(c.artist.id));
  add(`${prefix}.names.${i}.join_phrase`, c.joinphrase);
});
add('name', rel.title);
add('comment', rel.disambiguation);
acFields('artist_credit', rel['artist-credit']);
add('type', rel['release-group'] && rel['release-group']['primary-type']);
(rel['release-group'] && rel['release-group']['secondary-types'] || []).forEach(t => add('type', t));
add('status', rel.status);
add('barcode', rel.barcode);
add('packaging', rel.packaging);
if (rel.date) { const [y, m, d] = rel.date.split('-'); add('events.0.date.year', y); add('events.0.date.month', m); add('events.0.date.day', d); }
labels.forEach((l, i) => { add(`labels.${i}.mbid`, l.mbid); if (!l.mbid && l.name) console.log(`  label missing on the sandbox, left out: ${l.name}`); add(`labels.${i}.catalog_number`, l.catno); });
rel.media.forEach((m, i) => {
  add(`mediums.${i}.format`, m.format);
  add(`mediums.${i}.name`, m.title);
  (m.tracks || []).forEach((t, j) => {
    add(`mediums.${i}.track.${j}.name`, t.title);
    add(`mediums.${i}.track.${j}.number`, t.number);
    add(`mediums.${i}.track.${j}.length`, t.length);
    acFields(`mediums.${i}.track.${j}.artist_credit`, t['artist-credit']);
  });
});
urlRels.forEach((r, i) => { add(`urls.${i}.url`, r.url.resource); add(`urls.${i}.link_type`, typeIds[i]); });
add('edit_note', `Test fixture: a copy of ${PROD}/release/${mbid} for the mb-userscripts test suite (#625).`);
await submitForm(`${SANDBOX}/release/add`, f);
await page.waitForURL(/\/release\/add/, { timeout: 60000 });
await page.waitForFunction(() => window.MB && MB.releaseEditor && MB.releaseEditor.rootField, null, { timeout: 60000 });
await page.waitForTimeout(2000);

// submit: the last tab holds "Enter edit"
await page.click('a[href="#edit-note"]').catch(() => {});
await page.waitForTimeout(1000);
// the editor keeps every message in the page; only the shown ones are about this release
const errors = await page.evaluate(() => [...new Set([...document.querySelectorAll('.error, .field-error')].filter(e => e.offsetParent && e.textContent.trim()).map(e => e.textContent.trim()))].slice(0, 10));
if (errors.length) console.log('  editor says:', errors.join(' | '));
if (await page.locator('#enter-edit[disabled]').count()) {
  const why = await page.evaluate(() => {
    // an error the editor shows: not hidden by its binding, on whichever tab it sits
    const shown = e => { for (let n = e; n && n.id !== 'release-editor'; n = n.parentElement) if (n.style && n.style.display === 'none' && !n.classList.contains('ui-tabs-panel')) return false; return true; };
    return [...document.querySelectorAll('#release-editor .error, #release-editor .field-error')].filter(shown)
      .map(e => `${(e.closest('.ui-tabs-panel') || {}).id}: ${e.textContent.trim().slice(0, 120)}`).filter(s => !/: $/.test(s)).slice(0, 8);
  });
  console.log('  "Enter edit" is disabled:', JSON.stringify(why));
}
await Promise.all([
  page.waitForURL(/\/release\/[0-9a-f-]{36}$/, { timeout: 120000 }).catch(() => {}),
  page.click('button:has-text("Enter edit")'),
]);
const created = (page.url().match(/\/release\/([0-9a-f-]{36})$/) || [])[1];
await ctx.close();
if (!created) { console.error('the release editor did not submit'); process.exit(1); }

const reg = JSON.parse(await readFile(REGISTRY, 'utf8').catch(() => '{}'));
// the copy's release group is a new one too: a spec's replay maps it back to production's
const rg = await mbJson(`${SANDBOX}/ws/2/release/${created}?inc=release-groups&fmt=json`).then(j => j['release-group'].id).catch(() => null);
reg[mbid] = { sandbox: created, title: rel.title, copied: new Date().toISOString().slice(0, 10), ...(rg ? { rg, prodRg: rel['release-group'].id } : {}) };
await writeFile(REGISTRY, JSON.stringify(reg, null, 2) + '\n');
console.log(`sandbox copy: ${SANDBOX}/release/${created}`);
await markVideos(created);

// The release editor makes every recording a plain audio one; a production recording
// that is a video is marked so on the copy, one recording edit each. --videos does only
// this, for a copy made before.
async function markVideos(copy) {
  const videos = [];
  rel.media.forEach((m, i) => (m.tracks || []).forEach((t, j) => { if (t.recording && t.recording.video) videos.push([i, j]); }));
  if (!videos.length) return;
  const sb = await mbJson(`${SANDBOX}/ws/2/release/${copy}?inc=recordings&fmt=json`);
  const vctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1500, height: 1000 } });
  await installProdGuard(vctx);
  const vpage = vctx.pages()[0] || await vctx.newPage();
  for (const [i, j] of videos) {
    const rec = sb.media[i].tracks[j].recording;
    if (rec.video) continue;
    await vpage.goto(`${SANDBOX}/recording/${rec.id}/open_edits`, { waitUntil: 'load' });
    if (!(await vpage.locator('a[href*="/test/accept-edit/"]').count())) {   // not asked before
      await vpage.goto(`${SANDBOX}/recording/${rec.id}/edit`, { waitUntil: 'load' });
      await vpage.check('[id="id-edit-recording.video"]');
      await vpage.fill('[id="id-edit-recording.edit_note"]', `Test fixture: a video on ${PROD}/release/${mbid}, as on production (#625).`);
      await Promise.all([vpage.waitForURL(/\/recording\/[0-9a-f-]{36}$/, { timeout: 60000 }), vpage.click('button[type=submit]:has-text("Enter edit")')]);
      await vpage.goto(`${SANDBOX}/recording/${rec.id}/open_edits`, { waitUntil: 'load' });
    }
    // an edit to a recording waits for votes; the sandbox lets its editor accept it
    for (const href of await vpage.$$eval('a[href*="/test/accept-edit/"]', as => as.map(a => a.href))) await vpage.goto(href, { waitUntil: 'load' });
    console.log(`  marked a video: ${rec.title} (${rec.id})`);
  }
  await vctx.close();
}
