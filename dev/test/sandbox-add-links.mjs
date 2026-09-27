// Adds to a sandbox release the URL relationships its production counterpart has and
// it lacks (#625). test.musicbrainz.org's data is an older copy of production, so a
// fixture release can be missing the link a script imports from (a Discogs release,
// say). Its other relationships are left as they are, which is the point of using
// the existing release rather than copy-to-sandbox.mjs.
//
//   node dev/test/sandbox-add-links.mjs <release mbid (the same on both)> [--dry]
//
// Production is only read, through the web service.
import { chromium } from '@playwright/test';
import { mbJson, PROFILE, PROD, SANDBOX } from './harness.mjs';
import { installProdGuard } from './guard.mjs';

const [mbid] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const dry = process.argv.includes('--dry');
if (!/^[0-9a-f-]{36}$/.test(mbid || '')) { console.error('usage: node dev/test/sandbox-add-links.mjs <release mbid> [--dry]'); process.exit(2); }

const rels = async host => ((await mbJson(`${host}/ws/2/release/${mbid}?inc=url-rels&fmt=json`)).relations || []).filter(r => r.url);
const urls = async host => (await rels(host)).map(r => r.url.resource);
const prodRels = await rels(PROD);
const prod = prodRels.map(r => r.url.resource);
await new Promise(r => setTimeout(r, 1100));
const have = new Set(await urls(SANDBOX));
const missing = [...new Set(prod.filter(u => !have.has(u)))];
console.log(`production has ${prod.length} link(s), the sandbox lacks ${missing.length}: ${missing.join(' ') || '-'}`);
if (!missing.length || dry) process.exit(0);

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1500, height: 1000 } });
await installProdGuard(ctx);   // this writes to the sandbox only
const page = ctx.pages()[0] || await ctx.newPage();
// The edit page's external-links editor reads seeded urls, but each needs its link type,
// by numeric id. The web service names types by gid; the page maps one to the other.
await page.goto(`${SANDBOX}/release/${mbid}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.error('not logged in to the sandbox (node dev/test/login.mjs)'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => window.MB && MB.linkedEntities && Object.keys(MB.linkedEntities.link_type || {}).length, null, { timeout: 60000 });
const typeIds = await page.evaluate(gids => gids.map(g => { const t = Object.values(MB.linkedEntities.link_type).find(x => x.gid === g); return t ? t.id : null; }), missing.map(u => prodRels.find(r => r.url.resource === u)['type-id']));
const q = new URLSearchParams();
missing.forEach((u, i) => { q.set(`edit-release.url.${i}.text`, u); if (typeIds[i]) q.set(`edit-release.url.${i}.link_type_id`, String(typeIds[i])); });
console.log('link types: ' + missing.map((u, i) => `${prodRels.find(r => r.url.resource === u).type} = ${typeIds[i]}`).join(', '));
q.set('edit-release.edit_note', `Test fixture: links from ${PROD}/release/${mbid}, for the mb-userscripts test suite (#625).`);
await page.goto(`${SANDBOX}/release/${mbid}/edit?${q}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.MB && MB.releaseEditor && MB.releaseEditor.rootField, null, { timeout: 60000 });
await page.waitForTimeout(3000);
await page.click('a[href="#edit-note"]').catch(() => {});
await page.waitForTimeout(1000);
// an edit note, in case the seeded one isn't read on the edit page
await page.evaluate(n => { const ta = document.querySelector('#edit-note-text, textarea[name="edit_note"]'); if (ta && !ta.value) { ta.value = n; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.dispatchEvent(new Event('change', { bubbles: true })); } },
  `Test fixture: links from ${PROD}/release/${mbid}, for the mb-userscripts test suite (#625).`);
await Promise.all([
  page.waitForURL(u => !/\/edit$/.test(u.pathname), { timeout: 120000 }).catch(() => {}),
  page.click('button:has-text("Enter edit")'),
]);
await ctx.close();
// what counts is what the sandbox now has, read back
await new Promise(r => setTimeout(r, 2000));
const now = new Set(await urls(SANDBOX));
console.log('now on the sandbox: ' + missing.map(u => (now.has(u) ? '✓ ' : '✗ ') + u).join('  '));
if (missing.some(u => !now.has(u))) process.exit(1);
