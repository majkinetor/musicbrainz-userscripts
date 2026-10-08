// #689 (majkinetor): the type icon beside a resolved artist field opens the artist in a new
// tab; the same icon on the artist search dropdown's rows did nothing but pick the row.
// Each row's icon is now a link to its artist, opened in a new tab without picking it.
//
// test.musicbrainz.org, nothing submitted: a seeded release whose artist auto-matches, so
// focusing the field shows the dropdown from the slot's own candidates.
// APOLLO_EDITOR_SRC=<old build> to watch it fail.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('artist search dropdown icons open the artist in a new tab', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {
  const seed = { name: 'Apollo 689 fixture', 'artist_credit.names.0.name': 'Miles Davis', 'mediums.0.format': 'CD', 'mediums.0.track.0.name': 'So What', 'mediums.0.track.0.artist_credit.names.0.name': 'Miles Davis' };
  await openApollo(page, inject, { seed, tab: 'tracklist' });
  await page.waitForSelector('.tc-medsec .tc-search input.nm', { state: 'visible', timeout: 60000 });
  const matched = await page.waitForFunction(() => window.__apolloEditor.model?.tracks[0]?.slots[0].committed, null, { timeout: 120000 }).then(() => true).catch(() => false);
  check(matched, 'the slot auto-matched (its candidates feed the dropdown)');
  if (!matched) return;
  const gidBefore = await page.evaluate(() => window.__apolloEditor.model.tracks[0].slots[0].gid);
  await page.locator('.tc-medsec .tc-search input.nm').first().click();
  const rows = await until(() => page.evaluate(() => [...document.querySelectorAll('.tc-acpop .tc-acrow[data-i]')].map(r => {
    const a = r.querySelector('a.tic');
    return { href: a ? a.getAttribute('href') : null, target: a ? a.target : null };
  })), r => r.length > 1);
  check(rows.length > 1, `the dropdown lists several artists (${rows.length})`);
  check(rows.every(r => /\/artist\/[0-9a-f-]{36}$/.test(r.href || '') && r.target === '_blank'), 'every row icon links its artist in a new tab: ' + JSON.stringify(rows));
  // another artist's icon: opens that artist, and leaves the slot on the one it had
  const i = rows.findIndex(r => r.href && !r.href.endsWith(gidBefore));
  if (i < 0 || !rows[i].href) return;
  const [tab] = await Promise.all([context.waitForEvent('page'), page.locator(`.tc-acpop .tc-acrow[data-i="${i}"] a.tic`).click()]);
  await tab.waitForURL(/\/artist\//, { timeout: 30000 }).catch(() => {});
  check(tab.url().endsWith(rows[i].href.replace(/^.*\/artist\//, '/artist/')), `the new tab is that artist (${tab.url()})`);
  await tab.close();
  const gidAfter = await page.evaluate(() => window.__apolloEditor.model.tracks[0].slots[0].gid);
  check(gidAfter === gidBefore, `clicking the icon did not pick the row (slot ${gidBefore} → ${gidAfter})`);
});
