import { test, check, functionSource } from '../../../dev/test/harness.mjs';

test('the duplicate release search keeps each answer for the session', { tag: '@unit' }, async () => {
  const source = await functionSource('apollo_editor', ['duplicateReleases']);
  const run = new Function(`
    const ORIGIN = 'https://mb';
    const MBM_SPECIAL_PURPOSE = new Set(['VA']);
    const fold = s => String(s).toLowerCase();
    const Log = { cat: () => ({ debug() {}, warn() {} }) };
    const sent = [];
    let failNext = false;
    const wsJson = async (url) => {
      sent.push(decodeURIComponent(url.replace(/^.*\\/ws\\/2\\/release/, '')));
      if (failNext) { failNext = false; return { json: null }; }
      if (url.includes('query=')) return { json: { releases: url.includes('arid') ? [] : [{ id: 'R1', 'release-group': { id: 'G2' } }] } };
      return { json: { id: 'R1' } };
    };
    const _dupRelCache = new Map(), _dupQueryCache = new Map(), _dupDetailCache = new Map();
    ${source}
    return (async () => {
      failNext = true;
      const a = await duplicateReleases('Album', 'A1', 'G1');      // the artist search fails: no title-only search
      const afterStop = sent.length;
      const b = await duplicateReleases('Album', 'A1', 'G1');      // rerun: both searches and the detail
      const afterRerun = sent.length;
      await duplicateReleases('Album', 'A1', 'G3');                // another group: everything from the cache
      const afterCached = sent.length;
      await duplicateReleases('Other', 'VA', 'G1');                // Various Artists: title only
      return { a: a.length, b: b.length, afterStop, afterRerun, afterCached, va: sent.slice(afterCached) };
    })();
  `);
  const out = await run();
  check(out.a === 0 && out.afterStop === 1, 'a failed artist search sends no title-only search: ' + out.afterStop);
  check(out.b === 1 && out.afterRerun === 4, 'the rerun sends the searches and the detail: ' + out.afterRerun);
  check(out.afterCached === 4, 'a second run takes every answer from the cache: ' + out.afterCached);
  check(out.va.length === 1 && !out.va[0].includes('arid'), 'Various Artists sends the title-only search alone: ' + out.va.join(' | '));
});
