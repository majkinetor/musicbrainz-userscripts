// #608 (chaban-mb) — "Parallel merge submissions silently fail due to session
// queue race condition". MB keeps the merge queue in ONE per-user session slot
// and wipes it when a merge submits, so parallel Merge All workers clobbered each
// other: the losers' POSTs were bounced to "/" with no edit created, and Fusion
// counted that as success ("redirected away").
//
// REAL merges on test.musicbrainz.org (the sanctioned sandbox): three 2-member
// groups, Merge All clicked, then for EVERY group MB itself is asked whether the
// merge edit exists (both members now have a pending edit, or — auto-edit — the
// merged-away recording resolves to another one). A group marked "done" without
// that is the #608 bug. Run with FUSION_SRC=<old build> to watch it fail.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile(process.env.FUSION_SRC || 'C:/Work/mb-userscripts/userscripts/fusion/fusion.user.js', 'utf8');
const GROUPS = 3;

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_info = { script: { name: 'Fusion', version: 't' } };
    // fetch-backed GM_xmlhttpRequest (same shim as verify-529): real requests, real session
    window.GM_xmlhttpRequest = async (opts) => {
        try {
            const sameOrigin = new URL(opts.url, location.href).origin === location.origin;
            const r = await fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, body: opts.data, redirect: 'follow', credentials: sameOrigin ? 'include' : 'omit' });
            const text = await r.text();
            opts.onload && opts.onload({ status: r.status, responseText: text, finalUrl: r.url });
        } catch (e) { opts.onerror && opts.onerror(e); }
    };
});
const page = ctx.pages()[0] || await ctx.newPage();
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

await page.goto('https://test.musicbrainz.org/', { waitUntil: 'domcontentloaded' });
const loggedIn = await page.evaluate(() => !!document.querySelector('a[href*="/logout"]'));
if (!loggedIn) { console.log('NOT LOGGED IN to test.musicbrainz.org'); await ctx.close(); process.exit(3); }

// Fresh fixtures every run: earlier runs merged theirs. Recordings with NO pending
// edit, so a pending edit afterwards can only be the merge this run created.
const fixtures = await page.evaluate(async (need) => {
    // A broad title search, not one artist's catalogue: every earlier merge test
    // left its artist's recordings with pending (never-voted) edits on the sandbox.
    const out = [];
    for (let offset = 0; offset < 1000 && out.length < need; offset += 100) {
        const sr = await fetch(`/ws/2/recording?query=${encodeURIComponent('recording:love')}&limit=100&offset=${offset}&fmt=json`).then(r => r.json()).catch(() => null);
        const recs = (sr && sr.recordings) || [];
        if (!recs.length) break;
        for (const r of recs) {
            if (out.length >= need) break;
            const j = await fetch('/ws/js/entity/' + r.id).then(x => x.ok ? x.json() : null).catch(() => null);
            if (j && j.gid === r.id && !j.editsPending) out.push(r.id);
            await new Promise(z => setTimeout(z, 250));
        }
    }
    return out;
}, GROUPS * 2);
if (fixtures.length < GROUPS * 2) { console.log('only ' + fixtures.length + ' clean recordings on the sandbox'); await ctx.close(); process.exit(3); }

await page.goto(`https://test.musicbrainz.org/recording/${fixtures[0]}`, { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => window.__fusion, null, { timeout: 20000 });
const version = await page.evaluate(() => window.__fusion.VERSION);
console.log('Fusion', version, '— fixtures', fixtures.join(', '));

const groups = await page.evaluate(async ([gids, n]) => {
    const F = window.__fusion;
    await F.openFusion();   // the real window, so Merge All is the real button
    F.clearBoard();
    const out = [];
    for (let g = 0; g < n; g++) {
        const a = await F.fetchRecordingByGid(gids[2 * g]), b = await F.fetchRecordingByGid(gids[2 * g + 1]);
        F.addToPool(a); F.addToPool(b);
        const grp = F.createGroupWithMember(a.gid); F.addToGroup(b.gid, grp.id);
        out.push({ id: grp.id, target: grp.target, members: grp.memberGids.slice() });
    }
    F.STATE.recordings.forEach(r => { r.editsPending = false; });   // fixtures were checked clean above
    F.renderAll();
    return out;
}, [fixtures, GROUPS]);
ck(groups.length === GROUPS, `built ${GROUPS} two-member groups`);

console.log('Clicking Merge All — REAL merges on test.musicbrainz.org (sandbox)…');
await page.click('#fs-mergeall');
await page.waitForFunction(() => window.__fusion.STATE.groups.every(g => g.state === 'done' || g.state === 'error'), null, { timeout: 120000 });
const result = await page.evaluate(() => window.__fusion.STATE.groups.map(g => ({ id: g.id, state: g.state, error: g.error, url: g.mergedUrl })));
console.log('Fusion says:', JSON.stringify(result, null, 1));

// Ask MB. A created merge edit puts a pending edit on every member (or, if it
// auto-applied, the merged-away gid now resolves to the kept recording).
await page.waitForTimeout(1500);
const truth = await page.evaluate(async (groups) => {
    const out = {};
    for (const g of groups) {
        const st = [];
        for (const gid of g.members) {
            const j = await fetch('/ws/js/entity/' + gid).then(x => x.ok ? x.json() : null).catch(() => null);
            st.push(!!j && (j.editsPending || j.gid !== gid));
        }
        out[g.id] = st.every(Boolean);
    }
    return out;
}, groups);
console.log('MB has the merge edit:', JSON.stringify(truth));
const lies = result.filter(r => r.state === 'done' && !truth[r.id]);
ck(lies.length === 0, `no group reported "done" without a merge edit in MB (#608) — ${lies.length} did: ${lies.map(l => l.id + ' → ' + l.url).join(', ')}`);
ck(result.every(r => r.state === 'done') && groups.every(g => truth[g.id]), `all ${GROUPS} groups really merged (${Object.values(truth).filter(Boolean).length}/${GROUPS} in MB)`);
const lines = await page.evaluate(() => window.__fusion.getLogLines());
const posts = lines.filter(l => /→ (GET|POST) \/recording\/merge|POST landed at|merge_queue redirected|▶ Merge group|merge session free/.test(l));
console.log(posts.map(l => '   ' + l).join('\n'));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
