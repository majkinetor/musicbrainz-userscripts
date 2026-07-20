// Probe #441 — a feat. artist parsed from the title must not link to the wrong
// RG artist. Release "Give Me Your Love (feat. Nile Rodgers)" (Sigala): the title
// omits a co-feature (the full credit is "feat. John Newman & Nile Rodgers"), so
// the edited AC has fewer slots than the RG sibling. sib[i] by index grabbed John
// Newman for the Nile Rodgers slot; pickSibArtist selects by name instead.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const O = 'https://musicbrainz.org';
const REL = '79329b50-3a6a-4497-94b0-6671bb601065';
const NILE = 'c6d571dd', JOHN = '589ef702';
const log = (...a) => console.log('[probe-441]', ...a);

const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1600, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.goto(`${O}/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForSelector('#release-editor, form', { timeout: 30000 }).catch(() => {});
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 20000 }).catch(() => {});

const r = await page.evaluate(async () => {
  const A = window.__apolloEditor;
  const sib = (await A.loadSiblingMap()).get('give me your love');   // sibling AC: [Sigala, John Newman, Nile Rodgers]
  const sibArr = sib ? sib.map(s => ({ gid: s.gid.slice(0, 8), name: s.name })) : null;
  // the Nile Rodgers slot is at index 1 in this release (Sigala + Nile Rodgers)
  const byIndex = sib ? sib[1] : null;                            // the OLD behavior
  const picked = A.pickSibArtist(sib, 'Nile Rodgers', 1);         // the NEW behavior
  const m = await A.matchSlot('Nile Rodgers', picked, null, []);  // end-to-end
  return { sibArr, byIndexGid: byIndex && byIndex.gid.slice(0, 8), pickedGid: picked && picked.gid.slice(0, 8), matchGid: m.entity && m.entity.gid.slice(0, 8), matchSrc: m.source };
});
log('sibling AC:', JSON.stringify(r.sibArr));
log('sib[1] (old, by index):', r.byIndexGid, '| pickSibArtist (new, by name):', r.pickedGid, '| matchSlot →', r.matchGid, `(${r.matchSrc})`);

let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(r.byIndexGid === JOHN, 'reproduced the bug: sib[1] by index is John Newman (wrong)');
check(r.pickedGid === NILE, 'pickSibArtist selects Nile Rodgers by name, not the index-1 artist');
check(r.matchGid === NILE, `matchSlot links the Nile Rodgers slot to the correct artist (got ${r.matchGid})`);
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
