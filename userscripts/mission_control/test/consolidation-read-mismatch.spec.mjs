import { test, check, functionSource, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

test('consolidation rejects a read with another track count or barcode and updates its lane', { tag: '@unit' }, async () => {
  const src = await functionSource('mission_control', ['ccTracklistVerdict', 'ccTracklistCheck']);
  const own = '894231248122';
  const ref = Array.from({ length: 18 }, (_, i) => ({ title: 'Track ' + i, ms: 180000 }));
  const logs = [];
  const Log = { cat: () => ({ warn: x => logs.push(x), debug: () => {} }) };
  const CC = { sources: [{ barcode: own }] };
  const run = new Function('CC', 'CONS', 'ccTracklistRef', 'ccBc', 'ccCount', 'ccName', 'Log', 'const ccTitleKey = x => x; const CC_LEN_SLACK = 3000; const ccLen = String; ' + src + '; return ccTracklistCheck;')(
    CC, true, () => ref, x => String(x || '').replace(/^0+/, ''), r => r.mediums.flatMap(m => m.tracks).length, x => x, Log);
  const make = (n, barcode) => ({ key: 'beatport', role: 'found', take: true, barcode: null, tracks: null, read: { state: 'done', rel: {
    barcode, mediums: [{ tracks: ref.slice(0, n).map(t => ({ title: t.title, lengthMs: t.ms })) }]
  } } });
  const short = make(3, '5060203987374');
  run(short);
  check(!short.take && /3 tracks, not 18/.test(short.read.other), '3-track Beatport release is left out with a reason');
  check(short.barcode === '5060203987374' && short.tracks === 3, 'read metadata updates barcode grouping and track count');
  const otherBarcode = make(18, '5060203987374');
  run(otherBarcode);
  check(!otherBarcode.take && /barcode/.test(otherBarcode.read.other), 'another barcode is left out even with matching track count');
  const sameBarcode = make(3, own);
  run(sameBarcode);
  check(!sameBarcode.take, 'matching barcode does not override a different track count');
  const forced = make(3, '5060203987374');
  forced.hand = true;
  run(forced);
  check(forced.take && /3 tracks/.test(forced.read.other), 'explicit manual selection is retained with the mismatch');
  check(logs.some(x => /left out: 3 tracks/.test(x)), 'automatic rejection is logged');
});

test('read-result removes the unrelated Beatport album from consolidation votes', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(SANDBOX + '/release/add#mc=beatportregression', { waitUntil: 'domcontentloaded' });
  await inject('mission_control', { waitFor: '__mccTest' });
  await page.evaluate(() => {
    const send = (type, data) => document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(data) }));
    const tracks = Array.from({ length: 18 }, (_, i) => ({ title: 'Track ' + i, lengthMs: 180000, credit: [{ name: 'Various Artists' }] }));
    const rel = { title: 'Afro Cuban Funk', barcode: '894231248122', credit: [{ name: 'Various Artists' }], labels: [], types: [], mediums: [{ format: 'Digital Media', tracks }] };
    send('fc:consolidate', { token: 'beatportregression', source: 'apple', sourceName: 'Apple Music', url: 'https://music.apple.com/us/album/299006364', rel });
    const cc = window.__mccTest.state();
    cc.pc.state = 'done';
    const url = 'https://www.beatport.com/release/diggin-in-the-crates-vol1/2771789';
    cc.sources.push({ key: 'beatport', url, role: 'found', take: true, tracks: null, barcode: null, read: { state: 'reading' } });
    send('mc:read-result', { run: cc.run, url, ok: true, ms: 1, rel: { ...rel, title: 'Diggin in the Crates Vol1', barcode: '5060203987374', mediums: [{ format: 'Digital Media', tracks: tracks.slice(0, 3) }] } });
  });
  const source = await page.evaluate(() => window.__mccTest.state().sources.find(s => s.key === 'beatport'));
  check(!source.take && source.tracks === 3 && source.barcode === '5060203987374', 'reader rejects Beatport and updates its source lane');
  check(await page.locator('#mcc-root [data-cc="take"][data-k="beatport"]').isChecked() === false, 'Beatport checkbox is unselected');
  check(!(await page.locator('#mcc-root .mcc-f[data-field="title"]').textContent()).includes('Vol1'), 'unrelated title no longer votes');
});
