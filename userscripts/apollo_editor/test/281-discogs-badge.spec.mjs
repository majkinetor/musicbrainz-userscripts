// #281: the tracklist's Discogs badge ("🔗 N links": credited artists whose MusicBrainz
// entry lacks the Discogs link the release's Discogs page gives them).
//
// A transient Discogs failure (429) no longer poisons the session: the failed read is
//   retried, never cached, and the badge recovers without a reload.
// A model rebuilt mid-check (MusicBrainz lazy-loads the rest of the tracks after Apollo
//   starts) is checked again, so the badge never settles blank.
// Only a resolved (committed) artist is flagged; an unresolved slot is not, and keeps its
//   Discogs URL for create-with-link.
//
// Sandbox copies of production releases (their artists were created on the sandbox,
// without Discogs links); Discogs's answers replayed from a recording (RECORD_WS=1).
import { test, check, replayWs, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });
const discogs = (page, name) => replayWs(page, new URL(`./fixtures/discogs-${name}.json.gz`, import.meta.url), { paths: /(?!)/, web: /(^|\.)discogs\.com$/ });
const badge = page => page.evaluate(() => { const b = document.querySelector('.tc-discstat'); return b ? { t: b.textContent, cls: b.className } : null; });

test('a 429 from Discogs is retried, and the badge recovers without a reload', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const ws = await discogs(page, '627a37f2');
  let hits = 0;
  // registered last, so asked first: the first two reads are refused
  await page.route(/^https:\/\/api\.discogs\.com\//, route => (++hits <= 2
    ? route.fulfill({ status: 429, headers: { 'retry-after': '1', 'access-control-allow-origin': '*' }, body: '{"message":"rate limited"}' })
    : route.fallback()));
  await openApollo(page, inject, { release: '627a37f2-6e95-4460-80db-84cdc1cb4a10', tab: 'tracklist' });   // Nigeria Special Volume 3
  const got = await page.waitForFunction(() => /tc-disc-badge|tc-disc-ok/.test(document.querySelector('.tc-discstat')?.className || ''), null, { timeout: 30000 }).then(() => true).catch(() => false);
  check(hits > 2, `Discogs was asked again after the refusals (${hits} reads)`);
  check(got, `the badge settles to a result (${JSON.stringify(await badge(page))})`);
  await ws.done();
});

test('a model rebuilt mid-check still gets a badge', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const ws = await discogs(page, '06278b3f');
  let grew = false;
  page.on('console', m => { if (/snapshot \+ \d+ newly loaded/.test(m.text())) grew = true; });
  await openApollo(page, inject, { release: '06278b3f-1b45-4355-9b1e-368c5016b831', tab: 'tracklist', settle: 0 });   // Ghana Special 2: 9 → 18 tracks
  // MusicBrainz lazy-loads the rest of the tracks and Apollo rebuilds its model mid-check
  // (it logs "snapshot + N newly loaded"); after that, the badge must reach a result.
  // One that went blank on the rebuild never would.
  await until(() => grew, Boolean, { timeout: 30000 });
  const result = b => b && !/checking/.test(b.t) && /tc-disc-badge|tc-disc-ok|tc-disc-pend/.test(b.cls);
  const b = await until(() => badge(page), result, { timeout: 30000 });
  const settled = result(b) ? b : null;
  check(settled && /tc-disc-badge|tc-disc-ok|tc-disc-pend/.test(settled.cls), `the badge settles to a result, not blank (${JSON.stringify(settled)}; rebuilt mid-check: ${grew})`);
  await ws.done();
});

test('only a resolved artist is flagged', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const ws = await discogs(page, '06278b3f');
  await openApollo(page, inject, { release: '06278b3f-1b45-4355-9b1e-368c5016b831', tab: 'tracklist' });
  await page.waitForFunction(() => /tc-disc-badge/.test(document.querySelector('.tc-discstat')?.className || ''), null, { timeout: 60000 }).catch(() => {});
  const r = await page.evaluate(async () => {
    const ap = window.__apolloEditor;
    let target = null;
    for (const t of ap.model.tracks) { target = t.slots.find(s => s._discogsAddable && s.committed && s.gid); if (target) break; }
    if (!target) return { none: true };
    const url = target._discogsUrl;
    await ap.tagDiscogsAddable(target, url);
    const base = { addable: !!target._discogsAddable, checked: !!target._discogsChecked };
    const was = target.committed;
    target.committed = false;
    await ap.tagDiscogsAddable(target, url);
    const off = { addable: !!target._discogsAddable, checked: !!target._discogsChecked, urlKept: target._discogsUrl === url };
    target.committed = was;
    await ap.tagDiscogsAddable(target, url);
    return { base, off, again: !!target._discogsAddable };
  });
  check(!r.none, 'a resolved artist lacking its Discogs link');
  if (r.none) return;
  check(r.base.addable && r.base.checked, 'resolved: flagged');
  check(!r.off.addable && !r.off.checked, 'unresolved: not flagged, not counted as checked');
  check(r.off.urlKept, 'its Discogs URL is kept, for create-with-link');
  check(r.again, 'resolved again: flagged again');
  await ws.done();
});
