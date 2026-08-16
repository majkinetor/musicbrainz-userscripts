// #522 (majkinetor): "In a new branch, create a Text parser tool. It should
// work sorta like Pattern parser of Apollo but for credits." Parses
// unstructured liner-note-style credit text ("Mastering: Nick Robbins",
// "Cameron Allen - Flute, Tenor Saxophone") into (role, artist) rows and
// stages them as real artist→release relationships via dispatchRelationship
// — the same mechanism every other Group Therapy tool already uses.
//
// Runs against test.musicbrainz.org (the sanctioned sandbox) and never
// submits — every edit POST is blocked, so this only exercises the editor's
// staged state, which is exactly what the user reviews before saving.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/group_therapy/group_therapy.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1100 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'Group Therapy', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
let posts = 0;
await page.route('**/*', route => {
  const r = route.request();
  if (r.method() === 'POST' && /\/edit/.test(r.url())) { posts++; return route.abort(); }
  return route.continue();
});
await page.goto('https://test.musicbrainz.org/release/3a37a35f-1e06-457f-9b2a-46155c5c03ce/edit-relationships', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(4500);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__groupTherapy, { timeout: 15000 });
await page.waitForTimeout(1500);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// 1. the modal opens and the toolbar button exists.
ck(await page.isVisible('button.gt-clone-btn:has-text("Text parser")'), 'the "Text parser…" toolbar button is present');
await page.evaluate(() => window.__groupTherapy.openTextParser());
await page.waitForTimeout(150);
ck(await page.isVisible('.gt-cons.gt-tp'), 'the modal opens');

// 2. paste majkinetor's own R: A sample and confirm it parses correctly.
const RA_SAMPLE = [
  'Graphic Design: Ricardo "Magrão" Fernandes',
  'Mastering: Michael Graves (Osiris Studio)',
  'Audio Restoration: Jordan McLeod (Osiris Studio)',
  'Liner Notes: Banning Eyre',
  'Text Editing: Jesse Simon',
].join('\n');
await page.fill('.gt-tp-ta', RA_SAMPLE);
await page.waitForTimeout(150);
let rowTexts = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-row')].map(tr => [...tr.querySelectorAll('.gt-tp-c')].map(td => td.textContent)));
console.log('R: A rows:', JSON.stringify(rowTexts));
ck(rowTexts.length === 5, `all 5 lines produce a row (got ${rowTexts.length})`);
ck(rowTexts[1][0] === 'Mastering' && rowTexts[1][1].includes('Michael Graves'), `role/artist split correctly for one row (got ${JSON.stringify(rowTexts[1])})`);

// 3. switch to the A - R[,] preset and confirm the comma-split expansion.
await page.click('.gt-tp-chip:has-text("A - R[,]")');
await page.fill('.gt-tp-ta', 'Cameron Allen - Flute, Tenor Saxophone');
await page.waitForTimeout(150);
rowTexts = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-row')].map(tr => [...tr.querySelectorAll('.gt-tp-c')].map(td => td.textContent)));
console.log('A - R[,] rows:', JSON.stringify(rowTexts));
ck(rowTexts.length === 2, `one line with 2 comma-split roles expands to 2 rows (got ${rowTexts.length})`);
// table columns are always [role, artist] regardless of the pattern's own field order.
ck(rowTexts.every(r => r[1] === 'Cameron Allen'), 'both expanded rows share the same artist');
ck(rowTexts.map(r => r[0]).join('|') === 'Flute|Tenor Saxophone', `roles split correctly (got ${JSON.stringify(rowTexts.map(r => r[0]))})`);

// 4. annotation loading — a real fetch against a real release (loose assertion,
// annotation content varies; just confirm the pipeline runs without throwing
// and returns a string).
const annoText = await page.evaluate(async () => {
  try { return await window.__groupTherapy.txpFetchAnnotation('3a37a35f-1e06-457f-9b2a-46155c5c03ce'); }
  catch (e) { return '__ERROR__: ' + e.message; }
});
console.log('annotation fetch result (first 80 chars):', JSON.stringify(String(annoText).slice(0, 80)));
ck(typeof annoText === 'string' && !annoText.startsWith('__ERROR__'), 'txpFetchAnnotation runs against a real release without throwing');

// 5. role auto-resolution — "mastering" is a real, stable MB link-type name
// for artist-release (schema/vocabulary, not data — safe against test-server
// data drift), so linkTypesForPair should always find it.
const roleCheck = await page.evaluate(() => {
  const roles = window.__groupTherapy.linkTypesForPair('artist', 'release');
  return { count: roles.length, hasMastering: roles.some(r => r.name.toLowerCase() === 'mastering'), dedup: new Set(roles.map(r => r.id)).size === roles.length };
});
console.log('linkTypesForPair(artist,release):', JSON.stringify(roleCheck));
ck(roleCheck.count > 0 && roleCheck.hasMastering, `linkTypesForPair finds "mastering" among artist-release types (${roleCheck.count} total)`);
ck(roleCheck.dedup, 'no duplicate ids (MB keys link_type by both numeric id and gid)');

// 6. artist resolution — a clearly-fabricated name must resolve to null
// (not throw, not falsely match), independent of test-server data drift.
const artistCheck = await page.evaluate(async () => {
  try { return await window.__groupTherapy.txpResolveByExactAlias('Zzqxv Nonexistent Artist 522' + Date.now()); }
  catch (e) { return '__ERROR__: ' + e.message; }
});
ck(artistCheck === null, `txpResolveByExactAlias correctly returns null for a name that can't exist (got ${JSON.stringify(artistCheck)})`);

// 7. apply — resolve a single row manually via the picker paste-MBID path (a
// stable, data-drift-proof way to get a resolved artist), then Apply, and
// confirm a real relationship-item / rel-add appears in the DOM.
await page.fill('.gt-tp-pat', 'R: A');
await page.fill('.gt-tp-ta', 'Mastering: Test Artist For 522');
await page.waitForTimeout(150);
// resolve the role automatically (exact name match, no picker needed)
await page.click('.gt-tp-resolve');
await page.waitForTimeout(600);
// resolve the artist via the picker's paste-MBID path — pick a real artist
// gid from this same test release's own credits so it's guaranteed to exist.
const anArtistGid = await page.evaluate(() => {
  const a = document.querySelector('.relationship-item a[href^="/artist/"]');
  return a ? a.getAttribute('href').split('/')[2] : null;
});
console.log('artist gid to paste into the picker:', anArtistGid);
if (anArtistGid) {
  await page.click('.gt-tp-search');
  await page.waitForTimeout(150);
  await page.fill('.gt-tp-q', anArtistGid);
  await page.waitForTimeout(600);
  await page.click('.gt-tp-res');
  await page.waitForTimeout(150);
  const relCountBefore = await page.evaluate(() => document.querySelectorAll('.relationship-item').length);
  await page.click('.gt-cons-apply');
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({
    relCount: document.querySelectorAll('.relationship-item').length,
    relAdd: document.querySelectorAll('.rel-add').length,
    applied: document.querySelector('.gt-tp-applied') !== null,
  }));
  console.log('after apply:', JSON.stringify(after), 'before:', relCountBefore);
  ck(after.relCount > relCountBefore, `a new relationship-item appears after Apply (before ${relCountBefore}, after ${after.relCount})`);
  ck(after.relAdd > 0, `MB staged the addition (${after.relAdd} rel-add)`);
  ck(after.applied, 'the row flips to an "applied" state in the table');
} else {
  console.log('SKIP: no existing artist relationship on this test release to reuse an MBID from');
}

// ── follow-up feedback fixes (majkinetor, live, after trying the first pass) ──

// 8. one raw line can have multiple role+artist pairs, semicolon-separated.
// (This also regression-guards a real bug caught live: since this runs
// AFTER the apply test manually resolved a DIFFERENT artist at the same row
// POSITION, a position-keyed manual pick used to leak that stale resolution
// onto "Alice" here. Resolutions are now keyed by row TEXT, not position.)
await page.fill('.gt-tp-pat', 'R: A');
await page.fill('.gt-tp-ta', 'Guitar: Alice; Bass: Bob');
await page.waitForTimeout(150);
let pairRows = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-row')].map(tr => [...tr.querySelectorAll('.gt-tp-c')].map(td => td.textContent)));
console.log('semicolon-pair rows:', JSON.stringify(pairRows));
ck(pairRows.length === 2, `"Guitar: Alice; Bass: Bob" expands to 2 rows (got ${pairRows.length})`);
ck(pairRows[0][0] === 'Guitar' && pairRows[0][1] === 'Alice', `first pair parsed correctly (got ${JSON.stringify(pairRows[0])})`);
ck(pairRows[1][0] === 'Bass' && pairRows[1][1] === 'Bob', `second pair parsed correctly (got ${JSON.stringify(pairRows[1])})`);
ck(pairRows[0][3] === 'search', `"Alice" does NOT inherit a stale manual pick from an earlier, unrelated row at the same position (got "${pairRows[0][3]}")`);

// 9. per-row pattern override keeps focus + value while typing (used to lose
// focus on every keystroke because render() rebuilt the whole table).
await page.fill('.gt-tp-ta', 'Line one\nLine two');
await page.waitForTimeout(150);
const ov = page.locator('.gt-tp-ov').first();
await ov.click();
await ov.type('R: A', { delay: 25 });
await page.waitForTimeout(150);
const focusInfo = await page.evaluate(() => ({ cls: document.activeElement.className || '', val: document.activeElement.value || '' }));
console.log('focus after typing an override:', JSON.stringify(focusInfo));
ck(focusInfo.cls.includes('gt-tp-ov') && focusInfo.val === 'R: A', `focus and value survive re-renders while typing (got ${JSON.stringify(focusInfo)})`);

// 10. fuzzy role auto-resolution ("compiled" -> "compiler", "mastered by" ->
// "mastering") without colliding with lookalike roles ("chorus master",
// "remixes and compilations").
await page.fill('.gt-tp-ta', 'mastered by: Someone For 522\ncompiled: Someone Else For 522');
await page.waitForTimeout(150);
await page.click('.gt-tp-resolve');
await page.waitForTimeout(1000);
// role cells (resolved) render as a <span>; artist cells (resolved) render
// as an <a> — target span specifically so an artist name can't false-match.
const fuzzyRoles = await page.evaluate(() => [...document.querySelectorAll('span.gt-tp-resolved')].map(b => b.textContent.toLowerCase()));
console.log('fuzzy-resolved roles:', JSON.stringify(fuzzyRoles));
ck(fuzzyRoles.includes('mastering'), `"mastered by" fuzzy-resolves to "mastering" (got ${JSON.stringify(fuzzyRoles)})`);
ck(fuzzyRoles.includes('compiler'), `"compiled" fuzzy-resolves to "compiler", not colliding with "remixes and compilations" (got ${JSON.stringify(fuzzyRoles)})`);

// 11. #522 second round (majkinetor, live): "Tidy up artist / role column —
// ... plain text after selection." A resolved role is now plain (a <span>,
// no click/button styling); a resolved artist is a real <a> (left click
// opens the entity, no separate re-pick affordance).
const roleTagName = await page.evaluate(() => document.querySelector('span.gt-tp-resolved')?.tagName);
ck(roleTagName === 'SPAN', `a resolved role renders as plain text, not a button (got tag "${roleTagName}")`);
// reuse the exact text manually resolved (and applied) back in check 7 —
// artistCache is text-keyed and persists across textarea content changes
// within the same session, so this is guaranteed to already be resolved.
await page.fill('.gt-tp-ta', 'Mastering: Test Artist For 522');
await page.waitForTimeout(150);
const artistLink = await page.evaluate(() => { const a = document.querySelector('a.gt-tp-resolved'); return a ? { tag: a.tagName, href: a.getAttribute('href'), target: a.target } : null; });
console.log('resolved artist link:', JSON.stringify(artistLink));
ck(artistLink && artistLink.tag === 'A' && /^\/(artist|label)\//.test(artistLink.href) && artistLink.target === '_blank', `a resolved artist is a real link that opens in a new tab (got ${JSON.stringify(artistLink)})`);
ck(await page.evaluate(() => !document.querySelector('.gt-tp-openlink')), 'the separate ↗ open-icon is gone — the artist name itself is the link now');

// 12. Escape inside the nested role picker closes only the picker, not the
// whole Text Parser modal. Open it via an UNRESOLVED row's "search" link —
// resolved cells no longer reopen the picker (see #11 above).
await page.fill('.gt-tp-ta', 'Some Unmapped Role Xyz522: Some Artist For Esc Test');
await page.waitForTimeout(150);
await page.click('.gt-tp-search');
await page.waitForTimeout(150);
ck(await page.isVisible('.gt-role-pick'), 'clicking "search" on an unresolved role opens the picker');
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
const afterEsc = await page.evaluate(() => ({ rolePickOpen: !!document.querySelector('.gt-role-pick'), mainOpen: !!document.querySelector('.gt-cons.gt-tp') }));
console.log('after Escape inside the role picker:', JSON.stringify(afterEsc));
ck(!afterEsc.rolePickOpen, 'Escape closes the nested role picker');
ck(afterEsc.mainOpen, 'Escape does NOT also close the main Text Parser modal');

// 13. Load annotation goes straight into the textarea — no confirm/preview step.
await page.fill('.gt-tp-ta', '');
await page.click('.gt-tp-anno');
await page.waitForTimeout(1500);
const hasConfirmBox = await page.evaluate(() => !!document.querySelector('.gt-tp-anno-use'));
ck(!hasConfirmBox, 'no confirmation/preview box exists for annotation loading anymore');

// 14. state (pasted text) survives closing and reopening the tool on the same release.
const marker = 'Persisted Sample 522: Persist Test Artist ' + Date.now();
await page.fill('.gt-tp-ta', marker);
await page.waitForTimeout(250);
// the new maximize button shares .gt-cons-x with the close button (same
// convention Match Works already uses for its own header icons) — only the
// close button has no title, so :not([title]) picks it out unambiguously.
await page.click('.gt-cons.gt-tp .gt-cons-x:not([title])');
await page.waitForTimeout(150);
ck(!(await page.isVisible('.gt-cons.gt-tp')), 'modal closes');
await page.evaluate(() => window.__groupTherapy.openTextParser());
await page.waitForTimeout(300);
const restoredText = await page.inputValue('.gt-tp-ta');
console.log('restored text after reopen:', JSON.stringify(restoredText));
ck(restoredText === marker, `pasted text survives a close+reopen on the same release (got ${JSON.stringify(restoredText)})`);

// 15. Copyright notices are detected AUTOMATICALLY by their ©/℗ markers —
// no separate mode. A paste can freely mix ordinary credits with a
// copyright line, all resolved in the same pass.
await page.fill('.gt-tp-pat', 'R: A');
await page.fill('.gt-tp-ta', 'Mastering: Someone For 522\n℗ & © 2020 Some Copyright Test Label 522');
await page.waitForTimeout(150);
const mixedRows = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-row')].map(tr => [...tr.querySelectorAll('.gt-tp-c')].map(td => td.textContent)));
console.log('mixed credit + copyright rows:', JSON.stringify(mixedRows));
ck(mixedRows.length === 3, `1 ordinary credit + 1 combined "℗ & ©" line (2 notices) = 3 rows total (got ${mixedRows.length})`);
ck(mixedRows[0][0] === 'Mastering' && mixedRows[0][1] === 'Someone For 522', `the ordinary credit line still parses via the R: A pattern (got ${JSON.stringify(mixedRows[0])})`);
const crPortion = mixedRows.slice(1);
ck(crPortion.every(r => r[1] === 'Some Copyright Test Label 522'), `both copyright rows share the same holder text (got ${JSON.stringify(crPortion.map(r => r[1]))})`);
ck(crPortion.some(r => r[0].includes('phonographic')) && crPortion.some(r => r[0] === '© copyright'), `both notice kinds detected (got ${JSON.stringify(crPortion.map(r => r[0]))})`);

// the picker for a copyright row only offers/searches LABELS (per
// majkinetor: "do only label->release for now").
await page.click('.gt-tp-row:nth-child(2) .gt-tp-search');
await page.waitForTimeout(150);
const pickerInfo = await page.evaluate(() => ({
  header: document.querySelector('.gt-tp-apop .gt-pop-hdr')?.textContent,
  createLinks: [...document.querySelectorAll('.gt-tp-apop .gt-tp-createlink')].map(a => a.textContent),
}));
console.log('copyright-row picker:', JSON.stringify(pickerInfo));
ck(/label/i.test(pickerInfo.header) && !/artist/i.test(pickerInfo.header), `the picker header asks for a label, not "label or artist" (got "${pickerInfo.header}")`);
ck(pickerInfo.createLinks.length === 1 && /create label/i.test(pickerInfo.createLinks[0]), `only a "Create label" link is offered, no artist option (got ${JSON.stringify(pickerInfo.createLinks)})`);
await page.keyboard.press('Escape');
await page.waitForTimeout(100);

// direct function-level checks for the copyright parser + label resolution,
// independent of real test-server holder data.
const crParse = await page.evaluate(() => window.__groupTherapy.txpParseCopyrightLine('© 2020 Some Label'));
ck(crParse && crParse.types.join(',') === 'copyright' && crParse.year === '2020' && crParse.holder === 'Some Label', `txpParseCopyrightLine parses a plain © line (got ${JSON.stringify(crParse)})`);
const labelCheck = await page.evaluate(async () => {
  try { return await window.__groupTherapy.txpResolveLabelByExactAlias('Zzqxv Nonexistent Label 522' + Date.now()); }
  catch (e) { return '__ERROR__: ' + e.message; }
});
ck(labelCheck === null, `txpResolveLabelByExactAlias correctly returns null for a name that can't exist (got ${JSON.stringify(labelCheck)})`);

// #522 follow-up (majkinetor, live): "Why is this label not auto resolved
// as it seems like a single name match?" (© 2004 Geffen Records / ℗ 2015
// Geffen Records) — live-verified against PRODUCTION musicbrainz.org that
// MB genuinely has two labels named exactly "Geffen Records" (a real one,
// score 100, and a "bootleg version" duplicate, score 45), so refusing as
// ambiguous was technically correct — but a decisive score gap should
// still resolve it. Tested with synthetic data here (deterministic,
// doesn't depend on test.musicbrainz.org happening to have the same
// real-world duplicate).
const scoreNarrow = await page.evaluate(() => {
  const GT = window.__groupTherapy;
  const decisive = GT.txpNarrowByScore([{ id: 'a', score: 100 }, { id: 'b', score: 45 }]);
  const tooClose = GT.txpNarrowByScore([{ id: 'a', score: 80 }, { id: 'b', score: 75 }]);
  return { decisive: decisive.map(x => x.id), tooClose: tooClose.map(x => x.id) };
});
console.log('score-narrowing:', JSON.stringify(scoreNarrow));
ck(scoreNarrow.decisive.length === 1 && scoreNarrow.decisive[0] === 'a', `a decisive score gap (100 vs 45) narrows to the top match (got ${JSON.stringify(scoreNarrow.decisive)})`);
ck(scoreNarrow.tooClose.length === 2, `a marginal gap (80 vs 75) stays genuinely ambiguous, no guessing (got ${JSON.stringify(scoreNarrow.tooClose)})`);

// ── third round of live feedback ──────────────────────────────────────────

// 16. instrument roles ("Guitar", "Flute", "Saxophone", "Piano", "Hammond",
// "Percussion") auto-resolve — MB has no standalone link type for these,
// they're ATTRIBUTES on the generic "instrument" relationship. "Drums"
// resolves via the loose-substring stage to "drums (drum set)"; "Keys" is a
// genuine synonym gap (real name is "keyboard") and is deliberately NOT
// asserted to auto-resolve here.
await page.fill('.gt-tp-pat', 'A - R[,]');
await page.fill('.gt-tp-ta', 'Kwame Yeboah - Keys, Guitar, Piano, Hammond\nBen Abarbanel-Wolff - Saxophone, Flute\nEric Owusu - Percussion');
await page.waitForTimeout(150);
await page.click('.gt-tp-resolve');
await page.waitForTimeout(1500);
// the override/raw columns only render on a line's FIRST sub-row, so a
// plain nth-child count isn't stable across rows — read the parsed role
// text from the FIRST of the row's .gt-tp-c cells instead (array order is
// always [role, artist, →role, →artist] regardless of which line-level
// cells are present).
const instrumentRows = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-row')].map(tr => {
  const cs = [...tr.querySelectorAll('.gt-tp-c')];
  return { role: cs[0]?.textContent, resolved: tr.querySelector('span.gt-tp-resolved')?.textContent || null };
}));
console.log('instrument rows:', JSON.stringify(instrumentRows));
const byRole = role => instrumentRows.find(r => r.role === role);
ck(byRole('Guitar')?.resolved?.toLowerCase() === 'guitar', `"Guitar" auto-resolves (got ${JSON.stringify(byRole('Guitar'))})`);
ck(byRole('Piano')?.resolved?.toLowerCase() === 'piano', `"Piano" auto-resolves (got ${JSON.stringify(byRole('Piano'))})`);
ck(byRole('Hammond')?.resolved?.toLowerCase().includes('hammond'), `"Hammond" loose-matches "Hammond organ" (got ${JSON.stringify(byRole('Hammond'))})`);
ck(byRole('Saxophone')?.resolved?.toLowerCase() === 'saxophone', `"Saxophone" auto-resolves (got ${JSON.stringify(byRole('Saxophone'))})`);
ck(byRole('Flute')?.resolved?.toLowerCase() === 'flute', `"Flute" auto-resolves (got ${JSON.stringify(byRole('Flute'))})`);
ck(byRole('Percussion')?.resolved?.toLowerCase() === 'percussion', `"Percussion" auto-resolves (got ${JSON.stringify(byRole('Percussion'))})`);
// an instrument match must dispatch as the "instrument" link type PLUS the
// specific-instrument attribute — not a link type of its own.
const guitarApplied = await page.evaluate(async () => {
  const GT = window.__groupTherapy;
  const roles = GT.linkTypesForPair('artist', 'release');
  const instrumentLt = roles.find(r => r.name === 'instrument');
  return { hasInstrumentLt: !!instrumentLt, instrumentLtId: instrumentLt && instrumentLt.id };
});
console.log('instrument link type:', JSON.stringify(guitarApplied));
ck(guitarApplied.hasInstrumentLt, 'the "instrument" link type exists for artist-release (schema, not data — stable)');

// 17. remove a row — deletes it from the results AND the underlying textarea.
await page.fill('.gt-tp-pat', 'R: A');
await page.fill('.gt-tp-ta', 'Mastering: Row To Keep 522\nProducer: Row To Delete 522');
await page.waitForTimeout(150);
let rowCountBefore = await page.evaluate(() => document.querySelectorAll('.gt-tp-row').length);
await page.click('.gt-tp-row:nth-child(2) .gt-tp-rowdel');
await page.waitForTimeout(150);
const afterDelete = await page.evaluate(() => ({
  rowCount: document.querySelectorAll('.gt-tp-row').length,
  taValue: document.querySelector('.gt-tp-ta').value,
}));
console.log('after row delete:', JSON.stringify(afterDelete), 'before count:', rowCountBefore);
ck(afterDelete.rowCount === rowCountBefore - 1, `deleting a row removes it from the table (before ${rowCountBefore}, after ${afterDelete.rowCount})`);
ck(!afterDelete.taValue.includes('Row To Delete') && afterDelete.taValue.includes('Row To Keep'), `the deleted line is also gone from the source textarea (got ${JSON.stringify(afterDelete.taValue)})`);

// 18. editing the raw-line cell in the table updates the source textarea.
await page.fill('.gt-tp-ta', 'Mastering: Typo Artist 522');
await page.waitForTimeout(150);
const rawInput = page.locator('.gt-tp-raw').first();
await rawInput.click();
await rawInput.fill('Mastering: Fixed Artist 522');
await rawInput.dispatchEvent('input');
await page.waitForTimeout(150);
const afterRawEdit = await page.evaluate(() => ({
  taValue: document.querySelector('.gt-tp-ta').value,
  artistCell: [...document.querySelector('.gt-tp-row').querySelectorAll('.gt-tp-c')][1]?.textContent,
}));
console.log('after inline raw edit:', JSON.stringify(afterRawEdit));
ck(afterRawEdit.taValue.includes('Fixed Artist'), `editing the raw cell updates the source textarea (got ${JSON.stringify(afterRawEdit.taValue)})`);
ck(afterRawEdit.artistCell === 'Fixed Artist 522', `the row re-parses from the edited text (got "${afterRawEdit.artistCell}")`);

// 19. maximize button toggles a near-fullscreen class and back.
const maxBefore = await page.evaluate(() => document.querySelector('.gt-cons.gt-tp').classList.contains('gt-tp-max'));
await page.click('.gt-cons.gt-tp .gt-cons-x[title="Maximize / restore"]');
await page.waitForTimeout(150);
const maxAfter = await page.evaluate(() => document.querySelector('.gt-cons.gt-tp').classList.contains('gt-tp-max'));
console.log('maximize toggle:', { maxBefore, maxAfter });
ck(!maxBefore && maxAfter, `the maximize button adds the near-fullscreen class (before ${maxBefore}, after ${maxAfter})`);
await page.click('.gt-cons.gt-tp .gt-cons-x[title="Restore"]');
await page.waitForTimeout(150);
ck(!(await page.evaluate(() => document.querySelector('.gt-cons.gt-tp').classList.contains('gt-tp-max'))), 'clicking it again restores');

// 20. resizable columns — dragging a header's resize handle changes its
// <col> width.
const colWidthBefore = await page.evaluate(() => document.querySelector('.gt-tp-tbl colgroup col:nth-child(2)').style.width);
const handle = await page.$('.gt-tp-tbl thead th:nth-child(2) .gt-tp-colresize');
const box = await handle.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + 80, box.y + box.height / 2);
await page.mouse.up();
await page.waitForTimeout(100);
const colWidthAfter = await page.evaluate(() => document.querySelector('.gt-tp-tbl colgroup col:nth-child(2)').style.width);
console.log('column width drag:', { colWidthBefore, colWidthAfter });
ck(parseInt(colWidthAfter) > parseInt(colWidthBefore), `dragging a column's resize handle widens it (before ${colWidthBefore}, after ${colWidthAfter})`);

// 21. full resolution state (not just text) survives a close+reopen.
await page.fill('.gt-tp-ta', 'Mastering: Persisted Resolution Artist 522');
await page.waitForTimeout(150);
await page.click('.gt-tp-resolve');
await page.waitForTimeout(800);
const beforeClose = await page.evaluate(() => document.querySelector('span.gt-tp-resolved')?.textContent);
console.log('role resolved before close:', beforeClose);
ck(beforeClose && beforeClose.toLowerCase() === 'mastering', 'sanity: the role is resolved before closing');
await page.click('.gt-cons.gt-tp .gt-cons-x:not([title])');
await page.waitForTimeout(150);
await page.evaluate(() => window.__groupTherapy.openTextParser());
await page.waitForTimeout(300);
const afterReopen = await page.evaluate(() => document.querySelector('span.gt-tp-resolved')?.textContent);
console.log('role resolved after reopen:', afterReopen);
ck(afterReopen && afterReopen.toLowerCase() === 'mastering', `the resolution survives close+reopen, not just the pasted text (got ${JSON.stringify(afterReopen)})`);

ck(posts === 0, `nothing submitted during the test (${posts})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
