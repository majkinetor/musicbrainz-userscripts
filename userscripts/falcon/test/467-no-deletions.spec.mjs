// #467 (majkinetor: "falcon should never have deletion of link staged. Maybe we
// should have protection against it?").
//
// This was a real, measured bug, not a hypothetical: checkRowUsable used to
// click "remove" on any row MB complained about, and when the complaint is
// "This relationship already exists" that row IS the existing relationship — so
// a re-run over an already-imported entity staged DELETIONS of live data (three
// .rel-remove markers observed on a real recording).
//
// Protection is deliberately doubled up, because this is the one failure mode
// that destroys data rather than merely failing:
//   1. Falcon only ever removes rows IT added (MB marks those `rel-add`).
//   2. At submit time it refuses outright if either MB shows a staged removal,
//      OR — structurally, independent of MB's CSS classes — any link that
//      existed before Falcon started has gone missing from the form.
//
// The structural half is what this test attacks, by deleting a pre-existing row
// behind Falcon's back and requiring it to refuse to commit.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, idle } from '../../../dev/test/harness.mjs';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("#467: no deletions", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');

  await context.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const ck = check;

  const errs = []; page.on('pageerror', e => errs.push(e.message));
  let posts = 0;
  await page.route('**/*', route => {
    const r = route.request();
    if (r.method() === 'POST' && /\/(recording|artist|label)\/[0-9a-f-]{36}\/edit/.test(r.url())) { posts++; return route.abort(); }
    return route.fallback();
  });

  const ARTIST = 'd31f76d2-1d8e-4271-8027-148f375979d7';   // Der Zirkel, has several real links
  await page.goto(`https://test.musicbrainz.org/artist/${ARTIST}/edit`, { waitUntil: 'load' });
  await requireLogin(page);
  await idle(page);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 10000 });
  await page.waitForFunction(() => [...document.querySelectorAll('#external-links-editor input')].some(i => /add (another )?link|add another url/i.test(i.placeholder || '')), null, { timeout: 30000 });   // the links editor is up

  // 1. Falcon must not remove a PRE-EXISTING row even when MB rejects the url.
  const dupResult = await page.evaluate(async () => {
    const before = [...document.querySelectorAll('tr.external-link-item a[href]')].map(a => a.getAttribute('href'));
    // feed it a url the entity already has -> MB says "already exists"
    const already = before.find(u => /bandcamp/.test(u)) || before[0];
    const r = await window.__falconTest.fillAndSubmit(window, { urls: [{ url: already, linkTypeId: null }], note: '' }, { skipSubmit: true, tag: '[dup]' });
    const after = [...document.querySelectorAll('tr.external-link-item a[href]')].map(a => a.getAttribute('href'));
    return { already, stillThere: after.includes(already), removals: document.querySelectorAll('.rel-remove').length, result: r.results[0] };
  });
  console.log('duplicate-url handling:', JSON.stringify(dupResult));
  ck(dupResult.stillThere, `a pre-existing link MB rejected as duplicate is left in place, not removed (${dupResult.already})`);
  ck(dupResult.removals === 0, `no removal is staged (${dupResult.removals} .rel-remove)`);

  // 2. If a pre-existing link disappears anyway (markup change, MB quirk, a bug
  // we haven't found), the submit gate must catch it structurally and refuse.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await idle(page);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 10000 });
  await page.waitForFunction(() => [...document.querySelectorAll('#external-links-editor input')].some(i => /add (another )?link|add another url/i.test(i.placeholder || '')), null, { timeout: 30000 });   // the links editor is up
  const guard = await page.evaluate(async () => {
    const baseline = [...document.querySelectorAll('tr.external-link-item a[href]')].map(a => a.getAttribute('href'));
    // sabotage: delete a real, pre-existing relationship behind Falcon's back
    const victimRow = [...document.querySelectorAll('tr.external-link-item')].find(tr => tr.querySelector('a[href]'));
    const victim = victimRow.querySelector('a[href]').getAttribute('href');
    victimRow.querySelector('button.remove-item')?.click();
    for (let i = 0; i < 400 && [...document.querySelectorAll('tr.external-link-item a[href]')].some(a => a.getAttribute('href') === victim) && !document.querySelector('.rel-remove'); i++) await new Promise(r => setTimeout(r, 25));   // until MusicBrainz has taken it out
    const r = await window.__falconTest.fillAndSubmit(window, {
      urls: [{ url: 'https://myspace.com/falcon-guard-probe', linkTypeId: null }], note: '',
    }, { tag: '[guard]', baseline });
    return { victim, committed: r.committed, err: r.results.map(x => x.error).filter(Boolean)[0] };
  });
  console.log('guard result:', JSON.stringify(guard));
  ck(guard.committed === false, 'with a pre-existing link missing, the form is NOT committed');
  ck(/never removes links|removal/i.test(guard.err || ''), `and the reason says so plainly (got "${guard.err}")`);
  ck(posts === 0, `nothing was submitted at all (POST attempts: ${posts})`);

  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
});
