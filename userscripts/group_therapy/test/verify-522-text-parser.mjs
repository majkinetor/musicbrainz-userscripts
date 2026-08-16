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
  await page.click('.gt-tp-pick:has-text("search / create")');
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
ck(pairRows[0][3] === 'search / create…', `"Alice" does NOT inherit a stale manual pick from an earlier, unrelated row at the same position (got "${pairRows[0][3]}")`);

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
const fuzzyRoles = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-pick.gt-tp-resolved')].map(b => b.textContent.toLowerCase()));
console.log('fuzzy-resolved roles:', JSON.stringify(fuzzyRoles));
ck(fuzzyRoles.includes('mastering'), `"mastered by" fuzzy-resolves to "mastering" (got ${JSON.stringify(fuzzyRoles)})`);
ck(fuzzyRoles.includes('compiler'), `"compiled" fuzzy-resolves to "compiler", not colliding with "remixes and compilations" (got ${JSON.stringify(fuzzyRoles)})`);

// 11. a resolved role/artist stays clickable to change the pick (used to
// freeze once set).
const roleBtnClass = await page.evaluate(() => document.querySelector('.gt-tp-pick.gt-tp-resolved')?.className);
ck(roleBtnClass && roleBtnClass.includes('gt-tp-resolved'), 'a resolved role renders as a (still-clickable) button, not static text');
await page.click('.gt-tp-pick.gt-tp-resolved');
await page.waitForTimeout(150);
ck(await page.isVisible('.gt-role-pick'), 'clicking an already-resolved role reopens the picker to change it');

// 12. Escape inside the nested role picker closes only the picker, not the
// whole Text Parser modal.
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
await page.click('.gt-cons.gt-tp .gt-cons-x');
await page.waitForTimeout(150);
ck(!(await page.isVisible('.gt-cons.gt-tp')), 'modal closes');
await page.evaluate(() => window.__groupTherapy.openTextParser());
await page.waitForTimeout(300);
const restoredText = await page.inputValue('.gt-tp-ta');
console.log('restored text after reopen:', JSON.stringify(restoredText));
ck(restoredText === marker, `pasted text survives a close+reopen on the same release (got ${JSON.stringify(restoredText)})`);

// 15. Copyright notice parsing mode.
await page.click('.gt-tp-mode:has-text("Copyright")');
await page.waitForTimeout(150);
ck(!(await page.isVisible('.gt-tp-ctrl')), 'the credits-only pattern control bar is hidden in Copyright mode');
await page.fill('.gt-tp-ta', '℗ & © 2020 Some Copyright Test Label 522');
await page.waitForTimeout(150);
const crRows = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-row')].map(tr => [...tr.querySelectorAll('.gt-tp-c')].map(td => td.textContent)));
console.log('copyright rows:', JSON.stringify(crRows));
ck(crRows.length === 2, `a combined "℗ & ©" line produces 2 rows, one per notice type (got ${crRows.length})`);
ck(crRows.every(r => r[1] === 'Some Copyright Test Label 522'), `both rows share the same holder text (got ${JSON.stringify(crRows.map(r => r[1]))})`);
ck(crRows.some(r => r[0].includes('phonographic')) && crRows.some(r => r[0] === '© copyright'), `both notice kinds detected (got ${JSON.stringify(crRows.map(r => r[0]))})`);

// direct function-level checks for the copyright parser + label resolution,
// independent of real test-server holder data.
const crParse = await page.evaluate(() => window.__groupTherapy.txpParseCopyrightLine('© 2020 Some Label'));
ck(crParse && crParse.types.join(',') === 'copyright' && crParse.year === '2020' && crParse.holder === 'Some Label', `txpParseCopyrightLine parses a plain © line (got ${JSON.stringify(crParse)})`);
const labelCheck = await page.evaluate(async () => {
  try { return await window.__groupTherapy.txpResolveLabelByExactAlias('Zzqxv Nonexistent Label 522' + Date.now()); }
  catch (e) { return '__ERROR__: ' + e.message; }
});
ck(labelCheck === null, `txpResolveLabelByExactAlias correctly returns null for a name that can't exist (got ${JSON.stringify(labelCheck)})`);
await page.click('.gt-tp-mode:has-text("Credits")');

ck(posts === 0, `nothing submitted during the test (${posts})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
