// A manager can start the bundle late, when the page is already parsed (oblaka's log: Violentmonkey).
// ISRC Scout then ran its button code at once, before `btnStatus` existed — "Cannot access 'btnStatus'
// before initialization" — and the throw stopped every member after it: no Platform Check panel
// until a reload. Two fixes, both checked here: ISRC Scout's status helper is hoisted, and a member
// that throws while starting no longer stops the others.
//
// test.musicbrainz.org, a release page; the bundle goes in after the page has loaded.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'String Theory' } });
const RELEASE = 'ec116461-5b0d-4c98-bb44-a4de5de63076';

test('started late, on a parsed page, every script comes up: ISRC Scout\'s button, Platform Check\'s panel', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'load', timeout: 60000 });
  await inject('string_theory');   // after load: every member finds the page already there
  const seen = await until(() => page.evaluate(() => ({ isrc: !!document.getElementById('ii-btn'), pc: !!document.getElementById('mb-pc-panel') })), s => s.isrc && s.pc, { timeout: 30000 });
  check(!errors.some(e => /btnStatus/.test(e)), `ISRC Scout starts without "Cannot access 'btnStatus'" (${errors.join(' | ') || 'no errors'})`);
  check(seen.isrc, 'ISRC Scout\'s button is on the page');
  check(seen.pc, 'Platform Check\'s panel is on the page — a member before it no longer stops it');
});

test('a member that throws while starting doesn\'t stop the ones after it', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  const logs = []; page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'load', timeout: 60000 });
  // ISRC Scout's body made to throw at its first line
  await inject('string_theory', { transform: code => code.replace(/(\/\/ ===== isrc_scout [^\n]*\n[\s\S]*?try \{ \(function\(\)\{\n)/, "$1throw new Error('simulated start-up failure');\n") });
  const pc = await until(() => page.evaluate(() => !!document.getElementById('mb-pc-panel')), Boolean, { timeout: 30000 });
  check(pc, 'Platform Check still starts');
  check(logs.some(l => /\[String Theory\] isrc_scout failed while starting — the other scripts carry on/.test(l)), `the failure is named in the console (${logs.find(l => /String Theory/.test(l))})`);
});
