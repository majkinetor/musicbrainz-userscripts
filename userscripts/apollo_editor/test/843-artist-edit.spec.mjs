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
// the card is at the end of the column that was shorter without it
const shorterColumn = page => page.evaluate(() => {
  const c = document.getElementById('loujine-menu'), half = document.querySelector('#information > .half-width'), col = document.getElementById('tc-ri-rightcol');
  const note = half.querySelector(':scope > fieldset.editnote');
  const left = (note ? note.getBoundingClientRect().top : half.getBoundingClientRect().bottom) - (c.parentElement === half ? c.offsetHeight : 0);
  const right = col.getBoundingClientRect().bottom - (c.parentElement === col ? c.offsetHeight : 0);
  return { in: c.parentElement === half ? 'left' : c.parentElement === col ? 'right' : c.parentElement.id, want: left < right ? 'left' : 'right', card: c.classList.contains('tc-ent-card') };
});

test('the artist edit page gets the links column, the name highlight and loujine\'s box as a card', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }, testInfo) => {
  await page.goto(AR);
  await requireLogin(page); await idle(page);
  await addLoujine(page);
  await inject('apollo_editor');
  const s = await until(() => page.evaluate(() => ({
    col: !!document.querySelector('#tc-ri-rightcol #external-links-editor'),
    card: document.getElementById('loujine-menu').classList.contains('tc-ent-card'),
    doc: getComputedStyle(document.querySelector('#information > div.documentation')).display,
    bar: !!document.getElementById('tc-nav-bar'),
  })), v => v.col && v.card);
  check(s.col, 'the external links sit in the right column');
  check(s.card, 'loujine\'s box is a card');
  check(s.doc === 'none', `the help column is hidden (${s.doc})`);
  check(s.bar, 'Apollo\'s header bar is there');
  const c = await until(() => shorterColumn(page), v => v.in === v.want);
  check(c.in === c.want, `loujine's card ends the shorter column (${c.in}, want ${c.want})`);
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
      card: document.getElementById('loujine-menu').classList.contains('tc-ent-card'),
      map: document.getElementById('largemap') ? document.getElementById('largemap').classList.contains('tc-ent-card') && document.getElementById('largemap').offsetHeight > 100 : null,
    })), v => v.col && v.card && v.map !== false);
    check(s.col, `${kind}: the external links sit in the right column`);
    check(s.card, `${kind}: loujine's box is a card`);
    if (kind === 'place') check(s.map === true, `place: the map is a visible card (${s.map})`);
    const c = await until(() => shorterColumn(page), v => v.in === v.want);
    check(c.in === c.want, `${kind}: loujine's card ends the shorter column (${c.in}, want ${c.want})`);
    await attachShot(testInfo, page, kind + '-edit');
  }
});
