// #704: MusicBrainz takes a Qobuz URL only with an ASCII slug, so a Cyrillic one
// (`/interpreter/союз/3284439`) was refused under every link type. Qobuz finds the page
// by its id, so a non-Latin name gets an ASCII-folded slug, or `-`.
import { test, check, loadFunctions, functionSource } from '../../../dev/test/harness.mjs';

test('Qobuz slugs are ASCII', { tag: '@unit' }, async () => {
  const { pcQobuzSlug } = await loadFunctions('platform_check', ['pcSlug', 'pcQobuzSlug']);
  const cases = [
    [['союз', 'СОЮЗ'], '-'],
    [[undefined, 'SOYUZ / СОЮЗ'], 'soyuz'],
    [[undefined, '坂本龍一'], '-'],
    [[undefined, 'Björk'], 'bjork'],
    [['mr-bongo-2', 'Mr Bongo'], 'mr-bongo-2'],
  ];
  for (const [[slug, name], want] of cases) {
    const got = pcQobuzSlug(slug, name);
    check(got === want, `${JSON.stringify([slug, name])} → ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
});

test("Qobuz's page links get an ASCII slug too", { tag: '@unit' }, async () => {
  const { pcCreditsQobuzPage } = await loadFunctions('platform_check', ['VA_NAME_RE', 'qzDec', 'pcCr', 'pcCredits', 'pcSlug', 'pcQobuzSlug', 'pcCreditsQobuzPage']);
  const html = '<a href="/us-en/interpreter/%D1%81%D0%BE%D1%8E%D0%B7/3284439">СОЮЗ</a>'
    + '<a href="/us-en/interpreter/союз/3284440">СОЮЗ</a>'
    + '<a href="/us-en/label/mr-bongo-2/download-streaming-albums/69917">Mr Bongo</a>';
  const c = pcCreditsQobuzPage(html);
  const urls = [...c.artists, ...c.labels].map(x => x.url);
  check(JSON.stringify(urls) === JSON.stringify([
    'https://www.qobuz.com/us-en/interpreter/-/3284439',
    'https://www.qobuz.com/us-en/interpreter/-/3284440',
    'https://www.qobuz.com/us-en/label/mr-bongo-2/download-streaming-albums/69917',
  ]), `page links (${JSON.stringify(urls)})`);
});

test('a Qobuz match cached with a non-ASCII slug is read again', { tag: '@unit' }, async () => {
  const store = {};
  const pcLsGet = k => store[k] ?? null, appendLog = () => {};
  const src = await functionSource('platform_check', ['cacheKey', 'cacheGet', 'PC_CREDIT_PROVIDERS', 'cacheGetScan']);
  const cacheGetScan = new Function('pcLsGet', 'appendLog', src + '\nreturn cacheGetScan;')(pcLsGet, appendLog);
  const at = (credits, p = 'qobuz') => { store[`pc:cache:v2:${p}:m`] = { url: 'u', credits }; return cacheGetScan('m', p, 'L'); };
  check(at({ artists: [{ name: 'СОЮЗ', url: 'https://www.qobuz.com/us-en/interpreter/союз/3284439' }], labels: [] }) === null, 'a Cyrillic slug is read again');
  check(at({ artists: [{ name: 'СОЮЗ', url: 'https://www.qobuz.com/us-en/interpreter/-/3284439' }], labels: [] }) !== null, 'an ASCII one is served');
});
