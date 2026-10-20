// #716: a new release whose title and artist match exactly one of the release groups MusicBrainz
// suggests under the Release group field gets that group selected, marked with an "auto" badge.
//
// Sandbox data: Les McCann Ltd. has one "Plays the Truth" release group among several suggested
// for that title ("The Truth", "Les McCann Ltd. Plays the Shout", …).
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

const PLAYS_THE_TRUTH = '20fdc0cd-8047-3858-86f5-e8c06d7d0ad6';
const seed = {
  name: 'Plays the Truth', status: 'official',
  'artist_credit.names.0.name': 'Les McCann Ltd.',
  'mediums.0.format': 'Vinyl', 'mediums.0.track.0.name': 'Vakushna',
};
const rgGid = page => page.evaluate(() => { const rg = window.MB.releaseEditor.rootField.release().releaseGroup(); return (rg && rg.gid) || null; });

test.describe('release group auto-select', () => {
  test.use({ gm: apolloGm() });

  test('the only suggested group with the title and artist is selected, with a badge', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
    await openApollo(page, inject, { seed });
    check(await until(() => rgGid(page), g => g === PLAYS_THE_TRUTH, { timeout: 60000 }) === PLAYS_THE_TRUTH, 'Plays the Truth is the release group');
    const badge = await until(() => page.locator('#information .tc-ri-rgb .tc-badge').textContent().catch(() => ''), t => t === 'auto');
    check(badge === 'auto', `the field shows the auto badge: ${JSON.stringify(badge)}`);
    const checked = await page.evaluate(() => { const r = document.querySelector('.duplicate-release-groups-list input:checked'); return r && r.closest('label').textContent.trim().replace(/\s+/g, ' '); });
    check(/^Plays the Truth/.test(checked || ''), `its radio is checked: ${checked}`);

    // "Add a new release group" picked afterwards stays picked
    await page.locator('.duplicate-release-groups-list input[data-change="clearReleaseGroup"]').click();
    await page.evaluate(() => window.__apolloEditor.autoSelectReleaseGroup());
    check(await rgGid(page) === null, 'a new release group, as chosen, is not overridden');
    check(await until(() => page.locator('#information .tc-ri-rgb').count(), n => n === 0) === 0, 'the badge goes with it');
  });

  test('a title that differs only in punctuation still takes the group', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openApollo(page, inject, { seed: { ...seed, name: 'Plays, the Truth' } });
    check(await until(() => rgGid(page), g => g === PLAYS_THE_TRUTH, { timeout: 60000 }) === PLAYS_THE_TRUTH, 'Plays the Truth is the release group');
    const tip = await until(() => page.locator('#information .tc-ri-rgb .tc-badge').getAttribute('data-tip').catch(() => ''), t => !!t);
    check(/ignoring punctuation/.test(tip || ''), `the badge says the title was compared loosely: ${tip}`);
  });

  test.describe('setting off', () => {
    test.use({ gm: apolloGm({ autoMatchRG: false }) });
    test('nothing is selected', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
      await openApollo(page, inject, { seed });
      await until(() => page.locator('.duplicate-release-groups-list input[data-change="selectReleaseGroup"]').count(), n => n > 0, { timeout: 30000 });
      await until(() => page.evaluate(() => window.__apolloEditor.riArt.some(s => s.committed)), v => v, { timeout: 60000 });
      await page.evaluate(() => window.__apolloEditor.autoSelectReleaseGroup());
      check(await rgGid(page) === null, 'the release group is left new');
    });
  });
});
