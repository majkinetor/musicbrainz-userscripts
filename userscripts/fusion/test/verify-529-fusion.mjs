// #529 "Fusion" — verifies the matching-engine pure functions with synthetic
// recordings (no network), then performs a REAL end-to-end merge against
// test.musicbrainz.org (the sanctioned sandbox): seed from a recording page,
// add a second recording manually, group them, and submit the merge through
// Fusion's own background GET(merge_queue)->POST(merge) flow — the exact
// mechanism live-verified during #529's design phase. Nothing here touches
// production MusicBrainz.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/fusion/fusion.user.js', 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_info = { script: { name: 'Fusion', version: 't' } };
    // Minimal GM_xmlhttpRequest shim backed by real fetch() — same-origin only,
    // used solely to exercise Fusion's own merge_queue/merge POST flow live.
    window.GM_xmlhttpRequest = async (opts) => {
        try {
            const r = await fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, body: opts.data, redirect: 'follow', credentials: 'include' });
            const text = await r.text();
            opts.onload && opts.onload({ status: r.status, responseText: text, finalUrl: r.url });
        } catch (e) { opts.onerror && opts.onerror(e); }
    };
});
const page = ctx.pages()[0] || await ctx.newPage();

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// ── two recordings on a test-server release, one pair still unmerged from
// earlier live verification of this same release (2bea9225 = survivor of an
// earlier probe merge; bc1af47a = never touched) ──
const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const RECORDING_A = '2bea9225-3cee-4a23-b8f3-cd705bed3d06';
const RECORDING_B = 'bc1af47a-056f-43fc-93fa-1370b2814448';

await page.goto(`https://test.musicbrainz.org/recording/${RECORDING_A}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__fusion, { timeout: 15000 });
await page.waitForTimeout(500);

// ── pure matching-engine checks (synthetic recordings, no network) ──
const engineChecks = await page.evaluate(() => {
    const F = window.__fusion;
    const out = {};
    out.tokenMatchExact = F.tokenMatch('Floor It', 'floor it');
    out.tokenMatchLoose = F.titleSimilar('Floor It (Extended Mix)', 'Floor It Extended');
    out.tokenMatchDisjoint = F.titleSimilar('Floor It', 'Completely Different Song');
    // artistSimilar(a, b) is lenient ('min' mode) only when b (the second/MB-side
    // argument) is the SHORTER credit — a subset of a's tokens, e.g. platform
    // credit "SOTAREKO feat. Someone Else" vs MB's plain "SOTAREKO".
    out.artistSimilarSubset = F.artistSimilar('SOTAREKO feat. Someone Else', 'SOTAREKO');
    out.parseMbidUrl = F.parseMbidFromInput('https://musicbrainz.org/recording/2bea9225-3cee-4a23-b8f3-cd705bed3d06');
    out.parseMbidRaw = F.parseMbidFromInput('  2BEA9225-3cee-4a23-b8f3-cd705bed3d06 ');
    out.parseMbidNone = F.parseMbidFromInput('not an mbid');

    const r1 = F.mkRecording('r1', { title: 'Floor It', length: 200000, isrcs: ['XXAB12345678'], artistCredit: 'SOTAREKO', releases: [{ gid: 'rel1', title: 'A', trackNumber: '1' }] });
    const r2 = F.mkRecording('r2', { title: 'Floor It', length: 202000, isrcs: ['XXAB12345678'], artistCredit: 'SOTAREKO', releases: [{ gid: 'rel2', title: 'B', trackNumber: '1' }] });
    const r3 = F.mkRecording('r3', { title: 'Floor It (Extended Mix)', length: 400000, isrcs: [], artistCredit: 'SOTAREKO', releases: [{ gid: 'rel3', title: 'C', trackNumber: '2' }] });
    const r4 = F.mkRecording('r4', { title: 'Floor It (Extended)', length: 401500, isrcs: [], artistCredit: 'SOTAREKO', releases: [{ gid: 'rel4', title: 'D', trackNumber: '2' }] });
    const r5 = F.mkRecording('r5', { title: 'Totally Unrelated Track', length: 150000, isrcs: [], artistCredit: 'Someone Else', releases: [{ gid: 'rel5', title: 'E', trackNumber: '3' }] });

    const sigISRC = F.pairSignals(r1, r2, 5000);
    out.sigIsrcHit = sigISRC.isrc === true;
    const sigTitleArtistLen = F.pairSignals(r3, r4, 5000);
    out.sigMediumCombo = sigTitleArtistLen.title && sigTitleArtistLen.artist && sigTitleArtistLen.length && !sigTitleArtistLen.isrc;

    const groups = F.autoMatch([r1, r2, r3, r4, r5], 5000);
    out.groupCount = groups.length;
    out.highGroup = groups.find(g => g.confidence === 'high');
    out.medGroup = groups.find(g => g.confidence === 'medium');
    out.highHasR1R2 = out.highGroup && out.highGroup.memberGids.includes('r1') && out.highGroup.memberGids.includes('r2');
    out.medHasR3R4 = out.medGroup && out.medGroup.memberGids.includes('r3') && out.medGroup.memberGids.includes('r4');
    out.r5Excluded = !groups.some(g => g.memberGids.includes('r5'));

    return out;
});
ck(engineChecks.tokenMatchExact, 'tokenMatch: case-insensitive exact match');
ck(engineChecks.tokenMatchLoose, 'titleSimilar: "Floor It (Extended Mix)" ~ "Floor It Extended"');
ck(!engineChecks.tokenMatchDisjoint, 'titleSimilar: disjoint titles do not match');
ck(engineChecks.artistSimilarSubset, 'artistSimilar: MB artist is a subset of the longer credited form');
ck(engineChecks.parseMbidUrl === '2bea9225-3cee-4a23-b8f3-cd705bed3d06', 'parseMbidFromInput extracts an MBID out of a pasted URL');
ck(engineChecks.parseMbidRaw === '2bea9225-3cee-4a23-b8f3-cd705bed3d06', 'parseMbidFromInput lowercases + trims a raw MBID');
ck(engineChecks.parseMbidNone === null, 'parseMbidFromInput returns null for non-MBID text');
ck(engineChecks.sigIsrcHit, 'pairSignals: shared ISRC detected');
ck(engineChecks.sigMediumCombo, 'pairSignals: title+artist+length combo detected without ISRC');
ck(engineChecks.groupCount === 2, 'autoMatch forms exactly 2 groups from 5 synthetic recordings (' + engineChecks.groupCount + ')');
ck(!!engineChecks.highGroup, 'autoMatch: one HIGH-confidence group (ISRC match)');
ck(!!engineChecks.medGroup, 'autoMatch: one MEDIUM-confidence group (title+artist+length)');
ck(engineChecks.highHasR1R2, 'HIGH group contains r1+r2');
ck(engineChecks.medHasR3R4, 'MEDIUM group contains r3+r4');
ck(engineChecks.r5Excluded, 'unrelated r5 stays out of every group (singleton)');

// ── live: seed from the recording page, add a second recording, group + merge ──
const seedInfo = await page.evaluate(async () => {
    await window.__fusion.seedFromScope();
    return { poolSize: window.__fusion.STATE.poolOrder.length, scopeType: window.__fusion.SCOPE.type };
});
ck(seedInfo.scopeType === 'recording', 'Fusion detects recording-page scope on /recording/' + RECORDING_A.slice(0, 8) + '…');
ck(seedInfo.poolSize === 1, 'recording-page seed puts exactly the one recording in the pool (' + seedInfo.poolSize + ')');

const grouped = await page.evaluate(async (gidB) => {
    const F = window.__fusion;
    const recB = await F.fetchRecordingByGid(gidB);
    if (!recB) return { ok: false, reason: 'fetchRecordingByGid failed' };
    F.addToPool(recB);
    const gidA = [...F.STATE.recordings.keys()].find(g => g !== gidB);
    const group = F.createGroupWithMember(gidA);
    if (!group) return { ok: false, reason: 'createGroupWithMember failed' };
    F.addToGroup(gidB, group.id);
    return { ok: true, groupId: group.id, memberCount: group.memberGids.length, poolSize: F.STATE.poolOrder.length };
}, RECORDING_B);
ck(grouped.ok, 'manually grouped two recordings via createGroupWithMember + addToGroup' + (grouped.ok ? '' : ' — ' + grouped.reason));
ck(grouped.memberCount === 2, 'manual group has exactly 2 members');
ck(grouped.poolSize === 0, 'pool is empty after both recordings moved into the group');

console.log('Submitting a REAL merge on test.musicbrainz.org (sandbox — safe)…');
const mergeResult = await page.evaluate(async (groupId) => {
    const F = window.__fusion;
    const group = F.findGroup(groupId);
    await F.mergeGroup(group);
    return { state: group.state, error: group.error };
}, grouped.groupId);
console.log('merge result:', JSON.stringify(mergeResult));
ck(mergeResult.state === 'done', 'mergeGroup() reports state=done after a real submit (' + JSON.stringify(mergeResult) + ')');

// verify against WS2: the merged-away recording's own lookup should now redirect
// to the survivor via MB's merge-alias mechanism (or at least no longer be a
// standalone entity the merge form itself would accept again).
await page.waitForTimeout(1000);
const post = await page.evaluate(async ([gidA, gidB]) => {
    const rA = await fetch(`/ws/2/recording/${gidA}?fmt=json`).then(r => r.json()).catch(() => null);
    const rB = await fetch(`/ws/2/recording/${gidB}?fmt=json`).then(r => r.json()).catch(() => null);
    return { survivorId: rA && rA.id, mergedAwayId: rB && rB.id };
}, [RECORDING_A, RECORDING_B]);
console.log('post-merge WS2 check:', JSON.stringify(post));
ck(post.survivorId === RECORDING_A, 'survivor recording still resolves via WS2');

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
