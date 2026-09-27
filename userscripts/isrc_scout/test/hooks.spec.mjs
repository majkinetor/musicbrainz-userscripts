// ISRC Scout's functions, through its test hooks, on a stub release page (no network).
import { test, check } from '../../../dev/test/harness.mjs';
import { openStub } from './is.mjs';

test.use({ profile: 'fresh', gm: { name: 'ISRC Scout' } });

// #481 (majkinetor): the same recording got two cosmetically different links depending
// on whether Harmony or ISRC Scout added them (tidal.com/track/N vs
// tidal.com/browse/track/N; Apple with and without the song slug). MusicBrainz's own
// URLCleanup.js is the authority, and Harmony already writes its canonical shape;
// normalizeProviderUrl() mirrors its two rules.
test('#481: Tidal and Apple links are written in MusicBrainz\'s canonical form', { tag: '@unit' }, async ({ page, context, inject }) => {
  await openStub(page, context, inject);
  await page.waitForFunction(() => !!window.__isrcScoutTest466?.normalizeProviderUrl, null, { timeout: 20000 });
  const cases = [
    ['td', 'https://tidal.com/browse/track/23959722', 'https://tidal.com/track/23959722'],
    ['td', 'https://tidal.com/track/23959722', 'https://tidal.com/track/23959722'],
    ['td', 'https://listen.tidal.com/browse/track/23959722', 'https://tidal.com/track/23959722'],
    ['td', 'https://tidal.com/gb/browse/track/23959722', 'https://tidal.com/track/23959722'],
    ['am', 'https://music.apple.com/us/song/distant-horizon/767643144', 'https://music.apple.com/us/song/767643144'],
    ['am', 'https://music.apple.com/us/song/767643144', 'https://music.apple.com/us/song/767643144'],
    ['am', 'https://music.apple.com/gb/album/some-album/123456?i=767643144', 'https://music.apple.com/gb/song/767643144'],
    ['dz', 'https://www.deezer.com/track/3702424332', 'https://www.deezer.com/track/3702424332'],   // not Tidal or Apple: untouched
  ];
  const got = await page.evaluate(cs => cs.map(([c, u]) => window.__isrcScoutTest466.normalizeProviderUrl(c, u)), cases);
  cases.forEach(([c, input, want], i) => check(got[i] === want, `${c}: ${input} → ${got[i]} (want ${want})`));
});

// #486 (chaban-mb): SoundExchange gave "Sing (radio edit)" and "Sing (club edit)" the
// same ISRC. MusicBrainz puts the edit in the title; SoundExchange returns the bare title
// ("Sing") for every edit and keeps the difference in `version`, which classify() ignored.
test('#486: SoundExchange\'s version field tells edits of one title apart', { tag: '@unit' }, async ({ page, context, inject }) => {
  await openStub(page, context, inject);
  await page.waitForFunction(() => !!window.__isrcScoutTestSX, null, { timeout: 20000 });
  const r = await page.evaluate(() => {
    const SX = window.__isrcScoutTestSX;
    const item = (isrc, version) => ({ isrc, recordingTitle: 'Sing', recordingArtistName: 'Soul Avengerz Featuring Angie Brown', recordingVersion: version, recordingYear: '2006', duration: '' });
    const radio = item('GBAYE0600449', 'Radio Edit; Feat. Angie Brown'), club = item('GBAYE0600486', 'Club Edit; Feat. Angie Brown');
    const cls = (it, title) => SX.classify(SX.fields(it), title, 'Soul Avengerz Featuring Angie Brown', '', 2006);
    return {
      radioRadio: cls(radio, 'Sing (radio edit)'), radioClub: cls(radio, 'Sing (club edit)'),
      clubClub: cls(club, 'Sing (club edit)'), clubRadio: cls(club, 'Sing (radio edit)'),
      noVersion: cls({ ...radio, recordingVersion: '' }, 'Sing (club edit)'), plainTitle: cls(radio, 'Sing'),
    };
  });
  check(r.radioRadio === 'best' && r.clubClub === 'best', `each edit is 'best' for its own title (${r.radioRadio}, ${r.clubClub})`);
  check(r.radioClub !== 'best' && r.clubRadio !== 'best', `…and not for the other edit's (${r.radioClub}, ${r.clubRadio})`);
  check(r.noVersion === 'best' && r.plainTitle === 'best', `no version on SoundExchange's side, or no edit in the title, costs nothing (${r.noVersion}, ${r.plainTitle})`);
});

// #501 follow-up (majkinetor): "Tokens should go into GM storage" and "tidy up config
// prefixes": every stored key carries `ii:`, adopted once from the old bare name (left
// in place); tokens stay in GM storage; only the per-release pending-removal draft goes
// to localStorage.
test.describe('with the old bare-named values stored', () => {
  test.use({ gm: { name: 'ISRC Scout', values: { col_widths: '{"a":1}', ignore_pc_confidence: true, oauth_refresh_token: 'my-refresh-token', tidal_token: 'my-tidal-token' } } });
  test('#501: settings move under ii:, tokens stay in GM storage, only the draft goes to localStorage', { tag: '@unit' }, async ({ page, context, inject }) => {
    await openStub(page, context, inject);
    await page.waitForFunction(() => !!window.__isrcScoutTestStore, null, { timeout: 20000 });
    // the migration happens on the first read of each key
    const reads = await page.evaluate(() => { const { store } = window.__isrcScoutTestStore; return ['col_widths', 'ignore_pc_confidence', 'oauth_refresh_token', 'tidal_token'].map(k => store.get(k, null)); });
    check(JSON.stringify(reads) === JSON.stringify(['{"a":1}', true, 'my-refresh-token', 'my-tidal-token']), `each old value is read through the new name (${JSON.stringify(reads)})`);
    const s = await page.evaluate(() => ({ cw: GM_getValue('ii:col_widths'), tt: GM_getValue('ii:tidal_token'), old: GM_getValue('col_widths'), ls: localStorage.getItem('ii:tidal_token') }));
    check(s.cw === '{"a":1}' && s.tt === 'my-tidal-token', 'stored under ii: in GM storage');
    check(s.old === '{"a":1}', 'the old key is left in place');
    check(s.ls === null, 'the token is not in localStorage');
    const p = await page.evaluate(() => { window.__isrcScoutTestStore.localStore.set('pending_removals_test', { rec1: ['USRC1'] }); const out = { ls: localStorage.getItem('ii:pending_removals_test'), gm: GM_getValue('ii:pending_removals_test') }; localStorage.removeItem('ii:pending_removals_test'); return out; });
    check(!!p.ls && p.gm === undefined, `the pending-removal draft goes to localStorage, not GM storage (${JSON.stringify(p)})`);
  });
});
