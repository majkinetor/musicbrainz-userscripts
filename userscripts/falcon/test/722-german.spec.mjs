// #722 #723: Falcon told a disc ID's medium by the text of the heading row above it ("CD 1"),
// which is the medium's format in MusicBrainz's language. It reads the heading's a#disc<N> now.
// Its cover-art upload picks the type by MB's type id (dev/mbpage's specs cover that map).
// Runs on test.musicbrainz.org; read only.
import { test, check, requireLogin, SANDBOX, idle, functionSource } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

// "Love Songs of the 70s" on the sandbox: three CDs, each with one disc ID
const RELEASE = '67d009f9-417a-439c-878f-d8f163867544';

test("in German, the disc IDs page's mediums by number", { tag: ['@sandbox', '@login'] }, async ({ page, context }) => {
  await context.addCookies([{ name: 'lang', value: 'de', domain: 'test.musicbrainz.org', path: '/', expires: Math.floor(Date.now() / 1000) + 600 }]);
  try {
    await page.goto(`${SANDBOX}/release/${RELEASE}/discids`, { waitUntil: 'domcontentloaded' });
    await requireLogin(page);
    await idle(page);
    check(await page.evaluate(() => document.documentElement.lang) === 'de', 'MusicBrainz is in German');
    const src = await functionSource('falcon', ['scrapeMediumIds']);
    const byPos = await page.evaluate(src => new Function(src + '\nreturn scrapeMediumIds();')(), src);
    // each medium's id from its Remove link, under its own number
    const ids = await page.evaluate(() => [...document.querySelectorAll('tr.subh a[id^="disc"]')].map(a => {
      let tr = a.closest('tr').nextElementSibling, m = null;
      while (tr && !tr.classList.contains('subh') && !m) { m = /[?&]medium_id=(\d+)/.exec(tr.innerHTML); tr = tr.nextElementSibling; }
      return [a.id.replace('disc', ''), m && +m[1]];
    }));
    check(ids.length === 3, `three mediums on the page (${JSON.stringify(ids)})`);
    for (const [n, id] of ids) check(byPos[n] === id, `medium ${n} is ${id} (${JSON.stringify(byPos)})`);
  } finally {
    await context.clearCookies({ name: 'lang' });
  }
});
