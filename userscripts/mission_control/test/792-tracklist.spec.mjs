// #792: a platform Platform Check takes on its track count alone (no barcode) is no selected album link until
// First Contact has read it, on every probe, and stays unselected without First Contact. Read, it is left out when
// its tracklist is another release's: fewer than half the lengths match the release's, even with every title the
// same (another version of the album). A transliterated tracklist (other titles, the same lengths) is selected, and a platform with the
// release's barcode is never held. Compare reuses those reads and leaves the other release out of what it hands
// Platform Check. Stand-ins for Platform Check and First Contact give fixed answers, as in 782-compare. Read only.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = '9d290316-dcd3-4d7e-a62b-392ab2396f27';   // "Rushing Pictures": 5 tracks, no barcode
const BC = '4006381333931';
const TITLES = ['Rushing Pictures', 'Homes & Gardens (Remix)', 'Retribution (Edge of Dawn remix)', 'Further Dose (V01d remix)', 'Humanity'];
const LENS = [241000, 302000, 355000, 288000, 199000];
const len = ms => Math.floor(ms / 60000) + ':' + String(Math.round(ms / 1000) % 60).padStart(2, '0');

// the stand-ins; First Contact answers only once announced (window.__fc()), and holds its reads while __hold is set
async function setup(page, inject) {
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(([release, bc, titles, lens]) => {
    const send = (type, d) => document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(d) }));
    const url = k => ({ deezer: 'https://www.deezer.com/album/792', qobuz: 'https://www.qobuz.com/gb-en/album/rushing-pictures/792', amazonmusic: 'https://music.amazon.com/albums/B0000792', ytmusic: 'https://music.youtube.com/playlist?list=OLAK792' })[k];
    window.__pcProbes = []; window.__reads = []; window.__held = [];
    // Deezer linked; Qobuz with the release's barcode; Amazon and YouTube Music without one, as many tracks
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      if (!d.only.includes('pc')) return;
      window.__pcProbes.push(d.cons || null);
      const fs = [
        { key: 'deezer', name: 'Deezer', url: url('deezer'), barcode: bc, state: 'linked' },
        { key: 'qobuz', name: 'Qobuz', url: url('qobuz'), barcode: bc, tracks: 5, state: 'new' },
        { key: 'amazonmusic', name: 'Amazon Music', url: url('amazonmusic'), tracks: 5, state: 'new' },
        { key: 'ytmusic', name: 'YouTube Music', url: url('ytmusic'), tracks: 5, state: 'new' },
      ];
      setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, release, findings: fs, barcode: bc }), 50);
    });
    send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, release, capabilities: ['probe', 'apply'] });
    // Amazon: another version (the same titles, lengths far off); YouTube Music: the titles transliterated, the
    // lengths the same; Qobuz: the release's barcode, though its titles and lengths are another's
    const other = ['PITORESUKU', 'OOTONOMII', 'OYASUMI', 'KEKKYOKU', 'SAIGO'];
    const tracks = k => titles.map((t, i) => ({
      title: k === 'qobuz' ? other[i] : k === 'ytmusic' ? 'ラッシング ' + (i + 1) : t,
      lengthMs: k === 'amazonmusic' || k === 'qobuz' ? lens[i] - 60000 - i * 7000 : lens[i] + (k === 'ytmusic' ? 600 : 0),
      credit: [{ name: 'Mind.In.A.Box', join: '' }] }));
    const relOf = k => ({ title: 'Rushing Pictures', credit: [{ name: 'Mind.In.A.Box', join: '' }], types: ['EP'], date: { year: 2008 }, barcode: k === 'deezer' || k === 'qobuz' ? bc : null,
      labels: [], urls: [{ url: url(k), linkType: 85 }], mediums: [{ format: 'Digital Media', tracks: tracks(k) }] });
    const answer = d => { const k = ['deezer', 'qobuz', 'amazonmusic', 'ytmusic'].find(x => url(x) === d.url); send('mc:read-result', { url: d.url, run: d.run, ok: true, provider: { id: k, name: k, abbr: k.slice(0, 2) }, rel: relOf(k), ms: 5 }); };
    window.__release = () => { window.__hold = false; window.__held.splice(0).forEach(answer); };
    window.__fc = () => {
      document.addEventListener('mc:read', e => {
        const d = JSON.parse(e.detail);
        window.__reads.push(['deezer', 'qobuz', 'amazonmusic', 'ytmusic'].find(x => url(x) === d.url));
        if (window.__hold) window.__held.push(d); else setTimeout(() => answer(d), 30);
      });
      send('mc:provider', { id: 'fc', name: 'First Contact', version: 1, capabilities: ['read'] });
    };
  }, [RELEASE, BC, TITLES, LENS]);
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  // the release's tracks with lengths (the sandbox's have none), so the lengths count
  await page.evaluate(lens => window.__mcTest.release().tracks.forEach((t, i) => { t.len = lens[i]; }), LENS.map(len));
  await until(() => page.evaluate(() => (window.__mcTest.results().pc || {}).state), s => s === 'done');
}
const picked = page => page.evaluate(() => window.__mcTest.picked().pc || []);
const why = (page, k) => page.evaluate(k => (window.__mcTest.results().pc.findings.find(f => f.key === k) || {}).why || '', k);

test('#792: a platform taken on its track count is unselected until First Contact has read it', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  test.setTimeout(120_000);
  await setup(page, inject);
  let p = await until(() => picked(page), x => x.includes('qobuz'));
  check(p.includes('qobuz') && !p.includes('amazonmusic') && !p.includes('ytmusic'), `without First Contact, only the platform with the release's barcode is selected (${p})`);
  check(/First Contact isn't installed/.test(await why(page, 'ytmusic')), `the row says why (${await why(page, 'ytmusic')})`);
  check(!(await page.evaluate(() => window.__mcTest.results().fc)), 'the Platforms step is still Ask: no comparison ran');
  // First Contact comes: the two are read, nothing else; held, they stay unselected
  await page.evaluate(() => { window.__hold = true; window.__fc(); });
  const reads = await until(() => page.evaluate(() => window.__reads.slice().sort().join()), r => r === 'amazonmusic,ytmusic');
  check(reads === 'amazonmusic,ytmusic', `only the platforms without a barcode are read (${reads})`);
  p = await picked(page);
  check(!p.includes('amazonmusic') && !p.includes('ytmusic'), `unselected while they are read (${p})`);
  check(/until First Contact has read/.test(await why(page, 'amazonmusic')), `the row says so (${await why(page, 'amazonmusic')})`);
  await page.evaluate(() => window.__release());
  p = await until(() => picked(page), x => x.includes('ytmusic'));
  check(p.includes('ytmusic') && !p.includes('amazonmusic'), `read, YouTube Music (the same lengths) is selected, Amazon not (${p})`);
  const w = await why(page, 'amazonmusic');
  check(/another tracklist: 5 of 5 titles, 0 of 5 lengths match/.test(w) && !/until First Contact/.test(w), `Amazon's row says why (${w})`);
  check(!/tracklist|First Contact/.test(await why(page, 'ytmusic')), 'YouTube Music\'s row has no note left');
});

test('#792: Compare leaves out a platform with another release\'s tracklist and reads nothing twice', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  test.setTimeout(120_000);
  await setup(page, inject);
  await page.evaluate(() => window.__fc());
  await until(() => picked(page), x => x.includes('ytmusic'));
  await page.locator('#mc-root [data-fetch="fc"]').click();
  const done = await until(() => page.evaluate(() => { const r = window.__mcTest.results(); return r.fc && r.fc.state === 'done' && window.__pcProbes.length === 2 && r.pc.state === 'done'; }), Boolean);
  check(done, 'the comparison finished and Platform Check was asked again');
  const cmp = await page.evaluate(() => window.__mcTest.cmp());
  console.log(JSON.stringify(cmp.sources));
  const take = Object.fromEntries(cmp.sources.map(s => [s.key, s.take + ':' + s.read]));
  const reads = await page.evaluate(() => window.__reads.slice().sort().join());
  check(reads === 'amazonmusic,deezer,qobuz,ytmusic', `each platform read once (${reads})`);
  check(take.amazonmusic === 'false:done', `Amazon, another tracklist, is left out (${take.amazonmusic})`);
  check(take.ytmusic === 'true:done', `YouTube Music, the titles transliterated but the lengths the same, stays (${take.ytmusic})`);
  check(take.qobuz === 'true:done' && take.deezer === 'true:done', `Qobuz, with the release's barcode, stays (${take.qobuz})`);
  const cons = await page.evaluate(() => window.__pcProbes[1]);
  check(cons && cons.urls.map(u => u.key).sort().join() === 'deezer,qobuz,ytmusic', `the links handed to Platform Check leave Amazon out (${cons && cons.urls.map(u => u.key)})`);
  const p = await picked(page);
  check(!p.includes('amazonmusic') && p.includes('ytmusic') && p.includes('qobuz'), `Platform Check's findings again: Amazon still unselected, the others selected (${p})`);
});
