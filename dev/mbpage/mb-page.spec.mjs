// The shared MusicBrainz page helpers (#722, #723): what they find on MB's markup, in English
// and in another interface language. The markup is MB's sidebar as rendered on test (German).
import { test, check, requireLogin, SANDBOX } from '../test/harness.mjs';
import { MBP_INLINE } from './mb-page.mjs';

test.use({ gm: false, profile: 'fresh' });   // fresh: nothing learnt from an earlier run

// the helpers as the scripts get them (consts + functions from their own source)
// in an IIFE: setContent keeps the window, so a second injection must not redeclare them
const SRC = '(() => {\n' + Object.entries(MBP_INLINE.consts).map(([k, v]) => `const ${k} = ${JSON.stringify(v)};`).join('\n')
  + '\n' + MBP_INLINE.fns.map(f => f.toString()).join('\n')
  + '\nwindow.__mbp = { mbpCoverTypeId, mbpReleaseLinkList, mbpReleaseJsonLinks, mbpReleaseLinks };\n})();';

const list = (head, links) => `<h2 class="external-links">${head}</h2><ul class="external_links">${links.map(u => `<li><a href="${u}">x</a></li>`).join('')}</ul>`;
const page_ = (lang, body) => `<!DOCTYPE html><html lang="${lang}"><body><div id="sidebar"><h2 class="labels">Labels</h2>${body}</div></body></html>`;
const REL = 'https://open.spotify.com/album/rel', RG = 'https://www.discogs.com/master/1';

test('cover-art types by id', { tag: '@unit' }, async ({ page }) => {
  await page.setContent('<!DOCTYPE html><html><body></body></html>');
  await page.addScriptTag({ content: SRC });
  const r = await page.evaluate(() => ['Front', 'back', ' Matrix/Runout ', 'Vorderseite', ''].map(n => window.__mbp.mbpCoverTypeId(n)));
  check(JSON.stringify(r) === JSON.stringify(['1', '2', '15', null, null]), `English names map to MB's ids, others to nothing (${JSON.stringify(r)})`);
});

test("the release's own links, in any language", { tag: '@unit' }, async ({ page }) => {
  // served from a made-up origin, so the page has localStorage (what a heading is learnt into)
  let html = '';
  await page.route('https://mbpage.invalid/**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  const read = async h => {
    html = h;
    await page.goto('https://mbpage.invalid/release');
    await page.addScriptTag({ content: SRC });
    return page.evaluate(() => window.__mbp.mbpReleaseLinks());
  };
  const one = (lang, head, link) => read(page_(lang, list(head, [link])));
  // one German list before anything is learnt: can't be told apart, so nothing
  const unknown = await one('de', 'Externe Links', REL);
  check(unknown.length === 0, `one German list, nothing learnt yet: nothing (${JSON.stringify(unknown)})`);
  // both lists: the first is the release's, whatever its heading says; that heading is learnt
  const both = await read(page_('de', list('Externe Links', [REL]) + list('Externe Links der Veröffentlichungsgruppe', [RG])));
  check(JSON.stringify(both) === JSON.stringify([REL]), `two lists: the first, not the release group's (${JSON.stringify(both)})`);
  // one German list after that: the learnt heading decides
  const deRel = await one('de', 'Externe Links', REL), deRg = await one('de', 'Externe Links der Veröffentlichungsgruppe', RG);
  check(JSON.stringify(deRel) === JSON.stringify([REL]) && deRg.length === 0, `one German list: the learnt heading decides (${JSON.stringify([deRel, deRg])})`);
  // one English list: the plain heading is the release's, the prefixed one the release group's
  const en = await one('en', 'External links', REL), enRg = await one('en', 'Release group external links', RG);
  check(JSON.stringify(en) === JSON.stringify([REL]) && enRg.length === 0, `English: by the plain heading (${JSON.stringify([en, enRg])})`);
  // English learns nothing, so a release-group list is never taken for the release's
  const three = await read(page_('en', list('Release group external links', [RG]) + list('External links', [REL]) + list('Release group external links', [RG])));
  check(JSON.stringify(three) === JSON.stringify([REL]), `several lists: the one headed unlike the last (${JSON.stringify(three)})`);
  const learntEn = await page.evaluate(() => localStorage.getItem('mbu.extLinksHeading.en'));
  check(learntEn === null, `nothing learnt for English (${learntEn})`);
});

test("the release's own links from MB's data, when the page has it", { tag: '@unit' }, async ({ page }) => {
  let html = '';
  await page.route('https://mbpage.invalid/**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  const MBID = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';
  const url = h => ({ target: { entityType: 'url', href_url: h } });
  // as MB embeds it: the release's relationships, and its release group's apart
  const data = { release: { entityType: 'release', gid: MBID, relationships: [url(REL), url('//x.bandcamp.com/album/y'), { target: { entityType: 'artist' } }], releaseGroup: { entityType: 'release_group', relationships: [url(RG)] } } };
  // the sidebar shows only the release group's list, under a heading nothing has taught
  html = page_('de', '<script type="application/json">' + JSON.stringify(data) + '</script>' + list('Externe Links der Veröffentlichungsgruppe', [RG]));
  await page.goto('https://mbpage.invalid/release/' + MBID);
  await page.addScriptTag({ content: SRC });
  const r = await page.evaluate(() => window.__mbp.mbpReleaseLinks());
  check(JSON.stringify(r) === JSON.stringify([REL, 'https://x.bandcamp.com/album/y']), `the release's URL relationships (a protocol-relative one resolved), not the release group's (${JSON.stringify(r)})`);
  // another release's data (a different page's MBID) is not this one's
  await page.goto('https://mbpage.invalid/release/00000000-0000-0000-0000-000000000000');
  await page.addScriptTag({ content: SRC });
  check(await page.evaluate(() => window.__mbp.mbpReleaseJsonLinks()) === null, 'data for another release is not used');
});

test.describe('on the sandbox', () => {
  test.use({ profile: 'logged-in' });
  test("on test in German, the release's own links", { tag: ['@sandbox', '@login'] }, async ({ page, context }) => {
    await context.addCookies([{ name: 'lang', value: 'de', domain: 'test.musicbrainz.org', path: '/', expires: Math.floor(Date.now() / 1000) + 600 }]);
    // "Bad Boys!" on the sandbox: one link of its own (Discogs), headed "Externe Links"
    await page.goto(`${SANDBOX}/release/e91b84a9-6b98-4d64-b4fc-753a9c674c4c`, { waitUntil: 'domcontentloaded' });
    await requireLogin(page);
    check(await page.evaluate(() => document.documentElement.lang) === 'de', 'MusicBrainz is in German');
    await page.addScriptTag({ content: SRC });
    const r = await page.evaluate(() => window.__mbp.mbpReleaseLinks());
    check(JSON.stringify(r) === JSON.stringify(['https://www.discogs.com/release/5889603']), `its Discogs link, from MB's data (${JSON.stringify(r)})`);
    await context.clearCookies({ name: 'lang' });   // the profile is shared: back to English
  });
});
