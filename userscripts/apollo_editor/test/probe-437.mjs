// Probe #437 — credit-based artist matching (co-occurrence).
// On the example release editor "Today" by Sidney Samson (which credits a feat.
// "Joni" — a non-unique common name), verifies that matchSlot, given the release
// artist (Sidney Samson) as context, disambiguates "Joni" via existing artist
// credits and returns a confident 'cred' match — NOT a blind name-search pick.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const O = 'https://musicbrainz.org';
const REL = 'a56091bd-dd60-44f5-87f5-dec6754b8523';       // Today — Sidney Samson (feat. Joni)
const SIDNEY = '4fc48643-7a22-482c-b419-9628e0fbfe25';    // release artist, the context seed
const JONI = 'a766abff';                                  // the correct co-credited Joni
const log = (...a) => console.log('[probe-437]', ...a);

const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1600, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.goto(`${O}/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForSelector('#release-editor, .release-editor, form', { timeout: 30000 }).catch(() => {});
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 20000 }).catch(() => {});
if (!await page.evaluate(() => !!window.__apolloEditor)) { log('apollo API not exposed'); await ctx.close(); process.exit(2); }

// 1) baseline: a bare name search for "Joni" is ambiguous (no unique high match)
const name = await page.evaluate(() => window.__apolloEditor.matchSlot('Joni', null, null, []));
log('1) name-only matchSlot →', JSON.stringify({ source: name.source, confidence: name.confidence, gid: name.entity && name.entity.gid, cands: name.candidates.length }));

// 2) with the release artist as context, cred disambiguates it
const cred = await page.evaluate((sid) => window.__apolloEditor.matchSlot('Joni', null, null, [sid]), SIDNEY);
log('2) cred matchSlot →', JSON.stringify({ source: cred.source, confidence: cred.confidence, entity: cred.entity && cred.entity.name, gid: cred.entity && cred.entity.gid }));

let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(name.source !== 'cred', 'without context, no cred match (baseline is name/low or ambiguous)');
check(cred.source === 'cred' && cred.confidence === 'high', 'with release-artist context, matchSlot returns a confident cred match');
check(cred.entity && cred.entity.gid && cred.entity.gid.startsWith(JONI), `cred resolved "Joni" to the co-credited artist (${cred.entity && cred.entity.gid})`);
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
