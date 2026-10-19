// #789 (phw): Fusion grouped a studio recording with a live one of the same song (a shared
// AcoustID), and nothing on the card said which was live. A recording's relationships say it:
// a performance of a work marked live, and where it was recorded ("recorded at" a place,
// "recorded in" an area). Match now never groups live with studio, or two places (or one
// place on two dates), even on a shared ISRC or AcoustID; grouping by hand still can, and the
// card warns. The rows show a "live" pill and the place.
import { test, check, until, requireLogin, SANDBOX } from '../../../dev/test/harness.mjs';

const STUDIO = 'b9348679-060f-4af4-82be-2736fd3476f3';   // Paradise Lost, "Praise Lamented Shade"
const LIVE = '07d2a16e-6b22-4275-8c3f-d2b6362e1496';     // the same, live at KOKO, 2007-04-12

test.describe('logic', () => {
  test.use({ profile: 'fresh', gm: { name: 'Fusion', xhr: 'none' } });

  test('live and studio, or two places, do not group', { tag: '@unit' }, async ({ page, context, inject }) => {
    // Fusion returns early on a page it doesn't recognise, so serve a stub at one it does
    await context.route(/musicbrainz\.org/, r =>
      r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><meta charset="utf-8"><body><div id="content"></div></body>' }));
    await page.goto('https://musicbrainz.org/release-group/a07cbaff-aa79-35a9-9932-af7335f306eb', { waitUntil: 'domcontentloaded' });
    await inject('fusion', { waitFor: '__fusion' });

    const got = await page.evaluate(() => {
      const F = window.__fusion;
      const perf = live => ({ 'target-type': 'work', type: 'performance', attributes: live ? ['live'] : [], work: { id: 'w' } });
      const at = (id, name, date) => ({ 'target-type': 'place', type: 'recorded at', begin: date, place: { id, name } });
      const inArea = (id, name) => ({ 'target-type': 'area', type: 'recorded in', area: { id, name } });
      let n = 0;
      // every recording shares one AcoustID, title, artist and length: only the setting differs
      const rec = rels => F.mkRecording('aaaaaaaa-0000-4000-8000-' + String(n++).padStart(12, '0'), {
        title: 'Praise Lamented Shade', length: 345000, isrcs: [], acoustids: ['acid-1'], artistCredit: 'Paradise Lost',
        artistGid: 'ar', artistGids: ['ar'], video: false, releases: [{ title: 'R' }], isrcsKnown: true, ...F.recordingSetting(rels) });
      const grouped = recs => F.autoMatch(recs, 5000, 'strict').length > 0;
      const studio = rec([perf(false)]);
      const koko = rec([perf(true), at('p1', 'KOKO', '2007-04-12')]);
      return {
        parsed: { studio: [studio.live, studio.places.length], koko: [koko.live, koko.places[0].name], unknown: F.recordingSetting(undefined) },
        liveStudio: grouped([studio, koko]),
        liveStudioIsrc: grouped([{ ...studio, isrcs: ['GBX000000001'] }, { ...koko, isrcs: ['GBX000000001'] }]),
        twoVenues: grouped([koko, rec([perf(true), at('p2', 'Wacken', '2008-08-01')])]),
        twoDates: grouped([koko, rec([perf(true), at('p1', 'KOKO', '2009-01-01')])]),
        sameGig: grouped([koko, rec([perf(true), at('p1', 'KOKO', '2007-04-12')])]),
        placeVsArea: grouped([koko, rec([perf(true), inArea('a1', 'London')])]),
        noRels: grouped([koko, rec(undefined)]),
        // a recording with nothing known must not bridge the live one to the studio one
        bridge: F.autoMatch([studio, rec(undefined), koko], 5000, 'strict').map(g => g.memberGids.length),
        warn: F.settingWarning([studio, koko]),
        warnPlaces: F.settingWarning([koko, rec([perf(true), at('p2', 'Wacken', '2008-08-01')])]),
        warnDis: F.settingWarning([{ ...studio, disambiguation: 'radio edit' }, studio]),
        warnNone: F.settingWarning([koko, rec([perf(true), at('p1', 'KOKO', '2007-04-12')])]),
        // majkinetor moves a disambiguation from the tracks to the album: a recording without one goes by its release's
        // ...but only against a recording whose release is in the same release group
        warnRelDis: F.settingWarning([{ ...studio, releases: [{ title: 'Album', disambiguation: 'live', rgGid: 'rg1' }] }, { ...studio, releases: [{ title: 'Album', rgGid: 'rg1' }] }]),
        otherRg: F.settingWarning([{ ...studio, releases: [{ title: 'Album', disambiguation: 'live', rgGid: 'rg1' }] }, { ...studio, releases: [{ title: 'Other', rgGid: 'rg2' }] }]),
        noWarnRelDis: F.settingWarning([{ ...studio, disambiguation: 'live', releases: [{ title: 'Album', rgGid: 'rg1' }] }, { ...studio, releases: [{ title: 'Album', disambiguation: 'live', rgGid: 'rg1' }] }]),
        summary: F.releasesSummary({ ...studio, releases: [{ title: 'Live at KOKO', disambiguation: 'live' }], allReleases: null }).text,
      };
    });
    console.log(JSON.stringify(got));
    check(JSON.stringify(got.parsed.studio) === '[false,0]' && JSON.stringify(got.parsed.koko) === '[true,"KOKO"]', 'live and the place are read from the relationships');
    check(got.parsed.unknown.live === null && got.parsed.unknown.places === null, 'no relationships fetched: both unknown');
    check(!got.liveStudio, 'a live and a studio recording are not grouped, though they share an AcoustID');
    check(!got.liveStudioIsrc, 'nor on a shared ISRC');
    check(!got.twoVenues, 'two places are not grouped');
    check(!got.twoDates, 'one place on two dates is not grouped');
    check(got.sameGig, 'one place on one date still groups');
    check(got.placeVsArea, 'a place and an area do not contradict');
    check(got.noRels, 'an unknown setting does not block');
    check(!got.bridge.some(len => len === 3), `a recording of unknown setting does not bridge live and studio (groups ${JSON.stringify(got.bridge)})`);
    check(got.warn && got.warn.label === 'live + studio' && /KOKO/.test(got.warn.title), `the card warns live + studio, naming the place (${JSON.stringify(got.warn)})`);
    check(got.warnPlaces && got.warnPlaces.label === '2 places', `two places warn (${JSON.stringify(got.warnPlaces)})`);
    check(got.warnDis && got.warnDis.label === 'disamb.', 'differing disambiguations warn');
    check(got.warnNone === null, 'one gig, nothing to warn about');
    check(got.warnRelDis && got.warnRelDis.label === 'disamb.' && /album: live/.test(got.warnRelDis.title), `a release's disambiguation stands in for a recording without one, named as the album's (${JSON.stringify(got.warnRelDis)})`);
    check(got.otherRg === null, 'not against a release of another release group');
    check(got.noWarnRelDis === null, "the recording's own and the release's agree: no warning");
    check(/^Live at KOKO \(live\)/.test(got.summary), `the release's disambiguation shows in the Releases column (${got.summary})`);
  });
});

test.describe('page', () => {
  test.use({ viewport: { width: 1500, height: 900 }, gm: { name: 'Fusion' } });

  test("phw's pair: live pill, place, no Match group, warning when grouped by hand", { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await page.goto(`${SANDBOX}/recording/${LIVE}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await requireLogin(page);
    await inject('fusion', { waitFor: '__fusion' });
    const facts = await page.evaluate(async ([studio, live]) => {
      const F = window.__fusion;
      await F.openFusion();
      F.clearBoard();
      const s = F.STATE.recordings.get(studio) || await F.fetchRecordingByGid(studio); F.addToPool(s);
      const l = F.STATE.recordings.get(live) || await F.fetchRecordingByGid(live); F.addToPool(l);
      const sig = F.pairSignals(s, l, 5000);
      const withAcid = F.shouldUnion(Object.assign({}, sig, { acoustid: true }), 'loose');
      F.renderAll();
      return { live: [s.live, l.live], places: (l.places || []).map(p => p.name), liveMismatch: sig.liveMismatch, withAcid };
    }, [STUDIO, LIVE]);
    console.log(JSON.stringify(facts));
    test.skip(facts.live[1] !== true, 'the sandbox copy no longer marks the recording live');
    check(facts.live[0] === false, 'the studio recording reads as studio');
    check(facts.places.some(p => /KOKO/i.test(p)), `the live one is recorded at KOKO (${facts.places})`);
    check(facts.liveMismatch && !facts.withAcid, 'Match would not group them, even with a shared AcoustID');

    const pool = await until(() => page.evaluate(gid => {
      const a = document.querySelector(`.fs-pcard[data-gid="${gid}"] .fs-t a[href$="/recording/${gid}"]`);
      const t = a && a.parentElement;
      return t && { pill: !!t.querySelector('.fs-live'), place: (t.querySelector('.fs-place') || {}).textContent || '' };
    }, LIVE), Boolean, { timeout: 30000 });
    check(pool.pill, 'the live recording has a "live" pill in the pool');
    check(/KOKO/i.test(pool.place), `and its place (${pool.place})`);

    const card = await page.evaluate(([studio, live]) => {
      const F = window.__fusion;
      const g = F.createGroupWithMember(studio); F.addToGroup(live, g.id); F.renderAll();
      const c = document.querySelector(`.fs-gcard[data-gid="${g.id}"]`);
      const w = c && c.querySelector('.fs-setwarn');
      return { id: g.id, members: g.memberGids.length, warn: w && w.textContent, title: w && w.title };
    }, [STUDIO, LIVE]);
    if (process.env.SHOT_789) await page.locator(`.fs-gcard[data-gid="${card.id}"]`).screenshot({ path: process.env.SHOT_789 });
    console.log(JSON.stringify(card));
    check(card.members === 2, 'grouping them by hand is still allowed');
    check(card.warn === '⚠ live + studio', `the card warns (${card.warn})`);
  });
});
