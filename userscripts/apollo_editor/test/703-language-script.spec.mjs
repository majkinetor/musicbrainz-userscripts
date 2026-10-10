// #703 (majkinetor): "If none is provided, Apollo should detect language and script
// (optional, on by default)". The rules follow Harmony's: letters only, the main script
// over 70%, no language from one or two titles, and the language from lande, the
// model Harmony uses, inlined so it works in every browser. Then (majkinetor): "So it
// almost doesn't work in FF at all" — the first build used Chrome's LanguageDetector.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('the script of the titles', { tag: '@unit' }, async ({ page, inject }) => {
  await page.setContent('<!DOCTYPE html><html><body></body></html>');
  await inject('apollo_editor', { waitFor: '__apolloEditor' });
  const r = await page.evaluate(() => {
    const { lsDetectScript: d, lsDetectLanguage: l, LS_LANDE: names, lsClean: c } = window.__apolloEditor;
    const lang = t => { const r = l(t); return r && r.conf >= 0.8 ? names[r.lang] : null; };
    const s = t => (d(t) || {}).script || null;
    return {
      cyr: s('Ночь\nДорога домой (Live)'), lat: s('Hello\nGoodbye'), jp: s('夜に駆ける\nハルジオン'), ko: s('봄날\n피 땀 눈물'),
      gr: s('Σ\' αγαπώ\nΤο τρένο'), mixed: s('Ночь Night Road Дом'), short: s('Ab'),
      clean: c('Ночь (2011 Remaster) [Live]'), feat: c('Песня feat. Someone'),
      fi: lang(['Seitsemäs sinetti', 'Kerro ketä ajattelit', 'Viikon perehtymisjakso', 'Kuurupiiloa'].join('\n')),
      de: lang(['Wenn der Regen fällt', 'Nur noch ein Tag', 'Ich bin nicht allein', 'Die Straße nach Hause'].join('\n')),
      sv: lang(['Mina hundar', 'Livet är underbart', 'En dag på stranden', 'Hus av glas'].join('\n')),
      none: lang(['Intro', 'Outro', 'XYZ'].join('\n')),
    };
  });
  check(r.cyr === 'Cyrillic' && r.lat === 'Latin' && r.gr === 'Greek', `plain scripts (${JSON.stringify(r)})`);
  check(r.jp === 'Japanese' && r.ko === 'Korean', `kana → Japanese, Hangul → Korean (${r.jp}, ${r.ko})`);
  check(r.mixed === 'Multiple' && r.short === null, `no main script over 70%: Multiple; too few letters: nothing (${r.mixed}, ${r.short})`);
  check(r.clean === 'Ночь' && r.feat === 'Песня', `brackets and feat. are not read (${JSON.stringify([r.clean, r.feat])})`);
  check(r.fi === 'Finnish' && r.de === 'German' && r.sv === 'Swedish', `lande, in MusicBrainz's names (${r.fi}, ${r.de}, ${r.sv})`);
  check(r.none === null, `no confident answer for titles in no language (${r.none})`);
});

const badge = k => !!document.querySelector('select#' + k)?.parentElement.querySelector(':scope > .tc-ls-auto');
const sel = page => page.evaluate(badge => ({ badges: ['language', 'script'].filter(new Function('k', 'return (' + badge + ')(k)')), language: document.querySelector('select#language').value, script: document.querySelector('select#script').value, rel: (r => [r.languageID(), r.scriptID()])(MB.releaseEditor.rootField.release()) }), badge.toString());

test('empty fields are filled; a given one is left alone', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: { name: 'Το τρένο', 'mediums.0.format': 'CD', 'mediums.0.track.0.name': 'Σ\' αγαπώ', 'mediums.0.track.1.name': 'Η θάλασσα', 'mediums.0.track.2.name': 'Το φεγγάρι' } });
  const v = await until(() => sel(page), v => v.script && v.language);
  check(v.script === '22' && v.language === '159', `Greek titles: script Greek (22), language Greek (159) (${JSON.stringify(v)})`);
  check(String(v.rel[0]) === '159' && String(v.rel[1]) === '22', `the editor's model has them too (${JSON.stringify(v.rel)})`);
  check(v.badges.length === 2, `both fields wear the auto badge (${v.badges})`);
  // changed by hand → Apollo keeps off it, even when the titles change
  await page.evaluate(() => { const s = document.querySelector('select#script'); s.value = '28'; s.dispatchEvent(new Event('change', { bubbles: true })); MB.releaseEditor.rootField.release().name('Το τρένο ξανά'); });
  await until(() => page.evaluate(() => window.__apolloEditor && document.querySelector('select#script').value), x => x === '28');
  const after = await until(() => sel(page), x => x.badges.length === 1);
  check(after.script === '28', 'a script changed by hand stays');
  check(JSON.stringify(after.badges) === '["language"]', `its auto badge is gone, the language's stays (${after.badges})`);
});

test('German titles get German and Latin', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: { name: 'Nur noch ein Tag', 'mediums.0.format': 'CD', 'mediums.0.track.0.name': 'Wenn der Regen fällt', 'mediums.0.track.1.name': 'Ich bin nicht allein', 'mediums.0.track.2.name': 'Die Straße nach Hause' } });
  const v = await until(() => sel(page), v => v.script && v.language);
  check(v.script === '28' && v.language === '145', `script Latin (28), language German (145) (${JSON.stringify(v)})`);
});

// majkinetor's First Contact import of discogs.com/release/34839779: parallel titles, Finnish
// or transliterated beside the Ukrainian. Read whole, lande said Serbian 95% and no script held
// 70%, so the script stayed empty. "ukrainian is right".
test('parallel Latin and Cyrillic titles: Multiple scripts, the language of the Cyrillic words', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const t = ['Laula Mulle Laulu (Preludi)', 'Laula Mulle Laulu = Обійми', 'Oy U Luzi Chervona Kalyna = Ой у лузі червона калина', 'Chervona Ruta = Червона рута', 'Kristallivirta', 'Kristallivirta (Coda) = Реве та стогне Дніпр широкий'];
  await openApollo(page, inject, { seed: Object.assign({ name: 'Solovey - Lauluja Ukrainasta', 'mediums.0.format': 'Vinyl' }, ...t.map((x, i) => ({ [`mediums.0.track.${i}.name`]: x }))) });
  const v = await until(() => sel(page), v => v.script && v.language);
  check(v.script === '160', `script [Multiple scripts] (160) (${JSON.stringify(v)})`);
  check(v.language === '441', `language Ukrainian (441), not Serbian (${v.language})`);
  // majkinetor: "we should offer found languages on selection. User should be able to select
  // one or all of the found langauges by lande (the same for script)"
  const offered = await page.evaluate(() => Object.fromEntries(['language', 'script'].map(k =>
    [k, [...document.querySelectorAll(`select#${k} > optgroup.tc-ls-found > option`)].map(o => o.textContent)])));
  check(offered.language[0] === 'Ukrainian' && offered.language.includes('Finnish') && offered.language.at(-1) === '[Multiple languages]',
    `the language list offers each one found, then all of them (${JSON.stringify(offered.language)})`);
  check(offered.script.join() === 'Latin,Cyrillic,[Multiple scripts]', `the script list too (${JSON.stringify(offered.script)})`);
  const picked = await page.evaluate(() => {
    const s = document.querySelector('select#language'), o = [...s.querySelectorAll('optgroup.tc-ls-found > option')].find(x => x.textContent === 'Finnish');
    s.value = o.value; o.selected = true; s.dispatchEvent(new Event('change', { bubbles: true }));
    return String(MB.releaseEditor.rootField.release().languageID());
  });
  check(picked === '131', `picking Finnish from it sets Finnish (131) (${picked})`);
  const after = await until(() => sel(page), x => !x.badges.includes('language'));
  check(after.language === '131' && !after.badges.includes('language'), `and it is the user's now: no auto badge (${JSON.stringify(after)})`);
});

// majkinetor: "but it can also be / like here" — discogs.com/release/24951187, English or
// Portuguese beside the Russian. The split is by word, so the separator doesn't matter.
test('parallel titles with a slash: Russian', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const t = ['Song With No Words / Песня без слов', 'Offscreen / За кадром', 'I Knew It / Я так и знал', 'Glance / Мгновение', 'How Are You / Como É Que Vai Você', 'Beige Days / Бежевые дни', 'Morning Moon / Lua Da Manhã', 'Force Of The Wind / Сила ветра', 'Weather Report / Прогноз погоды'];
  await openApollo(page, inject, { seed: Object.assign({ name: 'Сила Ветра = Force Of The Wind', 'mediums.0.format': 'Vinyl' }, ...t.map((x, i) => ({ [`mediums.0.track.${i}.name`]: x }))) });
  const v = await until(() => sel(page), v => v.script && v.language);
  check(v.script === '160', `script [Multiple scripts] (160) (${JSON.stringify(v)})`);
  check(v.language === '353', `language Russian (353) (${v.language})`);
});

test('a seeded language stays', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: { name: 'Привет', language: 'srp', 'mediums.0.format': 'CD', 'mediums.0.track.0.name': 'Ночь', 'mediums.0.track.1.name': 'Дорога домой', 'mediums.0.track.2.name': 'Звезда' } });
  const v = await until(() => sel(page), v => v.script);
  check(v.script === '31', `script Cyrillic (31), filled beside it (${JSON.stringify(v)})`);
  check(v.language === '363', `the seeded Serbian (363) is not replaced (${v.language})`);
});
