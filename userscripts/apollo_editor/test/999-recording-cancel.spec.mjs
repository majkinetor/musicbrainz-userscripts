import { test, check, functionSource } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm, toTab } from './ap.mjs';

test.use({ gm: apolloGm(null, { xhr: 'fetch' }) });

for (const stage of ['pool', 'positions', 'suggestions']) {
  test('Stop releases recordings waiting on ' + stage, { tag: '@unit' }, async () => {
    const source = await functionSource('apollo_editor', ['autoMatchRecordings', 'matchWait', 'stopMatching']);
    const run = new Function('stage', `
      let _stopGen = 0, _matchStop = false, _matching = false, _autoMatching = false, _autoMatchWaiting = false, _recLastStatus = '';
      const _wsInFlight = 0, _webInFlight = 0, _matchWaits = new Set(), MATCH_STOPPED = {}, _recLeftForYou = new Map();
      const document = { querySelector: () => null, getElementById: () => null };
      const messages = [], Log = { cat: () => ({ info: (...x) => messages.push(x.join(' ')), debug() {}, warn() {} }) };
      const SETTINGS = {}, CUTOFF = { near: 2 }, u = v => typeof v === 'function' ? v() : v;
      let entered, late, writes = 0;
      const reached = new Promise(r => { entered = r; });
      const hold = () => { entered(); return new Promise(r => { late = r; }); };
      const mediums = () => [], mediumLoadedRec = () => true;
      const readRecordings = () => [{ mi: 0, ti: 0, title: 'Track', number: 1 }];
      const release = () => ({ name: '', releaseGroup: stage === 'suggestions' ? null : { gid: 'group' } });
      const acArtistGids = () => [], acNameList = () => [];
      const fetchRgRecordings = () => stage === 'pool' ? hold() : Promise.resolve([]);
      const fetchRgPositionIndex = () => hold();
      const track = { position: 1, suggestedRecordings: () => [], loadingSuggestedRecordings: () => true, setRecordingValue: () => { writes++; } };
      const koTrack = () => track, videoBlockedHere = () => false, fcIsrcFor = () => null, fcHandoff = () => null;
      const recFold = s => s, suggList = () => [], suggStale = () => false;
      const getEditor = () => ({ recordingAssociation: { findRecordingSuggestions: () => { entered(); } } });
      const rerenderRec = () => {};
      ${source}
      return (async () => {
        const pass = autoMatchRecordings();
        pass.catch(() => {});
        await reached;
        stopMatching();
        const ended = await Promise.race([pass.then(() => true), new Promise(r => setTimeout(() => r(false), 400))]);
        const out = { ended, busy: _autoMatching, status: _recLastStatus, writes };
        if (ended && late) late([]);
        return out;
      })();
    `);
    const out = await run(stage);
    check(out.ended && !out.busy && /stopped/.test(out.status), 'Stop restores the idle state without waiting for a response');
    check(out.writes === 0, 'the cancelled pass never links a recording');
  });
}

test('manual recording search remains available during Stop', { tag: '@unit' }, async () => {
  const source = await functionSource('apollo_editor', ['wsGet', 'wsJsonOnce']);
  const run = new Function(`
    let _stopGen = 1, _matchStop = true, _wsInFlight = 0, calls = 0;
    const WS_TRIES = 4, wsLanes = () => 4, wsGateLog = () => {}, _sleep = () => Promise.resolve();
    const Log = { cat: () => ({ debug() {}, warn() {}, err() {} }) };
    const mbnSlot = async o => ({ ok: !o.cancelled() });
    const wsAnswer = async () => ({ throttled: false });
    const mbnWsFetch = async () => { calls++; return { ok: true, status: 200, json: async () => ({ recordings: [] }) }; };
    ${source}
    return (async () => ({ result: await wsJsonOnce('recording', { stale: () => false }), calls }))();
  `);
  const out = await run();
  check(out.calls === 1 && Array.isArray(out.result.json?.recordings), 'a live picker query reaches the transport while the automatic pass is stopped');
});

test('Finish cancels matching before forwarding to MusicBrainz', { tag: '@unit' }, async () => {
  const source = await functionSource('apollo_editor', ['buildNav']);
  const run = new Function(`
    let _matching = false, _autoMatching = true, stops = 0, forwarded;
    const elements = [], element = () => { const e = { dataset: {}, append() {}, appendChild() {}, insertBefore() {} }; elements.push(e); return e; };
    const document = { getElementById: () => null, createElement: element };
    const editor = element(), editorEl = () => editor, navStyle = () => {}, fillNavTitle = () => {};
    const STEP_DEFS = [], PAGE_DEFS = [], DIFF_ICON = '', syncNav = () => {}, ensureApolloEditNote = () => {}, navFooterEl = () => ({});
    const WIZ_DEFS = [{ id: 'finish', label: 'Finish', cls: '', find: () => ({ click: () => { forwarded = _autoMatching; } }) }];
    const stopMatching = () => { stops++; Promise.resolve().then(() => { _autoMatching = false; }); };
    ${source}
    return (async () => {
      buildNav(); elements.find(e => e.dataset.wiz === 'finish').onclick();
      await new Promise(r => setTimeout(r, 10));
      return { stops, forwarded };
    })();
  `);
  const out = await run();
  check(out.stops === 1 && out.forwarded === false, 'Finish stops matching and forwards only after its cancellation cleanup');
});

test('Finish reaches the edit note while recording suggestions never arrive', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.route(/\/ws\/2\/release\?/, r => r.fulfill({ json: { releases: [], count: 0 } }));
  const seed = {
    name: 'Apollo recording Stop fixture', 'artist_credit.names.0.name': 'Various Artists',
    'artist_credit.names.0.mbid': '89ad4ac3-39f7-470e-963a-56509c546377',
    'mediums.0.format': 'CD', 'mediums.0.track.0.name': 'Recording Stop fixture',
    'mediums.0.track.0.length': '2:00',
  };
  const submitted = await openApollo(page, inject, { seed, tab: 'tracklist' });
  await toTab(page, 'recordings');
  await page.evaluate(() => {
    const ed = window.MB.releaseEditor;
    ed.recordingAssociation.findRecordingSuggestions = ko => {
      ko.suggestedRecordings([]); ko.loadingSuggestedRecordings(true); window.__recAsked = true;
    };
    window.__recPass = window.__apolloEditor.autoMatchRecordings();
  });
  await page.waitForFunction(() => window.__recAsked === true);
  await page.evaluate(() => document.querySelector('#tc-nav-wiz [data-wiz="finish"]').click());
  await page.waitForFunction(() => document.querySelector('#release-editor > ul.ui-tabs-nav li.ui-tabs-active a')?.getAttribute('href') === '#edit-note', null, { timeout: 5000 });
  await page.waitForFunction(() => /stopped/.test(document.querySelector('.tc-rec-amstatus')?.textContent || ''), null, { timeout: 5000 });
  check(await page.evaluate(() => window.__apolloEditor.readRecordings().every(r => !r.recGid)), 'stopping to finish leaves every recording unlinked');
  check(submitted.length === 0, 'Finish only navigates to the edit note; nothing is submitted');
});
