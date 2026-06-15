// Probe #224 — Discogs artist-link matching in Apollo.
// On a Discogs-linked release editor (logged-in profile), verifies:
//  1. the Discogs release URL is scraped from the page,
//  2. the per-track artist map builds from the Discogs JSON,
//  3. a Discogs artist URL resolves to its MB artist,
//  4. matchSlot returns a confident 'disc' match (priority over name search).
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const O = 'https://musicbrainz.org';
const REL = '3cc7b91d-d9c3-4b1e-9d52-37c15aa17fc4';   // The Lost Tapes (Discogs 719254)
const log = (...a) => console.log('[probe-224]', ...a);

const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1600, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.goto(`${O}/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
// the release editor is React — wait for it to render the external Discogs link
await page.waitForSelector('a[href*="discogs.com/release/"]', { timeout: 30000 }).catch(() => log('discogs anchor not found within timeout'));
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 20000 }).catch(() => {});
const has = await page.evaluate(() => !!window.__apolloEditor);
log('__apolloEditor present:', has);
if (!has) { log('apollo did not expose API on this page'); await ctx.close(); process.exit(2); }

const url = await page.evaluate(() => window.__apolloEditor.discogsReleaseUrlFromPage());
log('1) scraped Discogs URL:', url);

const mapSize = await page.evaluate(async () => { const m = await window.__apolloEditor.loadDiscogsMap(true); return m ? m.size : null; });
log('2) Discogs track map size:', mapSize);

const hits = await page.evaluate(() => window.__apolloEditor.resolveByDiscogsUrl('https://www.discogs.com/artist/205719'));
log('3) resolve artist 205719 →', JSON.stringify(hits));

const m = await page.evaluate(() => window.__apolloEditor.matchSlot('Eric Van Wonterghem', null, 'https://www.discogs.com/artist/205719'));
log('4) matchSlot →', JSON.stringify({ source: m.source, confidence: m.confidence, entity: m.entity && m.entity.name, gid: m.entity && m.entity.gid }));

let fail = 0;
const check = (c, msg) => { console.log((c ? 'ok  : ' : 'FAIL: ') + msg); if (!c) fail++; };
check(/discogs\.com\/release\/719254/.test(url || ''), 'scraped the Discogs release URL');
check(mapSize > 0, 'built the per-track Discogs artist map');
check(Array.isArray(hits) && hits.length === 1 && hits[0].name === 'Eric Van Wonterghem', 'resolved Discogs artist → single MB artist');
check(m.source === 'discogs' && m.confidence === 'high' && m.entity && m.entity.name === 'Eric Van Wonterghem', 'matchSlot returned a confident Discogs match');
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
