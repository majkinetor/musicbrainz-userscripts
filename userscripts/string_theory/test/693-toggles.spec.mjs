// #693: each bundled script can be turned off from the manager's menu. The off list is the GM value
// 'string_theory.off' (folder names); an off member doesn't start, the others do. The menu lists
// every member as ☑/☐, and a click flips it in storage and relabels the entry.
//
// test.musicbrainz.org, a release page (ISRC Scout's button and Platform Check's panel both show there).
import { readFileSync } from 'node:fs';
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

const RELEASE = 'ec116461-5b0d-4c98-bb44-a4de5de63076';
const MEMBERS = readFileSync(new URL('../members.txt', import.meta.url), 'utf8').split(/\r?\n/).map(l => l.replace(/#.*/, '').trim()).filter(Boolean).length;

test.describe('Platform Check turned off', () => {
  test.use({ gm: { name: 'String Theory', values: { 'string_theory.off': ['platform_check'] } } });

  test('an off member doesn\'t start, the others do', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
    const logs = []; page.on('console', m => logs.push(m.text()));
    await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'load', timeout: 60000 });
    await inject('string_theory');
    const isrc = await until(() => page.evaluate(() => !!document.getElementById('ii-btn')), Boolean, { timeout: 30000 });
    await page.waitForTimeout(3000);   // give Platform Check the time it would take to show
    check(isrc, 'ISRC Scout\'s button is on the page');
    check(!(await page.evaluate(() => !!document.getElementById('mb-pc-panel'))), 'Platform Check\'s panel is not');
    check(logs.some(l => /turned off in the manager menu — platform_check/.test(l)), 'the console names what is off');
  });
});

test('the menu lists every member, and a click flips it and relabels the entry', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'load', timeout: 60000 });
  // a manager's menu: entries by id, unregister removes one
  await page.evaluate(() => {
    const menu = window.__menu = new Map(); let next = 1;
    window.GM_registerMenuCommand = (caption, fn) => { const id = next++; menu.set(id, { caption, fn }); return id; };
    window.GM_unregisterMenuCommand = id => menu.delete(id);
  });
  await inject('string_theory');
  const captions = () => page.evaluate(() => [...window.__menu.values()].map(e => e.caption));
  const before = await captions();
  check(before.length === MEMBERS && before.every(c => c.startsWith('☑ ')), `${MEMBERS} entries, all on (${before.join(' · ')})`);
  check(before.includes('☑ Platform Check'), 'labelled with the script\'s name');

  await page.evaluate(() => [...window.__menu.values()].find(e => /Platform Check/.test(e.caption)).fn());
  const after = await captions();
  check(after.length === MEMBERS, `still ${MEMBERS} entries, not doubled (${after.length})`);
  check(after.includes('☐ Platform Check') && after.filter(c => c.startsWith('☐ ')).length === 1, `Platform Check shows off, nothing else (${after.join(' · ')})`);
  check(JSON.stringify(await page.evaluate(() => GM_getValue('string_theory.off'))) === '["platform_check"]', 'stored as off');

  await page.evaluate(() => [...window.__menu.values()].find(e => /Platform Check/.test(e.caption)).fn());
  check((await captions()).every(c => c.startsWith('☑ ')), 'a second click turns it back on');
  check(JSON.stringify(await page.evaluate(() => GM_getValue('string_theory.off'))) === '[]', 'and stores it so');
});
