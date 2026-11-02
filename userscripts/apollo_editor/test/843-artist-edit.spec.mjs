import { test, check, requireLogin, idle, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Apollo Editor' } });

// #843: the artist's, label's and place's edit pages in Release information's style
const AR = 'https://test.musicbrainz.org/artist/a74b1b7f-71a5-4011-9441-d0b5e4122711/edit';
const LABEL = 'https://test.musicbrainz.org/label/46f0f4cd-8aab-4b33-b698-f459faf64190/edit';
const PLACE = 'https://test.musicbrainz.org/place/4352063b-a833-421b-a420-e7fb295dece0/edit';

// loujine's "Add external link" box, as his scripts place it: a #side-col after the form's left column, his menu after that
const addLoujine = page => page.evaluate(() => {
  const half = document.querySelector('#page form > .half-width');
  half.insertAdjacentHTML('afterend', '<div id="side-col" style="float:right"></div>');
  document.getElementById('side-col').insertAdjacentHTML('afterend', '<div id="loujine-menu" style="background-color:white;padding:8px;border:5px dotted rgb(115,109,171)"><h2>loujine GM tools</h2><a href="#">documentation</a><h3>Add external link</h3><input id="linkParser"></div>');
});
// the card is at the end of the column that was shorter without the cards
const shorterColumn = page => page.evaluate(() => {
  const c = document.getElementById('tc-af-card'), half = document.querySelector('#information > .half-width'), col = document.getElementById('tc-ri-rightcol');
  const note = half.querySelector(':scope > fieldset.editnote');
  const map = document.getElementById('largemap'), mapPos = map && map.style.position;   // Autofill is placed first, before the map
  c.style.position = 'absolute'; if (map) map.style.position = 'absolute';
  const left = note ? note.getBoundingClientRect().top : half.getBoundingClientRect().bottom;
  const right = col.getBoundingClientRect().bottom;
  c.style.position = ''; if (map) map.style.position = mapPos;
  return { in: c.parentElement === half ? 'left' : c.parentElement === col ? 'right' : c.parentElement.id, want: left < right ? 'left' : 'right', card: c.classList.contains('tc-ent-card'), gap: left - right };
});

// #895: near a tie the card's margins flipped the answer on each move, and each move asked again
test('Autofill stays put when the two columns are almost equally tall', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto(AR);
  await requireLogin(page); await idle(page);
  await inject('apollo_editor');
  await until(() => page.evaluate(() => !!document.querySelector('#tc-ri-rightcol #tc-af-card, #information > .half-width > #tc-af-card')), v => v);
  await until(() => shorterColumn(page), v => v.in === v.want);
  await page.evaluate(() => {
    const s = document.createElement('div'); s.id = 'tc-test-spacer';
    (document.querySelector('#information > .half-width')).prepend(s);
    window.__moves = 0;
    new MutationObserver(ms => { window.__moves += ms.filter(m => [...m.addedNodes].some(n => n.id === 'tc-af-card')).length; }).observe(document.querySelector('#information'), { childList: true, subtree: true });
  });
  // the links render late: find the tie once the columns have stopped growing
  let last = NaN;
  const base = await until(async () => { const v = await shorterColumn(page), still = v.gap === last; last = v.gap; await page.waitForTimeout(1000); return { ...v, still }; }, v => v.still);
  const tie = Math.abs(base.gap);   // this artist has many links: the left column is the shorter one
  for (let d = -30; d <= 30; d += 6) {
    const moves = await page.evaluate(async h => {
      document.getElementById('tc-test-spacer').style.height = h + 'px';
      document.getElementById('tc-test-spacer').appendChild(document.createElement('i'));   // the page changing, as a new link does
      await new Promise(r => setTimeout(r, 300));
      const before = window.__moves;
      await new Promise(r => setTimeout(r, 900));
      return window.__moves - before;
    }, Math.max(0, tie + d));
    check(moves === 0, `the card settles with the spacer at ${tie + d}px (${moves} moves)`);
  }
});

test('the artist edit page gets the links column, the name highlight and loujine\'s box as a card', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }, testInfo) => {
  await page.goto(AR);
  await requireLogin(page); await idle(page);
  await addLoujine(page);
  await inject('apollo_editor');
  const s = await until(() => page.evaluate(() => ({
    col: !!document.querySelector('#tc-ri-rightcol #external-links-editor'),
    card: !!document.querySelector('#tc-af-card.tc-ent-card') && getComputedStyle(document.getElementById('loujine-menu')).display === 'none',
    doc: getComputedStyle(document.querySelector('#information > div.documentation')).display,
    bar: !!document.getElementById('tc-nav-bar'),
  })), v => v.col && v.card);
  check(s.col, 'the external links sit in the right column');
  check(s.card, 'loujine\'s box is a card');
  check(s.doc === 'none', `the help column is hidden (${s.doc})`);
  check(s.bar, 'Apollo\'s header bar is there');
  const c = await until(() => shorterColumn(page), v => v.in === v.want);
  check(c.in === c.want, `Autofill ends the shorter column (${c.in}, want ${c.want})`);
  // links with a platform we draw get our SVG icon in place of MusicBrainz's favicon
  const fav = await until(() => page.evaluate(() => [...document.querySelectorAll('#external-links-editor tr.external-link-item')].filter(tr => tr.querySelector('a[href]')).map(tr => [new URL(tr.querySelector('a[href]').href).hostname, tr.querySelector('.favicon')?.dataset.tcIcon || '', !!tr.querySelector('.favicon > svg')])), v => v.some(r => /discogs/.test(r[0]) && r[2]));
  const dc = fav.find(r => /discogs/.test(r[0]));
  check(dc && dc[1] === 'discogs' && dc[2], `Discogs gets our icon (${JSON.stringify(dc)})`);
  // Sort name: guess is the shared sort icon, MusicBrainz's copy button is gone
  const sn = await page.evaluate(() => ({ gc: !!document.querySelector('button.guesscase-sortname svg'), copy: getComputedStyle(document.querySelector('button.sortname-copy')).display }));
  check(sn.gc && sn.copy === 'none', `sort name: the sort icon, no copy (${sn.gc}, ${sn.copy})`);
  check(await page.evaluate(() => getComputedStyle(document.querySelector('button.guesscase-options')).display) === 'none', 'the guess-case ⚙ is hidden');
  await page.locator('form.tc-ent-form button.guesscase-title').first().click({ button: 'right' });
  check(await until(() => page.evaluate(() => !!document.querySelector('.tc-gcpop')), v => v), 'right-click on Aa opens the guess-case options');
  await page.keyboard.press('Escape');
  await attachShot(testInfo, page.locator('[id="id-edit-artist.name"]').locator('xpath=ancestor::fieldset[1]'), 'artist-details');
  // right-click a link's favicon: MusicBrainz's own URL editor opens, as on Release information
  const inputs = () => page.evaluate(() => [...document.querySelectorAll('#external-links-editor input, .external-link-dialog input, [role=dialog] input')].filter(i => i.offsetParent).length);
  const before = await inputs();
  await page.locator('#external-links-editor tr.external-link-item > td:first-child').first().click({ button: 'right' });
  const after = await until(inputs, n => n > before);
  check(after > before, `right-click on a favicon opens the URL editor (${before} → ${after} inputs)`);
  await page.keyboard.press('Escape');
  // a double space and a no-break space in the name show under the field
  await page.locator('[id="id-edit-artist.name"]').fill('Radio head  x');
  const hl = await until(() => page.evaluate(() => { const b = document.querySelector('.tc-ent-hl'); return b && !b.hidden ? b.querySelectorAll('.tc-cf,.tc-jp').length : 0; }), n => n >= 2);
  check(hl >= 2, `the name's no-break and double space are marked (${hl})`);
  await attachShot(testInfo, page, 'artist-edit');
});

test('the label and place edit pages get the links column and the cards', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  for (const [url, kind] of [[LABEL, 'label'], [PLACE, 'place']]) {
    await page.goto(url);
    await requireLogin(page); await idle(page);
    await addLoujine(page);
    await inject('apollo_editor');
    const s = await until(() => page.evaluate(() => ({
      col: !!document.querySelector('#tc-ri-rightcol #external-links-editor'),
      card: !!document.querySelector('#tc-af-card.tc-ent-card') && getComputedStyle(document.getElementById('loujine-menu')).display === 'none',
      map: document.getElementById('largemap') ? document.getElementById('largemap').classList.contains('tc-ent-card') && document.getElementById('largemap').offsetHeight > 100 : null,
    })), v => v.col && v.card && v.map !== false);
    check(s.col, `${kind}: the external links sit in the right column`);
    check(s.card, `${kind}: Autofill is a card, loujine's box hidden`);
    if (kind === 'place') check(s.map === true, `place: the map is a visible card (${s.map})`);
    const c = await until(() => shorterColumn(page), v => v.in === v.want);
    check(c.in === c.want, `${kind}: Autofill ends the shorter column (${c.in}, want ${c.want})`);
    await attachShot(testInfo, page, kind + '-edit');
  }
});

test('the work, recording and event edit pages get the links column and the name highlight', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  for (const kind of ['work', 'recording', 'event']) {
    await page.goto(`https://test.musicbrainz.org/${kind}/create`);
    await requireLogin(page); await idle(page);
    await inject('apollo_editor');
    const s = await until(() => page.evaluate(() => ({
      col: !!document.querySelector('#tc-ri-rightcol #external-links-editor'),
      plain: !!document.querySelector('form.tc-ent-plain'),
      bar: !!document.getElementById('tc-nav-title'),
    })), v => v.col && v.plain && v.bar);
    check(s.col, `${kind}: the external links sit in the right column`);
    check(s.plain, `${kind}: the form has Apollo's layout`);
    check(s.bar, `${kind}: Apollo's header bar is there`);
    check(await page.evaluate(() => ![...document.querySelectorAll('p')].some(p => p.offsetParent && p.querySelector(':scope > a[href*="/doc/"]') && /information/i.test(p.textContent) && !p.closest('form'))), `${kind}: no "For more information" line`);
    if (kind === 'recording') check(await page.evaluate(() => !!document.querySelector('#artist-credit-editor')?.offsetParent), 'recording: the Artist field shows');
    await page.fill(`[id="id-edit-${kind}.name"]`, 'A  B');
    check(await until(() => page.evaluate(() => document.querySelectorAll('.tc-jp').length), n => n > 0) > 0, `${kind}: the name's double space is marked`);
    await attachShot(testInfo, page, kind + '-edit');
  }
});
