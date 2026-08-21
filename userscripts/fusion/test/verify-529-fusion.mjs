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
            // credentials:'include' is ILLEGAL against Access-Control-Allow-Origin:* —
            // it silently fails CORS. Real GM_xmlhttpRequest isn't CORS-bound at all;
            // here, only same-origin (MB) calls need the session cookie.
            const sameOrigin = new URL(opts.url, location.href).origin === location.origin;
            const r = await fetch(opts.url, { method: opts.method || 'GET', headers: opts.headers || {}, body: opts.data, redirect: 'follow', credentials: sameOrigin ? 'include' : 'omit' });
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

    // #529 follow-up: "kill entire group" and "clear entire board" — both
    // return every member to the pool rather than dropping them.
    const k1 = F.mkRecording('k1', { title: 'K1', length: 1000, isrcs: [], artistCredit: '', releases: [] });
    const k2 = F.mkRecording('k2', { title: 'K2', length: 1000, isrcs: [], artistCredit: '', releases: [] });
    const k3 = F.mkRecording('k3', { title: 'K3', length: 1000, isrcs: [], artistCredit: '', releases: [] });
    const k4 = F.mkRecording('k4', { title: 'K4', length: 1000, isrcs: [], artistCredit: '', releases: [] });
    [k1, k2, k3, k4].forEach(r => F.addToPool(r));
    const kg1 = F.createGroupWithMember('k1'); F.addToGroup('k2', kg1.id);
    const kg2 = F.createGroupWithMember('k3'); F.addToGroup('k4', kg2.id);
    F.deleteGroup(kg1.id);
    out.deleteGroupRemovesGroup = !F.findGroup(kg1.id);
    out.deleteGroupReturnsMembers = F.STATE.poolOrder.includes('k1') && F.STATE.poolOrder.includes('k2');
    out.otherGroupUntouchedByDelete = !!F.findGroup(kg2.id) && F.findGroup(kg2.id).memberGids.length === 2;
    F.clearBoard();
    out.clearBoardRemovesAllGroups = F.STATE.groups.length === 0;
    out.clearBoardReturnsEveryMember = ['k1', 'k2', 'k3', 'k4'].every(g => F.STATE.poolOrder.includes(g));
    F.STATE.recordings.delete('k1'); F.STATE.recordings.delete('k2'); F.STATE.recordings.delete('k3'); F.STATE.recordings.delete('k4');
    F.STATE.poolOrder.length = 0; F.STATE.groups.length = 0;

    // #529 follow-up: "Video recordings should never be added to groups with
    // audio recordings" — a hard block, not just a lower score, at every entry
    // point (auto-match AND manual add).
    const va1 = F.mkRecording('va1', { title: 'Same Title', length: 100000, isrcs: ['XXAB11111111'], artistCredit: 'Band', releases: [], video: false });
    const va2 = F.mkRecording('va2', { title: 'Same Title', length: 100000, isrcs: ['XXAB11111111'], artistCredit: 'Band', releases: [], video: true });
    const sigVA = F.pairSignals(va1, va2, 5000);
    out.videoMismatchDetected = sigVA.videoMismatch === true;
    out.videoMismatchBlocksEvenWithIsrc = F.shouldUnion(sigVA, 'normal') === false;
    const autoMatchGroups = F.autoMatch([va1, va2], 5000, 'normal');
    out.autoMatchNeverGroupsVideoWithAudio = autoMatchGroups.length === 0;
    // manual add must refuse it too, not just Auto-match
    F.addToPool(va1); F.addToPool(va2);
    const vaGroup = F.createGroupWithMember('va1');
    const addResult = F.addToGroup('va2', vaGroup.id);
    out.manualAddRefusesVideoAudioMix = addResult === false;
    out.videoStaysInPoolAfterRefusal = F.STATE.poolOrder.includes('va2');
    F.STATE.recordings.delete('va1'); F.STATE.recordings.delete('va2');
    F.STATE.poolOrder.length = 0; F.STATE.groups.length = 0;
    // unknown (null) video status must never block — e.g. artist-scrape seeds
    // before their background video backfill lands.
    const vu1 = F.mkRecording('vu1', { title: 'Z', length: 100000, isrcs: ['XXAB22222222'], artistCredit: 'Band', releases: [], video: null });
    const vu2 = F.mkRecording('vu2', { title: 'Z', length: 100000, isrcs: ['XXAB22222222'], artistCredit: 'Band', releases: [], video: true });
    out.unknownVideoNeverBlocks = F.pairSignals(vu1, vu2, 5000).videoMismatch === false;

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
ck(engineChecks.deleteGroupRemovesGroup, 'deleteGroup: the group itself is gone');
ck(engineChecks.deleteGroupReturnsMembers, 'deleteGroup: both its members return to the pool');
ck(engineChecks.otherGroupUntouchedByDelete, 'deleteGroup: a different group is untouched');
ck(engineChecks.clearBoardRemovesAllGroups, 'clearBoard: every group is gone');
ck(engineChecks.clearBoardReturnsEveryMember, 'clearBoard: every member from every group is back in the pool');
ck(engineChecks.videoMismatchDetected, 'pairSignals detects a video/audio mismatch even with identical title+ISRC');
ck(engineChecks.videoMismatchBlocksEvenWithIsrc, 'shouldUnion refuses a video/audio pair even with a shared ISRC — the hardest signal there is');
ck(engineChecks.autoMatchNeverGroupsVideoWithAudio, 'autoMatch never groups a video recording with an audio one, despite otherwise-perfect signals');
ck(engineChecks.manualAddRefusesVideoAudioMix, 'addToGroup refuses to manually mix video into an audio group (and vice versa)');
ck(engineChecks.videoStaysInPoolAfterRefusal, 'a refused video/audio add leaves the recording in the pool, not silently dropped');
ck(engineChecks.unknownVideoNeverBlocks, 'unknown (null) video status never blocks a match — only a KNOWN mismatch does');

// #529 (majkinetor): "I didn't see a single AcoustID, although all should have
// it basically" — correct: MB does NOT store AcoustIDs as recording→URL
// relationships (verified: a recording with 2 AcoustIDs has zero url-rels), so
// the original source was simply wrong and always yielded []. They come from
// AcoustID's own list_by_mbid, which needs no key and supports batching.
const acoustidCheck = await page.evaluate(async () => {
    const F = window.__fusion;
    const known = '5a54cad7-97f7-43bb-b05a-59723da75e16';   // has AcoustIDs
    const map = await F.fetchAcoustIdsBatch([known, 'ac2c28b3-c278-47f9-88de-80d2a663ed39']);
    const rec = F.mkRecording(known, { title: 'AcoustID probe', length: 1000, isrcs: [], artistCredit: 'X', releases: [] });
    await F.enrichAcoustIds([rec], 4);
    return { batchKeys: [...map.keys()].length, knownIds: map.get(known) || [], viaEnrich: rec.acoustids };
});
console.log('acoustid:', JSON.stringify(acoustidCheck));
ck(acoustidCheck.batchKeys === 2, 'fetchAcoustIdsBatch resolves multiple MBIDs in ONE request (' + acoustidCheck.batchKeys + ' keys)');
ck(acoustidCheck.knownIds.length > 0, 'a recording known to have AcoustIDs actually returns them (' + JSON.stringify(acoustidCheck.knownIds) + ') — the old url-rels source always returned none');
ck(acoustidCheck.viaEnrich.length > 0, 'enrichAcoustIds populates rec.acoustids from the real service');

// #529 (majkinetor): per-group edit note, opened from a ✎ in the card title,
// with the button coloured differently when a custom note exists.
const noteCheck = await page.evaluate(() => {
    const F = window.__fusion;
    const a = F.mkRecording('n1', { title: 'N1', length: 1000, isrcs: [], artistCredit: 'X', releases: [] });
    const b = F.mkRecording('n2', { title: 'N2', length: 1000, isrcs: [], artistCredit: 'X', releases: [] });
    F.addToPool(a); F.addToPool(b);
    const g = F.createGroupWithMember('n1'); F.addToGroup('n2', g.id);
    const auto = F.buildEditNote(g);
    g.editNote = 'Same take, verified by ear.';
    const custom = F.buildEditNote(g);
    F.deleteGroup(g.id); F.STATE.recordings.delete('n1'); F.STATE.recordings.delete('n2');
    F.STATE.poolOrder.length = 0;
    return { auto, custom };
});
ck(/Merged via Fusion/.test(noteCheck.auto), 'a group with no custom note still gets the auto-generated note');
ck(noteCheck.custom.startsWith('Same take, verified by ear.'), 'a custom note replaces the auto reason line');
ck(/Fusion v.* by majkinetor/.test(noteCheck.custom), 'the attribution footer is appended even to a custom note');

// #529 (majkinetor): a recording that demonstrably has an ISRC on MB was
// showing isrc=none in the log after release-group seeding. The rgid: SEARCH
// index can lag/omit fields, and MB's WS2 sends no cache headers so the
// browser can also serve a stale copy. enrichAcoustIds now reconciles ISRCs
// against the authoritative per-recording lookup, which never goes via search.
const isrcBackfill = await page.evaluate(async () => {
    const F = window.__fusion;
    const detail = await F.fetchRecordingDetail('ac2c28b3-c278-47f9-88de-80d2a663ed39');
    // simulate a stale search result: recording known to have data, seeded with none
    const stale = F.mkRecording('ac2c28b3-c278-47f9-88de-80d2a663ed39', { title: 'Stale Seed', length: 1000, isrcs: [], artistCredit: 'X', releases: [] });
    await F.enrichAcoustIds([stale], 1);
    return { detailHasIsrcField: !!detail && Array.isArray(detail.isrcs), backfilled: stale.isrcs, detailIsrcs: detail && detail.isrcs };
});
ck(isrcBackfill.detailHasIsrcField, 'fetchRecordingDetail returns an isrcs array from the authoritative per-recording lookup');
ck(JSON.stringify(isrcBackfill.backfilled) === JSON.stringify(isrcBackfill.detailIsrcs),
   'enrichAcoustIds reconciles a stale/empty seeded ISRC list against MB\'s real data (' + JSON.stringify(isrcBackfill.backfilled) + ')');

// ── live: open the real UI (not just STATE), seed, add a second recording,
// group via REAL double-clicks (regression guard for the bug below), merge ──
const seedInfo = await page.evaluate(async () => {
    await window.__fusion.openFusion();
    return { poolSize: window.__fusion.STATE.poolOrder.length, scopeType: window.__fusion.SCOPE.type };
});
ck(seedInfo.scopeType === 'recording', 'Fusion detects recording-page scope on /recording/' + RECORDING_A.slice(0, 8) + '…');
ck(seedInfo.poolSize === 1, 'recording-page seed puts exactly the one recording in the pool (' + seedInfo.poolSize + ')');

const added = await page.evaluate(async (gidB) => {
    const F = window.__fusion;
    const recB = await F.fetchRecordingByGid(gidB);
    if (!recB) return false;
    F.addToPool(recB);
    F.renderAll();
    return true;
}, RECORDING_B);
ck(added, 'added a second recording to the pool via fetchRecordingByGid');

// #529 real bug (majkinetor, live): double-clicking a pool card silently
// created NO group at all — the single-click handler's full renderPool() on
// every click replaced the card's DOM node mid-gesture, and a native dblclick
// only fires when both clicks land on the SAME element. Since no group was
// ever formed this way, Merge All stayed permanently disabled ("unclickable").
// Fixed by only toggling a CSS class on selection clicks instead of re-rendering.
// This drives the exact same real DOM gesture a user performs, not the STATE API.
const cardsBefore = await page.$$('.fs-pcard');
ck(cardsBefore.length === 2, 'pool has exactly 2 cards before double-clicking (' + cardsBefore.length + ')');
await cardsBefore[0].dblclick();
await page.waitForTimeout(150);
const afterFirstDblclick = await page.evaluate(() => window.__fusion.STATE.groups.map(g => g.memberGids.length));
ck(afterFirstDblclick.length === 1 && afterFirstDblclick[0] === 1, 'first double-click creates a 1-member group (' + JSON.stringify(afterFirstDblclick) + ')');
const cardsAfter = await page.$$('.fs-pcard');
ck(cardsAfter.length === 1, 'the grouped card left the pool (' + cardsAfter.length + ' remain)');
await cardsAfter[0].dblclick();
await page.waitForTimeout(150);
const grouped = await page.evaluate(() => {
    const g = window.__fusion.STATE.groups[0];
    return { memberCount: g ? g.memberGids.length : 0, poolSize: window.__fusion.STATE.poolOrder.length, mergeAllDisabled: document.getElementById('fs-mergeall').disabled };
});
ck(grouped.memberCount === 2, 'second double-click joins the same (only) group — now has 2 members (' + grouped.memberCount + ')');
ck(grouped.poolSize === 0, 'pool is empty after both recordings moved into the group');
ck(grouped.mergeAllDisabled === false, 'Merge All is enabled (clickable) once a real 2-member group exists — this is the reported "unclickable" symptom, now fixed');

// #529 real bug (majkinetor, screenshot): "I can't see individual recordings
// here (have to zoom out)". Root cause: .fs-gcard has overflow:hidden with no
// flex-shrink:0, and overflow:hidden makes a flex item's automatic min-height
// resolve to 0 (not content-based) — so with many groups competing for a
// fixed-height modal, flexbox squeezed every card to fit instead of letting
// .fs-colbody's own overflow-y:auto scroll, clipping the rows inside each
// squeezed card. Reproduce with many single-member groups (cheap, synthetic).
const layoutCheck = await page.evaluate(() => {
    const F = window.__fusion;
    for (let i = 0; i < 10; i++) {
        const gid = 'layout-' + i;
        F.addToPool(F.mkRecording(gid, { title: 'Layout Test ' + i, length: 1000, isrcs: [], artistCredit: '', releases: [] }));
        F.createGroupWithMember(gid);
    }
    F.renderAll();
    const body = document.getElementById('fs-groups-body');
    const firstCard = document.querySelector('.fs-gcard');
    const firstRow = document.querySelector('.fs-grow');
    const result = {
        scrollableInternally: body.scrollHeight > body.clientHeight,
        firstCardHeight: firstCard ? firstCard.getBoundingClientRect().height : 0,
        firstRowHeight: firstRow ? firstRow.getBoundingClientRect().height : 0,
    };
    // cleanup — don't leak into the mergeAll section below
    for (let i = 0; i < 10; i++) { const gid = 'layout-' + i; const g = F.STATE.groups.find(x => x.memberGids.includes(gid)); if (g) F.deleteGroup(g.id); F.STATE.recordings.delete(gid); const pi = F.STATE.poolOrder.indexOf(gid); if (pi !== -1) F.STATE.poolOrder.splice(pi, 1); }
    F.renderAll();
    return result;
});
ck(layoutCheck.scrollableInternally, 'groups column scrolls internally instead of squeezing cards when there are more groups than fit (scrollHeight > clientHeight)');
ck(layoutCheck.firstRowHeight >= 20, 'a group row keeps its real height instead of being clipped to ~0 (' + layoutCheck.firstRowHeight.toFixed(1) + 'px)');
ck(layoutCheck.firstCardHeight >= 60, 'a full group card (header+row+dropzone) keeps its real height (' + layoutCheck.firstCardHeight.toFixed(1) + 'px)');

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

// Drive the REAL footer button, not F.mergeAll() directly. Calling the
// function with no args hid a live bug for a whole round: the button was wired
// as `onclick = mergeAll`, so the click Event landed in mergeAll's `concurrency`
// parameter — truthy, so `|| 3` kept it — and Math.min(Event, n) → NaN made
// Array.from({length:NaN}) spawn ZERO workers. Merge All logged "queued" then
// instantly "finished: 0 merged, 0 failed" while a direct mergeAll() call in
// the test passed happily. Always exercise the real user gesture.
console.log('Submitting REAL merges by clicking Merge All on test.musicbrainz.org (sandbox — safe)…');
await page.click('#fs-mergeall');
await page.waitForFunction(() => window.__fusion.STATE.groups.every(g => g.state === 'done' || g.state === 'error'), { timeout: 60000 });
const mergeAllResult = await page.evaluate(() => window.__fusion.STATE.groups.map(g => ({ id: g.id, memberGids: g.memberGids, state: g.state, error: g.error })));
console.log('mergeAll result:', JSON.stringify(mergeAllResult));
ck(mergeAllResult.length === 2, 'clicking Merge All left exactly the 2 groups that were built (' + mergeAllResult.length + ')');
ck(mergeAllResult.every(g => g.state === 'done'), 'clicking Merge All drove EVERY ready group to state=done, not just the first (' + JSON.stringify(mergeAllResult.map(g => g.state)) + ')');
const workerLine = await page.evaluate(() => window.__fusion.getLogLines().find(l => /Merge All: \d+ group\(s\) queued/.test(l)) || '');
ck(/up to [1-9]\d* in parallel/.test(workerLine), 'Merge All reports a real worker count, not NaN — the exact "registered but immediately finished" bug (' + workerLine + ')');

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

// #529 follow-up (majkinetor): "In logging I want to see merge all event and
// what is going on" + "we can see the data of the recordings" — the log
// should carry enough detail to diagnose a merge without a screenshot.
const logLines = await page.evaluate(() => window.__fusion.getLogLines());
const logText = logLines.join('\n');
ck(/Merge All: 2 group\(s\) queued/.test(logText), 'log shows Merge All starting with the queued group count');
ck(/isrc=/.test(logText) && /length=/.test(logText), 'log shows recording data (isrc/length/etc) for merged members, not just ids');
ck(/Merge All finished: 2 merged, 0 failed/.test(logText), 'log shows a final Merge All summary line');

// #529 real bug (majkinetor: "log button does nothing … it just closes the
// help popup"). openLog() set only the element's ID, but its CSS is a CLASS
// rule (.fs-logpop{position:fixed;…}) — so the panel was created completely
// unstyled: position:static, transparent, no z-index, rendered at the bottom
// of the page BEHIND the modal. It "existed", so an existence-only assertion
// (getElementById → truthy) passed happily while the user saw nothing. These
// assertions therefore check real VISIBILITY — computed style, viewport
// geometry, and a hit test — never mere existence.
await page.evaluate(() => { document.getElementById('fs-settings')?.remove(); document.getElementById('fs-logpop')?.remove(); });
await page.click('#fs-cfg');
await page.waitForTimeout(250);
ck(await page.evaluate(() => !!document.getElementById('fs-settings')), 'the ⚙ settings popup opens');
await page.click('.fs-logbtn');
await page.waitForTimeout(350);
const logVis = await page.evaluate(() => {
    const pop = document.getElementById('fs-logpop');
    if (!pop) return { exists: false };
    const cs = getComputedStyle(pop);
    const r = pop.getBoundingClientRect();
    const probeX = Math.min(window.innerWidth - 5, Math.max(5, r.left + r.width / 2));
    const probeY = Math.min(window.innerHeight - 5, Math.max(5, r.top + 20));
    const hit = document.elementFromPoint(probeX, probeY);
    return {
        exists: true,
        position: cs.position,
        visible: cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) !== 0,
        inViewport: r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0,
        onTop: !!hit && pop.contains(hit),
        lineCount: pop.querySelectorAll('.fs-log-li').length,
    };
});
console.log('log panel visibility:', JSON.stringify(logVis));
ck(logVis.exists, 'clicking Log creates the log panel');
ck(logVis.position === 'fixed', 'log panel is positioned (fixed) — i.e. its CSS class actually applied (' + logVis.position + ')');
ck(logVis.visible && logVis.inViewport, 'log panel is actually visible and within the viewport');
ck(logVis.onTop, 'log panel is on top at its own position, not hidden behind the modal — the exact "log button does nothing" symptom');
ck(logVis.lineCount > 0, 'log panel is populated with entries (' + logVis.lineCount + ')');

// #529 (majkinetor): "Make entire log window as in apollo (it has min/maximize,
// wider etc.)" — the Apollo-style viewer: wider, badge, minimize/restore,
// clickable URLs, severity colouring, Escape-to-close, state remembered.
const logWin = await page.evaluate(() => {
    const pop = document.getElementById('fs-logpop');
    const r = pop.getBoundingClientRect();
    return {
        width: Math.round(r.width),
        badge: pop.querySelector('.fs-log-badge') ? pop.querySelector('.fs-log-badge').textContent : null,
        hasMin: !!pop.querySelector('.fs-logpop-min'),
        hasCopy: !!pop.querySelector('.fs-logpop-copy'),
        links: pop.querySelectorAll('.fs-log-m a').length,
        severityColoured: (() => {
            const w = pop.querySelector('.fs-log-warn .fs-log-m'), i = pop.querySelector('.fs-log-info .fs-log-m');
            return w && i ? getComputedStyle(w).color !== getComputedStyle(i).color : null;
        })(),
    };
});
console.log('log window:', JSON.stringify(logWin));
ck(logWin.width >= 600, 'log window is wide like Apollo\'s (' + logWin.width + 'px, was 420)');
ck(logWin.hasMin && logWin.hasCopy, 'log window has both Minimize and Copy controls');
ck(/^\(\d+\)/.test(logWin.badge || ''), 'header shows an entry-count badge (' + logWin.badge + ')');
ck(logWin.links > 0, 'URLs in log lines are rendered as clickable links (' + logWin.links + ')');
ck(logWin.severityColoured !== false, 'warn lines are coloured differently from info lines');
// minimize / restore
await page.click('#fs-logpop .fs-logpop-min');
await page.waitForTimeout(200);
const minned = await page.evaluate(() => {
    const pop = document.getElementById('fs-logpop');
    return { hasMinClass: pop.classList.contains('min'), listVisible: getComputedStyle(pop.querySelector('.fs-log-list')).display !== 'none', btn: pop.querySelector('.fs-logpop-min').textContent };
});
ck(minned.hasMinClass && !minned.listVisible, 'Minimize collapses the log list, leaving just the title bar');
ck(minned.btn === '▢', 'the minimize button flips to a restore glyph');
await page.click('#fs-logpop .fs-logpop-min');
await page.waitForTimeout(200);
ck(await page.evaluate(() => getComputedStyle(document.getElementById('fs-logpop').querySelector('.fs-log-list')).display !== 'none'), 'Restore brings the log list back');
// Escape closes, and the open-state is remembered
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
ck(await page.evaluate(() => !document.getElementById('fs-logpop')), 'Escape closes the log window');

// #529 (majkinetor): the ✎ edit-note button on a card — driven by REAL clicks
// with the UI actually open, since this is a DOM/CSS behaviour.
await page.evaluate(() => { document.getElementById('fs-logpop')?.remove(); document.getElementById('fs-settings')?.remove(); });
const noteGid = await page.evaluate(() => {
    const F = window.__fusion;
    const a = F.mkRecording('n1', { title: 'Note A', length: 1000, isrcs: [], artistCredit: 'X', releases: [] });
    const b = F.mkRecording('n2', { title: 'Note B', length: 1000, isrcs: [], artistCredit: 'X', releases: [] });
    F.addToPool(a); F.addToPool(b);
    const g = F.createGroupWithMember('n1'); F.addToGroup('n2', g.id);
    F.renderAll();
    return g.id;
});
const plainColor = await page.evaluate(g => { const b = document.querySelector('.fs-gcard[data-gid="' + g + '"] .fs-note-btn'); return b ? getComputedStyle(b).color : ''; }, noteGid);
await page.click('.fs-gcard[data-gid="' + noteGid + '"] [data-act="edit-note"]');
await page.waitForTimeout(200);
const editing = await page.evaluate(g => ({
    ta: !!document.querySelector('.fs-gcard[data-gid="' + g + '"] .fs-note-ta'),
    rowsGone: !document.querySelector('.fs-gcard[data-gid="' + g + '"] .fs-grow'),
}), noteGid);
ck(editing.ta && editing.rowsGone, 'clicking ✎ turns the whole card into the edit-note textbox (member rows replaced)');
await page.fill('.fs-gcard[data-gid="' + noteGid + '"] .fs-note-ta', 'Same take, verified by ear.');
await page.click('.fs-gcard[data-gid="' + noteGid + '"] [data-act="note-save"]');
await page.waitForTimeout(200);
const saved = await page.evaluate(g => {
    const grp = window.__fusion.findGroup(g);
    const b = document.querySelector('.fs-gcard[data-gid="' + g + '"] .fs-note-btn');
    return { stored: grp.editNote, hasClass: b ? b.classList.contains('fs-has-note') : false, color: b ? getComputedStyle(b).color : '', note: window.__fusion.buildEditNote(grp), rowsBack: !!document.querySelector('.fs-gcard[data-gid="' + g + '"] .fs-grow') };
}, noteGid);
console.log('edit note:', JSON.stringify(saved));
ck(saved.stored === 'Same take, verified by ear.', 'the typed note is saved on the group');
ck(saved.rowsBack, 'saving returns the card to its normal member-row view');
ck(saved.hasClass, 'the ✎ button is marked as having a custom note');
ck(saved.color !== plainColor, 'the ✎ button changes colour once a note exists (' + saved.color + ' vs ' + plainColor + ')');
ck(saved.note.startsWith('Same take, verified by ear.') && /Fusion v.* by majkinetor/.test(saved.note), 'the merge will submit the custom note plus the attribution footer');

// #529 (majkinetor): "we should color the same isrc/acousticid within card …
// If there are multiple groups, each should have its own color." Only values
// shared by 2+ members get a tint; a value appearing once proves nothing.
const tint = await page.evaluate(() => {
    const F = window.__fusion;
    const mk = (id, isrc, acid) => F.mkRecording(id, { title: 'T', length: 1000, isrcs: isrc ? [isrc] : [], acoustids: acid ? [acid] : [], artistCredit: 'X', releases: [] });
    // SHARED_A on two members, SHARED_B on two others, LONELY on one
    const recs = [mk('c1', 'SHARED_A', null), mk('c2', 'SHARED_A', null), mk('c3', null, 'SHARED_B'), mk('c4', null, 'SHARED_B'), mk('c5', 'LONELY', null)];
    recs.forEach(r => F.addToPool(r));
    const g = F.createGroupWithMember('c1');
    ['c2', 'c3', 'c4', 'c5'].forEach(x => F.addToGroup(x, g.id));
    F.renderAll();
    const card = document.querySelector('.fs-gcard[data-gid="' + g.id + '"]');
    const cells = [...card.querySelectorAll('.fs-isrc')].map(s => ({ v: s.textContent.trim(), cls: (s.className.match(/fs-idc\d/) || [''])[0] }));
    const out = {
        sharedA: cells.filter(c => c.v === 'SHARED_A').map(c => c.cls),
        sharedB: cells.filter(c => /^SHARED_B/.test(c.v) || /^SHARED_B/.test(c.v.replace('…', ''))).map(c => c.cls),
        lonely: cells.filter(c => c.v === 'LONELY').map(c => c.cls),
        dashes: cells.filter(c => c.v === '—').map(c => c.cls),
    };
    F.deleteGroup(g.id); ['c1','c2','c3','c4','c5'].forEach(x => F.STATE.recordings.delete(x));
    F.STATE.poolOrder.length = 0; F.renderAll();
    return out;
});
console.log('tint:', JSON.stringify(tint));
ck(tint.sharedA.length === 2 && tint.sharedA[0] && tint.sharedA[0] === tint.sharedA[1], 'both rows carrying the same ISRC get the SAME tint (' + JSON.stringify(tint.sharedA) + ')');
ck(tint.sharedB.length === 2 && tint.sharedB[0] && tint.sharedB[0] === tint.sharedB[1], 'both rows carrying the same AcoustID get the same tint (' + JSON.stringify(tint.sharedB) + ')');
ck(tint.sharedA[0] !== tint.sharedB[0], 'a DIFFERENT shared value gets a DIFFERENT colour (' + tint.sharedA[0] + ' vs ' + tint.sharedB[0] + ')');
ck(tint.lonely.every(c => !c), 'an identifier held by only one member is not tinted');
ck(tint.dashes.every(c => !c), 'empty (—) identifier cells are never tinted');

// #529 (majkinetor): "it's not clear loading is happening - make it flashing in
// the title" — a ref-counted pulsing indicator next to the window title.
const busy = await page.evaluate(async () => {
    const F = window.__fusion;
    const e = document.getElementById('fs-busy');
    const hiddenAtRest = e.style.display === 'none';
    F.busyStart('testing…');
    const shown = { display: e.style.display, text: e.textContent, anim: getComputedStyle(e).animationName };
    F.busyStart('nested…');          // overlapping op
    F.busyEnd();                     // inner finishes — must STAY visible
    const stillShown = e.style.display !== 'none';
    F.busyEnd();                     // outer finishes — now hidden
    return { hiddenAtRest, shown, stillShown, hiddenAfter: e.style.display === 'none' };
});
console.log('busy:', JSON.stringify(busy));
ck(busy.hiddenAtRest, 'the loading indicator is hidden when idle');
ck(busy.shown.display !== 'none' && /⏳/.test(busy.shown.text), 'it appears in the title while work is in flight (' + busy.shown.text + ')');
ck(busy.shown.anim === 'fs-pulse', 'it flashes (CSS pulse animation applied)');
ck(busy.stillShown, 'a nested operation finishing does not clear it early (ref-counted)');
ck(busy.hiddenAfter, 'it clears once the last operation finishes');

// #529 (majkinetor): "acoustic id still not fully fetched … no dot in the pool
// is lighted". AcoustIDs used to be fetched ONLY by Auto-match, so a freshly
// seeded pool always showed them unknown. Seeding now enriches in the
// background — assert it happens WITHOUT pressing Auto-match.
await page.goto('https://test.musicbrainz.org/release-group/ce90ac93-3c64-464a-8a44-ce6f20ae0f53', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__fusion, { timeout: 15000 });
await page.click('#fs-launch');
const seedAc = await page.waitForFunction(
    () => { const r = [...window.__fusion.STATE.recordings.values()]; return r.length && r.every(x => x.acoustids !== null) ? { total: r.length, withAc: r.filter(x => x.acoustids.length).length, lit: document.querySelectorAll('.fs-pcard .fs-b-on').length } : null; },
    { timeout: 90000 }).then(h => h.jsonValue());
console.log('seed-time acoustid:', JSON.stringify(seedAc));
ck(seedAc.withAc > 0, 'AcoustIDs are resolved at seed time, before Auto-match is ever pressed (' + seedAc.withAc + '/' + seedAc.total + ')');
ck(seedAc.lit > 0, 'the pool cards\' AcoustID dots actually light up (' + seedAc.lit + ')');

// #529 (majkinetor): "make maximize/minimize button the same as in group
// therapy" — GT uses a borderless ⛶ that flips to ❐ when maximized.
const maxRest = await page.evaluate(() => { const b = document.getElementById('fs-max'); return { g: b.textContent, border: getComputedStyle(b).borderStyle }; });
ck(maxRest.g === '⛶', 'maximize button uses Group Therapy\'s ⛶ glyph (' + maxRest.g + ')');
ck(maxRest.border === 'none', 'and Group Therapy\'s borderless styling');
await page.click('#fs-max'); await page.waitForTimeout(250);
const maxOn = await page.evaluate(() => { const b = document.getElementById('fs-max'); return { g: b.textContent, t: b.title, on: document.getElementById('fs-cons').classList.contains('fs-maximized') }; });
ck(maxOn.on && maxOn.g === '❐' && maxOn.t === 'Restore', 'maximizing flips it to ❐ / "Restore" like GT (' + JSON.stringify(maxOn) + ')');
await page.click('#fs-max'); await page.waitForTimeout(250);
const maxOff = await page.evaluate(() => { const b = document.getElementById('fs-max'); return { g: b.textContent, on: document.getElementById('fs-cons').classList.contains('fs-maximized') }; });
ck(!maxOff.on && maxOff.g === '⛶', 'restoring flips it back to ⛶');
await page.evaluate(g => { const F = window.__fusion; F.deleteGroup(g); F.STATE.recordings.delete('n1'); F.STATE.recordings.delete('n2'); F.STATE.poolOrder.length = 0; F.renderAll(); }, noteGid);

// #529 (majkinetor): "scraping the page is not going to cut it, we need to use
// an API here". Artist seeding used to scrape the visible table, which capped
// at MB's 100-row page AND broke entirely when the logged-in layout shifted the
// columns. It now uses the indexed search (arid:), paginated — so the pool must
// exceed one page's worth and carry data the DOM never exposed.
await page.goto('https://test.musicbrainz.org/artist/c321a13a-1c52-43c0-b60a-3a454cb7f9a2/recordings', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__fusion, { timeout: 15000 });
await page.click('#fs-launch');
await page.waitForFunction(() => window.__fusion.STATE.poolOrder.length > 0, { timeout: 60000 });
await page.waitForTimeout(500);
const artistSeed = await page.evaluate(() => {
    const F = window.__fusion;
    const table = document.querySelector('table.tbl');
    const recs = [...F.STATE.recordings.values()];
    return {
        scope: F.SCOPE.type,
        domRowsOnPage: table ? table.querySelectorAll('tbody > tr').length : 0,
        pooled: F.STATE.poolOrder.length,
        withReleases: recs.filter(r => r.releases.length).length,
        withIsrc: recs.filter(r => r.isrcs.length).length,
        withArtist: recs.filter(r => r.artistCredit).length,
        seedLine: F.getLogLines().find(l => /Artist seed:/.test(l)) || '',
        harvestLine: F.getLogLines().find(l => /Harvested \d+ internal/.test(l)) || '',
        consBg: getComputedStyle(document.getElementById('fs-cons')).backgroundColor,
    };
});
console.log('artist seed:', JSON.stringify(artistSeed));
ck(artistSeed.scope === 'artist-recordings', 'Fusion detects artist-recordings scope');
ck(artistSeed.pooled > artistSeed.domRowsOnPage,
   'API seeding gets MORE than the single visible page (' + artistSeed.pooled + ' pooled vs ' + artistSeed.domRowsOnPage + ' DOM rows) — the whole point of dropping the scrape');
ck(/Artist seed: \d+ recording\(s\) of \d+ total \(arid:/.test(artistSeed.seedLine), 'log shows the arid: API seed with totals (' + artistSeed.seedLine + ')');
ck(artistSeed.withReleases === artistSeed.pooled, 'every API-seeded recording carries its releases (' + artistSeed.withReleases + '/' + artistSeed.pooled + ')');
ck(artistSeed.withArtist === artistSeed.pooled, 'every API-seeded recording carries an artist credit');
ck(artistSeed.withIsrc > 0, 'API seeding carries ISRCs inline (' + artistSeed.withIsrc + ' recordings)');
ck(/Harvested \d+ internal recording id/.test(artistSeed.harvestLine), 'internal ids harvested from the page\'s merge checkboxes (' + artistSeed.harvestLine + ')');
ck(artistSeed.consBg === 'rgb(255, 255, 255)', 'window renders on a white background (' + artistSeed.consBg + ')');

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
