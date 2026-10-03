// #671: `?falcon=` takes Falcon's whole JSON model — what Export writes and Import reads,
// edit note and all, so another script
// (Platform Check's artist and label links) can hand over anything a row can carry.
import { test, check, functionSource } from '../../../dev/test/harness.mjs';

const b64 = o => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const DAFT = 'd31f76d2-1d8e-4271-8027-148f375979d7';

// parseUrlParam for a given location.search
async function parser() {
  const src = await functionSource('falcon', ['MBID_RE', 'ENTITY_RE', 'normalizeEntityType', 'tryDecodeBase64Json', 'parseUrlParam']);
  return search => new Function('location', 'GM_getValue', 'GM_deleteValue', `
    const setBatchNote = () => {}, log = () => {};
    ${src}
    return parseUrlParam();`)({ search }, (k, d) => d, () => {});
}

test('?falcon= is read as an Import', { tag: '@unit' }, async () => {
  const parse = await parser();
  const model = { note: 'Links from Platform Check — “x”', items: [{ entityType: 'artist', mbid: DAFT, name: 'Daft Punk', urls: [{ url: 'https://www.deezer.com/artist/27', linkTypeId: null }] }] };

  let out = parse('?falcon=' + encodeURIComponent(b64(model)));
  check(out && JSON.parse(out.importText).note === model.note, `{ note, items } is read as an Import (${JSON.stringify(out)})`);
  out = parse('?falcon=' + encodeURIComponent(b64(model.items)));
  check(out && out.importText, 'so is a bare array of full items');
  out = parse('?falcon=' + encodeURIComponent(b64([{ entityType: 'recording', mbid: DAFT, isrcs: ['NLTH62000001'] }])));
  check(out && out.importText, '…even one with no links at all (ISRCs only)');

  check(parse('?falcon=not-base64') === null, 'a payload that isn\'t base64 JSON is nothing');
});

test('the model from the URL is queued as Import queues a file, note included', { tag: '@unit' }, async () => {
  const src = await functionSource('falcon', ['MBID_RE', 'ENTITY_RE', 'normalizeEntityType', 'DISAMBIGUATABLE', 'RENAMEABLE', 'normalizeAliases', 'normalizeCoverForImport', 'importQueueJson']);
  const env = new Function(`
    let queue = [], _idSeq = 0, _batchNote = '', added = [];
    const batchNote = () => _batchNote.trim(), setBatchNote = v => { _batchNote = String(v || ''); };
    const syncBatchNoteUi = () => {}, renderQueue = () => {}, resolveMissingNames = () => {}, log = () => {};
    const addToQueue = t => { added.push(...t); return { added: t.length, merged: 0 }; };
    const newCoverEntry = () => ({}), checkExistingCoverArt = () => null;
    ${src}
    return { importQueueJson, get queue() { return queue; }, get note() { return batchNote(); }, get added() { return added; } };`)();
  const model = { note: 'Artist and label links from Platform Check', items: [
    { entityType: 'artist', mbid: DAFT, name: 'Daft Punk', urls: [{ url: 'https://www.deezer.com/artist/27', linkTypeId: null }, { url: 'https://www.discogs.com/artist/1289', linkTypeId: null }] },
    { entityType: 'label', mbid: 'f18f3b31-8263-4de3-966a-b2c5b4e7c3c4', name: 'Daft Life', urls: [{ url: 'https://www.discogs.com/label/1', linkTypeId: null }] },
  ] };
  const r = env.importQueueJson(JSON.stringify(model), 'the falcon= URL');
  check(r.added === 2 && env.queue.length === 2, `one row per entity (${JSON.stringify(r)})`);
  check(env.queue[0].urls.length === 2 && env.queue[0].name === 'Daft Punk' && env.queue[0].status === 'queued' && env.queue[1].entityType === 'label', 'each with all its links, queued, not run');
  check(env.note === model.note, `the note is the batch edit note (${JSON.stringify(env.note)})`);
  env.importQueueJson(JSON.stringify([{ entityType: 'artist', mbid: DAFT, url: 'https://x/1', name: 'Daft Punk' }]), 'x');
  check(env.added[0] && env.added[0].name === 'Daft Punk', 'a flat row keeps its name');
});
