// #662: recording matching by the ISRCs First Contact hands over. Every track in the
// handoff carries one:
// - USQX91300108 is held by exactly one sandbox recording ("Get Lucky"), which
//   agrees on title and artist, so it is linked on the ISRC and ranked above
//   everything else.
// - ZZ6620000001 is answered (routed) with two recordings sharing it, so it is
//   offered but never linked on the ISRC alone.
// - GBZZZ6620099 is unknown to MusicBrainz, so nothing comes of it.
// The picker lists the ISRC holder on top with an ISRC badge.
//
// Nothing is submitted (openApollo aborts the edit POST).
import { test, check, frames } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm, toTab } from './ap.mjs';

const LUCKY = '833f00e1-781f-4edd-90e4-e52712618862';
const seed = {
  name: 'Apollo 662 ISRC match', 'artist_credit.names.0.name': 'Daft Punk', status: 'official', 'mediums.0.format': 'Digital Media',
  'mediums.0.track.0.name': 'Get Lucky', 'mediums.0.track.0.length': '367000',
  'mediums.0.track.0.artist_credit.names.0.name': 'Daft Punk', 'mediums.0.track.0.artist_credit.names.0.join_phrase': ' feat. ',
  'mediums.0.track.0.artist_credit.names.1.name': 'Pharrell Williams', 'mediums.0.track.0.artist_credit.names.1.join_phrase': ' & ',
  'mediums.0.track.0.artist_credit.names.2.name': 'Nile Rodgers',
  'mediums.0.track.1.name': 'Shared Code 662', 'mediums.0.track.1.length': '200000', 'mediums.0.track.1.artist_credit.names.0.name': 'Daft Punk',
  'mediums.0.track.2.name': 'Unknown Code 662', 'mediums.0.track.2.length': '200000', 'mediums.0.track.2.artist_credit.names.0.name': 'Daft Punk',
};
const handoff = {
  v: 1, token: 't662', created: Date.now(), source: 'deezer', sourceName: 'Deezer', title: seed.name, credit: [{ name: 'Daft Punk', join: '' }],
  mediums: [{ tracks: [
    { title: 'Get Lucky', isrc: 'USQX91300108', credit: [] },
    { title: 'Shared Code 662', isrc: 'ZZ6620000001', credit: [] },
    { title: 'Unknown Code 662', isrc: 'GB-ZZZ-66-20099', credit: [] },   // written with dashes: normalised before the lookup
  ] }],
};
const fakeRec = (id, title) => ({ id, title, length: 200000, video: false, isrcs: ['ZZ6620000001'], releases: [],
  'artist-credit': [{ name: 'Daft Punk', joinphrase: '', artist: { id: '056e4f3e-d505-4dad-8ec1-d04f521cbb56', name: 'Daft Punk' } }] });

test.use({ gm: apolloGm({ autoMatchRec: true, autoMatch: false }) });

test('recordings are matched by the ISRC First Contact hands over', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
  const isrcLookups = [];
  page.on('request', r => { const m = /\/ws\/2\/isrc\/([^?]+)/.exec(r.url()); if (m) isrcLookups.push(decodeURIComponent(m[1])); });
  // the shared-ISRC case is answered here; this is a read, nothing is written
  await page.route(/\/ws\/2\/isrc\/ZZ6620000001/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ isrc: 'ZZ6620000001',
    recordings: [fakeRec('00000000-0000-4000-8000-000000000661', 'Shared Code 662'), fakeRec('00000000-0000-4000-8000-000000000662', 'Shared Code 662')] }) }));
  await openApollo(page, inject, {
    seed, tab: 'recordings',
    before: () => page.evaluate(h => { document.documentElement.dataset.firstContact = JSON.stringify(h); }, handoff),
  });
  await page.waitForFunction(() => { const e = document.querySelector('#tc-recwrap .tc-rec-amstatus'); return e && /linked \d+ of/.test(e.textContent); }, null, { timeout: 90000 });
  const recs = await page.evaluate(() => window.MB.releaseEditor.rootField.release().mediums()[0].tracks().map(t => { const r = t.recording(); return r && r.gid ? r.gid : null; }));
  const log = await page.evaluate(() => window.__apolloEditor.logMarkdown());
  console.log('recordings:', JSON.stringify(recs), '\nlookups:', JSON.stringify(isrcLookups));
  console.log(log.split('\n').filter(l => /ISRC/.test(l)).join('\n'));

  check(recs[0] === LUCKY, `Get Lucky is linked to the one recording holding USQX91300108 (got ${recs[0]})`);
  check(/ISRC USQX91300108 → 1 recording/.test(log) && /only recording with USQX91300108 and agrees on title and artist, ranked first/.test(log), 'the log says how it was found and why it ranked first');
  check(!recs[1] || !recs[1].startsWith('00000000-0000-4000-8000-00000000066'), `two recordings sharing an ISRC: neither is linked on the ISRC alone (got ${recs[1]})`);
  check(/2 recordings share ZZ6620000001, not linked on the ISRC alone/.test(log), 'the log says why the shared ISRC was not used');
  check(isrcLookups.includes('GBZZZ6620099'), `a dashed ISRC is looked up normalised (${JSON.stringify(isrcLookups)})`);
  check(isrcLookups.length === 3, `one lookup per track ISRC, nothing more (${isrcLookups.length})`);

  // the picker: the ISRC holder on top, badged; the cached lookup is reused
  const cell = '.tc-rectbl tbody tr.tc-recrow td.tc-recname';
  await page.waitForSelector(cell, { timeout: 30000 }).catch(async () => { console.log('CELLS', await page.evaluate(() => [...document.querySelectorAll('#tc-recwrap tr')].slice(0, 3).map(r => r.className + ' :: ' + [...r.children].map(c => c.className).join(',')).join(' | '))); });
  await page.evaluate(cell => document.querySelectorAll(cell)[1].click(), cell);
  await page.waitForSelector('.tc-recpop .tc-rpk-sugg .tc-rpk-isrcm', { timeout: 15000 });
  await frames(page);
  const top = await page.evaluate(() => [...document.querySelectorAll('.tc-recpop .tc-rpk-sugg .tc-rpk-row')].slice(0, 3).map(r => ({ gid: r.dataset.gid, isrc: !!r.querySelector('.tc-rpk-isrcm') })));
  console.log('picker top:', JSON.stringify(top));
  check(top.length >= 2 && top[0].isrc && top[1].isrc, `both ISRC holders head the picker's suggestions, badged (${JSON.stringify(top)})`);
  check(isrcLookups.length === 3, 'the picker reused the lookup the matcher made');
  await page.screenshot({ path: 'test-results/662-picker.png', clip: await page.locator('.tc-recpop').boundingBox() });
});
