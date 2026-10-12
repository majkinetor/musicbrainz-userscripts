// #722: Group Therapy waited for the relationship editor's "Release relationships" heading
// before adding its toolbar, and MusicBrainz translates it ("Veröffentlichungsbeziehungen"),
// so with MusicBrainz in German the toolbar never came. It waits for the editor's
// #release-rels section now. Runs on test.musicbrainz.org; nothing is submitted.
import { test, check, until, requireLogin, SANDBOX, settled } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('in German, the toolbar comes on the relationship editor', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {
  await context.addCookies([{ name: 'lang', value: 'de', domain: 'test.musicbrainz.org', path: '/', expires: Math.floor(Date.now() / 1000) + 600 }]);
  try {
    await page.goto(`${SANDBOX}/release/3a37a35f-1e06-457f-9b2a-46155c5c03ce/edit-relationships`, { waitUntil: 'domcontentloaded' });
    await requireLogin(page);
    await settled(page);
    check(await page.evaluate(() => document.documentElement.lang) === 'de', 'MusicBrainz is in German');
    await inject('group_therapy', { waitFor: '__groupTherapy' });
    check(await until(() => page.evaluate(() => !!document.querySelector('#content .gt-toolbar')), Boolean), 'the Group Therapy toolbar is on the page');
  } finally {
    await context.clearCookies({ name: 'lang' });
  }
});
