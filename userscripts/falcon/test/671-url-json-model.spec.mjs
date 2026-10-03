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

// #671: majkinetor's batch reached Falcon three times and each artist ran three times over.
// A handed-over batch now merges into what's queued; a file Import still restores as it was.
test('a batch handed over again merges into the queue; it names the session', { tag: '@unit' }, async () => {
  const src = await functionSource('falcon', ['MBID_RE', 'ENTITY_RE', 'normalizeEntityType', 'DISAMBIGUATABLE', 'RENAMEABLE', 'normalizeAliases', 'normalizeCoverForImport', 'importQueueJson']);
  const env = new Function(`
    let queue = [], _idSeq = 0, _batchNote = '', _batchName = '', named = [];
    const batchNote = () => _batchNote.trim(), setBatchNote = v => { _batchNote = String(v || ''); };
    const syncBatchNoteUi = () => {}, renderQueue = () => {}, resolveMissingNames = () => {}, log = () => {}, dbg = () => {};
    const noteSessionReleaseName = n => named.push(n);
    const addToQueue = t => ({ added: t.length, merged: 0 });
    const newCoverEntry = () => ({}), checkExistingCoverArt = () => null;
    ${src}
    return { importQueueJson, get queue() { return queue; }, get name() { return _batchName; }, get named() { return named; } };`)();
  const batch = urls => JSON.stringify({ name: 'De Gulden Snede — artist and label links', note: 'n', items: [{ entityType: 'artist', mbid: DAFT, name: 'Daft Punk', urls: urls.map(url => ({ url, linkTypeId: null })) }] });
  env.importQueueJson(batch(['https://www.deezer.com/artist/27']), 'a script on this page', { merge: true });
  const r = env.importQueueJson(batch(['https://www.deezer.com/artist/27', 'https://www.discogs.com/artist/1289']), 'a script on this page', { merge: true });
  check(env.queue.length === 1 && env.queue[0].urls.length === 2 && r.added === 0 && r.merged === 1, `sent again: one item, the new link merged into it (${JSON.stringify({ n: env.queue.length, urls: env.queue[0].urls.length, r })})`);
  env.importQueueJson(batch(['https://www.deezer.com/artist/27']), 'file.json');
  check(env.queue.length === 2, 'a file Import restores its rows as they are');
  check(env.name === 'De Gulden Snede — artist and label links' && env.named.includes(env.name), `the model's name names the session (${env.name})`);
});

test('one platform page under any of its url forms', { tag: '@unit' }, async () => {
  const src = await functionSource('falcon', ['platformPageKey', 'equivalentExistingUrl']);
  const f = new Function('isOurs', src + '\nreturn { platformPageKey, equivalentExistingUrl };')(tr => !!tr.ours);
  const k = f.platformPageKey;
  check(k('https://www.qobuz.com/us-en/interpreter/pink-floyd/38324') === k('https://www.qobuz.com/gb-en/interpreter/pink-floyd/38324')
    && k('https://open.qobuz.com/artist/38324') === k('https://www.qobuz.com/gb-en/interpreter/pink-floyd/38324'), 'Qobuz: any locale, and open.qobuz.com');
  check(k('https://www.qobuz.com/us-en/interpreter/blink-182/12345') === 'qobuz:artist:12345', 'the id, not a number in the slug');
  check(k('https://www.qobuz.com/us-en/label/x/download-streaming-albums/7') === 'qobuz:label:7' && k('https://www.qobuz.com/us-en/label/x/download-streaming-albums/7') !== k('https://open.qobuz.com/artist/7'), 'a label is not the artist of the same number');
  check(k('https://music.apple.com/us/artist/487143') === k('https://music.apple.com/gb/artist/pink-floyd/487143') && k('https://itunes.apple.com/gb/artist/id487143') === 'apple:artist:487143', 'Apple Music: any storefront, slug or not, itunes.apple.com');
  check(k('https://www.discogs.com/artist/1') === null && k('nonsense') === null, 'others: no equivalence');
  const row = (href, ours) => ({ ours, querySelector: () => ({ getAttribute: () => href }) });
  const doc = { querySelectorAll: () => [row('https://www.qobuz.com/us-en/interpreter/x/9', true), row('https://music.apple.com/gb/artist/5', false)] };
  check(f.equivalentExistingUrl(doc, 'https://music.apple.com/us/artist/5') === 'https://music.apple.com/gb/artist/5', 'the link already on the entity is found');
  check(f.equivalentExistingUrl(doc, 'https://www.qobuz.com/gb-en/interpreter/x/9') === null, 'one Falcon seeded itself is not "already there"');
});
