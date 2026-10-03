// #671: `?falcon=` takes { note, items } as well as a bare array, so a script that hands
// over a batch (Platform Check's artist and label links) can give it its edit note.
import { test, check, functionSource } from '../../../dev/test/harness.mjs';

const b64 = o => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');

async function parser() {
  const src = await functionSource('falcon', ['MBID_RE', 'ENTITY_RE', 'normalizeEntityType', 'tryDecodeBase64Json', 'parseUrlParam']);
  return search => {
    const env = { note: '', logs: [] };
    const run = new Function('location', 'env', 'GM_getValue', 'GM_deleteValue', `
      let _batchNote = '';
      const batchNote = () => String(_batchNote || '').trim();
      const setBatchNote = v => { _batchNote = String(v || ''); env.note = _batchNote; };
      const log = (lvl, msg) => env.logs.push(lvl + ': ' + msg);
      ${src}
      return parseUrlParam();`);
    return { out: run({ search }, env, (k, d) => d, () => {}), env };
  };
}

test('?falcon= reads { note, items } and a bare array', { tag: '@unit' }, async () => {
  const parse = await parser();
  const item = { entityType: 'artist', mbid: 'd31f76d2-1d8e-4271-8027-148f375979d7', url: 'https://www.deezer.com/artist/27', name: 'Daft Punk' };

  let { out, env } = parse('?falcon=' + encodeURIComponent(b64({ note: 'Links from Platform Check — “x”', items: [item] })));
  check(Array.isArray(out) && out.length === 1 && out[0].url === item.url && out[0].name === 'Daft Punk' && out[0].entityType === 'artist', `the items are queued (${JSON.stringify(out)})`);
  check(env.note === 'Links from Platform Check — “x”', `the note becomes the batch edit note (${JSON.stringify(env.note)})`);
  check(out.fromHarmony === false, 'it is not a Harmony seed (Auto start stays off)');

  ({ out, env } = parse('?falcon=' + encodeURIComponent(b64([item]))));
  check(Array.isArray(out) && out.length === 1 && env.note === '', 'a bare array still works, with no note');

  ({ out } = parse('?falcon=' + encodeURIComponent(b64({ note: 'x' }))));
  check(out === null, 'an object without items is no batch');
});
