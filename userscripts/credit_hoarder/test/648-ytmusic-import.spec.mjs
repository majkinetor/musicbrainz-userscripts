// #648: a YouTube Music import end to end on test.musicbrainz.org — the toolbar offers
// YouTube Music for a release linked to a YouTube Music album, the import fetches each
// song's credits (live, anonymously) and stages them through the review table. Nothing
// is submitted.
//
// Fixture: Mocky – Music Will Explain (Choir Music Vol. 1), copied from production
// bc55a0a0-0025-40fd-a9d9-627fc3f5b1f3 with its links. Every song is "Produced by Mocky"
// on YouTube Music, so producer relationships to Mocky must be staged on its recordings.
import { test, check, requireLogin, SANDBOX } from '../../../dev/test/harness.mjs';
import { openReleasePage, snapshotRelationships, confirmReviewTable, waitForImportDone, getCapturedLog } from './lib/browser.js';

const RELEASE = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';
test.use({ gm: { name: 'Credit Hoarder' } });   // GM_xmlhttpRequest made from Node, like a manager's

test('YouTube Music: credits import from the linked album and stage producer relationships', { tag: ['@sandbox', '@login', '@web'] }, async ({ context, inject }, testInfo) => {
  test.setTimeout(10 * 60_000);
  const page = await openReleasePage(context, `${SANDBOX}/release/${RELEASE}/edit-relationships`);
  await requireLogin(page);
  await inject('credit_hoarder', { target: page });
  try {
    const btn = page.locator('.discogs-bar .discogs-src-ico[data-src="YouTube Music"]');
    await btn.waitFor({ state: 'visible', timeout: 30_000 });
    check(/YouTube Music/.test(await btn.getAttribute('title') || ''), 'the toolbar offers YouTube Music');
    await btn.click();
    await confirmReviewTable(page);
    const { log: importLog, timedOut } = await waitForImportDone(page);
    await testInfo.attach('import log', { body: importLog || '(empty)', contentType: 'text/plain' });
    check(!timedOut, 'the import finished');
    check(/12 song\(s\)/.test(importLog || ''), 'all 12 songs read, in order');
    check(/Not imported: track 1: Performed by — Mocky/.test(importLog || ''), '"Performed by" reported, not imported');

    const snap = await snapshotRelationships(page);
    // 141 = producer (artist → recording)
    const producers = snap.staged.filter(r => String(r.linkTypeID) === '141' && r.sourceType === 'artist' && r.sourceName === 'Mocky' && r.targetType === 'recording');
    console.log(`staged ${snap.staged.length}: ${snap.staged.slice(0, 30).map(r => `${r.linkTypeID} ${r.sourceType}(${r.sourceName}) → ${r.targetType}(${r.targetName})`).join('; ')}`);
    check(snap.staged.length > 0, `relationships staged (${snap.staged.length})`);
    check(new Set(producers.map(r => r.targetName)).size === 12, `Mocky staged as producer on all 12 recordings (${producers.length})`);
  } finally {
    await testInfo.attach('browser log', { body: getCapturedLog(page) || '(none)', contentType: 'text/plain' }).catch(() => {});
    await testInfo.attach('editor', { body: await page.screenshot({ fullPage: true }).catch(() => Buffer.from('')), contentType: 'image/png' }).catch(() => {});
    await page.close().catch(() => {});
  }
});
