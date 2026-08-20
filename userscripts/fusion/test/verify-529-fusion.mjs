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

// Fresh, never-merged recordings on a test-server release ("Demos 5") — a
// prior run of this file already consumed the release used earlier
// (3a37a35f…) via real merges, so this uses an untouched one instead.
const RELEASE = '4394bacf-e985-4084-809d-fcc227a4782b';
const RECORDING_A = 'ac2c28b3-c278-47f9-88de-80d2a663ed39';
const RECORDING_B = '2da3ee28-67d0-4125-b91a-149555634b5d';
const RECORDING_C = 'd02c00a6-1e9f-4f5e-b671-aa4a22b02a47';
const RECORDING_D = 'b97bc761-ff3c-476a-a00c-038a43603621';

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

    // #529 follow-up: single-word-title typo tolerance (majkinetor's own
    // example: "Oburumankoma" vs "Oburumakoma" — a one-letter deletion that
    // token-overlap alone can never catch since it's a single token).
    out.typoTolerated = F.titleSimilar('Oburumankoma', 'Oburumakoma');
    out.typoRejectsUnrelated = !F.titleSimilar('Oburumankoma', 'Completely Different');

    // #529 follow-up: match cutoff levels change what Auto-match will union.
    const rTitleLenOnly = F.mkRecording('t1', { title: 'Some Track', length: 180000, isrcs: [], artistCredit: 'Artist One', releases: [] });
    const rTitleLenOnly2 = F.mkRecording('t2', { title: 'Some Track', length: 180500, isrcs: [], artistCredit: 'Completely Different Artist', releases: [] });
    out.strictRejectsTitleLenOnly = F.autoMatch([rTitleLenOnly, rTitleLenOnly2], 5000, 'strict').length === 0;
    out.looseAcceptsTitleLenOnly = F.autoMatch([rTitleLenOnly, rTitleLenOnly2], 5000, 'loose').length === 1;
    out.normalRejectsTitleLenOnly = F.autoMatch([rTitleLenOnly, rTitleLenOnly2], 5000, 'normal').length === 0;

    // #529 follow-up: "I should be able to add release URL and release group
    // URL to get all recordings from them" — the Add box now detects entity
    // type from the pasted URL's path.
    out.addRelease = F.parseAddInput ? F.parseAddInput('https://musicbrainz.org/release/259b3df7-0c94-49e6-b941-923b8d59ea28') : null;
    out.addReleaseGroup = F.parseAddInput ? F.parseAddInput('https://musicbrainz.org/release-group/7581d544-a648-4503-ad29-53688a114d74') : null;
    out.addRecordingBare = F.parseAddInput ? F.parseAddInput('2bea9225-3cee-4a23-b8f3-cd705bed3d06') : null;

    // #529 follow-up (real bug, majkinetor live): "'Return to pool' returns
    // the entire group back instead single recording." Root cause: a group
    // left with <2 members used to auto-dissolve, evicting its last member
    // too. Build a real 2-member group via the STATE mutators and confirm
    // returning ONE member leaves the group alive with the other still in it.
    const p1 = F.mkRecording('p1', { title: 'X', length: 1000, isrcs: [], artistCredit: '', releases: [] });
    const p2 = F.mkRecording('p2', { title: 'Y', length: 1000, isrcs: [], artistCredit: '', releases: [] });
    F.addToPool(p1); F.addToPool(p2);
    const grp = F.createGroupWithMember('p1');
    F.addToGroup('p2', grp.id);
    F.returnToPool('p1', grp.id);
    const survivingGroup = F.findGroup(grp.id);
    out.groupSurvivesPartialReturn = !!survivingGroup && survivingGroup.memberGids.length === 1 && survivingGroup.memberGids[0] === 'p2';
    out.returnedMemberBackInPool = F.STATE.poolOrder.includes('p1');
    // cleanup so this synthetic state doesn't leak into the live-seed section below
    F.STATE.recordings.delete('p1'); F.STATE.recordings.delete('p2');
    F.STATE.poolOrder.length = 0; F.STATE.groups.length = 0;

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
ck(engineChecks.typoTolerated, 'titleSimilar tolerates a single-letter typo ("Oburumankoma" ~ "Oburumakoma")');
ck(engineChecks.typoRejectsUnrelated, 'titleSimilar still rejects genuinely different titles');
ck(engineChecks.strictRejectsTitleLenOnly, 'strict cutoff rejects a title+length-only match (no ISRC/AcoustID)');
ck(engineChecks.normalRejectsTitleLenOnly, 'normal cutoff rejects title+length without an artist match');
ck(engineChecks.looseAcceptsTitleLenOnly, 'loose cutoff accepts title+length alone, artist not required');
ck(engineChecks.addRelease && engineChecks.addRelease.type === 'release', 'parseAddInput detects a /release/ URL');
ck(engineChecks.addReleaseGroup && engineChecks.addReleaseGroup.type === 'release-group', 'parseAddInput detects a /release-group/ URL');
ck(engineChecks.addRecordingBare && engineChecks.addRecordingBare.type === 'recording', 'parseAddInput defaults a bare MBID to recording');
ck(engineChecks.groupSurvivesPartialReturn, 'returnToPool: returning ONE member leaves the group alive with the other still in it (regression for the "returns the whole group" bug)');
ck(engineChecks.returnedMemberBackInPool, 'returnToPool: the returned member is back in the pool');

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

// #529 follow-up: "we also need merge all" — build a SECOND group (C+D) so
// mergeAll() actually has more than one group to loop over, then drive it
// (not mergeGroup directly) for the real submit, matching the footer button.
const grouped2 = await page.evaluate(async ([gidC, gidD]) => {
    const F = window.__fusion;
    const recC = await F.fetchRecordingByGid(gidC);
    const recD = await F.fetchRecordingByGid(gidD);
    if (!recC || !recD) return { ok: false };
    F.addToPool(recC); F.addToPool(recD);
    const group = F.createGroupWithMember(gidC);
    F.addToGroup(gidD, group.id);
    return { ok: true, groupId: group.id };
}, [RECORDING_C, RECORDING_D]);
ck(grouped2.ok, 'built a second manual group (C+D) for the mergeAll() test');

console.log('Submitting REAL merges via mergeAll() on test.musicbrainz.org (sandbox — safe)…');
const mergeAllResult = await page.evaluate(async () => {
    const F = window.__fusion;
    await F.mergeAll();
    return F.STATE.groups.map(g => ({ id: g.id, memberGids: g.memberGids, state: g.state, error: g.error }));
});
console.log('mergeAll result:', JSON.stringify(mergeAllResult));
ck(mergeAllResult.length === 2, 'mergeAll() left exactly the 2 groups that were built (' + mergeAllResult.length + ')');
ck(mergeAllResult.every(g => g.state === 'done'), 'mergeAll() drove EVERY ready group to state=done, not just the first (' + JSON.stringify(mergeAllResult.map(g => g.state)) + ')');

// verify against WS2: both survivors still resolve. MB's WS2 throttles under
// load (transient 503s, same as Fusion's own wsGet() handles with retries),
// so retry here too rather than treating a rate-limit blip as a real failure.
await page.waitForTimeout(1000);
const post = await page.evaluate(async (gids) => {
    const out = {};
    for (const gid of gids) {
        let status = 0;
        for (let attempt = 0; attempt <= 3; attempt++) {
            status = await fetch(`/ws/2/recording/${gid}?fmt=json`).then(r => r.status).catch(() => 0);
            if (status !== 503 && status !== 429) break;
            await new Promise(res => setTimeout(res, 800 * Math.pow(2, attempt)));
        }
        out[gid] = status;
    }
    return out;
}, [RECORDING_A, RECORDING_C]);
console.log('post-merge WS2 status check:', JSON.stringify(post));
ck(post[RECORDING_A] === 200 && post[RECORDING_C] === 200, 'both survivor recordings still resolve via WS2 after mergeAll()');

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
