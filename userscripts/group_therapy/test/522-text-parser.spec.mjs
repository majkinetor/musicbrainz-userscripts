// #522 (majkinetor): "In a new branch, create a Text parser tool. It should
// work sorta like Pattern parser of Apollo but for credits." Parses
// unstructured liner-note-style credit text ("Mastering: Nick Robbins",
// "Cameron Allen - Flute, Tenor Saxophone") into (role, artist) credits and
// stages them as real artist→release relationships via dispatchRelationship
// — the same mechanism every other Group Therapy tool already uses.
//
// #798 moved it into the page with a row per name; this spec follows every
// behaviour of the rounds of live feedback below into that layout. What the
// layout removed (the entity popover and its placement, maximize, the old
// table's cells) is gone from here too.
//
// Runs against test.musicbrainz.org (the sanctioned sandbox) and never
// submits — every edit POST is blocked, so this only exercises the editor's
// staged state, which is exactly what the user reviews before saving.
import { test, check, requireLogin, SANDBOX, settled, idle, frames, until } from '../../../dev/test/harness.mjs';
import { blockEdits, ensureAnnotation, tpPaste, tpCredits, tpRow, tpPick, tpApply, tpSettle } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('the text parser end to end: parse, resolve, apply, and the fixes from live feedback', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
  test.setTimeout(600000);
  const RELEASE_GID = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
  // the release needs an annotation for "Load annotation" — a one-time real edit,
  // made before the POST block below
  await ensureAnnotation(page, RELEASE_GID);
  await page.goto(`${SANDBOX}/release/${RELEASE_GID}/edit-relationships`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await settled(page);
  const posts = await blockEdits(page);
  await inject('group_therapy', { waitFor: '__groupTherapy' });
  await idle(page);

  const open = async () => { if (!(await page.$('.gt-tp'))) { await page.evaluate(() => window.__groupTherapy.openTextParser()); await page.waitForSelector('.gt-tp'); await frames(page); } };
  const close = async () => { await page.evaluate(() => window.__groupTherapy.closeTextParser()); await frames(page); };
  const credits = () => tpCredits(page);
  const pairs = async () => (await credits()).filter(c => c.matched).map(c => [c.role, c.entity]);
  const resolvedOf = async role => ((await credits()).find(c => c.role === role) || {}).resolved || null;

  // 1. the toolbar button opens it, in the page.
  check(await page.isVisible('button.gt-clone-btn:has-text("Text parser")'), 'the "Text parser…" toolbar button is present');
  await page.click('button.gt-clone-btn:has-text("Text parser")');
  await page.waitForSelector('.gt-tp');
  check(await page.isVisible('.gt-tp'), 'the parser opens');

  // 1b. the copyright help is in the paste box's placeholder; the column divider is a thin line.
  const emptyState = await page.evaluate(() => {
    const handle = document.querySelector('.gt-tp-colresize');
    const after = handle ? getComputedStyle(handle, '::after') : null;
    return {
      hasCrNote: !!document.querySelector('.gt-tp-crnote'),
      placeholder: document.querySelector('.gt-tp-ta').placeholder,
      lineWidth: after ? after.width : null, lineBg: after ? after.backgroundColor : null,
    };
  });
  console.log('empty state:', JSON.stringify(emptyState));
  check(!emptyState.hasCrNote, 'no separate permanent copyright-help line');
  check(/©/.test(emptyState.placeholder) && /℗/.test(emptyState.placeholder), `the copyright help is in the paste box's placeholder (got ${JSON.stringify(emptyState.placeholder)})`);
  check(emptyState.lineBg && emptyState.lineBg !== 'rgba(0, 0, 0, 0)' && emptyState.lineBg !== 'transparent', `the column divider shows a line at rest (got "${emptyState.lineBg}")`);
  check(parseFloat(emptyState.lineWidth) <= 2, `and the line is thin, not a fat bar (got ${emptyState.lineWidth})`);

  // 2. majkinetor's own R: E sample.
  await tpPaste(page, [
    'Graphic Design: Ricardo "Magrão" Fernandes',
    'Mastering: Michael Graves (Osiris Studio)',
    'Audio Restoration: Jordan McLeod (Osiris Studio)',
    'Liner Notes: Banning Eyre',
    'Text Editing: Jesse Simon',
  ].join('\n'), 'R: E');
  let rows = await pairs();
  console.log('R: E credits:', JSON.stringify(rows));
  check(rows.length === 5, `all 5 lines produce a credit (got ${rows.length})`);
  check(rows[1][0] === 'Mastering' && rows[1][1].includes('Michael Graves'), `role/name split correctly (got ${JSON.stringify(rows[1])})`);

  // 3. the E[,] - R[,] preset, from the pattern's ▾ — a comma on either side splits.
  await page.click('.gt-tp-ddbtn');
  await page.click('.gt-tp-dd-it:has(.gt-tp-dd-pat:text-is("E[,] - R[,]"))');
  await tpPaste(page, 'Cameron Allen - Flute, Tenor Saxophone');
  rows = await pairs();
  console.log('E[,] - R[,] credits:', JSON.stringify(rows));
  check(await page.inputValue('.gt-tp-pat') === 'E[,] - R[,]', 'the preset is set as the pattern');
  check(rows.length === 2 && rows.every(r => r[1] === 'Cameron Allen'), `one line with 2 comma-split roles is 2 credits of one name (got ${JSON.stringify(rows)})`);
  check(rows.map(r => r[0]).join('|') === 'Flute|Tenor Saxophone', `roles split correctly (got ${JSON.stringify(rows.map(r => r[0]))})`);

  // 4–6. the building blocks, on real data.
  const annoText = await page.evaluate(async g => { try { return await window.__groupTherapy.txpFetchAnnotation(g); } catch (e) { return '__ERROR__: ' + e.message; } }, RELEASE_GID);
  check(typeof annoText === 'string' && !annoText.startsWith('__ERROR__'), 'txpFetchAnnotation runs against a real release without throwing');
  const roleCheck = await page.evaluate(() => {
    const roles = window.__groupTherapy.linkTypesForPair('artist', 'release');
    return { count: roles.length, hasMastering: roles.some(r => r.name.toLowerCase() === 'mastering'), dedup: new Set(roles.map(r => r.id)).size === roles.length };
  });
  check(roleCheck.count > 0 && roleCheck.hasMastering, `linkTypesForPair finds "mastering" among artist-release types (${roleCheck.count} total)`);
  check(roleCheck.dedup, 'no duplicate ids (MB keys link_type by both numeric id and gid)');
  const artistCheck = await page.evaluate(async () => { try { return await window.__groupTherapy.txpResolveByExactAlias('Zzqxv Nonexistent Artist 522' + Date.now()); } catch (e) { return '__ERROR__: ' + e.message; } });
  check(artistCheck === null, `txpResolveByExactAlias returns null for a name that can't exist (got ${JSON.stringify(artistCheck)})`);

  // 7. apply: pick the name by MBID, Apply, and a relationship is staged.
  const anArtistGid = await page.evaluate(() => { const a = document.querySelector('.relationship-item a[href^="/artist/"]'); return a ? a.getAttribute('href').split('/')[2] : null; });
  console.log('artist gid to pick:', anArtistGid);
  check(!!anArtistGid, 'the release has an artist to credit');
  await tpPaste(page, 'Mastering: Test Artist For 522', 'R: E');
  await tpPick(page, 'Test Artist For 522', anArtistGid);
  const relCountBefore = await page.evaluate(() => document.querySelectorAll('.relationship-item').length);
  await tpApply(page);
  await frames(page);
  const after = await page.evaluate(() => ({ relCount: document.querySelectorAll('.relationship-item').length, relAdd: document.querySelectorAll('.rel-add').length }));
  console.log('after apply:', JSON.stringify(after), 'before:', relCountBefore);
  check(after.relCount > relCountBefore, `a new relationship-item appears after Apply (before ${relCountBefore}, after ${after.relCount})`);
  check(after.relAdd > 0, `MB staged the addition (${after.relAdd} rel-add)`);
  check(!(await page.isVisible('.gt-tp')), 'Apply closes the parser');
  await open();

  // 8. one line, several pairs split by ";" — and no stale pick from an earlier
  // line at the same position (picks are keyed by name, not position)
  await tpPaste(page, 'Guitar: Alice; Bass: Bob', 'R: E');
  const semi = await credits();
  console.log('semicolon-pair credits:', JSON.stringify(semi.map(c => [c.role, c.entity, c.gid])));
  check(semi.length === 2 && semi[0].role === 'Guitar' && semi[0].entity === 'Alice' && semi[1].role === 'Bass' && semi[1].entity === 'Bob', '"Guitar: Alice; Bass: Bob" is 2 credits');
  check(semi[0].gid !== anArtistGid, '"Alice" does NOT inherit the pick of an earlier, unrelated line at the same position');

  // 9. a line's own pattern keeps focus and value while typing (render rebuilds the rows)
  await tpPaste(page, 'Line one\nLine two');
  const ov = page.locator('.gt-tp-line .gt-tp-ov').first();
  await ov.click();
  await ov.pressSequentially('R: E', { delay: 25 });
  await frames(page);
  const focusInfo = await page.evaluate(() => ({ cls: document.activeElement.className || '', val: document.activeElement.value || '' }));
  console.log('focus after typing a line pattern:', JSON.stringify(focusInfo));
  check(focusInfo.cls.includes('gt-tp-ov') && focusInfo.val === 'R: E', `focus and value survive re-renders while typing (got ${JSON.stringify(focusInfo)})`);
  // …and put it back: a line's pattern is keyed by LINE INDEX, so it would carry into later steps
  await page.locator('.gt-tp-line .gt-tp-ov').first().fill('');
  await tpSettle(page);
  check(await page.evaluate(() => [...document.querySelectorAll('.gt-tp-ov')].every(i => !i.value)), 'the line pattern is cleared again');

  // 10. loose role matching: "mastered by" → mastering, "compiled" → compiler
  await tpPaste(page, 'mastered by: Someone For 522\ncompiled: Someone Else For 522', 'R: E');
  check(await resolvedOf('mastered by') === 'mastering', `"mastered by" resolves to "mastering" (got ${await resolvedOf('mastered by')})`);
  check(await resolvedOf('compiled') === 'compiler', `"compiled" resolves to "compiler", not "remixes and compilations" (got ${await resolvedOf('compiled')})`);

  // 11. a resolved role is clickable, to change it; the picker opens with the role text, selected
  await tpRow(page, 'Someone For 522').locator('.gt-tp-role-pick').click();
  await page.waitForSelector('.gt-role-pick');
  await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('gt-role-search'));   // focused and selected 30 ms after opening
  const rq =await page.evaluate(() => { const el = document.querySelector('.gt-role-search'); return { v: el.value, s: el.selectionStart, e: el.selectionEnd }; });
  check(rq.v.toLowerCase() === 'mastered by', `the role picker opens with the parsed role text (got "${rq.v}")`);
  check(rq.s === 0 && rq.e === rq.v.length, `and that text is selected, so typing replaces it (got ${JSON.stringify(rq)})`);

  // 12. Escape closes the role picker only, never the parser
  await page.keyboard.press('Escape');
  await frames(page);
  const afterEsc = await page.evaluate(() => ({ rolePickOpen: !!document.querySelector('.gt-role-pick'), mainOpen: !!document.querySelector('.gt-tp') }));
  check(!afterEsc.rolePickOpen, 'Escape closes the role picker');
  check(afterEsc.mainOpen, 'and does NOT close the parser');
  // a pick is a real link that opens MusicBrainz in a new tab
  await tpPaste(page, 'Mastering: Test Artist For 522');
  const link = await page.evaluate(() => { const a = document.querySelector('.gt-tp-cand-on a.gt-tp-cand-name'); return a ? { href: a.getAttribute('href'), target: a.target } : null; });
  check(link && /^\/artist\//.test(link.href) && link.target === '_blank', `a picked name is a link to MusicBrainz, in a new tab (got ${JSON.stringify(link)})`);

  // 13. Load annotation goes straight into the paste box
  await tpPaste(page, '');
  await page.click('.gt-tp-anno');
  await until(() => page.inputValue('.gt-tp-ta'), v => !!v.trim(), { timeout: 30000 });
  check(!(await page.$('.gt-tp-anno-use')), 'no confirm/preview step for loading the annotation');

  // 14. the text survives closing and reopening (the ✕)
  const marker = 'Persisted Sample 522: Persist Test Artist ' + Date.now();
  await tpPaste(page, marker);
  await page.click('.gt-tp-bar .gt-cons-x');
  await frames(page);
  check(!(await page.isVisible('.gt-tp')), '✕ closes the parser');
  await open();
  check(await page.inputValue('.gt-tp-ta') === marker, 'the pasted text survives a close and reopen on the same release');

  // 15. copyright lines are recognised by their markers, mixed with ordinary credits
  await tpPaste(page, 'Mastering: Someone For 522\n℗ & © 2020 Some Copyright Test Label 522', 'R: E');
  const mixed = await credits();
  console.log('mixed credit + copyright:', JSON.stringify(mixed.map(c => [c.role, c.entity, c.kind])));
  check(mixed.length === 3, `1 credit + a "℗ & ©" line (2 notices) = 3 credits (got ${mixed.length})`);
  check(mixed[0].role === 'Mastering' && mixed[0].entity === 'Someone For 522', 'the ordinary line still parses with R: E');
  const cr = mixed.slice(1);
  check(cr.every(c => c.entity === 'Some Copyright Test Label 522'), 'both notices share the holder');
  check(cr.some(c => /phonographic/.test(c.role)) && cr.some(c => c.role === '© copyright'), `both notice kinds detected (got ${JSON.stringify(cr.map(c => c.role))})`);
  // a copyright holder is a label: its row says so, and + creates a label
  const crRow = tpRow(page, 'Some Copyright Test Label 522');
  check(await crRow.locator('.gt-tp-ekind').textContent() === 'label', 'the holder\'s row is a label');
  check(/Create the label/.test(await crRow.locator('.gt-tp-plus').getAttribute('data-tip') || ''), '+ creates a label for it');

  // the copyright parser itself
  const crParse = await page.evaluate(() => window.__groupTherapy.txpParseCopyrightLine('© 2020 Some Label'));
  check(crParse && crParse.types.join(',') === 'copyright' && crParse.year === '2020' && crParse.holders.join(',') === 'Some Label', `txpParseCopyrightLine parses a plain © line (got ${JSON.stringify(crParse)})`);
  const crCases = await page.evaluate(() => ({
    both: window.__groupTherapy.txpParseCopyrightLine('℗ & © «R&S Records»'),
    phonoWithYear: window.__groupTherapy.txpParseCopyrightLine('℗ «1995 R&S Records»'),
    copyrightOnly: window.__groupTherapy.txpParseCopyrightLine('© «R&S Records»'),
  }));
  check(crCases.both && crCases.both.types.join(',') === 'phonographic,copyright' && crCases.both.year === null && crCases.both.holders.join(',') === 'R&S Records', `"℗ & © «R&S Records»" parses with no year (got ${JSON.stringify(crCases.both)})`);
  check(crCases.phonoWithYear && crCases.phonoWithYear.holders.join(',') === 'R&S Records', `a guillemet-quoted holder leaks no "»" (got ${JSON.stringify(crCases.phonoWithYear)})`);
  check(crCases.copyrightOnly && crCases.copyrightOnly.types.join(',') === 'copyright' && crCases.copyrightOnly.year === null && crCases.copyrightOnly.holders.join(',') === 'R&S Records', `"© «R&S Records»" parses with no year (got ${JSON.stringify(crCases.copyrightOnly)})`);
  const crCases2 = await page.evaluate(() => {
    const GT = window.__groupTherapy;
    return {
      distributedBy: GT.txpParseCopyrightLine('distributed by Sony Music Entertainment'),
      marketedBy: GT.txpParseCopyrightLine('marketed by Universal Music'),
      marketedAndDistributed: GT.txpParseCopyrightLine('marketed and distributed by Sony Music Entertainment'),
      licensedTo: GT.txpParseCopyrightLine('licensed to Republic Records'),
      licensedFrom: GT.txpParseCopyrightLine('under exclusive licence from Interscope Records'),
      multiHolder: GT.txpParseCopyrightLine('℗ 2012 Shady Records/Aftermath Records/Interscope Records'),
      saNv: GT.txpParseCopyrightLine('© EMI Belgium SA/NV'),
      pinkFloyd: GT.txpParseCopyrightLine('© 2016 Pink Floyd Music Ltd. / Pink Floyd (1987) Ltd.'),
      multiYear: GT.txpParseCopyrightLine('© 1994, 1996 Some Label'),
      enDashSep: GT.txpParseCopyrightLine('Distributed By – Rush Hour Music'),
      enDashSepNoYear: GT.txpParseCopyrightLine('Copyright © – Club Coco'),
    };
  });
  check(crCases2.distributedBy && crCases2.distributedBy.types.join(',') === 'distributed' && crCases2.distributedBy.holders.join(',') === 'Sony Music Entertainment', '"distributed by X" parses');
  check(crCases2.marketedBy && crCases2.marketedBy.types.join(',') === 'marketed' && crCases2.marketedBy.holders.join(',') === 'Universal Music', '"marketed by X" parses');
  check(crCases2.marketedAndDistributed && crCases2.marketedAndDistributed.types.join(',') === 'marketed,distributed', '"marketed and distributed by X" fires both types');
  check(crCases2.licensedTo && crCases2.licensedTo.types.join(',') === 'licensee' && crCases2.licensedTo.holders.join(',') === 'Republic Records', '"licensed to X" → licensee');
  check(crCases2.licensedFrom && crCases2.licensedFrom.types.join(',') === 'licensor' && crCases2.licensedFrom.holders.join(',') === 'Interscope Records', '"under exclusive licence from X" → licensor');
  check(crCases2.multiHolder && crCases2.multiHolder.holders.join('|') === 'Shady Records|Aftermath Records|Interscope Records', 'a "/" multi-holder line is 3 holders');
  check(crCases2.saNv && crCases2.saNv.holders.join(',') === 'EMI Belgium SA/NV', '"SA/NV" is not split');
  check(crCases2.pinkFloyd && crCases2.pinkFloyd.year === '2016' && crCases2.pinkFloyd.holders.join('|') === 'Pink Floyd Music Ltd.|Pink Floyd (1987) Ltd.', 'a year inside a holder\'s name is not the notice year');
  check(crCases2.multiYear && crCases2.multiYear.year === null && crCases2.multiYear.holders.join(',') === 'Some Label', 'two years are dropped, not guessed');
  check(crCases2.enDashSep && crCases2.enDashSep.holders.join(',') === 'Rush Hour Music', '"Distributed By – X" leaks no "–"');
  check(crCases2.enDashSepNoYear && crCases2.enDashSepNoYear.holders.join(',') === 'Club Coco', '"Copyright © – X" leaks no "–"');
  const labelCheck = await page.evaluate(async () => { try { return await window.__groupTherapy.txpResolveLabelByExactAlias('Zzqxv Nonexistent Label 522' + Date.now()); } catch (e) { return '__ERROR__: ' + e.message; } });
  check(labelCheck === null, `txpResolveLabelByExactAlias returns null for a name that can't exist (got ${JSON.stringify(labelCheck)})`);
  const scoreNarrow = await page.evaluate(() => {
    const GT = window.__groupTherapy;
    return { decisive: GT.txpNarrowByScore([{ id: 'a', score: 100 }, { id: 'b', score: 45 }]).map(x => x.id), tooClose: GT.txpNarrowByScore([{ id: 'a', score: 80 }, { id: 'b', score: 75 }]).map(x => x.id) };
  });
  check(scoreNarrow.decisive.join() === 'a', 'a decisive score gap (100 vs 45) narrows to the top match');
  check(scoreNarrow.tooClose.length === 2, 'a marginal gap (80 vs 75) stays ambiguous');

  // 16. instruments resolve to the instrument role plus that instrument
  await tpPaste(page, 'Kwame Yeboah - Keys, Guitar, Piano, Hammond\nBen Abarbanel-Wolff - Saxophone, Flute\nEric Owusu - Percussion', 'E - R[,]');
  for (const [role, want] of [['Guitar', /^guitar$/], ['Piano', /^piano$/], ['Hammond', /hammond/], ['Saxophone', /^saxophone$/], ['Flute', /^flute$/], ['Percussion', /^percussion$/]]) {
    const got = ((await resolvedOf(role)) || '').toLowerCase();
    check(want.test(got), `"${role}" resolves (got "${got}")`);
  }
  check(await page.evaluate(() => !!window.__groupTherapy.linkTypesForPair('artist', 'release').find(r => r.name === 'instrument')), 'the "instrument" link type exists for artist-release');

  // 17. ✕ on a line removes it from the rows AND the pasted text
  await tpPaste(page, 'Mastering: Row To Keep 522\nProducer: Row To Delete 522', 'R: E');
  const nBefore = (await credits()).length;
  await tpRow(page, 'Row To Delete 522').locator('.gt-tp-rowdel').click();
  await tpSettle(page);
  const afterDelete = { n: (await credits()).length, ta: await page.inputValue('.gt-tp-ta') };
  check(afterDelete.n === nBefore - 1, `removing a line removes its credit (before ${nBefore}, after ${afterDelete.n})`);
  check(!afterDelete.ta.includes('Row To Delete') && afterDelete.ta.includes('Row To Keep'), `and its text from the paste box (got ${JSON.stringify(afterDelete.ta)})`);

  // 18. editing a line's text in its row updates the paste box and re-parses
  await tpPaste(page, 'Mastering: Typo Artist 522');
  await page.locator('.gt-tp-raw').first().fill('Mastering: Fixed Artist 522');
  await tpSettle(page);
  check((await page.inputValue('.gt-tp-ta')).includes('Fixed Artist'), 'editing a line updates the paste box');
  check((await credits())[0].entity === 'Fixed Artist 522', 'and the credit re-parses from it');

  // 19. in the page under the toolbar, not a modal; nothing to maximize
  const inline = await page.evaluate(() => {
    const p = document.querySelector('.gt-tp');
    return { afterBar: document.querySelector('.gt-toolbar').nextElementSibling === p, overlay: !!p.closest('.gt-cons-ov'), position: getComputedStyle(p).position };
  });
  check(inline.afterBar && !inline.overlay && inline.position === 'static', `the parser sits in the page under the toolbar (${JSON.stringify(inline)})`);

  // 20. the columns' divider drags, and the width is remembered
  const colW = () => page.evaluate(() => document.querySelector('.gt-tp-etbl col').style.width);
  const w0 = await colW();
  const box = await page.locator('.gt-tp-etbl .gt-tp-colresize').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 80, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await frames(page);
  const w1 = await colW();
  console.log('column width drag:', { w0, w1 });
  check(w1 !== w0, `dragging the divider changes the credited column's width (before ${w0}, after ${w1})`);
  await close(); await open();
  check(await colW() === w1, `the width is remembered across close and reopen (got "${await colW()}", expected "${w1}")`);

  // 21. what was resolved survives a close and reopen, not only the text
  await tpPaste(page, 'Mastering: Persisted Resolution Artist 522', 'R: E');
  check(await resolvedOf('Mastering') === 'mastering', 'sanity: the role is resolved before closing');
  await close(); await open();
  check((await credits())[0].resolved === 'mastering', 'the resolution survives a close and reopen');

  // 22. a pasted MBID picks for every credit with the name
  await tpPaste(page, 'Propagation Test Artist 522 - Guitar, Piano', 'E - R[,]');
  await tpPick(page, 'Propagation Test Artist 522', anArtistGid);
  const prop = (await credits()).filter(c => c.entity === 'Propagation Test Artist 522');
  check(prop.length === 2 && prop.every(c => c.gid === anArtistGid), `a pasted MBID picks for every credit with the name (got ${JSON.stringify(prop.map(c => c.gid))})`);

  // 23. password managers leave the parser's inputs alone
  const lpCheck = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('.gt-tp input[type="text"], .gt-tp input:not([type])')];
    return { count: inputs.length, allIgnored: inputs.every(i => i.getAttribute('data-lpignore') === 'true' && i.getAttribute('autocomplete') === 'off') };
  });
  check(lpCheck.count > 0 && lpCheck.allIgnored, `every text input opts out of password-manager heuristics (got ${JSON.stringify(lpCheck)})`);

  // 24. a fresh line at a position applied before is not pre-marked applied; Apply closes
  await tpPaste(page, 'Mastering: Apply Close Test Artist 522', 'R: E');
  await tpPick(page, 'Apply Close Test Artist 522', anArtistGid);
  check(!(await credits())[0].applied, 'a fresh line reusing an applied line\'s position is NOT marked applied');
  await tpApply(page);
  check(!(await page.isVisible('.gt-tp')), 'Apply closes the parser');

  // 25. "Apply & clear annotation" only for text that came from the annotation
  await open();
  await tpPaste(page, 'Mastering: Not From Annotation 522');
  const clearBtn = () => page.evaluate(() => { const b = [...document.querySelectorAll('.gt-tp button')].find(x => x.textContent.includes('clear annotation')); return b ? getComputedStyle(b).display : 'MISSING'; });
  check(await clearBtn() === 'none', '"Apply & clear annotation" is hidden for typed text');
  await page.click('.gt-tp-anno');
  await until(() => page.inputValue('.gt-tp-ta'), v => v !== 'Mastering: Not From Annotation 522', { timeout: 30000 });
  await frames(page);
  const shown = await clearBtn();
  check(shown !== 'none' && shown !== 'MISSING', `and appears once the text came from the annotation (got "${shown}")`);
  await close();

  // 26. the state lasts the page's life only: a reload starts empty
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settled(page);
  await inject('group_therapy', { waitFor: '__groupTherapy' });
  await idle(page);
  await open();
  check(await page.inputValue('.gt-tp-ta') === '', 'the pasted text does NOT survive a page reload');

  // 27. rows are tinted by state, as Credit Hoarder's
  await tpPaste(page, 'Producer: John Smith\nNo pattern match here at all 522', 'R: E');
  const tints = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-erow')].map(tr => ({ cls: tr.className, bg: getComputedStyle(tr.querySelector('td')).backgroundColor })));
  console.log('row tints:', JSON.stringify(tints));
  check(/gt-tp-st-amber/.test(tints[0].cls) && tints[0].bg !== 'rgba(0, 0, 0, 0)', `a name to pick is tinted amber (got ${JSON.stringify(tints[0])})`);
  check(/gt-tp-st-red/.test(tints[1].cls) && tints[1].bg !== 'rgba(0, 0, 0, 0)', `a line not parsed is tinted red (got ${JSON.stringify(tints[1])})`);
  check(tints[0].bg !== tints[1].bg, 'and the two tints differ');

  // 30. the other notice types, and a multi-holder line as one credit per holder
  await tpPaste(page, ['distributed by Sony Music Entertainment 522', 'licensed to Republic Records 522', '℗ 2012 Shady Records 522/Aftermath Records 522'].join('\n'), 'R: E');
  const nt = (await credits()).map(c => [c.role, c.entity]);
  console.log('notice credits:', JSON.stringify(nt));
  check(nt.length === 4, `3 lines (1 with 2 holders) are 4 credits (got ${nt.length})`);
  check(nt[0][0] === 'distributed by' && nt[0][1] === 'Sony Music Entertainment 522', '"distributed by" parses');
  check(nt[1][0] === 'licensed to' && nt[1][1] === 'Republic Records 522', '"licensed to" parses');
  check(nt[2][1] === 'Shady Records 522' && nt[3][1] === 'Aftermath Records 522', 'the multi-holder line is 2 credits');

  // 30b. matching says how far it is: "Matching N/M…", then nothing
  const snaps = await page.evaluate(() => new Promise(resolve => {
    const busy = document.querySelector('.gt-tp-busy'), seen = [];
    const mo = new MutationObserver(() => seen.push(busy.textContent));
    mo.observe(busy, { childList: true, characterData: true, subtree: true });
    const ta = document.querySelector('.gt-tp-ta');
    ta.value = ['Mastering: David Storrs 522', 'Producer: Gabriel Aldama 522', 'Recorded by: Eric Lauzon 522', 'Mixed by: Steven Cooper 522'].join('\n');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    const t = setInterval(() => { if (seen.length && !busy.textContent) { clearInterval(t); mo.disconnect(); resolve(seen); } }, 50);
    setTimeout(() => { clearInterval(t); mo.disconnect(); resolve(seen); }, 60000);
  }));
  console.log('matching progress:', JSON.stringify(snaps));
  check(snaps.some(s => /^Matching \d+\/4…$/.test(s)), `matching shows "Matching N/4…" (got ${JSON.stringify(snaps)})`);
  check(snaps[snaps.length - 1] === '', 'and clears once done');

  // 31. the notice types resolve to MusicBrainz's own names once the holder is picked
  await tpPaste(page, 'distributed by Sony Music Entertainment\nlicensed to Universal Music Group');
  const nr = await credits();
  console.log('resolved notice credits:', JSON.stringify(nr.map(c => [c.role, c.resolved, c.gid])));
  if (!nr[0].gid || !nr[1].gid) console.log('SKIP: the sandbox\'s label search did not pick both holders this run (live data)');
  else {
    check(nr[0].resolved === 'distributed', `"distributed by" → "distributed" (got ${nr[0].resolved})`);
    check(nr[1].resolved === 'licensee', `"licensed to" → "licensee" (got ${nr[1].resolved})`);
  }

  // 32. artist or label: a holder who is the release's artist is an artist, with
  // the kind to change beside the search; "distributed by" is a label's only
  await tpPaste(page, '© 2020 もちこまめ\ndistributed by Sony Music Entertainment 522');
  const mochi = tpRow(page, 'もちこまめ'), sony = tpRow(page, 'Sony Music Entertainment 522');
  check(await mochi.locator('.gt-tp-ekind').textContent() === 'artist', 'a holder matching the release\'s own artist is an artist');
  check(await mochi.locator('.gt-tp-esrch-kind').count() === 1, 'its kind can be changed beside the search');
  await mochi.locator('.gt-tp-esrch-kind').selectOption('label');
  await tpSettle(page);
  check(await mochi.locator('.gt-tp-ekind').textContent() === 'label', 'choosing label makes it a label at once');
  check(await sony.locator('.gt-tp-esrch-kind').count() === 0 && await sony.locator('.gt-tp-ekind').textContent() === 'label', '"distributed by" is a label, with no kind to choose');

  // 33. "Published by" is an ordinary line whose role only labels have
  await tpPaste(page, 'Published by: Sony Music Entertainment', 'R: E');
  const pub = (await credits())[0];
  console.log('"Published by":', JSON.stringify(pub));
  check(pub.resolved === 'published' && pub.kind === 'label', `"Published by" → "published", for a label (got ${pub.resolved}, ${pub.kind})`);
  check(await tpRow(page, 'Sony Music Entertainment').locator('.gt-tp-esrch-kind').count() === 0, 'with no artist/label choice');

  // 35. roles both kinds have (mastering, graphic design) are an artist's by default
  await tpPaste(page, 'Mastering: Michael Graves 525\nGraphic Design: Ricardo H Fernandes 525', 'R: E');
  const md = await credits();
  check(md[0].kind === 'artist' && md[1].kind === 'artist', `"Mastering" and "Graphic Design" are an artist's (got ${md[0].kind}, ${md[1].kind})`);

  // 36. "Biography and Pictures" is not the instrument "pi"
  await tpPaste(page, 'Biography and Pictures: Chico Unicornio 525', 'R: E[,]');
  const bio = (await credits())[0];
  check(!/^pi$/i.test(bio.resolved || ''), `"Biography and Pictures" does not match the instrument "pi" (got ${bio.resolved})`);

  // 37. the role follows the entity picked: "copyright" has an artist id and a label id
  const copyrightIds = await page.evaluate(() => {
    const GT = window.__groupTherapy;
    const a = GT.linkTypesForPair('artist', 'release').find(c => c.name === 'copyright');
    const l = GT.linkTypesForPair('label', 'release').find(c => c.name === 'copyright');
    return { artistId: a && a.id, labelId: l && l.id };
  });
  check(copyrightIds.artistId && copyrightIds.labelId && copyrightIds.artistId !== copyrightIds.labelId, `"copyright" has distinct artist and label ids (${JSON.stringify(copyrightIds)})`);
  await tpPaste(page, '© 2020 Toggle Test Label 525');
  const tog = tpRow(page, 'Toggle Test Label 525');
  check(await tog.locator('.gt-tp-ekind').textContent() === 'label', 'a holder that is not the release\'s artist starts as a label');
  await tog.locator('.gt-tp-esrch-kind').selectOption('artist');
  await tpSettle(page);
  await tpPick(page, 'Toggle Test Label 525', anArtistGid);
  const relBefore = await page.evaluate(() => document.querySelectorAll('.relationship-item').length);
  await tpApply(page);
  await frames(page);
  const staged = await page.evaluate(artistId => {
    const find = node => { for (const k in node) if (k.startsWith('__reactFiber$')) { let f = node[k]; let d = 0; while (f && d++ < 40) { const s = f.memoizedProps && f.memoizedProps.relationship; if (s && 'linkTypeID' in s) return s; f = f.return; } } return null; };
    return [...document.querySelectorAll('.relationship-item')].some(item => { const rel = find(item); return rel && rel.linkTypeID === artistId; });
  }, copyrightIds.artistId);
  const relAfter = await page.evaluate(() => document.querySelectorAll('.relationship-item').length);
  check(relAfter > relBefore, `Apply staged it (before ${relBefore}, after ${relAfter})`);
  check(staged, `with the ARTIST "copyright" id (${copyrightIds.artistId}), not the label one (${copyrightIds.labelId})`);

  // 34. right-click the name: the text takes the picked entity's own name, dropping a suffix
  await open();
  const canonicalName = await page.evaluate(async gid => { const e = await window.__groupTherapy.txpFetchEntity(gid, 'artist'); return e && e.name; }, anArtistGid);
  check(!!canonicalName, `sanity: the artist has a name (${canonicalName})`);
  const suffixed = `${canonicalName}* Suffix Cleanup 525`;
  await tpPaste(page, `Mastering: ${suffixed}`, 'R: E');
  await tpPick(page, suffixed, anArtistGid);
  const nameEl = () => page.locator('.gt-tp-erow .gt-tp-ename').first();
  check((await credits())[0].entity === suffixed && !!(await credits())[0].gid, 'sanity: the suffixed name is picked');
  await nameEl().click();
  await frames(page);
  check((await credits())[0].entity === suffixed, 'a left click on the name does nothing');
  await nameEl().click({ button: 'right' });
  await tpSettle(page);
  const cleaned = (await credits())[0];
  console.log('after right-click:', JSON.stringify(cleaned));
  check(cleaned.entity === canonicalName, `right-click puts the entity's own name in (got "${cleaned.entity}")`);
  check((await page.inputValue('.gt-tp-ta')).includes(canonicalName) && !(await page.inputValue('.gt-tp-ta')).includes(suffixed), 'in the pasted text too');
  check(cleaned.gid === anArtistGid && cleaned.resolved === 'mastering', 'and the credit stays picked');
  await nameEl().click({ button: 'right' });
  await frames(page);
  check((await credits())[0].entity === canonicalName, 'a second right-click is a no-op');

  // 38. a line with two notices is split in two on paste
  const directSplit = await page.evaluate(() => window.__groupTherapy.txpSplitCompoundCopyrightLines('Copyright: Albarika Stores BV under exclusive license to Acid Jazz Acquisitions'));
  check(directSplit === 'Copyright: Albarika Stores BV\nunder exclusive license to Acid Jazz Acquisitions', `txpSplitCompoundCopyrightLines splits at the second marker (got ${JSON.stringify(directSplit)})`);
  const noSplit = await page.evaluate(() => window.__groupTherapy.txpSplitCompoundCopyrightLines('marketed and distributed by Sony Music Entertainment'));
  check(noSplit === 'marketed and distributed by Sony Music Entertainment', 'one compound marker is left whole');
  await page.evaluate(() => {
    const el = document.querySelector('.gt-tp-ta');
    el.value = 'Copyright: Albarika Stores BV under exclusive license to Acid Jazz Acquisitions';
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true }));
  });
  await tpSettle(page);
  check(await page.inputValue('.gt-tp-ta') === 'Copyright: Albarika Stores BV\nunder exclusive license to Acid Jazz Acquisitions', 'the paste box splits into 2 lines right after the paste');
  const sp = (await credits()).map(c => [c.role, c.entity]);
  console.log('split credits:', JSON.stringify(sp));
  check(sp.length === 2 && sp[0][0] === '© copyright' && sp[0][1] === 'Albarika Stores BV' && sp[1][0] === 'licensed to' && sp[1][1] === 'Acid Jazz Acquisitions', 'one credit per notice, each with its own holder');
  await close();

  check(posts.length === 0, `nothing submitted during the test (${posts.length})`);
});
