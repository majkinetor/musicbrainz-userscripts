// The startup log line names MusicBrainz's interface language (#722), which changes what a
// script reads off the page: from <html lang>, or the lang cookie at document-start, when
// <html> isn't parsed yet. Off MusicBrainz it says nothing about it.
import { test, check, requireLogin, SANDBOX, functionSource } from '../test/harness.mjs';

test.use({ gm: false });

test('the startup line says which language MusicBrainz is in', { tag: ['@sandbox', '@login'] }, async ({ page, context }) => {
  const src = await functionSource('fusion', ['mbuStartupInfo']);
  await context.addCookies([{ name: 'lang', value: 'de', domain: 'test.musicbrainz.org', path: '/', expires: Math.floor(Date.now() / 1000) + 600 }]);
  try {
    // as early as a document-start userscript runs
    await context.addInitScript(s => { window.__mbuEarly = new Function(s + '\nreturn mbuStartupInfo("Fusion");')(); }, src);
    await page.goto(`${SANDBOX}/release/e91b84a9-6b98-4d64-b4fc-753a9c674c4c`, { waitUntil: 'domcontentloaded' });
    await requireLogin(page);
    const early = await page.evaluate(() => window.__mbuEarly);
    const late = await page.evaluate(s => new Function(s + '\nreturn mbuStartupInfo("Fusion");')(), src);
    check(/ · MusicBrainz in de$/.test(early), `at document-start, from the cookie (${early})`);
    check(/ · MusicBrainz in de$/.test(late), `once loaded, from <html lang> (${late})`);
    await context.clearCookies({ name: 'lang' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const en = await page.evaluate(() => window.__mbuEarly);
    check(/ · MusicBrainz in en$/.test(en), `English without the cookie (${en})`);
    await page.goto('https://example.com/');
    const other = await page.evaluate(() => window.__mbuEarly);
    check(!/MusicBrainz in/.test(other || ''), `nothing about it off MusicBrainz (${other})`);
  } finally {
    await context.clearCookies({ name: 'lang' });
  }
});
