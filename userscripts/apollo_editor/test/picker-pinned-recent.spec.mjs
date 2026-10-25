// The artist picker's pinned and recent artists (majkinetor): an emptied field shows one Recent header,
// collapsed until clicked, holding the pinned artists first and then the recent ones; a row's pin
// toggle pins or unpins it without picking it or closing the list; picking one doesn't reopen it.
//
// The lists are seeded into GM storage; nothing is searched or submitted.
import { test, check, until, frames } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

const bach = { gid: '24f1766e-9635-4d58-a4d4-9413f9f98a4c', name: 'Johann Sebastian Bach', comment: 'German Baroque period composer & musician', typeName: 'Person' };
const mozart = { gid: 'b972f589-fb0e-474e-b64a-803b0364fa75', name: 'Wolfgang Amadeus Mozart', comment: 'classical composer', typeName: 'Person' };
const kitchener = { gid: '0b2e0b26-7fb9-4b4e-a41b-1b3a7a2e6d10', name: 'Lord Kitchener', comment: 'calypsonian', typeName: 'Person' };

test.use({ gm: apolloGm(null, { values: {
  'apolloEditor.settings.v1': JSON.stringify({ autoMatch: false, autoMatchRec: false, autoMatchOnV: 1 }),
  'apollo.picks.artist': JSON.stringify({ pinned: [kitchener], recent: [mozart, bach, kitchener] }),
} }) });

test('an emptied artist field shows one collapsed Recent, pinned artists first', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.route(/\/ws\/(js|2)\/artist\?/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  const seed = { name: 'Apollo picks fixture', 'artist_credit.names.0.name': 'Zzq Nobody', 'mediums.0.format': 'CD', 'mediums.0.track.0.name': 'One', 'mediums.0.track.0.artist_credit.names.0.name': 'Zzq Nobody' };
  const submitted = await openApollo(page, inject, { seed, tab: 'tracklist' });
  const inp = page.locator('.tc-medsec .tc-search input.nm').first();
  await inp.waitFor({ state: 'visible', timeout: 60000 });
  await inp.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  const read = () => page.evaluate(() => {
    const pop = [...document.querySelectorAll('.tc-acpop')].find(p => p.isConnected && p.getClientRects().length);
    if (!pop) return null;
    return {
      secs: [...pop.querySelectorAll('.tc-acsec')].map(s => s.textContent.trim().replace(/\s+/g, ' ')),
      rows: [...pop.querySelectorAll('.tc-acrow[data-i] .nm')].map(n => n.textContent),
      pinned: [...pop.querySelectorAll('.tc-acrow[data-i]')].filter(r => r.querySelector('.tc-acpin.on')).map(r => r.querySelector('.nm').textContent),
    };
  });
  check(await until(async () => (await read()) !== null), 'the emptied field opens the list');
  let s = await read();
  check(JSON.stringify(s.secs) === JSON.stringify(['Recent 3']), `one Recent header with its count (${JSON.stringify(s.secs)})`);
  check(s.rows.length === 0, `Recent starts collapsed (${JSON.stringify(s.rows)})`);

  await page.locator('.tc-acpop .tc-acrec').dispatchEvent('mousedown');
  s = await read();
  check(JSON.stringify(s.rows) === JSON.stringify([kitchener.name, mozart.name, bach.name]), `the pinned one first, not repeated (${JSON.stringify(s && s.rows)})`);

  await page.locator('.tc-acpop .tc-acrow[data-i="1"] .tc-acpin').dispatchEvent('mousedown');
  s = await read();
  check(s && JSON.stringify(s.rows) === JSON.stringify([kitchener.name, mozart.name, bach.name]) && JSON.stringify(s.pinned) === JSON.stringify([kitchener.name, mozart.name]), `the pin toggle pins Mozart, list still open (${JSON.stringify(s)})`);

  await page.keyboard.press('Escape');
  await inp.evaluate(el => el.blur());
  await inp.click();
  check(await until(async () => { const r = await read(); return r && r.rows.length === 3; }), 'a reopened list keeps Recent open');

  await page.keyboard.type('moz');
  check(await until(async () => { const r = await read(); return r && JSON.stringify(r.secs) === JSON.stringify(['Recent 1']); }), 'typing filters Recent');

  // a recent artist is stored lean, so a pick loads it first and then refocuses the field: the list stays shut
  await page.locator('.tc-acpop .tc-acrow[data-i="0"]').dispatchEvent('mousedown');
  const picked = page.locator('.tc-medsec .tc-search input.nm').first();
  check(await until(() => picked.inputValue(), v => v === mozart.name), 'picking a recent artist sets it');
  await frames(page, 3);
  check(await picked.evaluate(el => el === document.activeElement), 'the field keeps the focus');
  check((await read()) === null, `the picker doesn't reopen after the pick (${JSON.stringify(await read())})`);
  check(submitted.length === 0, 'nothing submitted');
});
