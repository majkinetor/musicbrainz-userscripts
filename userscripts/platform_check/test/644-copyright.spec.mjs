// #644: a label from a copyright line, without its marks and year. Amazon Music runs the marks
// together ("℗© 2025 Stones Throw Records"), which left "℗©" and the year on the dash.
import { test, check, loadFunctions } from '../../../dev/test/harness.mjs';

test('the label, without ℗/© marks and years, however they are stacked', { tag: ['@unit'] }, async () => {
  const { stripCopyright } = await loadFunctions('platform_check', ['stripCopyright']);
  const cases = [
    ['℗© 2025 Stones Throw Records', 'Stones Throw Records'],          // Amazon Music
    ['(P)(C) 2025 Stones Throw Records', 'Stones Throw Records'],
    ['(P)  2013 Daft Life Limited under exclusive license to Columbia Records', 'Daft Life Limited under exclusive license to Columbia Records'],
    ['℗ 2017 © 2017 Label', 'Label'],
    ['2026 Label', 'Label'],                                               // Tidal: a bare year
    ['© Label', 'Label'],
    ['Stones Throw Records', 'Stones Throw Records'],
    ['℗ 2025', null],
  ];
  for (const [inp, want] of cases) check(stripCopyright(inp) === want, `"${inp}" → ${JSON.stringify(want)} (got ${JSON.stringify(stripCopyright(inp))})`);
});
