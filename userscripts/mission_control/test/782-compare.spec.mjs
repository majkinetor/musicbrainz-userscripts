// #782: a release compared with its platforms. The Platforms step (Ask: its Compare button) takes the album links
// Platform Check has for the release in its barcode lane, has First Contact read them headless, votes as a
// consolidation does, and hands what the release lacks back to Platform Check (cons): the barcode, the labels with
// their catalog numbers, the links, a release event for a release without one, the lengths of tracks without one.
// A title that differs is shown, not applied. Stand-ins for Platform Check and First Contact give fixed answers
// (the real ones: 727-update-release, and First Contact's reads in 702-consolidate). Read only.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = '9d290316-dcd3-4d7e-a62b-392ab2396f27';   // "Rushing Pictures": 5 tracks, none with a length, no barcode
const BC = '4006381333931';
const TITLES = ['Rushing Pictures', 'Homes & Gardens (Remix)', 'Retribution (Edge of Dawn remix)', 'Further Dose (V01d remix)', 'Humanity'];
const LENS = [241000, 302000, 355000, 288000, 199000];

test('#782: Compare reads the release\'s platforms and offers what it lacks', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  // the release as one without a release event: its sidebar section gone
  await page.evaluate(() => { const h = document.querySelector('#sidebar h2.release-events'); if (h) { h.nextElementSibling.remove(); h.remove(); } });
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(([release, bc, titles, lens]) => {
    const send = (type, d) => document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(d) }));
    const url = k => ({ deezer: 'https://www.deezer.com/album/782', qobuz: 'https://www.qobuz.com/gb-en/album/rushing-pictures/782', spotify: 'https://open.spotify.com/album/782', beatport: 'https://www.beatport.com/release/rushing-pictures/782', tidal: 'https://tidal.com/album/782' })[k];
    window.__pcProbes = []; window.__reads = [];
    // Platform Check: Deezer linked, Qobuz and Spotify found in the release's lane, Beatport with another barcode,
    // Tidal without one and a track short; with a consolidation, the release event and the lengths as rows
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      if (!d.only.includes('pc')) return;
      window.__pcProbes.push(d.cons || null);
      const fs = [
        { key: 'deezer', name: 'Deezer', url: url('deezer'), barcode: bc, state: 'linked' },
        { key: 'qobuz', name: 'Qobuz', url: url('qobuz'), barcode: bc, tracks: 5, state: 'withheld', why: 'barcode not confirmed' },
        { key: 'spotify', name: 'Spotify', url: url('spotify'), barcode: bc, tracks: 5, state: 'new' },
        { key: 'beatport', name: 'Beatport', url: url('beatport'), barcode: '0000782782782', tracks: 5, state: 'unsure' },
        { key: 'tidal', name: 'Tidal', url: url('tidal'), tracks: 4, state: 'unsure', mismatch: ['4 tracks, the release has 5'] },
      ];
      if (d.cons && d.cons.event) fs.unshift({ key: 'event:2008-08-29:XW', kind: 'event', name: 'Release event', code: '2008-08-29 [Worldwide]', state: 'new', why: 'consolidated by Mission Control from Deezer, Qobuz' });
      if (d.cons && d.cons.lengths) fs.unshift({ key: 'lengths:' + d.cons.lengths.length, kind: 'lengths', name: 'Track lengths', code: d.cons.lengths.length + ' tracks', state: 'new', why: 'consolidated by Mission Control from Deezer, Qobuz' });
      setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, release, findings: fs, barcode: null }), 50);
    });
    send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, release, capabilities: ['probe', 'apply'] });
    // First Contact's reader: the same album on Deezer and Qobuz, the second track's title as both give it
    const relOf = k => ({ title: 'Rushing Pictures', credit: [{ name: 'Mind.In.A.Box', join: '' }], types: ['EP'], date: { year: 2008, month: 8, day: 29 }, country: 'XW', barcode: bc,
      labels: [{ name: 'Artoffact', catno: 'AOF 782' }], urls: [{ url: url(k), linkType: 85 }],
      mediums: [{ format: 'Digital Media', tracks: titles.map((t, i) => ({ title: t, lengthMs: lens[i] + (k === 'qobuz' && i === 0 ? 400 : 0), isrc: 'DEX260878' + String(200 + i), credit: [{ name: 'Mind.In.A.Box', join: '' }] })) }] });
    document.addEventListener('mc:read', e => {
      const d = JSON.parse(e.detail), k = Object.keys({ deezer: 1, qobuz: 1, spotify: 1, beatport: 1, tidal: 1 }).find(x => url(x) === d.url);
      window.__reads.push(k);
      setTimeout(() => send('mc:read-result', { url: d.url, run: d.run, ok: true, provider: { id: k, name: k, abbr: k.slice(0, 2) }, rel: relOf(k), ms: 5 }), 30);
    });
    send('mc:provider', { id: 'fc', name: 'First Contact', version: 1, capabilities: ['read'] });
  }, [RELEASE, BC, TITLES, LENS]);
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await until(() => page.evaluate(() => (window.__mcTest.results().pc || {}).state), s => s === 'done');
  check(await page.evaluate(() => !window.__mcTest.results().fc), 'Ask: the probe doesn\'t compare');
  const btn = page.locator('#mc-root [data-fetch="fc"]');
  check(await btn.count() === 1 && /Compare/.test(await btn.textContent()), 'the Platforms column has a Compare button');
  await btn.click();
  const done = await until(() => page.evaluate(() => { const r = window.__mcTest.results(); return r.fc && r.fc.state === 'done' && window.__pcProbes.length === 2 && r.pc.state === 'done'; }), Boolean);
  check(done, 'the comparison finished and Platform Check was asked again');
  const cmp = await page.evaluate(() => window.__mcTest.cmp());
  console.log(JSON.stringify(cmp));
  const take = Object.fromEntries(cmp.sources.map(s => [s.key, s.take + ':' + s.read]));
  check(take.deezer === 'true:done' && take.qobuz === 'true:done', `the linked platform and the one in its lane are read (${JSON.stringify(take)})`);
  check(take.spotify === 'true:none', 'Spotify is taken, not read');
  check(take.beatport === 'false:none' && take.tidal === 'false:none', 'another barcode, or a track count off, is left out');
  check((await page.evaluate(() => window.__reads)).sort().join() === 'deezer,qobuz', 'only those two were read');

  const cons = await page.evaluate(() => window.__pcProbes[1]);
  console.log(JSON.stringify(cons));
  check(cons && cons.barcode === BC, 'the barcode goes to Platform Check');
  check(cons && JSON.stringify(cons.labels) === JSON.stringify([{ name: 'Artoffact', mbid: null, catno: 'AOF 782', url: null }]), `so do the label and its catalog number (${JSON.stringify(cons && cons.labels)})`);
  check(cons && cons.urls.map(u => u.key).sort().join() === 'deezer,qobuz,spotify', 'and the links taken');
  check(cons && cons.event && cons.event.date.year === 2008 && cons.event.date.day === 29 && cons.event.country === 'XW', `a release event, as the release has none (${JSON.stringify(cons && cons.event)})`);
  check(cons && cons.lengths && cons.lengths.length === 5 && cons.lengths[0].medium === 1 && cons.lengths[4].position === 5 && cons.lengths[2].ms === LENS[2], 'and every track\'s length, as none has one');
  check(cons && JSON.stringify(cons.from) === '["Deezer","Qobuz"]', `naming the platforms read (${cons && cons.from})`);
  check(cmp.isrcs && cmp.isrcs.length === 5 && cmp.isrcs[0] === 'DEX260878200', 'the ISRCs are kept for ISRC Scout, by track');

  const cells = await page.locator('#mc-root .mc-tbl td[data-col="plat"]').allTextContents();
  check(cells.length === 5 && cells.every(c => /\+ \d:\d\d/.test(c)), `each track shows the length it gets (${JSON.stringify(cells)})`);
  check(/≠ title/.test(cells[1]) && !/≠ title/.test(cells[0]), 'the second track\'s title differs ("Remix"), the first doesn\'t');
  await page.locator('#mc-root .mc-tbl tbody tr[data-i="1"] td.ttl').click();
  const insp = await page.locator('#mc-root .mc-insp').textContent();
  check(/Platforms/.test(insp) && /Homes & Gardens \(Remix\)/.test(insp), 'the inspector shows the track\'s versions on the platforms');
  const card = page.locator('#mc-root [data-card="pc"]');
  check(/Compared with/.test(await card.textContent()), 'Platform Check\'s card says the release was compared');
  check(await card.locator('.mc-line:has-text("Release event")').count() === 1 && await card.locator('.mc-line:has-text("Track lengths for")').count() === 1, 'the release event and the track lengths are rows of the Release section');
  const step = await page.locator('#mc-root .mc-step[data-step="fc"]').textContent();
  check(/2 platforms read · 1 track title differs/.test(step), `the step says what it did (${step})`);
  await page.locator('#mc-root').screenshot({ path: 'dev/_782-compare.png' });
});
