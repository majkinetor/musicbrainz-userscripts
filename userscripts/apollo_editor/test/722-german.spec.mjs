// #722: with MusicBrainz in German, Apollo found MB's own controls by their English text:
// the language and script options ("German" is "Deutsch"), the release editor's footer
// buttons ("Next »" is "Weiter »"), the external link's ended dialog. It finds them by MB's
// ids, data-click handlers and field names now. Runs on test.musicbrainz.org; nothing is submitted.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

const german = context => context.addCookies([{ name: 'lang', value: 'de', domain: 'test.musicbrainz.org', path: '/', expires: Math.floor(Date.now() / 1000) + 600 }]);

test('in German: language and script are filled, the nav buttons work', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {
  await german(context);
  try {
    await openApollo(page, inject, { seed: { name: 'Nur noch ein Tag', 'mediums.0.format': 'CD', 'mediums.0.track.0.name': 'Wenn der Regen fällt', 'mediums.0.track.1.name': 'Ich bin nicht allein', 'mediums.0.track.2.name': 'Die Straße nach Hause' } });
    check(await page.evaluate(() => document.documentElement.lang) === 'de', 'MusicBrainz is in German');
    const v = await until(() => page.evaluate(() => ({ language: document.querySelector('select#language').value, script: document.querySelector('select#script').value })), x => x.language && x.script);
    check(v.language === '145' && v.script === '28', `language German (145) and script Latin (28), found by id (${JSON.stringify(v)})`);
    const offered = await page.evaluate(() => [...document.querySelectorAll('select#language > optgroup.tc-ls-found > option')].map(o => o.textContent));
    check(offered.includes('Deutsch'), `the Detected list names it as MusicBrainz does (${JSON.stringify(offered)})`);
    // the pager's Next: enabled because MB's "Weiter »" is found by its data-click, and it moves on a step
    const next = '#tc-nav-pager [data-page="next"]';
    check(await until(() => page.evaluate(s => { const b = document.querySelector(s); return !!b && !b.disabled; }, next), Boolean), "the pager's Next is on");
    const step = () => page.evaluate(() => (document.querySelector('#release-editor li.ui-tabs-active a') || {}).getAttribute?.('href'));
    const before = await step();
    await page.click(next);
    const after = await until(step, s => s && s !== before);
    check(before === '#information' && after === '#tracklist', `Next moves from the first step to the tracklist (${before} → ${after})`);
  } finally {
    await context.clearCookies({ name: 'lang' });
  }
});
