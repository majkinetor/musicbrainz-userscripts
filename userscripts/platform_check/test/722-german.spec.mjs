// #722: Platform Check read a release's format, year, label and barcode off the page by their
// English names ("Format:", "Release events", "Barcode:", "Digital Media"), and MusicBrainz
// translates them ("Digitales Medium", "Veröffentlichungsereignisse"). It reads them from MB's
// own data and classes now. Runs on test.musicbrainz.org; read only.
import { test, check, requireLogin, SANDBOX, idle, functionSource } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

// "Never Ever Ever" on the sandbox: Digital Media, 2024-01-26, Classic Music Company, 826194657451
const RELEASE = 'aa3cbe43-46f7-4527-be62-66f71aa2e315';

test("in German, the release's format, year, label and barcode are read", { tag: ['@sandbox', '@login'] }, async ({ page, context }) => {
  await context.addCookies([{ name: 'lang', value: 'de', domain: 'test.musicbrainz.org', path: '/', expires: Math.floor(Date.now() / 1000) + 600 }]);
  try {
    await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
    await requireLogin(page);
    await idle(page);
    check(await page.evaluate(() => document.documentElement.lang) === 'de', 'MusicBrainz is in German');
    const src = await functionSource('platform_check', ['parseMbFromDom', 'pcPageLabels']);   // parseMbFromDom calls pcPageLabels for the release's catnos (31790e8e)
    const r = await page.evaluate(src => new Function(`const VA_MBID = '89ad4ac3-39f7-470e-963a-56509c546377', VA_NAME_RE = /^various(\\s+artists?)?$/i; const appendLog = () => {}, PC_FOLLOW = false;\n${src}\nreturn parseMbFromDom();`)(), src);
    check(!!r, 'the page was read');
    if (!r) return;
    check(/^digital\s*media$/i.test(r.format || ''), `format Digital Media, in English (${r.format})`);
    check(r.year === '2024', `year 2024 (${r.year})`);
    check(r.releaseLabel === 'Classic Music Company', `label (${r.releaseLabel})`);
    check(r.barcode === '826194657451', `barcode (${r.barcode})`);
  } finally {
    await context.clearCookies({ name: 'lang' });
  }
});
