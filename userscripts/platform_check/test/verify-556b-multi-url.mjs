// #556 (chaban-mb) — "Adding all links in the background randomly fails".
//
// The reproduction: queue three release URLs where at least one is spelled
// differently from how MusicBrainz will render it (Qobuz keeps its /us-en/
// locale segment; Deezer and Tidal come back verbatim). Run the real inject
// path on the real release editor and count what actually landed.
//
// What this caught, and now guards against: PC_URL_ID was a module-level
// `const` sitting BELOW the IIFE's early return for /release/<mbid>/edit, so
// injectInto — which only ever runs on that path — reached it in the temporal
// dead zone. It threw `ReferenceError: Cannot access 'PC_URL_ID' before
// initialization` out of the whole loop, and because matchRowByUrl tries
// `h === url` first, that only happened on the first URL MusicBrainz had
// rewritten — so the verbatim ones landed and everything after the rewritten
// one was lost. Exactly the "only Deezer inserted" in chaban's log.
//
// Two invariants are asserted, not one:
//   1. all three URLs land, and
//   2. a URL that throws cannot end the run — the loop reports it and carries on.
//
// Runs on test.musicbrainz.org and never submits: every POST is aborted at the
// network layer and the edit endpoints are asserted absent.
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'platform_check.user.js'), 'utf8');
const SHOTS = resolve(HERE, 'logs'); await mkdir(SHOTS, { recursive: true });

const RELEASE = process.env.PC_RELEASE || '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const PENDING = {
  deezer: 'https://www.deezer.com/album/978648191',                                       // MB echoes this verbatim
  tidal: 'https://tidal.com/album/522735526',                                             // …and this
  qobuz: 'https://www.qobuz.com/us-en/album/as-oneself-arkta-/uqj72odvp0ofm',              // …but this one goes through URLCleanup
};
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// ── static guard: nothing injectInto needs may be a const below the early return ──
const cutAt = code.search(/runInjectHelper\('release'\);/);
const belowConsts = [...code.slice(cutAt).matchAll(/^const ([A-Z][A-Z0-9_]*) =/gm)].map(m => m[1]);
const injectBody = code.slice(code.indexOf('async function injectInto'), code.indexOf('async function injectInto') + 8000);
const reachable = [...code.matchAll(/function (pcUrlKey|pcSameUrl|pcWaitFor|findAddLinkInput)\b[\s\S]{0,2500}?\n\}/g)].map(m => m[0]).join('\n');
const risky = belowConsts.filter(n => new RegExp('\\b' + n + '\\b').test(injectBody + reachable));
console.log('module-level CONSTs below the early return: ' + belowConsts.length);
ck(risky.length === 0, `none of them is reachable from the inject path — a TDZ ReferenceError there kills the whole run${risky.length ? ' (RISKY: ' + risky.join(', ') + ')' : ''}`);

const run = async (label, source) => {
  const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1100 } });
  await ctx.addInitScript(([mbid, pending]) => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_info = { script: { name: 'Platform Check', version: 't' } };
    try { localStorage.setItem('pc:pending:' + mbid, JSON.stringify(pending)); } catch (e) {}
    window.__con = [];
    for (const m of ['info', 'warn', 'error']) {
      const real = console[m].bind(console);
      console[m] = (...a) => { try { window.__con.push(m + ': ' + a.map(String).join(' ')); } catch (e) {} return real(...a); };
    }
  }, [RELEASE, PENDING]);
  const page = ctx.pages()[0] || await ctx.newPage();
  const postUrls = [];
  await page.route(() => true, r => { const q = r.request(); if (q.method() === 'POST') { postUrls.push(q.url()); return r.abort(); } return r.continue(); });
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { await ctx.close(); return { notLoggedIn: true }; }
  await page.waitForTimeout(2500);
  await page.addScriptTag({ content: source });
  await page.waitForTimeout(22000);
  const out = await page.evaluate(() => ({
    hrefs: [...document.querySelectorAll('tr.external-link-item a[href]')].map(a => a.href),
    banner: (() => { const m = document.body.innerText.match(/Platform Check: inject helper crashed[^\n]*/); return m ? m[0] : null; })(),
    con: window.__con.filter(l => /Platform Check/.test(l)),
  }));
  if (label === 'fixed') await page.screenshot({ path: resolve(SHOTS, 'i556b-fixed.png') }).catch(() => {});
  await ctx.close();
  return { ...out, postUrls };
};

const key = u => (u.match(/album\/([^/?#]+)/) || [])[1] || u;
const want = Object.values(PENDING);

const now = await run('fixed', code);
if (now.notLoggedIn) { console.log('NOT LOGGED IN — see reference_test_musicbrainz_instance'); process.exit(3); }
const landed = want.filter(u => now.hrefs.some(h => h.includes(key(u))));
console.log('\nrows: ' + JSON.stringify(now.hrefs, null, 1));
console.log('console: ' + JSON.stringify(now.con, null, 1));
ck(landed.length === want.length, `#556: all ${want.length} queued URLs landed (${landed.length})`);
ck(now.hrefs.some(h => /qobuz\.com/.test(h)), 'specifically the one MusicBrainz rewrites (Qobuz) — the URL the run used to die on');
ck(!now.banner, 'no "inject helper crashed" banner: ' + JSON.stringify(now.banner));
ck(now.con.some(l => /inject: 3\/3 link\(s\) landed/.test(l)), 'the run reports its own result to the console — ' + JSON.stringify(now.con.find(l => /inject:/.test(l)) || null));
ck(!now.postUrls.some(u => /ws\/js\/edit\/create/.test(u)), `no edit was submitted (${now.postUrls.length} POST(s), all aborted)`);

// ── A/B: the same fixture against the build this regressed in ───────────────
const PREV = process.env.PC_PREV || 'C:/Users/mmilic/AppData/Local/Temp/claude/C--Work-mb-userscripts/a7f42901-3446-4ab6-940d-0df2a834c06c/scratchpad/pc-prev.user.js';
let prevSrc = null;
try { prevSrc = await readFile(PREV, 'utf8'); } catch (e) { console.log('\n(skipping A/B — no previous build at ' + PREV + ')'); }
if (prevSrc) {
  const before = await run('prev', prevSrc);
  const landedBefore = want.filter(u => before.hrefs.some(h => h.includes(key(u))));
  console.log('\n########## PREVIOUS BUILD (ffd27e96) ##########');
  console.log('landed        : ' + landedBefore.length + '/' + want.length);
  console.log('crash banner  : ' + JSON.stringify(before.banner));
  ck(landedBefore.length < want.length, `the fixture really does reproduce on the previous build (${landedBefore.length}/${want.length} landed there)`);
  ck(/PC_URL_ID/.test(before.banner || ''), 'and it fails for the reason claimed — ' + JSON.stringify(before.banner));
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
