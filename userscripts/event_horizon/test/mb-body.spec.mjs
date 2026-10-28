import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true } });

// #853: while Event Horizon shows, MusicBrainz's page stays in the document (hidden), so the other
// scripts that read it (Mission Control's tracklist, Platform Check's catalog numbers) still find it
test('MusicBrainz\'s page stays readable while Event Horizon shows', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/');
  const id = await page.evaluate(async () => (await (await fetch('/ws/2/release?query=tracks:%5B5%20TO%2020%5D&limit=1&fmt=json')).json()).releases[0].id);
  await page.goto('https://test.musicbrainz.org/release/' + id);
  await inject('event_horizon');
  const rows = page.locator('.tr[data-row]');
  check(await until(() => rows.count(), n => n >= 2) >= 2, 'Event Horizon shows the tracklist');
  const st = await page.evaluate(() => ({
    first: document.body.querySelector('#app') !== null,
    tracks: document.querySelectorAll('#content table.medium tbody tr a[href*="/recording/"]').length,
    sidebar: document.querySelector('#sidebar') !== null,
    hidden: [...document.documentElement.children].filter(e => e.tagName === 'BODY').slice(1).every(b => b.hidden),
  }));
  check(st.first, 'document.body is Event Horizon\'s');
  check(st.tracks >= 2 && st.sidebar, 'MusicBrainz\'s tracklist and sidebar are still in the document');
  check(st.hidden, 'MusicBrainz\'s body is hidden');
});
