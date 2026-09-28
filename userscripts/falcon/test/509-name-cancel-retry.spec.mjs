// #509 follow-up (majkinetor, live): "It seems that when name is null, it
// blocks from fetching it" — a real Harmony batch left several items
// permanently nameless. Root cause: suspendNameLookups()'s cancelPending()
// resolves every not-yet-started cosmetic name lookup with null so it
// doesn't compete with the workers' rate-limit budget — correct while a run
// is active, but nothing ever gave a cancelled item a second try once the
// budget was free again, so it stayed null forever. resolveMissingNames()
// now sweeps still-nameless queued items whenever the suspension actually
// lifts (start()'s natural-completion path, and stop()).
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, until } from '../../../dev/test/harness.mjs';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("#509: name cancel retry", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');

  const ck = check;

  const MBID = 'aaaaaaaa-5090-0000-0000-000000000001';

  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const errs = []; 
  page.on('pageerror', e => errs.push(e.message));
  // The name lookup is held until the spec lets it go, so it is still out when
  // suspendNameLookups() cancels it — the real race, without guessing a delay.
  const heldNames = []; let namesReleased = false;
  const answerName = route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ title: 'Real Recording Name' }) });
  await page.route('**/ws/2/recording/**', route => (namesReleased ? answerName(route) : heldNames.push(route)));
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'load' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });

  const early = await page.evaluate(async (MBID) => {
    const t = window.__falconTest;
    // a nameless tuple (as if Harmony's own name pill hadn't rendered yet) —
    // addToQueue's fallback fires fetchEntityName, which our route delays.
    t.addToQueue([{ entityType: 'recording', mbid: MBID, url: 'https://example.com/a' }]);
    const nameRightAfterQueue = t.getQueue()[0].name;
    // simulate a run starting immediately — before the 800ms lookup resolves —
    // and immediately stopping (same suspend/cancel/resume path a real short
    // run takes).
    t.suspendNameLookups();
    const nameWhileSuspended = t.getQueue()[0].name;
    t.resumeNameLookups();
    // without a retry sweep this would stay null forever — call the fix.
    t.resolveMissingNames();
    return { nameRightAfterQueue, nameWhileSuspended };
  }, MBID);
  namesReleased = true;
  heldNames.splice(0).forEach(answerName);
  const result = { ...early, nameAfterRetry: await until(() => page.evaluate(() => window.__falconTest.getQueue()[0].name), n => !!n) };
  console.log(JSON.stringify(result));
  ck(result.nameRightAfterQueue === null, 'name starts null (no Harmony-scraped name given)');
  ck(result.nameWhileSuspended === null, 'still null while the lookup was cancelled mid-flight');
  ck(result.nameAfterRetry === 'Real Recording Name', `resolveMissingNames() gives the cancelled lookup a second try and it resolves (got "${result.nameAfterRetry}")`);

  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
});
