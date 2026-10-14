// #746: Qobuz's newer album pages carry no barcode (their Product "sku" is Qobuz's own id), so the consolidation's Barcode
// field listed Qobuz under "none", though Platform Check had found Qobuz's barcode. A platform whose read gives none now
// votes with the one Platform Check found for it. MC's own vote, run in Node over a stand-in consolidation.
import { test, check, functionSource } from '../../../dev/test/harness.mjs';

test('#746: a platform without a barcode on its page votes with the one Platform Check found', { tag: ['@unit'] }, async () => {
  const src = await functionSource('mission_control', ['ccBc', 'ccCredit', 'ccNone', 'ccRank', 'ccVote', 'ccFields']);
  const rel = barcode => ({ title: 'Sunrise Paradise', credit: [{ name: 'Sunset Vision', join: '' }], date: { year: 2026, month: 10, day: 9 }, labels: [], types: [], barcode });
  const sources = [
    { key: 'beatport', barcode: '5054290231397', read: { rel: rel('5054290231397') } },
    { key: 'deezer', barcode: '5054290231397', read: { rel: rel('5054290231397') } },
    { key: 'qobuz', barcode: '5054290231397', read: { rel: rel(null) } },   // the page has none; Platform Check found it
    { key: 'soundcloud', barcode: null, read: { rel: rel(null) } },          // nobody has one for it
  ];
  const CC = { sources, pc: { findings: sources.map(s => ({ key: s.key })) }, pick: {} };
  const f = new Function('CC', src + '; return ccFields;')(CC)(sources).barcode;
  console.log(JSON.stringify({ win: f.win && f.win.keys, none: f.none }));
  check(f.win && f.win.keys.includes('qobuz') && f.win.keys.length === 3, `Qobuz votes with Platform Check's barcode (${JSON.stringify(f.win && f.win.keys)})`);
  check(JSON.stringify(f.none) === '["soundcloud"]', `only a platform nobody has a barcode for is "none" (${JSON.stringify(f.none)})`);
});
