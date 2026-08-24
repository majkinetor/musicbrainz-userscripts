// #540, second half. majkinetor: "The problem here is that Apollo auto match
// seems to get tripped by two releases in this group on which tracks 7 and 10
// switch places (and also passed visual confirmation)."
//
// His release group really does contain two distinct recordings both called
// "Toubaka", and its editions disagree about where they sit:
//
//     092b3f5e "Discotheque 71"    Toubaka at track  7 → f8df5b35
//     ebd5c67c                     Toubaka at track 10 → f8df5b35
//     216a51c7 (the edited one)    Toubaka at track  7 → 53cb0616
//
// Both score identically on title, and being the same performance issued twice
// they score identically on length too — so the old chooser (`lvl < bestLevel`,
// first one wins) linked whichever the pool yielded first. The wrong one looks
// entirely plausible in the UI, which is why it survived a visual check and only
// showed up later as a wrong ISRC.
//
// The rule now: auto-link only when the winner is unique. This exercises
// recPickBest directly, with the group's real MBIDs, so no editor is needed and
// nothing is submitted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');

const A = { gid: '53cb0616-cde0-4e32-b83a-f686de50577e', name: 'Toubaka', length: 251000 };   // track 7 on 216a51c7
const B = { gid: 'f8df5b35-ecf5-4e5d-93e2-3032219d33f6', name: 'Toubaka', length: 251000 };   // track 7 on 092b3f5e, track 10 on ebd5c67c

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const ctx = await chromium.launch({ headless: true });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR ' + e.message));
// A blank MusicBrainz page is enough — the script exports its helpers on load.
await page.goto('https://musicbrainz.org/robots.txt', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.addScriptTag({ content: code });
await page.waitForTimeout(400);
const has = await page.evaluate(() => !!(window.__apolloEditor && window.__apolloEditor.recPickBest));
ck(has, 'recPickBest is reachable');

const r = await page.evaluate(({ A, B }) => {
  const pick = window.__apolloEditor.recPickBest;
  const track = { title: 'Toubaka', artist: '', length: 251000, artistGids: [] };
  return {
    // the reported case: two same-named, same-length recordings, no position help
    ambiguous: pick([A, B], track, []),
    // the group agrees this slot holds B → that is evidence, so link it
    posBreaksTie: pick([A, B], track, [B.gid]),
    // editions disagree about the slot → still ambiguous, must not link
    posDisagrees: pick([A, B], track, [A.gid, B.gid]),
    // a genuinely different length is evidence too
    lenBreaksTie: pick([A, Object.assign({}, B, { length: 190000 })], track, []),
    // the same recording arriving from several tiers is not a tie
    sameTwice: pick([A, Object.assign({}, A)], track, []),
    // one candidate is the ordinary case and must still link
    single: pick([A], track, []),

    // ── #541: a position only counts when the candidate STAYS there ─────────
    // The real index for this group: f8df5b35 sits at 1.7 on one edition and
    // at 1.10 on another. If only the first edition covers slot 1.7, the old
    // rule saw "the group agrees" and picked confidently — and wrongly.
    wanderingPos: (() => {
      const posIndex = new Map([
        ['1.7', [{ gid: B.gid, name: 'Toubaka' }]],
        ['1.10', [{ gid: B.gid, name: 'Toubaka' }]],
      ]);
      return pick([A, B], track, [B.gid], { posIndex });
    })(),
    // …whereas a candidate that sits at one position on every edition is
    // evidence, and still breaks the tie.
    stablePos: (() => {
      const posIndex = new Map([['1.7', [{ gid: B.gid, name: 'Toubaka' }]]]);
      return pick([A, B], track, [B.gid], { posIndex });
    })(),
    // ── #541: don't spend one recording on two slots when there is a choice ──
    avoidsReuse: pick([A, B], track, [], { taken: new Set([A.gid]) }),
    // but a release CAN repeat a recording — one candidate, already used: link it, flagged
    allowsRealRepeat: pick([A], track, [], { taken: new Set([A.gid]) }),
  };
}, { A, B });

console.log('two same-named, same-length candidates → ' + JSON.stringify({ ambiguous: r.ambiguous.ambiguous, tied: r.ambiguous.tied.map(t => t.gid.slice(0, 8)) }));
ck(r.ambiguous.ambiguous === true, 'the reported case is reported as ambiguous, not guessed at');
ck(r.ambiguous.tied.length === 2, 'with both candidates named so the log says which two');

console.log('position agrees on one → ' + JSON.stringify({ ambiguous: r.posBreaksTie.ambiguous, best: (r.posBreaksTie.best || {}).gid }));
ck(r.posBreaksTie.ambiguous === false && r.posBreaksTie.best.gid === B.gid, 'a slot the release group agrees on breaks the tie');

console.log('editions disagree → ' + JSON.stringify({ ambiguous: r.posDisagrees.ambiguous }));
ck(r.posDisagrees.ambiguous === true, 'but when the editions disagree it stays ambiguous — the exact #540 shape');

console.log('lengths differ → ' + JSON.stringify({ ambiguous: r.lenBreaksTie.ambiguous, best: (r.lenBreaksTie.best || {}).gid }));
ck(r.lenBreaksTie.ambiguous === false && r.lenBreaksTie.best.gid === A.gid, 'an exactly-matching length breaks the tie');

ck(r.sameTwice.ambiguous === false, 'the same recording offered twice is not a tie');
ck(r.single.ambiguous === false && r.single.best.gid === A.gid, 'and a lone candidate still links, as before');

// ── #541 ───────────────────────────────────────────────────────────────────
console.log('candidate wanders between positions → ' + JSON.stringify({ ambiguous: r.wanderingPos.ambiguous }));
ck(r.wanderingPos.ambiguous === true, 'a slot is not evidence when the candidate sits elsewhere on another edition (#541)');
console.log('candidate stays put → ' + JSON.stringify({ ambiguous: r.stablePos.ambiguous, best: (r.stablePos.best || {}).gid }));
ck(r.stablePos.ambiguous === false && r.stablePos.best.gid === B.gid, 'but a stable position still breaks the tie');
console.log('one candidate already taken → ' + JSON.stringify({ best: (r.avoidsReuse.best || {}).gid, ambiguous: r.avoidsReuse.ambiguous }));
ck(r.avoidsReuse.best.gid === B.gid && r.avoidsReuse.ambiguous === false, 'a tie prefers the recording no other slot has claimed');
ck(r.allowsRealRepeat.best.gid === A.gid && r.allowsRealRepeat.reused === true, 'and a genuine repeat still links, flagged as a reuse');

await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
