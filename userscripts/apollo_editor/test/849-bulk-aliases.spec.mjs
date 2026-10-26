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
  await page.waitForSelector('#tc-alias tbody tr', { timeout: 30000 });
}
const rows = page => page.$$eval('#tc-alias tbody tr', trs => trs.map(tr => ({ cls: tr.className, name: tr.querySelector('.tc-al-n').value, sort: tr.querySelector('.tc-al-s').value, locale: tr.querySelector('.tc-al-l').value })));

test('paste, guess, submit, then edit and remove', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(240000);
  const { mbid } = await pristine(page, 'artist');
  await open(page, inject, mbid);
  eq(await page.$eval('input[name="edit-alias.name"]', e => e.closest('form').style.display), 'none', 'the table replaces MusicBrainz\'s form');
  eq((await rows(page)).length, 1, 'a blank row to start');

  await page.click('#tc-alias .tc-al-paste summary');
  await page.fill('#tc-alias .tc-al-paste textarea', 'Alpha Person | | ja\nBeta Person');
  await page.click('#tc-alias .tc-al-paste button');
  await page.click('#tc-alias .tc-al-guessall');
  const r1 = await rows(page);
  eq(r1.slice(1).map(r => [r.cls, r.name, r.locale]), [['tc-al-new', 'Alpha Person', 'ja'], ['tc-al-new', 'Beta Person', '']], 'pasted rows are new, with the pasted locale');
  eq(r1.slice(1).map(r => r.sort), ['Person, Alpha', 'Person, Beta'], 'sort names guessed');
  eq(await page.textContent('#tc-al-enter'), '✓ Enter 2 edits', 'the bar counts the edits');
  eq(await page.evaluate(() => document.body.classList.contains('tc-zen-on')), true, 'Zen hides MusicBrainz\'s header');
  await page.fill('#tc-alias .tc-al-note', 'Bulk alias test (mb-userscripts)');
  await page.click('#tc-al-enter');
  await page.waitForFunction(() => /entered/.test(document.querySelector('#tc-alias .tc-al-msg').textContent), null, { timeout: 120000 });
  eq(await page.textContent('#tc-alias .tc-al-msg'), '2 edits entered', 'both entered');

  await open(page, inject, mbid);
  const r2 = await rows(page);
  eq(r2.filter(r => r.name).map(r => [r.name, r.sort, r.locale]).sort(), [['Alpha Person', 'Person, Alpha', 'ja'], ['Beta Person', 'Person, Beta', '']], 'the aliases load back');
  const tr = n => page.locator('#tc-alias tbody tr').nth(n);
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
  await page.waitForSelector('#tc-alias tbody tr', { timeout: 30000 });
  eq((await rows(page)).filter(r => r.name).map(r => r.name), ['Alpha Person'], 'the list page has the editor, with the alias');
  eq(await page.$eval('#content table.tbl', t => t.style.display), 'none', 'MusicBrainz\'s table is hidden');

  // a release crediting the artist under another name: the name is offered from the credits, and
  // the release page shows the artist's alias after it
  const rel = await pristine(page, 'release', { 'artist_credit.names.0.mbid': mbid, 'artist_credit.names.0.name': 'Credited Otherwise' });
  await open(page, inject, mbid);
  await page.click('#tc-alias .tc-al-cred');
  const chip = page.locator('#tc-alias .tc-al-chip', { hasText: 'Credited Otherwise' });
  await chip.waitFor({ timeout: 60000 });
  await chip.click();
  eq((await rows(page)).filter(r => r.cls === 'tc-al-new' && r.name).map(r => r.name), ['Credited Otherwise'], 'a credited name becomes a new row');
  await page.goto(`${SANDBOX}/release/${rel.mbid}`, { waitUntil: 'domcontentloaded' });
  await inject('apollo_editor');
  await page.waitForSelector('.releaseheader .tc-al-inl', { timeout: 30000 });
  eq((await page.textContent('.releaseheader .tc-al-inl')).trim(), '(Alpha Person)', 'the release shows the artist\'s alias');
});
