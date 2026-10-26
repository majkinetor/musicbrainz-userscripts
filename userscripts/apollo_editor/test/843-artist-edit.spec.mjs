import { test, check, requireLogin, idle, until, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Apollo Editor' } });

// #843: the artist's edit page in Release information's style
const AR = 'https://test.musicbrainz.org/artist/a74b1b7f-71a5-4011-9441-d0b5e4122711/edit';

test('the artist edit page gets the links column, the name highlight and loujine\'s box beside the links', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }, testInfo) => {
  await page.goto(AR);
  await requireLogin(page); await idle(page);
  // loujine's "Add external link" box, as his script places it: floating after the form's left column
  await page.evaluate(() => document.querySelector('form.edit-artist > .half-width').insertAdjacentHTML('afterend', '<div id="side-col" style="float:right"><div id="loujine-menu" style="margin-left:550px;border:1px dotted"><h3>Add external link</h3><input id="linkParser"></div></div>'));
  await inject('apollo_editor');
  const s = await until(() => page.evaluate(() => ({
    col: !!document.querySelector('#tc-ri-rightcol #external-links-editor'),
    lou: document.getElementById('loujine-menu')?.parentElement?.id,
    doc: getComputedStyle(document.querySelector('#information > div.documentation')).display,
    bar: !!document.getElementById('tc-nav-bar'),
  })), v => v.col && v.lou === 'tc-ri-rightcol');
  check(s.col, 'the external links sit in the right column');
  check(s.lou === 'tc-ri-rightcol', `loujine's box moved into the right column (${s.lou})`);
  check(s.doc === 'none', `the help column is hidden (${s.doc})`);
  check(s.bar, 'Apollo\'s header bar is there');
  // a double space and a no-break space in the name show under the field
  await page.locator('[id="id-edit-artist.name"]').fill('Radio head  x');
  const hl = await until(() => page.evaluate(() => { const b = document.querySelector('.tc-ent-hl'); return b && !b.hidden ? b.querySelectorAll('.tc-cf,.tc-jp').length : 0; }), n => n >= 2);
  check(hl >= 2, `the name's no-break and double space are marked (${hl})`);
  await attachShot(testInfo, page, 'artist-edit');
});
