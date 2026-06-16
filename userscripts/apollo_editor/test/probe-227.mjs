// Probe #227 — add/create Discogs link affordance in Apollo.
// On a Discogs-linked release editor (logged-in), verifies:
//  1. an unresolved slot with a known Discogs URL is "addable" (→ create-with-link),
//  2. a matched slot whose artist already owns that Discogs URL is NOT addable,
//  3. add-to-existing opens the artist edit form seeded with the URL + link_type_id=180,
//  4. create-with-link seeds /artist/create with the same URL params.
// No live edits are submitted (window.open is stubbed to capture the URL).
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const O = 'https://musicbrainz.org';
const REL = '3cc7b91d-d9c3-4b1e-9d52-37c15aa17fc4';
const ERIC = 'https://www.discogs.com/artist/205719';   // → MB Eric Van Wonterghem (linked)
const ERIC_GID = '18b7a9f8-ece2-44fb-bcc6-c8747c4f0f41';
const UNLINKED = 'https://www.discogs.com/artist/999999999';   // no MB owner
const log = (...a) => console.log('[probe-227]', ...a);

const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1600, height: 1000 }, bypassCSP: true });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.goto(`${O}/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForSelector('a[href*="discogs.com/release/"]', { timeout: 30000 }).catch(() => {});
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 20000 }).catch(() => {});
if (!(await page.evaluate(() => !!window.__apolloEditor))) { log('no API'); await ctx.close(); process.exit(2); }

// capture window.open URLs instead of opening tabs
await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });

const r = await page.evaluate(async ({ ERIC, ERIC_GID, UNLINKED }) => {
  const A = window.__apolloEditor;
  const unresolved = { gid: null, creditedAs: 'Somebody New', name: '' };
  await A.tagDiscogsAddable(unresolved, UNLINKED);
  const linked = { gid: ERIC_GID, name: 'Eric Van Wonterghem' };
  await A.tagDiscogsAddable(linked, ERIC);
  // #227: an artist that links a DIFFERENT Discogs page than queried → mismatch, NOT missing/addable.
  // John Whybrew (d71e808b) links discogs/artist/695567; query it against Eric's URL (205719).
  const mismatch = { gid: 'd71e808b-b501-46cb-8412-07c7d16ff1f2', name: 'John Whybrew' };
  await A.tagDiscogsAddable(mismatch, ERIC);

  // add-to-existing seed URL
  A.addOrCreateDiscogsLink({ gid: ERIC_GID, name: 'Eric', _discogsUrl: ERIC });
  // create-with-link seed URL
  A.createArtist('Somebody New', { creditedAs: 'Somebody New' }, UNLINKED);
  return { unresolvedAddable: unresolved._discogsAddable, linkedAddable: linked._discogsAddable,
    mismatchAddable: mismatch._discogsAddable, mismatchUrl: mismatch._discogsMismatch, opened: window.__opened };
}, { ERIC, ERIC_GID, UNLINKED });

log('unresolved addable:', r.unresolvedAddable);
log('linked addable:', r.linkedAddable);
log('mismatch:', r.mismatchAddable, r.mismatchUrl);
log('opened URLs:', JSON.stringify(r.opened, null, 1));

const editUrl = r.opened.find(u => u.includes(`/artist/${ERIC_GID}/edit`)) || '';
const createUrl = r.opened.find(u => u.includes('/artist/create')) || '';
let fail = 0;
const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(r.unresolvedAddable === true, 'unresolved slot with a Discogs URL is addable (create-with-link)');
check(r.linkedAddable === false, 'already-linked artist is NOT addable');
check(r.mismatchAddable === true && /695567/.test(r.mismatchUrl || ''), 'artist linking a different Discogs page → mismatch flagged, still addable (add release link anyway)');
check(/edit-artist\.url\.0\.text=.*999999999/.test(decodeURIComponent(createUrl)) && /link_type_id=180/.test(createUrl), 'create seeds the Discogs URL + link_type_id=180');
check(/edit-artist\.url\.0\.text=.*205719/.test(decodeURIComponent(editUrl)) && /link_type_id=180/.test(editUrl), 'add-to-existing seeds the artist edit form with URL + link_type_id=180');
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
