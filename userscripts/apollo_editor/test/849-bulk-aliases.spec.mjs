// The bulk alias editor on /<entity>/<mbid>/add-alias (#849): pasted lines become new rows,
// Guess sort names fills them, Submit enters one edit per row; back on the page the aliases
// load as rows, and an edited and a removed row are entered the same way.
//
// On the sandbox, on a pristine artist made for the run.
import { test, check, SANDBOX, pristine, requireLogin } from '../../../dev/test/harness.mjs';
import { apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

async function open(page, inject, mbid) {
  await page.goto(`${SANDBOX}/artist/${mbid}/add-alias`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await page.waitForSelector('input[name="edit-alias.name"]', { state: 'attached', timeout: 30000 });
  await inject('apollo_editor');
  await page.waitForSelector('#tc-alias tbody tr', { timeout: 30000 });
}
const rows = page => page.$$eval('#tc-alias tbody tr', trs => trs.map(tr => ({ cls: tr.className, name: tr.querySelector('.tc-al-n').value, sort: tr.querySelector('.tc-al-s').value, locale: tr.querySelector('.tc-al-l').value })));

test('paste, guess, submit, then edit and remove', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(240000);
  const { mbid } = await pristine(page, 'artist');
  await open(page, inject, mbid);
  check('the table replaces MusicBrainz\'s form', await page.$eval('input[name="edit-alias.name"]', e => e.closest('form').style.display), 'none');
  check('a blank row to start', (await rows(page)).length, 1);

  await page.click('#tc-alias .tc-al-paste summary');
  await page.fill('#tc-alias .tc-al-paste textarea', 'Alpha Person | | ja\nBeta Person');
  await page.click('#tc-alias .tc-al-paste button');
  await page.click('#tc-alias .tc-al-guessall');
  const r1 = await rows(page);
  check('pasted rows are new, with the pasted locale', r1.slice(1).map(r => [r.cls, r.name, r.locale]), [['tc-al-new', 'Alpha Person', 'ja'], ['tc-al-new', 'Beta Person', '']]);
  check('sort names guessed', r1.slice(1).map(r => r.sort), ['Person, Alpha', 'Person, Beta']);
  check('the button counts the edits', await page.textContent('#tc-alias .tc-al-go'), 'Submit 2 edits');
  await page.fill('#tc-alias .tc-al-note', 'Bulk alias test (mb-userscripts)');
  await page.click('#tc-alias .tc-al-go');
  await page.waitForFunction(() => /entered/.test(document.querySelector('#tc-alias .tc-al-msg').textContent), null, { timeout: 120000 });
  check('both entered', await page.textContent('#tc-alias .tc-al-msg'), '2 edits entered');

  await open(page, inject, mbid);
  const r2 = await rows(page);
  check('the aliases load back', r2.filter(r => r.name).map(r => [r.name, r.sort, r.locale]).sort(), [['Alpha Person', 'Person, Alpha', 'ja'], ['Beta Person', 'Person, Beta', '']]);
  const tr = n => page.locator('#tc-alias tbody tr').nth(n);
  const idx = name => r2.findIndex(r => r.name === name);
  await tr(idx('Alpha Person')).locator('.tc-al-s').fill('Alpha, Person');
  await tr(idx('Beta Person')).locator('.tc-al-x').click();
  check('changed yellow, removed red', (await rows(page)).filter(r => r.name).map(r => [r.name, r.cls]).sort(), [['Alpha Person', 'tc-al-chg'], ['Beta Person', 'tc-al-del']]);
  await page.click('#tc-alias .tc-al-go');
  await page.waitForFunction(() => /entered/.test(document.querySelector('#tc-alias .tc-al-msg').textContent), null, { timeout: 120000 });
  check('both entered', await page.textContent('#tc-alias .tc-al-msg'), '2 edits entered');

  await open(page, inject, mbid);
  check('one alias left, with the new sort name', (await rows(page)).filter(r => r.name).map(r => [r.name, r.sort]), [['Alpha Person', 'Alpha, Person']]);
});
