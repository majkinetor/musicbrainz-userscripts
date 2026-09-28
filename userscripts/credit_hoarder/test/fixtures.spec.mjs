// The import, end to end, on every release in fixtures.json: open its relationship
// editor on test.musicbrainz.org, import from Discogs, confirm the review table, and
// check what was staged against the Discogs release (the source of truth) and
// MusicBrainz's own rules (lib/verify.js). Nothing is submitted.
//
//   pnpm test --project=credit_hoarder --grep @fixture          every fixture
//   pnpm test --project=credit_hoarder --grep "@fixture.*@small"  by fixture tag
//   CH_DEBUG=1 pnpm test … --grep @debug                        the bug reproductions
//
// Fixtures tagged "debug" reproduce specific bug reports and are noisy in a full run,
// so they run only with CH_DEBUG=1. A fixture marked "pending" is not on the sandbox
// yet and is skipped with that reason.
import { readFileSync } from 'node:fs';
import { test, check, requireLogin } from '../../../dev/test/harness.mjs';
import { openReleasePage, snapshotRelationships, clickImport, confirmReviewTable, waitForImportDone, getCapturedLog } from './lib/browser.js';
import { runAssertions, fetchDiscogsJson, fetchMbReleaseJson, fetchMbLinkedEntities, getDetectedDiscogsUrl } from './lib/verify.js';

const FIXTURES = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
// Credit Hoarder expects GM_info (edit notes, the summary); the rest it does without
const GM_INFO = "window.GM_info = window.GM_info || { script: { name: 'Credit Hoarder (test)', version: 'test' }, scriptHandler: 'Playwright', version: 'test' };\n";
test.use({ gm: false });

for (const fx of FIXTURES) {
  const tags = (fx.tags || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
  test(fx.name, { tag: ['@fixture', '@sandbox', '@login', ...tags.map(t => '@' + t)] }, async ({ context, inject }, testInfo) => {
    test.skip(!!fx.pending, fx.pending);
    test.skip(tags.includes('debug') && !process.env.CH_DEBUG, 'a bug reproduction: CH_DEBUG=1 to run it');
    test.setTimeout(25 * 60_000);   // the biggest releases take minutes to resolve
    const mbid = fx.url.match(/release\/([a-f0-9-]{36})/)[1];

    const page = await openReleasePage(context, fx.url);
    await requireLogin(page);
    await inject('credit_hoarder', { target: page, transform: code => GM_INFO + code });
    await page.waitForSelector('.discogs-bar', { timeout: 30_000 });
    try {
      const discogsUrl = await getDetectedDiscogsUrl(page);
      check(discogsUrl, 'the release has a Discogs link to import from');
      if (!discogsUrl) return;

      await clickImport(page);
      await confirmReviewTable(page);
      const { log: importLog, timedOut } = await waitForImportDone(page);
      await testInfo.attach('import log', { body: importLog || '(empty)', contentType: 'text/plain' });
      check(!timedOut, 'the import finished (the script went back to idle)');
      if (timedOut) return;

      const snap = await snapshotRelationships(page);
      const [linked, discogsJson, mbReleaseJson] = await Promise.all([fetchMbLinkedEntities(page), fetchDiscogsJson(page, discogsUrl), fetchMbReleaseJson(page, mbid)]);
      const { failures, warnings, stats } = runAssertions({
        existingRels: snap.existing, finalRels: snap.all, newRels: snap.staged,
        discogsJson, mbReleaseJson, linkTypes: linked.linkTypes, attrTypes: linked.attrTypes,
      });
      const top = Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => `${n}×${c}`).join(', ');
      console.log(`${fx.name}: ${snap.staged.length} staged (${top || 'none'}), ${snap.existing.length} existing; ${failures.length} failures, ${warnings.length} warnings`);
      for (const w of warnings) testInfo.annotations.push({ type: 'warning', description: w.msg });
      for (const f of failures) {
        const r = f.rel;
        check(false, `[${f.kind}] ${f.msg}` + (r ? ` — ltID=${r.linkTypeID} ${r.sourceType}(${r.sourceName || r.sourceGid || r.sourceId}) → ${r.targetType}(${r.targetName || r.targetGid || r.targetId}) credit=${JSON.stringify(r.targetCredit)}` : ''));
      }
    } finally {
      await testInfo.attach('browser log', { body: getCapturedLog(page) || '(none)', contentType: 'text/plain' }).catch(() => {});
      await testInfo.attach('editor', { body: await page.screenshot({ fullPage: true }).catch(() => Buffer.from('')), contentType: 'image/png' }).catch(() => {});
      await page.close().catch(() => {});
    }
  });
}
