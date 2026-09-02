// #556 — REAL end-to-end proof of the background add, on test.musicbrainz.org.
//
// majkinetor: "Use test.musicbrainz.org to add links in the background. One
// working instance is not enough, but 10 might be. […] Provide proof in the form
// of links to test release with recent edits that each adds links in the
// background (should be visible in the edit note too)."
//
// So this is not a mock. Per iteration it:
//
//   1. picks a sandbox release and a provider URL that release does not have;
//   2. seeds pc:pending:<mbid> exactly as the panel's + button does;
//   3. opens /release/<mbid>/edit#pc-autocommit in a tab that is NOT focused —
//      another page is brought to front first, which is as close as Playwright
//      gets to GM_openInTab({ active: false });
//   4. lets Platform Check do the whole thing itself: fill the field, set the
//      edit note, press Enter edit;
//   5. SUBMITS FOR REAL, then reads the release back over /ws/2 and asserts the
//      link is actually on it. Landing in the form is not proof; landing in the
//      database is.
//
// Sandbox only — the URL is asserted before anything is allowed to POST, so this
// cannot run against production even by mistake.
//
//   node userscripts/platform_check/test/e2e-556-background-add.mjs [--runs 10] [--hidden]
//
// --hidden additionally forces document.hidden in the editor tab, because
// Playwright leaves an unfocused tab reporting visible while a real browser does
// not. That is the stress case; the default is the honest one.
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'platform_check.user.js'), 'utf8');
const LOGS = resolve(HERE, 'logs'); await mkdir(LOGS, { recursive: true });

const B = 'https://test.musicbrainz.org';
if (!/^https:\/\/test\.musicbrainz\.org$/.test(B)) { console.error('refusing to run outside the sandbox'); process.exit(2); }

const argv = process.argv.slice(2);
const RUNS = Number((argv[argv.indexOf('--runs') + 1]) || 10);
const FORCE_HIDDEN = argv.includes('--hidden');
const OFFSET = Number((argv[argv.indexOf('--offset') + 1]) || 0);

// Distinct, well-formed provider URLs. Each iteration uses a different one, so a
// release can be reused without the add becoming a no-op duplicate.
const URLS = [
    ['deezer', 'https://www.deezer.com/album/1000%d'],
    ['spotify', 'https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRG%02d'],
    ['tidal', 'https://tidal.com/album/2000%d'],
    ['beatport', 'https://www.beatport.com/release/pc-e2e-%d/300%d'],
    ['apple', 'https://music.apple.com/us/album/pc-e2e-%d/150000000%d'],
];

// MusicBrainz REWRITES a URL as it stores it — it turned
//   .../album/pc-e2e-1004/1500000001004  into  .../album/1500000001004
// so an exact string compare reports "not on the release" for links that are
// plainly there. My first run of this harness scored 6/8 for exactly that reason
// and I nearly filed it as an Apple Music bug. Compare on resource identity,
// using the SHIPPED pcUrlKey rather than a second implementation that could
// drift from it.
const pcUrlKeySrc = (() => {
    const s = code.slice(code.indexOf('function pcUrlKey'));
    const m = s.match(/\r?\n\}\r?\n/);
    if (!m) throw new Error('could not extract pcUrlKey from the userscript');
    return s.slice(0, m.index + m[0].length);
})();
// eslint-disable-next-line no-new-func
const pcUrlKey = new Function(pcUrlKeySrc + '; return pcUrlKey;')();
const sameUrl = (a, b) => !!a && !!b && pcUrlKey(a) === pcUrlKey(b);

let ctx, front;
const out = [];
const say = (...a) => console.log(...a);

function providerFor(i) {
    const [name, tpl] = URLS[i % URLS.length];
    const n = 1000 + i + OFFSET * 100;
    return { name, url: tpl.replace(/%02d/g, String(i).padStart(2, '0')).replace(/%d/g, String(n)) };
}

// /ws/2 rate-limits hard (503) when polled back to back, and a 503 read as
// "no links" would silently turn every verification into a skip. Retry with
// backoff and treat a persistent failure as an error, never as an answer.
const relUrls = async (page, mbid) => page.evaluate(async ([b, id]) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let attempt = 1; attempt <= 6; attempt++) {
        const r = await fetch(`${b}/ws/2/release/${id}?inc=url-rels&fmt=json`, { headers: { Accept: 'application/json' } });
        if (r.ok) {
            const j = await r.json();
            return { urls: (j.relations || []).map(x => x.url && x.url.resource).filter(Boolean) };
        }
        if (r.status !== 503 && r.status !== 429) return { error: r.status };
        await sleep(1200 * attempt);
    }
    return { error: 503 };
}, [B, mbid]);

ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: false, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(([forceHidden]) => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_listValues = () => [...store.keys()];
    window.GM_info = { script: { name: 'Platform Check', version: 'e2e' } };
    window.unsafeWindow = window;
    window.GM_openInTab = () => ({ closed: false, close() {} });
    window.GM_registerMenuCommand = () => {};
    window.__con = [];
    for (const m of ['info', 'warn', 'error']) {
        const real = console[m].bind(console);
        console[m] = (...a) => { try { window.__con.push(a.map(String).join(' ')); } catch (e) {} return real(...a); };
    }
    if (forceHidden && /\/edit(#|$)/.test(location.href)) {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    }
}, [FORCE_HIDDEN]);

front = ctx.pages()[0] || await ctx.newPage();
await front.goto(B, { waitUntil: 'domcontentloaded' });
if (front.url().includes('/login')) { say('NOT LOGGED IN to the sandbox'); await ctx.close(); process.exit(3); }

// a pool of sandbox releases to spread the edits over
const pool = await front.evaluate(async () => {
    const j = await (await fetch('/ws/2/release?query=*&limit=30&fmt=json', { headers: { Accept: 'application/json' } })).json();
    return (j.releases || []).map(x => x.id);
});
say(`sandbox releases available: ${pool.length}   runs: ${RUNS}   forceHidden: ${FORCE_HIDDEN}\n`);

for (let i = 0; i < RUNS; i++) {
    const mbid = pool[(i + OFFSET) % pool.length];
    const { name, url } = providerFor(i);
    const t0 = Date.now();
    const rec = { n: i + 1, mbid, provider: name, url, release: `${B}/release/${mbid}` };

    const before = await relUrls(front, mbid);
    if (before.error) { rec.result = 'SKIP (ws/2 ' + before.error + ')'; out.push(rec); say(`#${i + 1} ${rec.result}`); continue; }
    if (before.urls.some(u => sameUrl(u, url))) { rec.result = 'SKIP (already present)'; out.push(rec); say(`#${i + 1} ${rec.result}`); continue; }

    // seed the queue exactly as the panel does, on the release page
    const seeder = await ctx.newPage();
    await seeder.goto(`${B}/release/${mbid}`, { waitUntil: 'domcontentloaded' });
    await seeder.evaluate(([id, p, u]) => localStorage.setItem('pc:pending:' + id, JSON.stringify({ [p]: u })), [mbid, name, url]);
    await seeder.close();

    // the editor tab, opened and then pushed to the background
    const tab = await ctx.newPage();
    const posts = [];
    tab.on('request', r => { if (r.method() === 'POST') posts.push(r.url()); });
    await tab.goto(`${B}/release/${mbid}/edit#pc-autocommit`, { waitUntil: 'domcontentloaded' });
    await front.bringToFront();                    // <- the tab under test is no longer focused
    await tab.waitForTimeout(1200);
    await tab.addScriptTag({ content: code });

    // wait for Platform Check to finish, whatever the outcome
    const finished = await tab.waitForFunction(
        () => (window.__con || []).some(l => /inject: \d+\/\d+ link\(s\) landed|NOT submitting|crashed/.test(l)),
        null, { timeout: 90000 }).then(() => true).catch(() => false);
    rec.ms = Date.now() - t0;
    rec.console = await tab.evaluate(() => (window.__con || []).filter(l => /Platform Check/.test(l))).catch(() => []);
    rec.hidden = await tab.evaluate(() => document.hidden).catch(() => null);
    // give the submit + redirect time to complete
    await tab.waitForTimeout(6000);
    rec.posts = posts.length;
    await tab.close().catch(() => {});

    const after = await relUrls(front, mbid);
    rec.landed = !after.error && after.urls.some(u => sameUrl(u, url));
    rec.stored = (after.urls || []).find(u => sameUrl(u, url)) || null;
    rec.result = rec.landed ? 'PASS — link is on the release' : (finished ? 'FAIL — not on the release' : 'FAIL — never finished');
    out.push(rec);
    say(`#${i + 1} ${rec.result}  (${rec.ms}ms, hidden=${rec.hidden}, ${rec.posts} POST)  ${name} -> ${rec.release}`);
    for (const l of rec.console) say('      ' + l);
}

const pass = out.filter(r => r.landed).length;
const ran = out.filter(r => r.result !== undefined && !/^SKIP/.test(r.result)).length;
say(`\n================ ${pass}/${ran} landed in the database ================`);
for (const r of out) say(`${r.landed ? 'PASS' : r.result.startsWith('SKIP') ? 'SKIP' : 'FAIL'}  ${r.release}  (${r.provider}${r.stored && r.stored !== r.url ? ' — MB stored it as ' + r.stored : ''})`);
await writeFile(resolve(LOGS, 'e2e-556.json'), JSON.stringify(out, null, 1));
say(`\nreport: ${resolve(LOGS, 'e2e-556.json')}`);
await ctx.close();
process.exit(pass === ran && ran > 0 ? 0 : 1);
