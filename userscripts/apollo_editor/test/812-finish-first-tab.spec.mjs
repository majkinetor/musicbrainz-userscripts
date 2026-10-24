// #812: on a release ADD, MusicBrainz hides its native Finish button on the first tab
// (Release Information) — `visible: (activeTabIndex() > 0 || action === 'edit') && …`. Apollo's
// compact-nav Finish proxy used to mirror that exactly, so after an import (which lands on the
// Release Information tab) the Finish button vanished there while showing on every other tab.
// The fix shows Apollo's Finish on every non-last tab once the release is submittable, since the
// native button still works when clicked (it only jumps to the edit-note tab).
import { test, check, settled, pristine } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.describe('Finish on the Release Information tab of an add', () => {
  test.use({ gm: apolloGm() });

  test('shows once the release is submittable, even though MB hides its native one', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    test.setTimeout(3 * 60_000);
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const { mbid: ARTIST, name: artistName } = await pristine(page, 'artist');   // made for the run (#795)
    const seed = {
      name: `Apollo 812 fixture ${stamp}`, 'artist_credit.names.0.mbid': ARTIST, 'artist_credit.names.0.name': artistName, status: 'official', type: 'album',
      'mediums.0.format': 'Digital Media', 'mediums.0.track.0.name': `Finish ${stamp}`, 'mediums.0.track.0.length': '2:00',
    };
    await openApollo(page, inject, { seed });
    await settled(page);

    // A newly added release isn't submittable until the Tracklist tab has been visited
    // (MB's addingWithoutVisitingTracklist). Step through as an import does — Tracklist, then on
    // to the end — so the release becomes submittable, then come back to Release Information,
    // the import's starting tab and where the Finish button went missing.
    await page.evaluate(() => document.querySelector('a[href="#tracklist"]').click());
    await page.evaluate(() => document.querySelector('#release-editor > div.buttons [data-click="lastTab"]').click());
    await page.waitForFunction(() => { try { return window.MB.releaseEditor.allowsSubmission(); } catch (e) { return false; } }, null, { timeout: 60_000 });
    await page.evaluate(() => document.querySelector('a[href="#information"]').click());
    await page.waitForFunction(() => {
      const a = document.querySelector('#release-editor > ul.ui-tabs-nav li.ui-tabs-active a');
      return !!a && a.getAttribute('href') === '#information';
    }, null, { timeout: 30_000 });
    await settled(page);

    const state = await page.evaluate(() => {
      const nat = document.querySelector('#release-editor > div.buttons [data-click="lastTab"]');
      const proxy = document.querySelector('#tc-nav-wiz [data-wiz="finish"]');
      return {
        submittable: (() => { try { return window.MB.releaseEditor.allowsSubmission(); } catch (e) { return false; } })(),
        nativeHidden: !!nat && getComputedStyle(nat).display === 'none',
        proxyShown: !!proxy && getComputedStyle(proxy).display !== 'none',
      };
    });

    check(state.submittable, 'the release is submittable on the Release Information tab');
    check(state.nativeHidden, "MB hides its own Finish here (the add's first tab) — the condition #812 is about");
    check(state.proxyShown, "Apollo's Finish proxy is shown on the Release Information tab (#812)");
  });
});
