// #798: the shared matcher's own tests (dev/match/test-artist-match.mjs), the
// candidate ranking among them, run with the @unit specs so CI keeps them.
import { execFileSync } from 'node:child_process';
import { test, check } from '../../../dev/test/harness.mjs';

test('the shared matcher, candidate ranking included', { tag: '@unit' }, async () => {
  let out = '', ok = true;
  try { out = execFileSync(process.execPath, ['dev/match/test-artist-match.mjs'], { encoding: 'utf8' }); }
  catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); ok = false; }
  console.log(out);
  check(ok && /ALL PASS/.test(out), 'dev/match/test-artist-match.mjs passes:\n' + out.split('\n').filter(l => /^FAIL/.test(l)).join('\n'));
  check(/member of the release artist → strong pick/.test(out), 'and runs the #798 ranking cases');
});
