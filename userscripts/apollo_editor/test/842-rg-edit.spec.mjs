import { test, check, requireLogin, idle, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Apollo Editor' } });

// #842: the release group's edit page in Release information's style
const RG = 'https://test.musicbrainz.org/release-group/12c4622e-b002-4532-9ec7-c7ce23bf8648/edit';

test('the release group edit page gets the artist cell, type bars and the links column', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
  await page.goto(RG);
  await requireLogin(page); await idle(page);
  await inject('apollo_editor');
  const s = await until(() => page.evaluate(() => ({
    cell: document.querySelectorAll('#information .tc-ri-art .tc-aslot').length,
    native: getComputedStyle(document.getElementById('artist-credit-editor')).display,
    col: !!document.querySelector('#tc-ri-rightcol #external-links-editor'),
    bars: document.querySelectorAll('.tc-rg-seg').length,
  })), v => v.cell > 0 && v.col && v.bars === 2);
  check(s.cell === 1, `one artist line for the one credited artist (${s.cell})`);
  check(s.native === 'none', `MusicBrainz's artist editor is hidden (${s.native})`);
  check(s.col, 'the external links sit in the right column');
  check(s.bars === 2, `primary and secondary type bars (${s.bars})`);
  // the bars set the form's own selects: one primary (a second click clears it), several secondary
  const prim = page.locator('.tc-rg-seg:not(.multi) button', { hasText: 'EP' });
  await prim.click();
  check(await page.evaluate(() => document.getElementById('id-edit-release-group.primary_type_id').selectedOptions[0].textContent.trim()) === 'EP', 'primary: EP selected');
  await prim.click();
  check(await page.evaluate(() => !document.getElementById('id-edit-release-group.primary_type_id').value.trim()), 'primary: a second click clears it');
  await page.locator('.tc-rg-seg.multi button', { hasText: 'Live' }).click();
  await page.locator('.tc-rg-seg.multi button', { hasText: 'Compilation' }).click();
  const sec = await page.evaluate(() => [...document.getElementById('id-edit-release-group.secondary_type_ids').selectedOptions].map(o => o.textContent.trim()).sort().join(','));
  check(sec === 'Compilation,Live', `secondary: both selected (${sec})`);
});
