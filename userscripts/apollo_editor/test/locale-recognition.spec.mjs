import { test, check, SANDBOX, pristine, requireLogin, attachShot } from '../../../dev/test/harness.mjs';
import { apolloGm } from './ap.mjs';

test.use({ gm: apolloGm(null, { persist: true }) });

test('recognize one locale, fill empty locales, preserve choices and save recognized values', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  const { mbid } = await pristine(page, 'artist');
  await page.goto(`${SANDBOX}/artist/${mbid}/add-alias`); await requireLogin(page);
  await page.evaluate(() => localStorage.removeItem('apollo:session:current'));
  await inject('apollo_editor');
  const row = i => page.locator('.tc-al-row').nth(i);
  const locale = i => row(i).locator('.tc-al-l').getAttribute('data-v');
  const names = ['Original Brothers International Band Of Imo State', 'Международный симфонический оркестр', 'Orchestre national de France', 'ABC', '東京交響楽団'];
  for (const name of names) await page.locator('.tc-al-row').last().locator('.tc-al-n').fill(name);
  check(!await page.getByLabel('Auto-detect locale', { exact: true }).isChecked(), 'automatic recognition defaults off');
  await row(0).getByRole('button', { name: 'Recognize locale', exact: true }).click();
  check(await locale(0) === 'en', 'single-row recognition maps English to a supported base locale');
  check(await page.evaluate(() => {
    const id = localStorage.getItem('apollo:session:current');
    return !!id && (localStorage.getItem('apollo:session:' + id) || '').includes('locale recognized');
  }), 'recognition is retained in Apollo’s latest log');
  if (!await row(0).getByRole('button', { name: 'Clear locale', exact: true }).count()) { check(false, 'a set locale offers a clear action'); return; }
  await row(2).locator('.tc-al-l').fill('de'); await row(2).locator('.tc-al-l').dispatchEvent('change');
  await row(0).getByRole('button', { name: 'Recognize locale', exact: true }).click({ button: 'right' });
  check(await locale(1) === 'ru', 'right-click fills another empty locale');
  check(await locale(2) === 'de', 'a manual choice is preserved');
  check(await locale(3) === '', 'a short ambiguous name stays empty');
  check(await locale(4) === '', 'an uncertain script-only name stays empty');
  await page.getByLabel('Auto-detect locale', { exact: true }).check();
  await page.locator('.tc-al-row').last().locator('.tc-al-n').fill('Das große deutsche Sinfonieorchester');
  await row(5).locator('.tc-al-l[data-v="de"]').waitFor();
  await row(5).locator('.tc-al-l').fill('fr'); await row(5).locator('.tc-al-l').dispatchEvent('change');
  await row(5).locator('.tc-al-n').fill('Das große deutsche Sinfonieorchester Berlin');
  await row(5).locator('.tc-al-n').blur();
  check(await locale(5) === 'fr', 'automatic recognition does not replace a manual correction');
  await row(5).locator('.tc-al-p').click();
  await row(5).getByRole('button', { name: 'Clear locale', exact: true }).click();
  check(await locale(5) === '' && !await row(5).locator('.tc-al-p').isVisible(), 'clear removes the locale and its primary flag');
  await attachShot(testInfo, page.locator('#tc-alias'), 'locale-recognition');
  await page.screenshot({ path: 'dev/_locale-recognition.png' });
  await page.locator('#tc-al-enter').click();
  await page.locator('.tc-al-msg').filter({ hasText: '6 edits entered' }).waitFor();
  check(await page.evaluate(() => {
    const id = localStorage.getItem('apollo:session:current'), log = localStorage.getItem('apollo:session:' + id) || '';
    return log.includes('locale cleared') && log.includes('alias submission');
  }), 'clearing and submission remain in the saved log');
  await page.getByLabel('Auto-detect locale', { exact: true }).uncheck();
  await page.goto(`${SANDBOX}/artist/${mbid}/aliases`); await inject('apollo_editor');
  await page.locator('.tc-al-row').nth(6).waitFor();
  const saved = await page.locator('.tc-al-row').evaluateAll(es => Object.fromEntries(es.map(e => [e.querySelector('.tc-al-n').value, e.querySelector('.tc-al-l').dataset.v])));
  check(saved[names[0]] === 'en' && saved[names[1]] === 'ru' && saved[names[2]] === 'de' && saved['ABC'] === '' && saved[names[4]] === '' && saved['Das große deutsche Sinfonieorchester Berlin'] === '', 'recognized, uncertain, manual and explicitly cleared locales persist on MusicBrainz');
  check(!await page.getByLabel('Auto-detect locale', { exact: true }).isChecked(), 'automatic option is remembered');
});

test.describe('bundled detector', () => {
  test.use({ gm: { name: 'String Theory' } });
  test('the bundled alias editor can recognize a locale', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await page.goto(`${SANDBOX}/artist/b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d/add-alias`);
    await requireLogin(page); await inject('string_theory');
    await page.locator('#tc-alias .tc-al-row').first().waitFor();
    const rows = page.locator('#tc-alias .tc-al-row');
    const row = rows.nth(await rows.count() - 1);
    await row.locator('.tc-al-n').fill('Das große deutsche Sinfonieorchester');
    await row.locator('.tc-al-detect').click();
    check(await row.locator('.tc-al-l').getAttribute('data-v') === 'de', 'bundled shared model recognizes the name');
  });
});
