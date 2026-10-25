// The artist picker's pinned and recent artists (majkinetor): an emptied field lists the pinned
// ones, then a Recent header, collapsed until clicked; a row's pin toggle pins or unpins it
// without picking it or closing the list.
//
// The lists are seeded into GM storage; nothing is searched or submitted.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

const bach = { gid: '24f1766e-9635-4d58-a4d4-9413f9f98a4c', name: 'Johann Sebastian Bach', comment: 'German Baroque period composer & musician', typeName: 'Person' };
const mozart = { gid: 'b972f589-fb0e-474e-b64a-803b0364fa75', name: 'Wolfgang Amadeus Mozart', comment: 'classical composer', typeName: 'Person' };
const kitchener = { gid: '0b2e0b26-7fb9-4b4e-a41b-1b3a7a2e6d10', name: 'Lord Kitchener', comment: 'calypsonian', typeName: 'Person' };

test.use({ gm: apolloGm(null, { values: {
  'apolloEditor.settings.v1': JSON.stringify({ autoMatch: false, autoMatchRec: false, autoMatchOnV: 1 }),
  'apollo.picks.artist': JSON.stringify({ pinned: [bach], recent: [mozart, bach, kitchener] }),
} }) });

test('an emptied artist field lists the pinned artists and a collapsed Recent', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
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
  check(JSON.stringify(s.secs) === JSON.stringify(['Pinned 1', 'Recent 2']), `Pinned, then Recent with its count (${JSON.stringify(s.secs)})`);
  check(JSON.stringify(s.rows) === JSON.stringify([bach.name]), `only the pinned artist is shown; Recent is collapsed (${JSON.stringify(s.rows)})`);

  await page.locator('.tc-acpop .tc-acpinh').dispatchEvent('mousedown');
  s = await read();
  check(s && s.rows.length === 0 && s.secs[0] === 'Pinned 1', `Pinned folds too (${JSON.stringify(s)})`);
  await page.locator('.tc-acpop .tc-acpinh').dispatchEvent('mousedown');

  await page.locator('.tc-acpop .tc-acrec:not(.tc-acpinh)').dispatchEvent('mousedown');
  s = await read();
  check(JSON.stringify(s.rows) === JSON.stringify([bach.name, mozart.name, kitchener.name]), `Recent opens below, without repeating the pinned one (${JSON.stringify(s && s.rows)})`);

  await page.locator('.tc-acpop .tc-acrow[data-i="1"] .tc-acpin').dispatchEvent('mousedown');
  s = await read();
  check(s && JSON.stringify(s.pinned) === JSON.stringify([bach.name, mozart.name]), `the pin toggle pins Mozart, list still open (${JSON.stringify(s && s.pinned)})`);
  check(s && s.secs[1] === 'Recent 1', `Recent loses the newly pinned one (${JSON.stringify(s && s.secs)})`);

  await page.keyboard.type('moz');
  check(await until(async () => { const r = await read(); return r && JSON.stringify(r.rows) === JSON.stringify([mozart.name]); }), 'typing filters the pinned artists');
  check(submitted.length === 0, 'nothing submitted');
});
