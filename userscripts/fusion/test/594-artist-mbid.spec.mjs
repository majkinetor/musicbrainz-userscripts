// #594 (chaban-mb): "auto-matching with normal cutoff fails due to differing
// artists credits even though the artist themselves are identical."
//
// Verified on his own release group (0ece1e80-fa3e-4fc8-8aec-c54003084bb3)
// before changing anything — both releases credit the SAME artist,
// 5b44eac2-b29e-42ba-bd99-213a270149d6, one as "Radium" and the other as
// "DJ Radium":
//
//     artistSimilar("Radium", "DJ Radium")  ->  1 of 2 tokens = 0.5  <  0.8
//
// so sig.artist was false, and `normal` — which needs title && artist &&
// (length || lengthUnknown) — could not group even the pair whose titles AND
// 5:05 lengths were identical. `loose` was the only way through, and it weakens
// every other pair in the pool at the same time.
//
// The fix compares artist MBIDs when both sides have them. The checks that
// matter are the ones where it must NOT match: a different artist, and a credit
// that adds a second artist ("X" vs "X feat. Y"), which comparing only the
// PRIMARY MBID would have wrongly called identical.
//
// Pure functions against a stub page — no network, nothing submitted.
import { test, check } from '../../../dev/test/harness.mjs';

const RADIUM = '5b44eac2-b29e-42ba-bd99-213a270149d6';
const OTHER = '11111111-2222-4333-8444-555555555555';

test.use({ profile: 'fresh', gm: { name: 'Fusion', xhr: 'none' } });

test('the artist signal compares artist MBIDs, and only whole credits', { tag: '@unit' }, async ({ page, context, inject }) => {
  /* Fusion bails at `if (!SCOPE) return;` on any page it does not recognise, so the
     export block never runs and the hook is absent — a blank page proves nothing.
     Serve a stub at a URL it DOES recognise: no network, and no MusicBrainz page
     is actually fetched. */
  await context.route(/musicbrainz\.org/, r =>
    r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><meta charset="utf-8"><body><div id="content"></div></body>' }));
  await page.goto('https://musicbrainz.org/release-group/0ece1e80-fa3e-4fc8-8aec-c54003084bb3', { waitUntil: 'domcontentloaded' });
  await inject('fusion', { waitFor: '__fusion' });
  check((await page.evaluate(() => Object.keys(window.__fusion))).includes('acGids'), 'acGids is exported');

  const run = (aGids, bGids, aCredit, bCredit, aTitle, bTitle, aLen, bLen, cutoff) => page.evaluate(
    ([ag, bg, ac, bc, at, bt, al, bl, cut]) => {
      const F = window.__fusion;
      const mk = (gid, title, len, credit, gids) => F.mkRecording(gid, {
        title, length: len, isrcs: [], artistCredit: credit, artistGid: gids[0] || null, artistGids: gids,
        video: false, releases: [{ title: 'Scum Centre' }], isrcsKnown: true,
      });
      const a = mk('aaaaaaaa-0000-4000-8000-000000000001', at, al, ac, ag);
      const b = mk('bbbbbbbb-0000-4000-8000-000000000002', bt, bl, bc, bg);
      const sig = F.pairSignals(a, b, 10000);
      return { artist: sig.artist, byMbid: !!sig.artistByMbid, title: sig.title, length: sig.length,
        groups: F.autoMatch([a, b], 10000, cut).length };
    }, [aGids, bGids, aCredit, bCredit, aTitle, bTitle, aLen, bLen, cutoff]);

  await test.step('the credit strings really are the problem', async () => {
    const strings = await page.evaluate(() => ({
      radium: window.__fusion.artistSimilar('Radium', 'DJ Radium'),
      same: window.__fusion.artistSimilar('Radium', 'Radium'),
    }));
    check(strings.radium === false, 'fixture: "Radium" vs "DJ Radium" does NOT pass the string comparison — which is the whole bug');
    check(strings.same === true, 'fixture: identical credits still do');
  });

  await test.step('same artist MBID, different credit → groups at NORMAL', async () => {
    const power = await run([RADIUM], [RADIUM], 'Radium', 'DJ Radium', 'Power Surgeon', 'Power Surgeon', 305000, 305000, 'normal');
    check(power.artist === true, 'the artist signal is satisfied by the shared MBID');
    check(power.byMbid === true, 'and it is flagged as having come from the MBID, not the string');
    check(power.groups === 1, `so the pair groups at NORMAL, which is what he asked for (${power.groups} group)`);
  });

  await test.step('the refusals — where this must NOT fire', async () => {
    const diff = await run([OTHER], [RADIUM], 'Someone Else', 'DJ Radium', 'Power Surgeon', 'Power Surgeon', 305000, 305000, 'normal');
    check(diff.artist === false && diff.groups === 0, 'two different artist MBIDs do not match, however alike the title and length');
    // ⚠ the case that makes comparing the FULL credit necessary rather than just
    // the primary artist: same lead, extra collaborator.
    const feat = await run([RADIUM], [RADIUM, OTHER], 'Radium', 'Radium feat. Someone', 'Power Surgeon', 'Power Surgeon', 305000, 305000, 'normal');
    check(feat.artist === false && feat.groups === 0, 'a credit with an EXTRA artist is not the same credit — comparing only the primary MBID would have merged these');
    // order of the same two artists is not a difference
    const swapped = await run([RADIUM, OTHER], [OTHER, RADIUM], 'A & B', 'B & A', 'Power Surgeon', 'Power Surgeon', 305000, 305000, 'normal');
    check(swapped.artist === true && swapped.groups === 1, 'the same two artists in the other order still match');
  });

  await test.step('the string path still works when MBIDs are absent', async () => {
    const noGids = await run([], [], 'Radium', 'Radium', 'Power Surgeon', 'Power Surgeon', 305000, 305000, 'normal');
    check(noGids.artist === true && noGids.byMbid === false && noGids.groups === 1, 'with no MBIDs it falls back to comparing the credit strings, as before');
    const noGidsDiff = await run([], [], 'Radium', 'DJ Radium', 'Power Surgeon', 'Power Surgeon', 305000, 305000, 'normal');
    check(noGidsDiff.artist === false && noGidsDiff.groups === 0, 'and the fallback is unchanged — differing credits with no MBIDs still do not match');
  });

  await test.step('nothing else about matching moved', async () => {
    const lenConflict = await run([RADIUM], [RADIUM], 'Radium', 'DJ Radium', 'Use Your Illusion', 'Use Your Illusion', 249000, 299000, 'normal');
    check(lenConflict.groups === 0, 'a shared MBID does not override the length guard — his 4:09 vs 4:59 pair stays apart');
    const video = await page.evaluate(([g]) => {
      const F = window.__fusion;
      const mk = (gid, video) => F.mkRecording(gid, { title: 'Power Surgeon', length: 305000, isrcs: [], artistCredit: 'Radium', artistGid: g, artistGids: [g], video, releases: [{}], isrcsKnown: true });
      return F.autoMatch([mk('aaaaaaaa-0000-4000-8000-000000000001', false), mk('bbbbbbbb-0000-4000-8000-000000000002', true)], 10000, 'normal').length;
    }, [RADIUM]);
    check(video === 0, 'and the video gate still blocks, shared MBID or not');
  });
});
