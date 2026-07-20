// Probe #440 — reproduce majkinetor's IMPORT flow end-to-end and drive it until it
// matches. Seeds MB's add-release editor with the Zaïre 74 (Deezer) tracklist — a
// Various-Artists release with NO release group — then runs Apollo's recording
// auto-match and asserts tracks 3 & 4 (Salongo Pt 1/2) link. Dumps the rec-match
// debug log so the decision path is visible.
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const O = 'https://musicbrainz.org';
const TABU = '85a694a0-dde9-4d79-a3b5-11950be0f3de';
const ABUMBA = '6d03b722-0a4d-40bf-b36c-e432cac11868';
// Deezer tracklist (title, seconds, artist name, artist mbid) — as an import would seed it
const TRACKS = [
  ['Introduction', 155, 'Tabu Ley Rochereau', TABU],
  ['Celicia', 321, 'Tabu Ley Rochereau', TABU],
  ['Salongo, Pt. 1', 168, 'Tabu Ley Rochereau', TABU],
  ['Salongo, Pt. 2', 90, 'Tabu Ley Rochereau', TABU],
  ['Annie', 444, 'Tabu Ley Rochereau', TABU],
  ['Magali Ya Kinshasa', 408, 'Abumba Masikini', ABUMBA],
];
const log = (...a) => console.log('[probe-440-import]', ...a);

const code = await readFile(SCRIPT, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1600, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => log('[pageerror]', e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });

// 1) seed the add-release editor via a POST form (the MB seeding mechanism), no RG.
await page.goto(`${O}/`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.evaluate(({ TRACKS, VA_TITLE }) => {
  const f = document.createElement('form'); f.method = 'POST'; f.action = '/release/add'; f.style.display = 'none';
  const add = (n, v) => { const i = document.createElement('input'); i.name = n; i.value = v; f.appendChild(i); };
  add('name', VA_TITLE);
  add('artist_credit.names.0.artist.name', 'Various Artists');
  add('artist_credit.names.0.mbid', '89ad4ac3-72e7-46f4-9f0c-0a8235f10005');
  add('mediums.0.format', 'Digital Media');
  TRACKS.forEach((t, i) => {
    add(`mediums.0.track.${i}.name`, t[0]);
    add(`mediums.0.track.${i}.number`, String(i + 1));
    add(`mediums.0.track.${i}.length`, String(t[1] * 1000));
    add(`mediums.0.track.${i}.artist_credit.names.0.artist.name`, t[2]);
    add(`mediums.0.track.${i}.artist_credit.names.0.mbid`, t[3]);
  });
  document.body.appendChild(f); f.submit();
}, { TRACKS, VA_TITLE: 'Zaire 74: The African Artists' });

await page.waitForSelector('#release-editor, .release-editor, form.release-editor, #content form', { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 20000 }).catch(() => {});
if (!await page.evaluate(() => !!window.__apolloEditor)) { log('apollo API not exposed'); await ctx.close(); process.exit(2); }

// 2) show the recordings mirror + run the auto-matcher
await page.evaluate(async () => { try { window.__apolloEditor.showRecMirror(); } catch (e) {} });
await page.waitForTimeout(1000);
await page.evaluate(async () => { await window.__apolloEditor.autoMatchRecordings(); });
await page.waitForTimeout(1000);

// 3) read the result + the rec-match debug log
const r = await page.evaluate(() => {
  const recs = window.__apolloEditor.readRecordings().map(x => ({ n: x.number, title: x.title, recGid: x.recGid ? x.recGid.slice(0, 8) : null }));
  const md = window.__apolloEditor.logMarkdown();
  const recLines = (md.match(/rec-match[^\n]*/g) || []).join('\n');
  return { recs, recLines };
});
console.log('\n──── rec-match debug log ────\n' + r.recLines + '\n─────────────────────────────\n');
r.recs.forEach(x => log(`track ${x.n} "${x.title}" → ${x.recGid || 'UNMATCHED'}`));

const t3 = r.recs.find(x => /pt\.?\s*1/i.test(x.title)), t4 = r.recs.find(x => /pt\.?\s*2/i.test(x.title));
let fail = 0; const check = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
check(t3 && t3.recGid === 'bb07aeb2', `track 3 "Salongo, Pt. 1" links to bb07aeb2 (got ${t3 && t3.recGid})`);
check(t4 && t4.recGid === '160e031e', `track 4 "Salongo, Pt. 2" links to 160e031e (got ${t4 && t4.recGid})`);
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
