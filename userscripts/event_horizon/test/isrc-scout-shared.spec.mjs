import { test, check, until, settled } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' }, pageErrors: ["reading 'querySelectorAll'"] });

const REL = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';

// ISRC Scout's chip in Event Horizon's header reads the release from the lookup EH drew its page from: no request of its own
test('ISRC Scout reads the release Event Horizon already looked up', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/release/' + REL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settled(page);
  await inject('event_horizon');
  const on = () => page.evaluate(() => document.documentElement.hasAttribute('data-mbu-dock'));
  if (!(await on())) await page.locator('#eh-launch').click();
  check(await until(on, v => v) === true, 'EH shows');
  check(await until(() => page.evaluate(id => !!(window.MBU && window.MBU.ehRelease && window.MBU.ehRelease(id)), REL), v => v) === true, 'EH shares its release lookup');
  await inject('isrc_scout');
  const status = () => page.evaluate(() => (document.querySelector('#app section.hero h1 #ii-btn-status') || {}).textContent || '');
  check(/\d/.test(await until(status, v => /\d/.test(v))), 'the header chip counts the ISRCs');
  const log = await page.evaluate(() => window.__isrcScoutLog ? window.__isrcScoutLog() : '');
  check(log.includes('Release read from Event Horizon'), 'ISRC Scout read it from Event Horizon');
  check(!/\/ws\/2\/release\/[0-9a-f-]{36}\?inc=\S*isrcs/.test(log), 'and asked MusicBrainz nothing');
});
