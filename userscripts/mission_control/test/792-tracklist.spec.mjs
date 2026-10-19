// #792: a platform without a barcode is taken on its track count, then left out once read when its tracklist is
// another release's: fewer than half the titles and fewer than half the lengths match the release's. It is no
// selected album link of Platform Check's then, and no link the comparison hands it. A transliterated tracklist
// (other titles, the same lengths) stays, and so does one whose barcode is the release's. Stand-ins for Platform
// Check and First Contact give fixed answers, as in 782-compare. Read only.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = '9d290316-dcd3-4d7e-a62b-392ab2396f27';   // "Rushing Pictures": 5 tracks, no barcode
const BC = '4006381333931';
const TITLES = ['Rushing Pictures', 'Homes & Gardens (Remix)', 'Retribution (Edge of Dawn remix)', 'Further Dose (V01d remix)', 'Humanity'];
const LENS = [241000, 302000, 355000, 288000, 199000];
const len = ms => Math.floor(ms / 60000) + ':' + String(Math.round(ms / 1000) % 60).padStart(2, '0');

test('#792: a platform with another release\'s tracklist is left out once read', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  test.setTimeout(120_000);
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(([release, bc, titles, lens]) => {
    const send = (type, d) => document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(d) }));
    const url = k => ({ deezer: 'https://www.deezer.com/album/792', qobuz: 'https://www.qobuz.com/gb-en/album/rushing-pictures/792', amazonmusic: 'https://music.amazon.com/albums/B0000792', ytmusic: 'https://music.youtube.com/playlist?list=OLAK792' })[k];
    window.__pcProbes = []; window.__reads = [];
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
    // Amazon: another album (other titles, lengths far off); YouTube Music: the titles transliterated, the
    // lengths the same; Qobuz: the release's barcode, though its titles and lengths are another's
    const other = ['PITORESUKU', 'OOTONOMII', 'OYASUMI', 'KEKKYOKU', 'SAIGO'];
    const tracks = k => titles.map((t, i) => ({
      title: k === 'amazonmusic' || k === 'qobuz' ? other[i] : k === 'ytmusic' ? 'ラッシング ' + (i + 1) : t,
      lengthMs: k === 'amazonmusic' || k === 'qobuz' ? lens[i] - 60000 - i * 7000 : lens[i] + (k === 'ytmusic' ? 600 : 0),
      credit: [{ name: 'Mind.In.A.Box', join: '' }] }));
    const relOf = k => ({ title: 'Rushing Pictures', credit: [{ name: 'Mind.In.A.Box', join: '' }], types: ['EP'], date: { year: 2008 }, barcode: k === 'deezer' || k === 'qobuz' ? bc : null,
      labels: [], urls: [{ url: url(k), linkType: 85 }], mediums: [{ format: 'Digital Media', tracks: tracks(k) }] });
    document.addEventListener('mc:read', e => {
      const d = JSON.parse(e.detail), k = ['deezer', 'qobuz', 'amazonmusic', 'ytmusic'].find(x => url(x) === d.url);
      window.__reads.push(k);
      setTimeout(() => send('mc:read-result', { url: d.url, run: d.run, ok: true, provider: { id: k, name: k, abbr: k.slice(0, 2) }, rel: relOf(k), ms: 5 }), 30);
    });
    send('mc:provider', { id: 'fc', name: 'First Contact', version: 1, capabilities: ['read'] });
  }, [RELEASE, BC, TITLES, LENS]);
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await until(() => page.evaluate(() => (window.__mcTest.results().pc || {}).state), s => s === 'done');
  // the release's tracks with lengths (the sandbox's have none), so the lengths count
  await page.evaluate(lens => window.__mcTest.release().tracks.forEach((t, i) => { t.len = lens[i]; }), LENS.map(len));
  await page.locator('#mc-root [data-fetch="fc"]').click();
  const done = await until(() => page.evaluate(() => { const r = window.__mcTest.results(); return r.fc && r.fc.state === 'done' && window.__pcProbes.length === 2 && r.pc.state === 'done'; }), Boolean);
  check(done, 'the comparison finished and Platform Check was asked again');
  const cmp = await page.evaluate(() => window.__mcTest.cmp());
  console.log(JSON.stringify(cmp.sources));
  const take = Object.fromEntries(cmp.sources.map(s => [s.key, s.take + ':' + s.read]));
  check((await page.evaluate(() => window.__reads)).sort().join() === 'amazonmusic,deezer,qobuz,ytmusic', 'every platform of the release\'s lane was read');
  check(take.amazonmusic === 'false:done', `Amazon, another tracklist, is left out once read (${take.amazonmusic})`);
  check(take.ytmusic === 'true:done', `YouTube Music, the titles transliterated but the lengths the same, stays (${take.ytmusic})`);
  check(take.qobuz === 'true:done' && take.deezer === 'true:done', `Qobuz, with the release's barcode, stays (${take.qobuz})`);
  const cons = await page.evaluate(() => window.__pcProbes[1]);
  check(cons && cons.urls.map(u => u.key).sort().join() === 'deezer,qobuz,ytmusic', `the links handed to Platform Check leave Amazon out (${cons && cons.urls.map(u => u.key)})`);
  const picked = await page.evaluate(() => window.__mcTest.picked().pc || []);
  check(!picked.includes('amazonmusic') && picked.includes('ytmusic'), `Amazon is no selected album link (${picked})`);
  const why = await page.evaluate(() => (window.__mcTest.results().pc.findings.find(f => f.key === 'amazonmusic') || {}).why || '');
  check(/another tracklist: 0 of 5 titles, 0 of 5 lengths match/.test(why), `its row says why (${why})`);
});
