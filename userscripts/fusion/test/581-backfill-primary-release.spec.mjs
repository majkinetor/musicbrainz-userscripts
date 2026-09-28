// #581 (chaban-mb): "Fusion claims `(no release)` for some recordings in the
// table yet when hovering it shows the release."
//
// Two fields, one truth. The release CELL reads rec.releases[0]; the TOOLTIP
// reads rec.allReleases. The background backfill — which fetches the release
// lists the search index did not return, 29 of his 129 — filled only the second.
// So a recording the index missed ended up with a complete tooltip sitting above
// a cell that flatly denied any release existed.
//
// storeReleaseDetails, the expand-on-demand path, already seeds both, and its
// comment says why in as many words: "so a row can never say 'no release' while
// its own table lists them" (#529). The backfill was written later and did not.
//
// Driven through the exported functions with a stubbed fetch — the bug is in
// what the backfill writes, not in how it asks. No network, no merges.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Fusion', xhr: 'none' } });

test('the release backfill fills the cell as well as the tooltip', { tag: '@sandbox' }, async ({ page, inject }) => {
  const posted = [];
  await page.route(() => true, r => { const q = r.request(); if (q.method() === 'POST') { posted.push(q.url()); return r.abort(); } return r.continue(); });
  await page.goto('https://test.musicbrainz.org/release-group/1279bc2b-8c89-4f68-b233-38fc9f04f8d4', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await inject('fusion', { waitFor: '__fusion' });
  const out = await page.evaluate(async () => {
    const F = window.__fusion;
    // The one recording of his that the search index missed: nothing in either
    // field, exactly as browse seeding leaves it.
    const missed = F.mkRecording('9823f528-dc83-49cb-93e6-41dc2c24e4ea', { title: 'Maratona', length: 163000 });
    // And one seeded from a release page, which already knows its primary. The
    // backfill must not overwrite that with whatever order the web service returns.
    const seeded = F.mkRecording('c4259828-c766-498f-bc01-a6177d72b8a4', {
      title: 'Maratona', length: 163000,
      releases: [{ gid: 'rel-seed', title: 'Chic Nisello', trackNumber: '4', trackCount: 12, date: '2021' }],
    });

    const before = { text: F.releasesSummary(missed).text, tooltip: F.releasesSummary(missed).tooltip };

    // Stand in for the network: the same shape fetchAllReleases returns.
    const answers = {
      '9823f528-dc83-49cb-93e6-41dc2c24e4ea': { releases: [{ gid: 'rel-a', title: 'Chic Nisello', trackNumber: '7', trackCount: 12, date: '2021' }], video: false },
      'c4259828-c766-498f-bc01-a6177d72b8a4': { releases: [{ gid: 'rel-b', title: 'Cultura Italiana Pt.2', trackNumber: '3', trackCount: 14, date: '2019' }], video: false },
    };
    const realWsGet = window.fetch;
    window.__fusion.fetchAllReleasesOrig = F.fetchAllReleases;
    // enrichAllReleases calls fetchAllReleases through the module's own binding,
    // so stub the transport it sits on instead of the function itself.
    window.fetch = async (url) => {
      const m = String(url).match(/\/ws\/2\/recording\/([0-9a-f-]{36})/);
      const a = m && answers[m[1]];
      return {
        ok: true, status: 200,
        headers: { get: () => null },
        json: async () => a
          ? { id: m[1], title: 'Maratona', video: a.video, releases: a.releases.map(r => ({ id: r.gid, title: r.title, date: r.date, media: [{ track: [{ number: r.trackNumber }], 'track-count': r.trackCount }] })) }
          : { id: 'x', releases: [] },
      };
    };
    await F.enrichAllReleases([missed, seeded], 2);
    window.fetch = realWsGet;

    const s1 = F.releasesSummary(missed), s2 = F.releasesSummary(seeded);
    return {
      before,
      missed: { text: s1.text, tooltip: s1.tooltip, releases: missed.releases, allReleases: missed.allReleases },
      seeded: { text: s2.text, primaryTitle: seeded.releases[0] && seeded.releases[0].title, allCount: (seeded.allReleases || []).length },
    };
  });

  console.log('[verify-581] before the backfill:', JSON.stringify(out.before));
  console.log('[verify-581] after :', JSON.stringify(out.missed));

  check(out.before.text === '—', `an un-fetched recording says nothing rather than "(no release)" (got ${JSON.stringify(out.before.text)})`);
  check(Array.isArray(out.missed.allReleases) && out.missed.allReleases.length === 1,
    'the backfill fetched the release list (the half that always worked)');
  check(out.missed.releases.length === 1,
    `and now also fills the field the CELL reads (${out.missed.releases.length} entr${out.missed.releases.length === 1 ? 'y' : 'ies'})`);
  check(!/no release/.test(out.missed.text),
    `so the cell no longer denies a release the tooltip lists (cell ${JSON.stringify(out.missed.text)})`);
  check(/Chic Nisello/.test(out.missed.text) && /Chic Nisello/.test(out.missed.tooltip),
    'cell and tooltip agree on the release');
  check(out.seeded.primaryTitle === 'Chic Nisello',
    `a row seeded from a release page keeps that release as its primary (got ${JSON.stringify(out.seeded.primaryTitle)})`);
  check(out.seeded.allCount === 1, 'while its full list is still enriched');

  // MusicBrainz posts its own telemetry from every page, so "zero POSTs" would
  // fail for reasons unrelated to this. What matters is that nothing was merged.
  const writes = posted.filter(u => /\/ws\/js\/edit|\/recording\/merge|\/edit\//.test(u));
  check(writes.length === 0, `nothing was merged or edited (${posted.length} POST(s) blocked, ${writes.length} of them writes)`);
});
