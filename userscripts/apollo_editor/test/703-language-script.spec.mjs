// #703 (majkinetor): "If none is provided, Apollo should detect language and script
// (optional, on by default)". The rules follow Harmony's: letters only, the main script
// over 70%, no language from one or two titles. Chromium in the harness has the
// browser's LanguageDetector but its model is only downloadable, so the sandbox run
// proves the script-implied language (Cyrillic names no language, Greek does).
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('the script of the titles', { tag: '@unit' }, async ({ page, inject }) => {
  await page.setContent('<!DOCTYPE html><html><body></body></html>');
  await inject('apollo_editor', { waitFor: '__apolloEditor' });
  const r = await page.evaluate(() => {
    const { lsDetectScript: d, lsLangName: n, lsClean: c } = window.__apolloEditor;
    const s = t => (d(t) || {}).script || null;
    return {
      cyr: s('Ночь\nДорога домой (Live)'), lat: s('Hello\nGoodbye'), jp: s('夜に駆ける\nハルジオン'), ko: s('봄날\n피 땀 눈물'),
      gr: s('Σ\' αγαπώ\nΤο τρένο'), mixed: s('Ночь Night Road Дом'), short: s('Ab'),
      clean: c('Ночь (2011 Remaster) [Live]'), feat: c('Песня feat. Someone'),
      sr: n('sr-Latn'), ky: n('ky'), und: n('und'),
    };
  });
  check(r.cyr === 'Cyrillic' && r.lat === 'Latin' && r.gr === 'Greek', `plain scripts (${JSON.stringify(r)})`);
  check(r.jp === 'Japanese' && r.ko === 'Korean', `kana → Japanese, Hangul → Korean (${r.jp}, ${r.ko})`);
  check(r.mixed === null && r.short === null, `no main script over 70%, or too few letters: nothing (${r.mixed}, ${r.short})`);
  check(r.clean === 'Ночь' && r.feat === 'Песня', `brackets and feat. are not read (${JSON.stringify([r.clean, r.feat])})`);
  check(r.sr === 'Serbian' && r.ky === 'Kirghiz' && r.und === '', `detector codes → MusicBrainz names (${r.sr}, ${r.ky}, ${JSON.stringify(r.und)})`);
});

const sel = page => page.evaluate(() => ({ language: document.querySelector('select#language').value, script: document.querySelector('select#script').value, rel: (r => [r.languageID(), r.scriptID()])(MB.releaseEditor.rootField.release()) }));

test('empty fields are filled; a given one is left alone', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: { name: 'Το τρένο', 'mediums.0.format': 'CD', 'mediums.0.track.0.name': 'Σ\' αγαπώ', 'mediums.0.track.1.name': 'Η θάλασσα', 'mediums.0.track.2.name': 'Το φεγγάρι' } });
  const v = await until(() => sel(page), v => v.script && v.language);
  check(v.script === '22' && v.language === '159', `Greek titles: script Greek (22), language Greek (159) (${JSON.stringify(v)})`);
  check(String(v.rel[0]) === '159' && String(v.rel[1]) === '22', `the editor's model has them too (${JSON.stringify(v.rel)})`);
  // changed by hand → Apollo keeps off it, even when the titles change
  await page.evaluate(() => { const s = document.querySelector('select#script'); s.value = '28'; s.dispatchEvent(new Event('change', { bubbles: true })); MB.releaseEditor.rootField.release().name('Το τρένο ξανά'); });
  await until(() => page.evaluate(() => window.__apolloEditor && document.querySelector('select#script').value), x => x === '28');
  check((await sel(page)).script === '28', 'a script changed by hand stays');
});

test('a seeded language stays; Cyrillic names no language', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: { name: 'Привет', language: 'srp', 'mediums.0.format': 'CD', 'mediums.0.track.0.name': 'Ночь', 'mediums.0.track.1.name': 'Дорога домой', 'mediums.0.track.2.name': 'Звезда' } });
  const v = await until(() => sel(page), v => v.script);
  check(v.script === '31', `script Cyrillic (31) (${JSON.stringify(v)})`);
  check(v.language === '363', `the seeded Serbian (363) is not replaced (${v.language})`);
});
