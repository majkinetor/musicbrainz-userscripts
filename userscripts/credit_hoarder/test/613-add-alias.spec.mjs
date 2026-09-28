// #613 "+ alias": after a manual pick whose credit is neither the artist's name nor one
// of its aliases, the review table offers to add the credited name as an alias.
//
// A. Right click submits it in the background: a real write, on test.musicbrainz.org,
//    read back from the web service, with no alias type (majkinetor: "no type should be
//    set"). Submitting it again is refused as already there.
// B. The button: on the #605 release ("Bad Boys!", copied to the sandbox), pick "George
//    Gershwin" by hand for the credit "George & Ira Gershwin" and "+ alias" appears in
//    the source column; a left click opens MusicBrainz's add-alias form, pre-filled, in
//    a new tab, which is closed unsubmitted; back on the page it turns to "✓ alias" once
//    MusicBrainz has the alias. B's web-service answers are production's
//    (fixtures/ws-613-add-alias.json.gz, RECORD_WS=1 to refresh).
import { test, check, expect, replayWs, SANDBOX, until, frames } from '../../../dev/test/harness.mjs';
import { withShim, openEditor } from './ch.mjs';

const UA = { 'User-Agent': 'mb-userscripts-tests/1.0 ( https://github.com/majkinetor/musicbrainz-userscripts )', Accept: 'application/json' };
test.use({ gm: false });

test('the button rule, and a background "+ alias" that really lands, once', { tag: ['@sandbox', '@login'] }, async ({ context, page, inject }) => {
  const MOCKY = 'c321a13a-1c52-43c0-b60a-3a454cb7f9a2';   // an artist on the sandbox
  const aliasName = 'CH 613 alias ' + new Date().toISOString().replace(/\D/g, '').slice(0, 12);
  await openEditor(page, 'c16af706-4926-4248-80c5-5faee767d579');
  await inject('credit_hoarder', { waitFor: '__creditHoarder', transform: withShim });

  const rules = await page.evaluate(() => {
    const C = window.__creditHoarder;
    return {
      heldByName: C.wantsAliasButton('artist', { id: 'x', name: 'George Gershwin', aliases: [] }, 'george gershwin'),
      heldByAlias: C.wantsAliasButton('artist', { id: 'x', name: 'Abiodun', aliases: ['Don Abi'] }, 'Don Abi'),
      notHeld: C.wantsAliasButton('artist', { id: 'x', name: 'Christophe Voisin', aliases: [{ name: 'C. Voisin' }] }, 'Christophe Voisin-Boisvinet'),
      unknownAliases: C.wantsAliasButton('artist', { id: 'x', name: 'Christophe Voisin' }, 'Christophe Voisin-Boisvinet'),
      label: C.wantsAliasButton('label', { id: 'x', name: 'A', aliases: [] }, 'B'),
      va: C.wantsAliasButton('artist', { id: '89ad4ac3-39f7-470e-963a-56509c546377', name: 'Various Artists', aliases: [] }, 'VA'),
    };
  });
  check(!rules.heldByName && !rules.heldByAlias && rules.notHeld, `the button shows only when the credit is neither the name nor an alias (${JSON.stringify(rules)})`);
  check(rules.unknownAliases && !rules.label && !rules.va, 'with the aliases unknown (a cached candidate) it shows when the credit differs from the name; never for labels or special-purpose artists');

  const sub = await page.evaluate(async ([mbid, name]) => { try { return { ok: true, url: await window.__creditHoarder.submitAliasBackground(mbid, name, 'Credit Hoarder #613 "+ alias" test (test.musicbrainz.org)') }; } catch (e) { return { ok: false, err: e.message }; } }, [MOCKY, aliasName]);
  check(sub.ok, `MusicBrainz accepted the background submit (${JSON.stringify(sub)})`);
  // until MusicBrainz shows it (every 2 s); if it isn't applied for this account, the edit is open instead
  const aliasesNow = () => fetch(`${SANDBOX}/ws/2/artist/${MOCKY}?inc=aliases&fmt=json&_=${Date.now()}`, { headers: UA }).then(r => r.json()).then(j => j.aliases || []).catch(() => []);
  const aliases = await until(aliasesNow, a => a.some(x => x.name === aliasName), { timeout: 15000, every: 2000 });
  const mine = aliases.find(a => a.name === aliasName);
  if (mine) {
    check(mine.type == null && !mine['type-id'], `the alias is on the artist, with no type (${JSON.stringify(mine.type)})`);
  } else {
    // not auto-applied for this account: the edit is open instead
    const open = await page.evaluate(async mbid => ((await fetch(`/artist/${mbid}/open_edits`).then(r => r.text())).match(/Add artist alias/g) || []).length, MOCKY);
    check(open > 0, `the alias edit is open on the artist (${open} open "Add artist alias" edits)`);
  }
  const again = await page.evaluate(async ([mbid, name]) => { try { return await window.__creditHoarder.submitAliasBackground(mbid, name, 'dup check'); } catch (e) { return { err: e.message }; } }, [MOCKY, aliasName]);
  check(again && again.already === true, `the same alias again: "already", nothing submitted (${JSON.stringify(again)})`);
  const tabs = context.pages().length;
  const leftDup = await page.evaluate(async ([mbid, name]) => { try { return await window.__creditHoarder.openAddAliasForm(mbid, name, 'dup check'); } catch (e) { return { err: e.message }; } }, [MOCKY, aliasName]);
  await until(() => context.pages().length === tabs, Boolean, { timeout: 10000 });
  check(leftDup && leftDup.already === true && context.pages().length === tabs, `a left click on an alias it already has: "already", and the tab it opened is closed (${JSON.stringify(leftDup)})`);
});

test('"+ alias" appears after a manual pick, opens the form, and turns to "✓ alias"', { tag: ['@sandbox', '@login', '@web'] }, async ({ context, page, inject }) => {
  test.setTimeout(10 * 60_000);
  const posts = []; page.on('request', r => { if (r.method() === 'POST') posts.push(r.url()); });
  await openEditor(page, 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c');   // "Bad Boys!", a copy of production's aba74013
  const ws = await replayWs(page, new URL('./fixtures/ws-613-add-alias.json.gz', import.meta.url));
  await inject('credit_hoarder', { transform: withShim });
  await page.waitForSelector('.discogs-bar', { timeout: 30000 });
  const coDefault = await until(() => page.evaluate(() => { const l = [...document.querySelectorAll('label')].find(x => /Co-credit search/.test(x.textContent)); const i = l && l.querySelector('input'); return i ? i.checked : null; }), v => v !== null);
  check(coDefault === true, `Options › Matching › "Co-credit search" is ticked by default (${coDefault})`);

  await page.click('.discogs-src-ico[data-src="Discogs"]').catch(() => page.click('.discogs-src-ico'));
  await page.waitForFunction(() => /Preflight done/.test(document.body.innerText), null, { timeout: 180000 });
  await page.waitForFunction(() => [...document.querySelectorAll('tbody tr')].some(x => [...x.querySelectorAll('a,span')].some(a => a.textContent.trim() === 'George & Ira Gershwin')), null, { timeout: 30000 });
  // a manual pick cached by an earlier run shows no "+ alias" (its aliases are unknown)
  const cached = await page.evaluate(() => {
    const tr = [...document.querySelectorAll('tbody tr')].find(x => [...x.querySelectorAll('a,span')].some(a => a.textContent.trim() === 'George & Ira Gershwin'));
    return tr && /user \(cache\)/.test(tr.innerText) ? !!tr.querySelector('.discogs-add-alias') : null;
  });
  if (cached !== null) check(!cached, 'a cached manual pick from an earlier run shows no "+ alias"');
  // "Refresh from MB" re-resolves without the cache, so the row can be picked by hand
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /Refresh from MB/.test(b.textContent)).click());
  await page.waitForFunction(() => { const tr = [...document.querySelectorAll('tbody tr')].find(x => [...x.querySelectorAll('a,span')].some(a => a.textContent.trim() === 'George & Ira Gershwin')); return tr && !/\(cache\)/.test(tr.innerText) && /George Gershwin/.test(tr.innerText); }, null, { timeout: 180000 });
  // a candidate is clicked only once it is there, so asking again is safe
  const picked = await until(() => page.evaluate(() => {
    const tr = [...document.querySelectorAll('tbody tr')].find(x => [...x.querySelectorAll('a,span')].some(a => a.textContent.trim() === 'George & Ira Gershwin'));
    if (!tr) return 'no row';
    const cand = [...tr.querySelectorAll('div')].find(d => d.querySelector('button') && /^George Gershwin/.test((d.querySelector('a') || {}).textContent || ''));
    if (!cand) return 'no candidate: ' + tr.innerText.replace(/\s+/g, ' ').slice(0, 300);
    cand.querySelector('button').click();
    return 'ok';
  }), p => p === 'ok');
  const btn = await until(() => page.evaluate(() => { const b = document.querySelector('.discogs-add-alias'); if (!b) return null; const td = b.closest('td'), tds = [...td.parentElement.children]; return { text: b.textContent, col: tds.indexOf(td), cols: tds.length }; }), b => b && b.text === '+ alias');
  expect(picked, 'George Gershwin can be picked for "George & Ira Gershwin"').toBe('ok');
  check(btn && btn.text === '+ alias', `"+ alias" appears after the pick (${JSON.stringify(btn)})`);
  check(btn && btn.col < btn.cols - 1, 'in the source column, with the other add actions, not the match column');

  if (btn) {
    const [popup] = await Promise.all([context.waitForEvent('page', { timeout: 15000 }), page.click('.discogs-add-alias')]);
    await popup.waitForURL(/\/add-alias\?/, { timeout: 20000 });   // blank first, then the form once the live check passes
    await popup.waitForLoadState('domcontentloaded');
    const form = await popup.evaluate(() => ({ url: location.pathname, name: (document.querySelector('[name="edit-alias.name"]') || {}).value, type: (document.querySelector('[name="edit-alias.type_id"]') || {}).value }));
    check(/\/artist\/[0-9a-f-]{36}\/add-alias$/.test(form.url) && form.name === 'George & Ira Gershwin', `a left click opens the add-alias form, name filled in (${JSON.stringify(form)})`);
    check(form.type === '' || form.type == null, 'with no alias type chosen');
    await popup.close();   // never submitted
    // Coming back re-checks the artist's aliases; "still + alias" is read once that check
    // has answered, counted on the page's fetch.
    await page.evaluate(() => {
      const real = window.fetch; window.__aliasChecks = 0;
      window.fetch = (u, o) => { const p = real(u, o); if (/\/ws\/2\/artist\/[0-9a-f-]{36}\?inc=aliases/.test(String(u))) p.finally(() => { window.__aliasChecks++; }); return p; };
    });
    await page.bringToFront(); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await until(() => page.evaluate(() => window.__aliasChecks), n => n > 0);
    await frames(page);
    check(await page.evaluate(() => document.querySelector('.discogs-add-alias').textContent) === '+ alias', 'back without submitting: still "+ alias"');
    // as if the form had been submitted: MusicBrainz now has the alias
    await page.evaluate(() => {
      const real = window.fetch;
      window.fetch = (u, o) => /\/ws\/2\/artist\/[0-9a-f-]{36}\?inc=aliases/.test(String(u))
        ? Promise.resolve(new Response(JSON.stringify({ id: String(u).match(/artist\/([0-9a-f-]{36})/)[1], name: 'George Gershwin', aliases: [{ name: 'George & Ira Gershwin' }] }), { headers: { 'Content-Type': 'application/json' } }))
        : real(u, o);
    });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const after = await until(() => page.evaluate(() => { const b = document.querySelector('.discogs-add-alias'); return { text: b.textContent, disabled: b.disabled }; }), a => a.text === '✓ alias');
    check(after.text === '✓ alias' && after.disabled, `after submitting the form, returning to the tab shows "✓ alias" (${JSON.stringify(after)})`);
  }
  check(!posts.some(u => /\/(artist\/[^/]+\/add-alias|ws\/js\/edit)/.test(u)), 'no alias or relationship edit was submitted');
  await ws.done();
});
