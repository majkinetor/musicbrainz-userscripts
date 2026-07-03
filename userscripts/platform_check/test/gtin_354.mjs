// #354 — gtinVariants: the distinct zero-padded GTIN forms an exact-UPC lookup tries.
import assert from 'node:assert';

// verbatim copy of the source helper
function gtinVariants(barcode) {
    const raw = String(barcode || '').replace(/\D/g, '');
    if (!raw) return [];
    const core = raw.replace(/^0+/, '') || raw;
    const out = [];
    const push = v => { if (v && !out.includes(v)) out.push(v); };
    push(raw);
    push(core);
    if (core.length >= 11 && core.length <= 14) [12, 13, 14].forEach(n => { if (core.length <= n) push(core.padStart(n, '0')); });
    return out;
}

// 13-digit EAN with a leading zero → also its 12-digit UPC-A and 14-digit forms
assert.deepEqual(gtinVariants('0602508146107'), ['0602508146107', '602508146107', '00602508146107']);
// 12-digit UPC-A with no leading zero → also 13 and 14
assert.deepEqual(gtinVariants('602508146107'), ['602508146107', '0602508146107', '00602508146107']);
// 14-digit → strips to the 12-digit core, then also offers the 13-digit form
assert.deepEqual(gtinVariants('00602508146107'), ['00602508146107', '602508146107', '0602508146107']);
// the raw MB barcode is ALWAYS first (preserves current behaviour / logging)
assert.equal(gtinVariants('0602508146107')[0], '0602508146107');
// no fabricated codes from a short fragment — just the raw value, no padding
assert.deepEqual(gtinVariants('12345'), ['12345']);
// hyphens/spaces stripped
assert.deepEqual(gtinVariants(' 0602508146107 '), ['0602508146107', '602508146107', '00602508146107']);
// empty → nothing to try
assert.deepEqual(gtinVariants(''), []);
assert.deepEqual(gtinVariants(null), []);

// every variant normalises to the SAME barcode (leading zeros insignificant) — so
// a padded-variant match is never flagged as a different-barcode mismatch (#182)
const normBarcode = b => String(b || '').replace(/\D/g, '').replace(/^0+/, '');
const vs = gtinVariants('0602508146107');
assert.equal(new Set(vs.map(normBarcode)).size, 1, 'all variants are the same GTIN');

console.log('ALL GTIN #354 TESTS PASSED (' + vs.length + ' variants for the sample)');
