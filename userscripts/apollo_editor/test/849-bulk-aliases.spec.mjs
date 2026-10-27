// The bulk alias editor on /<entity>/<mbid>/add-alias (#849): pasted lines become new rows,
// Guess sort names fills them, Submit enters one edit per row; back on the page the aliases
// load as rows, and an edited and a removed row are entered the same way.
//
// On the sandbox, on a pristine artist made for the run.
import { test, check, SANDBOX, pristine, requireLogin } from '../../../dev/test/harness.mjs';
import { apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

// equal by value, the message showing what was there
const eq = (got, want, msg) => check(JSON.stringify(got) === JSON.stringify(want), `${msg}: got ${JSON.stringify(got)}`);

async function open(page, inject, mbid) {
  await page.goto(`${SANDBOX}/artist/${mbid}/add-alias`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await page.waitForSelector('input[name="edit-alias.name"]', { state: 'attached', timeout: 30000 });
  await inject('apollo_editor');
  await page.waitForSelector('#tc-alias .tc-al-row', { timeout: 30000 });
}
const rows = page => page.$$eval('#tc-alias .tc-al-row', trs => trs.map(tr => ({ cls: tr.className.replace(/\s*tc-al-row\s*/, ''), name: tr.querySelector('.tc-al-n').value, sort: tr.querySelector('.tc-al-s').value, locale: tr.querySelector('.tc-al-l').dataset.v })));

test('paste, guess, submit, then edit and remove', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(240000);
  const { mbid } = await pristine(page, 'artist');
  await open(page, inject, mbid);
  eq(await page.$eval('input[name="edit-alias.name"]', e => e.closest('form').style.display), 'none', 'the table replaces MusicBrainz\'s form');
  eq((await rows(page)).length, 1, 'a blank row to start');

  // typing in the empty last line starts an alias and a new empty line
  await page.locator('#tc-alias .tc-al-row').last().locator('.tc-al-n').fill('Alpha Person');
  await page.locator('#tc-alias .tc-al-row').nth(0).locator('.tc-al-l').fill('Japanese');
  await page.locator('#tc-alias .tc-al-row').nth(0).locator('.tc-al-l').dispatchEvent('change');
  await page.locator('#tc-alias .tc-al-row').last().locator('.tc-al-n').fill('Beta Person');
  await page.locator('#tc-alias .tc-al-row').nth(1).locator('.tc-al-l').fill('');
  await page.locator('#tc-alias .tc-al-row').nth(1).locator('.tc-al-l').dispatchEvent('change');
  const r1 = await rows(page);
  eq(r1.filter(r => r.name).map(r => [r.cls, r.name, r.locale]), [['tc-al-new', 'Alpha Person', 'ja'], ['tc-al-new', 'Beta Person', '']], 'typed rows are new, with the picked locale');
  eq(r1.filter(r => r.name).map(r => r.sort), ['Person, Alpha', 'Person, Beta'], 'sort names follow the names');
  eq(await page.textContent('#tc-al-enter'), '✓ Enter 2 edits', 'the bar counts the edits');

  // Up and Down move between rows in the same column, the locale's list included
  const at = () => page.evaluate(() => { const e = document.activeElement, tr = e.closest('.tc-al-row'); return [[...tr.parentElement.children].indexOf(tr), e.className.split(' ')[0]]; });
  await page.locator('#tc-alias .tc-al-row').nth(0).locator('.tc-al-l').focus();
  await page.keyboard.press('ArrowDown'); eq(await at(), [1, 'tc-al-l'], 'Down goes to the locale below');
  await page.keyboard.press('ArrowDown'); eq(await at(), [2, 'tc-al-l'], 'and on to the empty line');
  await page.keyboard.press('ArrowUp'); eq(await at(), [1, 'tc-al-l'], 'Up comes back');
  eq(await page.$eval('#tc-alias .tc-al-pop', p => p.hidden), true, 'the locale list stays shut');

  // a search hint keeps only its name, the rest shut until the type changes back
  const ty = page.locator('#tc-alias .tc-al-row').nth(1).locator('.tc-al-t');
  const shut = () => page.locator('#tc-alias .tc-al-row').nth(1).evaluate(tr => ['.tc-al-n', '.tc-al-s', '.tc-al-p', '.tc-al-l', '.tc-al-b', '.tc-al-e'].map(c => tr.querySelector(c).disabled));
  await ty.fill('Search hint'); await ty.dispatchEvent('change');
  eq(await shut(), [false, true, true, true, true, true], 'a search hint shuts all but the name');
  eq((await rows(page))[1].sort, 'Beta Person', 'its sort name is the name');
  await ty.fill(''); await ty.dispatchEvent('change');
  eq(await shut(), [false, false, false, false, false, false], 'another type opens them again');
  eq((await rows(page))[1].sort, 'Person, Beta', 'with the guessed sort name back');
  await page.click('#tc-al-enter');
  await page.waitForFunction(() => /entered/.test(document.querySelector('#tc-alias .tc-al-msg').textContent), null, { timeout: 120000 });
  eq(await page.textContent('#tc-alias .tc-al-msg'), '2 edits entered', 'both entered');

  await open(page, inject, mbid);
  const r2 = await rows(page);
  eq(r2.filter(r => r.name).map(r => [r.name, r.sort, r.locale]).sort(), [['Alpha Person', 'Person, Alpha', 'ja'], ['Beta Person', 'Person, Beta', '']], 'the aliases load back');
  const tr = n => page.locator('#tc-alias .tc-al-row').nth(n);
  const idx = name => r2.findIndex(r => r.name === name);
  await tr(idx('Alpha Person')).locator('.tc-al-s').fill('Alpha, Person');
  await tr(idx('Beta Person')).locator('.tc-al-x').click();
  eq((await rows(page)).filter(r => r.name).map(r => [r.name, r.cls]).sort(), [['Alpha Person', 'tc-al-chg'], ['Beta Person', 'tc-al-del']], 'changed yellow, removed red');
  await page.click('#tc-al-enter');
  await page.waitForFunction(() => /entered/.test(document.querySelector('#tc-alias .tc-al-msg').textContent), null, { timeout: 120000 });
  eq(await page.textContent('#tc-alias .tc-al-msg'), '2 edits entered', 'both entered');

  await open(page, inject, mbid);
  eq((await rows(page)).filter(r => r.name).map(r => [r.name, r.sort]), [['Alpha Person', 'Alpha, Person']], 'one alias left, with the new sort name');
  await page.goto(`${SANDBOX}/artist/${mbid}`, { waitUntil: 'domcontentloaded' });
  await inject('apollo_editor');
  await page.waitForSelector('.tabs .tc-al-pill', { timeout: 30000 });
  eq(await page.textContent('.tabs .tc-al-pill'), '1', 'the Aliases tab counts them');
  // the aliases list is taken over too
  await page.goto(`${SANDBOX}/artist/${mbid}/aliases`, { waitUntil: 'domcontentloaded' });
  await inject('apollo_editor');
  await page.waitForSelector('#tc-alias .tc-al-row', { timeout: 30000 });
  eq((await rows(page)).filter(r => r.name).map(r => r.name), ['Alpha Person'], 'the list page has the editor, with the alias');
  eq(await page.$eval('#content table.tbl', t => t.style.display), 'none', 'MusicBrainz\'s table is hidden');

});
