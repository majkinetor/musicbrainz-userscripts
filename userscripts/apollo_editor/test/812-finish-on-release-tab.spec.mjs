// #812: on Add release, MusicBrainz hides its Finish button on the first step (so the
// duplicates get seen at least once), and Apollo's compact nav mirrored that: going back
// to the Release step after visiting the others made Finish vanish. Once the Release step
// has been left (past the duplicates check), Apollo's Finish stays there too, and still
// goes to the edit note.
//
// test.musicbrainz.org, nothing submitted.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

const PORTISHEAD = '8f6bd1e4-fbe1-4f50-aa9b-94c450ec0f11';
test.use({ gm: apolloGm() });

test('Finish stays on the Release step once it has been left', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: {
    name: 'Apollo #812 finish fixture', 'artist_credit.names.0.mbid': PORTISHEAD, 'artist_credit.names.0.name': 'Portishead', status: 'official', type: 'album',
    'mediums.0.format': 'Digital Media', 'mediums.0.track.0.name': 'Track', 'mediums.0.track.0.length': '2:00',
    edit_note: 'Apollo #812 test fixture (mb-userscripts test suite), never submitted',   // MB holds an Add without one
  } });
  await page.waitForSelector('#tc-nav-bar', { timeout: 30000 });

  const activeStep = () => page.evaluate(() => { const a = document.querySelector('#release-editor > ul.ui-tabs-nav li.ui-tabs-active a'); return a && a.getAttribute('href'); });
  const finishShown = () => page.evaluate(() => { const b = document.querySelector('#tc-nav-wiz [data-wiz="finish"]'); return !!b && b.style.display !== 'none'; });
  const waitFinish = want => page.waitForFunction(w => { const b = document.querySelector('#tc-nav-wiz [data-wiz="finish"]'); return (!!b && b.style.display !== 'none') === w; }, want, { timeout: 10000 }).catch(() => {});

  check(!(await finishShown()), 'no Finish on the Release step before it was left');
  await page.click('#tc-nav-pager [data-page="next"]');
  await page.waitForFunction(() => { const a = document.querySelector('#release-editor > ul.ui-tabs-nav li.ui-tabs-active a'); return a && a.getAttribute('href') !== '#information'; }, null, { timeout: 15000 });
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.allowsSubmission(); } catch (e) { return false; } }, null, { timeout: 60000 });
  await waitFinish(true);
  check(await finishShown(), `Finish on the next step (${await activeStep()})`);
  await page.click('#tc-nav-steps [data-step="information"]');
  await waitFinish(true);
  check((await activeStep()) === '#information', 'back on the Release step');
  check(await finishShown(), 'Finish still on the Release step');
  await page.click('#tc-nav-wiz [data-wiz="finish"]');
  await page.waitForFunction(() => { const a = document.querySelector('#release-editor > ul.ui-tabs-nav li.ui-tabs-active a'); return a && a.getAttribute('href') === '#edit-note'; }, null, { timeout: 10000 }).catch(() => {});
  check((await activeStep()) === '#edit-note', `Finish goes to the edit note (${await activeStep()})`);
});
