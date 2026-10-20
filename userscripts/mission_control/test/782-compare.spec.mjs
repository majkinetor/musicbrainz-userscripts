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
    // what Execute hands Platform Check, answered at once
    window.__applies = [];
    document.addEventListener('mc:apply', e => {
      const d = JSON.parse(e.detail);
      if (d.id !== 'pc') return;
      window.__applies.push(d);
      setTimeout(() => send('mc:applied', { id: 'pc', run: d.run, release, ok: true, sent: 1, note: 'stand-in' }), 20);
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
  check(cons && JSON.stringify(cons.labels) === JSON.stringify([{ name: 'Artoffact', mbid: null, catno: 'AOF 782', url: null, from: ['deezer', 'qobuz'] }]), `so do the label and its catalog number (${JSON.stringify(cons && cons.labels)})`);
  check(cons && cons.urls.map(u => u.key).sort().join() === 'deezer,qobuz,spotify', 'and the links taken');
  check(cons && JSON.stringify(cons.barcodeFrom) === '["deezer","qobuz"]' && JSON.stringify(cons.lengthsFrom) === '["deezer","qobuz"]' && JSON.stringify(cons.event.from) === '["deezer","qobuz"]', `each value names its own platforms (${JSON.stringify(cons && [cons.barcodeFrom, cons.lengthsFrom, cons.event && cons.event.from])})`);
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
  // ≠ title opens, under the track, what each platform gives; Expand all opens them as it does Fusion's
  // the lines under track 2 are rows of the Tracks table (tr.mc-pfr), there only while it is open
  const sub = page.locator('#mc-root .mc-tbl tbody'), subRows = page.locator('#mc-root .mc-tbl tr.mc-pfr[data-pfr="1"]');
  check(await subRows.count() === 0, 'the platforms\' titles are folded at first');
  await page.locator('#mc-root .mc-tbl tr[data-i="1"] td[data-col="plat"] [data-act="fx-pf"]').click();
  const lines = await subRows.allTextContents();
  const icons = await subRows.nth(1).locator('.mcc-icos > span').evaluateAll(s => s.map(x => x.title));
  // each value in its column: the version's title under Title, its icons under Platforms
  const cols = await subRows.nth(1).evaluate(r => { const hs = [...r.closest('table').querySelectorAll('thead th')].map(h => h.textContent.trim()); return { title: hs[[...r.cells].findIndex(c => /Homes/.test(c.textContent))], icons: hs[[...r.cells].findIndex(c => c.querySelector('.mcc-icos'))] }; });
  check(/^Title/i.test(cols.title) && /^Platforms/.test(cols.icons), `the line's title is under Title, its platforms under Platforms (${JSON.stringify(cols)})`);
  const x0 = await page.evaluate(() => { const r = document.querySelector('#mc-root .mc-tbl tr[data-i="1"] td.ttl').getBoundingClientRect(), i = document.querySelector('#mc-root [data-pf-title="1"]'), st = getComputedStyle(i); return [Math.round(r.left + parseFloat(getComputedStyle(document.querySelector('#mc-root .mc-tbl tr[data-i="1"] td.ttl')).paddingLeft)), Math.round(i.getBoundingClientRect().left + parseFloat(st.paddingLeft) + parseFloat(st.borderLeftWidth))]; });
  check(Math.abs(x0[0] - x0[1]) <= 1, `the box's text starts where the track's title does (${x0})`);
  check(lines.length === 2 && /Homes & Gardens \(Remix\)/.test(lines[1]) && icons.join() === 'Deezer,Qobuz', `under the track, one line for what Deezer and Qobuz both give, their icons on the right (${JSON.stringify(lines)} ${icons})`);
  await page.locator('#mc-root .mc-tbl tr[data-i="1"] td[data-col="plat"] [data-act="fx-pf"]').click();
  check(await subRows.count() === 0, 'a second click folds it');
  const all = page.locator('#mc-root .mc-fxall [data-act="fx-all"]');
  check(/Expand all/.test(await all.textContent()), 'the Tracks header offers Expand all');
  await all.click();
  check(await subRows.count() === 2 && /Collapse all/.test(await all.textContent()), 'Expand all opens it, and turns into Collapse all');
  await page.locator('#mc-root').screenshot({ path: 'dev/_782-expanded.png' });
  await all.click();
  check(await subRows.count() === 0, 'Collapse all folds it');

  // a title and a length taken in: a click on a platform's, or typed on the track's own line
  await page.locator('#mc-root .mc-tbl tr[data-i="1"] td[data-col="plat"] [data-act="fx-pf"]').click();
  const before = await page.evaluate(() => document.querySelector('#mc-root [data-act="exec"]').textContent);
  await sub.locator('[data-act="fx-take"][data-what="title"][data-k="deezer"]').click();
  let st = await page.evaluate(() => window.__mcTest.cmp());
  check(st.picks[1] && st.picks[1].title === 'Homes & Gardens (Remix)' && st.picks[1].from.title === 'Deezer, Qobuz', `a click takes Deezer's title, naming every platform that gives it (${JSON.stringify(st.picks)})`);
  check(await sub.locator('[data-act="fx-take"][data-what="title"].on').count() === 1 && await subRows.count() === 2, 'the platforms giving the same are one line, shown taken');
  check(await sub.locator('[data-pf-title="1"]').inputValue() === 'Homes & Gardens (Remix)', 'the track\'s own line holds it');
  check(/→ Homes & Gardens \(Remix\)/.test(await page.locator('#mc-root .mc-tbl tr[data-i="1"] td[data-col="plat"]').textContent()), 'the column shows what the track gets');
  check(await page.locator('#mc-root .mc-tbl tr[data-i="1"]').evaluate(r => r.classList.contains('chg')), 'the track counts as changed');
  const after = await page.evaluate(() => document.querySelector('#mc-root [data-act="exec"]').textContent);
  check(+after.replace(/\D/g, '') === +before.replace(/\D/g, '') + 1, `Execute counts it (${before} → ${after})`);
  await sub.locator('[data-pf-len="1"]').fill('5:10');
  await sub.locator('[data-pf-len="1"]').press('Enter');
  await sub.locator('[data-pf-rec="1"]').check();
  st = await page.evaluate(() => window.__mcTest.cmp());
  check(st.picks[1].ms === 310000 && st.picks[1].recording === true, `a typed length, and the recording's title too (${JSON.stringify(st.picks[1])})`);
  await sub.locator('[data-pf-len="1"]').fill('soon');
  await sub.locator('[data-pf-len="1"]').press('Enter');
  check((await page.evaluate(() => window.__mcTest.cmp())).picks[1].ms === 310000 && await sub.locator('[data-pf-len="1"]').inputValue() === '5:10', 'what isn\'t a length is put back');
  await page.locator('#mc-root').screenshot({ path: 'dev/_782-picked.png' });
  await page.click('#mc-root [data-act="exec"]');
  const applied = await until(() => page.evaluate(() => window.__applies[0] || null), Boolean);
  const tr = applied && applied.tracks;
  console.log(JSON.stringify(tr));
  check(tr && tr.length === 1 && tr[0].medium === 1 && tr[0].position === 2 && tr[0].title === 'Homes & Gardens (Remix)' && tr[0].recording === true && tr[0].ms === 310000, 'Execute hands Platform Check the track\'s title, the recording\'s and its length');
  check(tr && tr[0].was.title === 'Homes & Gardens (remix)' && tr[0].was.ms === null && /Deezer, Qobuz/.test(tr[0].from), `with what the track had, and where it came from (${JSON.stringify(tr && tr[0])})`);
  await until(() => page.evaluate(() => !Object.keys(window.__mcTest.cmp().picks).length), Boolean);
  check(!Object.keys((await page.evaluate(() => window.__mcTest.cmp())).picks).length, 'once sent, the track is as it was again');
  // #785: Aa beside the title shows the guess case of what the box holds, and a click takes it in
  if (!(await subRows.count())) await page.locator('#mc-root .mc-tbl tr[data-i="1"] td[data-col="plat"] [data-act="fx-pf"]').click();
  await sub.locator('[data-pf-title="1"]').fill('homes and gardens of KoRn (Official Music Video)');
  await sub.locator('[data-pf-title="1"]').press('Enter');
  const aa = sub.locator('[data-act="fx-gc"][data-i="1"]');
  const want = 'Homes and Gardens of KoRn (official music video)';
  const tip = await until(() => aa.getAttribute('data-tip'), t => (t || '').includes(want));
  check((tip || '').includes('Guess case (English) → ' + want), `Aa shows the guess (${tip})`);
  await aa.click();
  st = await page.evaluate(() => window.__mcTest.cmp());
  check(st.picks[1] && st.picks[1].title === want && await sub.locator('[data-pf-title="1"]').inputValue() === want, `a click takes it in (${JSON.stringify(st.picks[1])})`);
  check(/same/.test(await aa.getAttribute('class')), 'then Aa shows the title is as guess case writes it');
  await page.locator('#mc-root .mc-tbl').screenshot({ path: 'dev/_785-aa.png' });
  const card = page.locator('#mc-root [data-card="pc"]');
  check(/Compared with/.test(await card.textContent()), 'Platform Check\'s card says the release was compared');
  check(await card.locator('.mc-line:has-text("Release event")').count() === 1 && await card.locator('.mc-line:has-text("Track lengths for")').count() === 1, 'the release event and the track lengths are rows of the Release section');
  const step = await page.locator('#mc-root .mc-step[data-step="fc"]').textContent();
  check(/2 platforms read · 1 track title differs/.test(step), `the step says what it did (${step})`);
  await page.locator('#mc-root').screenshot({ path: 'dev/_782-compare.png' });
});
