// Settings v2 turned Probe on open and the reload after Execute on by default. Before it the whole
// settings object was saved, so an install that ever saved one setting has both stored as false: the
// old default, not a choice. They are dropped once; a later false is the user's and stays.
import { test, check } from '../../../dev/test/harness.mjs';

const OLD = { fusion: 'ask', ch: 'ask', disabled: [], left: true, right: true, linkedOpen: [], autoProbe: false, reloadAfter: false, consAfter: false };
test.use({ gm: { name: 'Mission Control', values: { 'mc.settings': JSON.stringify(OLD) } } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // sandbox copy of "Bad Boys!" (dev/test/sandbox-copies.json)

test('settings v2: the old stored defaults give way to the new ones, once', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  const s = await page.evaluate(() => window.__mcTest.settings());
  check(s.autoProbe === true && s.reloadAfter === true, `probe on open and the reload are on (${s.autoProbe}, ${s.reloadAfter})`);
  check(s.consAfter === false && s.v === 2, `another stored choice stays, and the settings are v2 (${s.consAfter}, ${s.v})`);
});
