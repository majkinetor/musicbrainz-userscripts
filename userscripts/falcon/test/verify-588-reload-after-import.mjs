// #588 (chaban-mb): "Some scripts reload the page after edits were entered, e.g.
// Art Station or Platform Check. However other scripts do not reload and page
// continues to show old state." — and, on Falcon specifically: "Falcon is set to
// fully auto for me. So all I see is an already processed queue and stale
// release view."
//
// majkinetor rejected standardising it ("context matters… Falcon doesn't as you
// want to see a queue results") and asked instead for:
//
//   - Harmony:
//     - [ ] Reload release page after import without errors
//
//   "Change the background color of the Falcon icon (or equivalent) on reloaded
//    page. The point is, with many tabs open, to know which one was reloaded by
//    Falcon after success."
//
// The release page here is a FIXTURE served at musicbrainz.org — the option
// navigates, and a test that navigates should not be doing it on the real site.
// ⚠ Routed on one narrow regex, never a catch-all: a catch-all route is what
// made production MusicBrainz load as chrome-error in an earlier session.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.FALCON_SRC || resolve(HERE, '..', 'falcon.user.js'), 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const MBID = '20b03c7d-9e8a-42b9-8a96-bcc9564de034';
const RELEASE = `https://musicbrainz.org/release/${MBID}`;
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Release</title></head>
  <body><div id="page"><h1>A Release</h1></div></body></html>`;

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1200, height: 900 } });
let served = 0;
// Every /release/ path, not just this MBID: the "a different release is not
// marked" probe below uses another MBID, and with the narrower pattern that one
// request escaped to the real musicbrainz.org — which is precisely the kind of
// unintended traffic a fixture test exists to avoid.
await ctx.route(/^https:\/\/musicbrainz\.org\/release\//, r => {
  served++;
  return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGE });
});

const open = async (url, opts) => {
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.log('PAGEERROR ' + e.message); fail++; });
  await page.addInitScript((o) => {
    const store = new Map(Object.entries(o));
    window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
    window.GM_xmlhttpRequest = () => {};
    window.__opened = [];
    window.GM_openInTab = u => { window.__opened.push(u); return { close() {}, closed: false }; };
    window.open = u => { window.__opened.push(u); return { closed: false }; };
  }, opts || {});
  // one injection only — two Falcons on one document means two launchers and two
  // closures, and every measurement below would be against the wrong one
  page.on('load', () => { page.addScriptTag({ content: code }).catch(() => {}); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__falconTest, null, { timeout: 15000 });
  const n = await page.evaluate(() => document.querySelectorAll('#falcon-launcher').length);
  ck(n === 1, `fixture: exactly one Falcon launcher on the page (${n})`);
  return page;
};
// a settled queue, as a run would leave it
const seedQueue = (page, statuses) => page.evaluate(ss => {
  window.__falconTest.setQueue(ss.map((status, i) => ({
    id: 'f' + (i + 1), entityType: 'recording', mbid: '1111111' + i + '-1111-4111-8111-111111111111',
    urls: [{ url: 'https://x.y/' + i, linkTypeId: '268' }], note: '', disambiguation: '', rename: '',
    isrcs: [], video: false, aliases: [], cover: [], coverExistingCount: null,
    name: 'Track ' + i, urlResults: null, status, error: status === 'failed' ? 'nope' : '',
  })));
}, statuses);

const ON = { 'falcon:reloadReleaseAfterImport': true };
const OFF = { 'falcon:reloadReleaseAfterImport': false };

/* ── 0. the option exists at all ───────────────────────────────────────────── */
const probe = await open(RELEASE, ON);
const have = await probe.evaluate(() => typeof window.__falconTest.maybeReloadReleasePage === 'function');
ck(have, 'this build has the post-import reload');
if (!have) {
  console.log('no post-import reload on this build — nothing further is measurable');
  await ctx.close(); console.log(`\n${fail + 1} FAILED`); process.exit(1);
}
ck(await probe.evaluate(() => window.__falconTest.cfg.reloadReleaseAfterImport === true),
  'and the option reads back from storage');
await probe.close();

/* ── 1. it refuses whenever the run was not clean ──────────────────────────── */
const refuses = [
  ['a failed item', ['done', 'failed'], ON, /did not go through/],
  ['a partial item', ['done', 'partial'], ON, /did not go through/],
  ['an item left for manual review', ['done', 'manual'], ON, /manual review/],
  ['the option turned off', ['done', 'done'], OFF, null],
];
for (const [name, statuses, opts, re] of refuses) {
  const p = await open(`${RELEASE}?falcon=tok&tport=8000`, opts);
  await seedQueue(p, statuses);
  const before = p.url();
  await p.evaluate(() => window.__falconTest.maybeReloadReleasePage());
  await p.waitForTimeout(600);
  ck(p.url() === before, `${name}: the page is left alone (${p.url().replace(RELEASE, '…')})`);
  if (re) {
    const lines = await p.evaluate(() => window.__falconTest.getLog().join('\n'));
    ck(re.test(lines), `${name}: and says why in the run log`);
  }
  await p.close();
}
// not a release page at all
const pNot = await open('https://musicbrainz.org/release/' + MBID + '/cover-art', ON);
// (the route serves the same fixture for this path; the pathname is what matters)
await seedQueue(pNot, ['done']);
await pNot.evaluate(() => window.__falconTest.maybeReloadReleasePage());
await pNot.waitForTimeout(500);
ck(/cover-art/.test(pNot.url()), 'a page that is not the release page itself is not reloaded either');
await pNot.close();

/* ── 2. a clean run reloads, and drops the spent token ─────────────────────── */
const p = await open(`${RELEASE}?falcon=tok123&tport=8000#tracklist`, ON);
await seedQueue(p, ['done', 'skipped', 'done']);   // 'skipped' is a success, not a problem
ck(await p.evaluate(() => window.__falconTest.reloadedAfterImportHere()) === false,
  'before the reload, this page is not marked');
const plainBg = await p.evaluate(() => getComputedStyle(document.getElementById('falcon-launcher')).backgroundColor);
const servedBefore = served;
await p.evaluate(() => window.__falconTest.maybeReloadReleasePage());
await p.waitForFunction(() => !new URLSearchParams(location.search).has('falcon'), null, { timeout: 10000 })
  .then(() => ck(true, 'a clean run reloads the release page')).catch(() => ck(false, 'a clean run reloads the release page'));
await p.waitForFunction(() => !!window.__falconTest, null, { timeout: 10000 });
console.log('\nurl after:', p.url(), '· fixture served', servedBefore, '→', served);
ck(served > servedBefore, 'the page really was fetched again rather than merely re-rendered');
const u = new URL(p.url());
ck(!u.searchParams.has('falcon'),
  'the consumed falcon= token is dropped — reloading it verbatim would log "not a known pending token" every time');
ck(u.searchParams.get('tport') === '8000',
  `…but tport survives, so MusicBrainz still draws its own tagger button (${u.search})`);
ck(u.pathname === `/release/${MBID}`, `and it is the same release (${u.pathname})`);
ck(u.hash === '#tracklist', `the fragment is kept too (${u.hash || '(none)'})`);

/* ── 3. the reloaded tab is recognisable ───────────────────────────────────── */
ck(await p.evaluate(() => window.__falconTest.reloadedAfterImportHere()) === true,
  'the reloaded page knows Falcon reloaded it');
const doneBg = await p.evaluate(() => {
  const el = document.getElementById('falcon-launcher');
  const cs = getComputedStyle(el);
  return { bg: cs.backgroundColor, shadow: cs.boxShadow, title: el.title, opacity: cs.opacity };
});
console.log('launcher — before:', plainBg, '\n           after :', JSON.stringify(doneBg));
ck(doneBg.bg !== plainBg,
  `the icon's background really changed, which is the whole ask (${plainBg} → ${doneBg.bg})`);
// measured, not merely "a different string": it must actually be painted
const alpha = /rgba?\(([^)]+)\)/.exec(doneBg.bg);
const parts = alpha ? alpha[1].split(',').map(s => parseFloat(s)) : [];
ck(parts.length >= 3 && (parts.length < 4 || parts[3] > 0.2),
  `and it is opaque enough to see across a screenful of tabs (${doneBg.bg})`);
ck(/reloaded/i.test(doneBg.title), `the tooltip explains the colour ("${doneBg.title}")`);
ck(Number(doneBg.opacity) > 0.9, `and it is not sitting at the usual dimmed opacity (${doneBg.opacity})`);

/* ── 4. the mark belongs to that release, not to the tab forever ───────────── */
const pOther = await open('https://musicbrainz.org/release/' + MBID.replace(/^2/, '3'), ON).catch(() => null);
if (pOther) {
  ck(await pOther.evaluate(() => window.__falconTest.reloadedAfterImportHere()) === false,
    'a different release in the same tab is NOT marked');
  await pOther.close();
}

/* ── 5. nothing was submitted or opened anywhere ───────────────────────────── */
ck(await p.evaluate(() => window.__opened.length) === 0, 'no tab was opened by any of this');
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
