// #354: gtinVariants — the zero-padded forms of a barcode an exact-UPC lookup tries.
// Leading zeros are insignificant, so every form is the same GTIN: a match on a padded
// form is never flagged as a different barcode (#182).
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

test('the barcode forms an exact lookup tries', { tag: '@unit' }, async () => {
  const { gtinVariants } = await loadFunctions('platform_check', ['gtinVariants']);
  const same = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), `${what}: ${JSON.stringify(got)}`);
  same(gtinVariants('0602508146107'), ['0602508146107', '602508146107', '00602508146107'], 'a 13-digit EAN with a leading zero: also its UPC-A and 14-digit forms, the raw one first');
  same(gtinVariants('602508146107'), ['602508146107', '0602508146107', '00602508146107'], 'a 12-digit UPC-A: also 13 and 14 digits');
  same(gtinVariants('00602508146107'), ['00602508146107', '602508146107', '0602508146107'], 'a 14-digit GTIN: its 12-digit core, then 13');
  same(gtinVariants('12345'), ['12345'], 'a short fragment: nothing made up');
  same(gtinVariants(' 0602508146107 '), ['0602508146107', '602508146107', '00602508146107'], 'spaces are dropped');
  same(gtinVariants(''), [], 'empty: nothing to try');
  same(gtinVariants(null), [], 'none: nothing to try');
  const core = b => String(b).replace(/\D/g, '').replace(/^0+/, '');
  check(new Set(gtinVariants('0602508146107').map(core)).size === 1, 'every form is the same GTIN');
});
