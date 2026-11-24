// The shared MusicBrainz request gate (#633), in two tabs of one origin, with fetch stubbed:
// nothing reaches MusicBrainz. The pages are a local stand-in origin (Web Locks need a secure
// one), served by a route — no network.
import { test, check } from '../test/harness.mjs';
import { MBN_INLINE, mbnGated } from './mb-gate.mjs';

test.use({ profile: 'fresh', gm: false });

const ORIGIN = 'https://gate.test';
// the specs below time the gate's logic at the old pace, a burst of three then one a second;
// the shipped pace has its own spec, with the real constants
// #1112: no jitter and no search line here, so the pace and hold specs measure exact times; the search
// line has its own spec, with its real constants
const CONSTS = { ...MBN_INLINE.consts, MBN_GAP: 1000, MBN_BURST: 3, MBN_JITTER: 0, MBN_SGAP_MIN: 0 };
const GATE = Object.entries(CONSTS).map(([k, v]) => `const ${k} = ${JSON.stringify(v)};`).join('\n') + '\n'
  + MBN_INLINE.fns.map(f => f.toString()).join('\n')
  // the stub: each call records its start; a queued status list decides the answers (default 200)
  + `\nwindow.__starts = []; window.__answers = [];
     window.fetch = async (url) => { window.__starts.push(Date.now()); const st = window.__answers.shift() || 200;
       return new Response('{}', { status: st, headers: st === 503 ? { 'Retry-After': '2' } : {} }); };
     Object.assign(window, { mbnSlot, mbnLead, mbnAnswer, mbnFetch, mbnState, mbnHot });`;

async function tab(context) {
  const p = await context.newPage();
  await p.goto(ORIGIN + '/');
  await p.addScriptTag({ content: GATE });
  return p;
}

test.beforeEach(async ({ context }) => {
  await context.route(ORIGIN + '/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>gate</title>' }));
});

test('the same read asked twice in one moment is one request, the cache lookup between them included', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context);
  const n = await a.evaluate(async () => {
    const u = 'https://musicbrainz.org/ws/2/url?resource=https%3A%2F%2Fa.test%2F&inc=artist-rels&fmt=json';
    await Promise.all([mbnFetch(u), mbnFetch(u)]);
    return window.__starts.length;
  });
  check(n === 1, `one request for both (${n})`);
});

test('a lookup with recordings answers a lighter lookup, by join and from the cache; a browse does not', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context);
  const n = await a.evaluate(async () => {
    const id = '0f1e2d3c-4b5a-4968-8776-a5b4c3d2e1f0', ws = 'https://musicbrainz.org/ws/2/';
    const out = {};
    await Promise.all([mbnFetch(ws + 'release/' + id + '?inc=recordings+isrcs&fmt=json'), mbnFetch(ws + 'release/' + id + '?inc=artist-credits&fmt=json')]);
    out.join = window.__starts.length;
    await mbnFetch(ws + 'release/' + id + '?fmt=json');
    out.cache = window.__starts.length;
    await mbnFetch(ws + 'recording?release=' + id + '&inc=isrcs&fmt=json');
    await mbnFetch(ws + 'recording?release=' + id + '&fmt=json');
    out.browse = window.__starts.length;
    await mbnFetch(ws + 'artist/' + id + '?inc=user-tags&fmt=json');
    await mbnFetch(ws + 'artist/' + id + '?fmt=json');
    out.user = window.__starts.length;
    await Promise.all([mbnFetch(ws + 'label/' + id + '?inc=aliases&fmt=json'), mbnFetch(ws + 'label/' + id + '?inc=user-tags&fmt=json')]);
    out.merge = window.__starts.length;
    return out;
  });
  check(n.join === 2, `the lighter lookup joins the one with recordings (${n.join} requests)`);
  check(n.cache === 2, `a later lighter lookup comes from the cache (${n.cache})`);
  check(n.browse === 4, `a browse with isrcs does not answer one without (${n.browse})`);
  check(n.user === 5, `a lookup with user-tags answers a lighter one too (${n.user})`);
  check(n.merge === 6, `a read with user-tags merges with one without (${n.merge})`);
});

// gate log: Event Horizon's background read queued behind another script's lead while the page's own read of the same
// entity went past it and came back; after the lead it sent its own anyway (and Fuzzy Logic sent into a 503 that way)
test('a read that waited sends nothing when a twin answered meanwhile, from the cache or still on its way', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context);
  const n = await a.evaluate(async () => {
    const ws = 'https://musicbrainz.org/ws/2/release/', out = {};
    const read = async (id, slow) => {
      window.__starts = [];
      await mbnLead('other-script', 1200);
      const bg = mbnFetch(ws + id + '?inc=labels&fmt=json');
      await new Promise(r => setTimeout(r, 300));   // past its own cache lookup: it is queued behind the lead
      const real = window.fetch;
      if (slow) window.fetch = async u => { window.__starts.push(Date.now()); await new Promise(r => setTimeout(r, 2000)); return new Response('{}', { status: 200 }); };
      const page = mbnFetch(ws + id + '?inc=labels&fmt=json', null, { background: false });
      const [x, y] = await Promise.all([bg, page]);
      window.fetch = real;
      await mbnLead('other-script', 0);
      return { starts: window.__starts.length, ok: x.ok && y.ok };
    };
    out.cache = await read('1a2b3c4d-0000-4000-8000-000000000001', false);
    out.join = await read('1a2b3c4d-0000-4000-8000-000000000002', true);
    return out;
  });
  check(n.cache.ok && n.cache.starts === 1, `answered from the cache the page's read filled (${JSON.stringify(n.cache)})`);
  check(n.join.ok && n.join.starts === 1, `joins the page's read still on its way (${JSON.stringify(n.join)})`);
});

test('o.send sends the request in place of fetch',{ tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context);
  const r = await a.evaluate(async () => {
    const sent = [];
    const send = async (u, init) => { sent.push(u + ' ' + init.method); return new Response('{"ok":1}', { status: 200 }); };
    const res = await mbnFetch('https://musicbrainz.org/ws/2/isrc/X?fmt=json', { method: 'POST', body: 'x' }, { send });
    return { sent, body: await res.json(), fetched: window.__starts.length };
  });
  check(r.sent.length === 1 && / POST$/.test(r.sent[0]) && r.body.ok === 1 && r.fetched === 0, `the answer comes from o.send, fetch is not called (${JSON.stringify(r)})`);
});

test('a hidden tab\'s background request waits for the queue to be free; a page request does not', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context);
  const r = await a.evaluate(async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    await mbnState(s => { s.tat = Date.now() + 1500; });
    const t0 = Date.now();
    const page = mbnSlot({ background: false }).then(() => Date.now() - t0);
    const bg = mbnSlot({}).then(() => Date.now() - t0);
    const ev = (globalThis.__mbnTrace.buf || []).find(e => e.e === 'hidden') || {};
    return { page: await page, bg: await bg, cap: ev.cap };
  });
  check(r.cap >= 9000, `the log says how long it may wait at most, not only the queue end it saw (${r.cap})`);
  check(r.page < 300, `the page request starts at once (${r.page} ms)`);
  check(r.bg >= 1300, `the background request waits for the queue to end (${r.bg} ms)`);
});

test('a lock bridge ignoring abort cannot retain the gate or book twice', { tag: '@unit' }, async ({ context }) => {
  const a = await tab(context);
  const got = await a.evaluate(async () => {
    let grant, writes = 0;
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (key, opts, fn) => new Promise(resolve => { grant = () => resolve(fn()); }) } });
    // the real 3s watchdog: mbnSleep checks the clock, so a shortened timer would not end it (#999)
    const answer = await Promise.race([mbnState(s => { writes++; s.tat = 123; return 'ready'; }), new Promise(r => setTimeout(() => r('hung'), 5000))]);
    grant();
    await Promise.resolve();
    return { answer, writes, tat: JSON.parse(localStorage.getItem('mbu:mb-gate') || '{}').tat };
  });
  check(got.answer === 'ready', 'the watchdog releases the caller even when abort has no effect');
  check(got.writes === 1 && got.tat === 123, 'a delayed lock grant does not repeat the state change');
});

test('version 1 upgrades a legacy schedule without resetting holds or extension fields', { tag: '@unit' }, async ({ context }) => {
  const a = await tab(context);
  const got = await a.evaluate(async () => {
    localStorage.setItem('mbu:mb-gate', JSON.stringify({ tat: 123, cool: 456, hot: 2, extension: 'kept' }));
    await mbnState(() => {});
    const legacy = JSON.parse(localStorage.getItem('mbu:mb-gate'));
    const future = JSON.stringify({ version: 2, tat: 789 }); localStorage.setItem('mbu:mb-gate', future);
    let refused = false; try { await mbnState(() => {}); } catch (e) { refused = /Unsupported/.test(e.message); }
    return { legacy, refused, unchanged: localStorage.getItem('mbu:mb-gate') === future };
  });
  check(got.legacy.version === 1 && got.legacy.tat === 123 && got.legacy.cool === 456 && got.legacy.hot === 2 && got.legacy.extension === 'kept', 'legacy schedule is stamped, preserving budget, hold and unknown fields');
  check(got.refused && got.unchanged, 'an unknown version is rejected without overwriting its schedule');
});

test('the gate paces starts, a burst first, then one a second', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context);
  const starts = await a.evaluate(async () => {
    localStorage.clear();
    const t0 = Date.now();
    await Promise.all(Array.from({ length: 6 }, (_, i) => mbnFetch('/ws/2/artist?query=x' + i)));
    return window.__starts.map(t => t - t0).sort((x, y) => x - y);
  });
  // measured from the first start, not from t0: a slow runner delays the whole burst
  check(starts[2] - starts[0] < 300, `the first three start at once (${starts.join(', ')} ms)`);
  const gaps = starts.slice(3).map((t, i) => t - starts[i + 2]);
  check(gaps.every(g => g >= 900 && g <= 1400), `then a second apart (${gaps.join(', ')} ms)`);
  check(await a.evaluate(() => mbnGated('/ws/2/x') && mbnGated('https://test.musicbrainz.org/ws/2/x') && !mbnGated('/ws/js/entity/x') && !mbnGated('https://example.org/ws/2/x')), 'only /ws/2 on MusicBrainz is gated');
  check(mbnGated('https://musicbrainz.org/ws/2/recording/x'), '…production included');
  check(mbnGated('//musicbrainz.org/ws/2/artist/x') && mbnGated('//test.musicbrainz.org/ws/2/x') && !mbnGated('//example.org/ws/2/x'), '…protocol-relative too (Credit Hoarder)');
});

// #1095: the shipped pace, with the real constants: a burst of four, then eight a second
test('the shipped pace is a burst of four, then eight a second', { tag: ['@unit'] }, async ({ context }) => {
  const a = await context.newPage();
  await a.goto(ORIGIN + '/');
  await a.addScriptTag({ content: GATE.replace(/^const MBN_GAP = .*$/m, 'const MBN_GAP = ' + MBN_INLINE.consts.MBN_GAP + ';').replace(/^const MBN_BURST = .*$/m, 'const MBN_BURST = ' + MBN_INLINE.consts.MBN_BURST + ';') });
  const starts = await a.evaluate(async () => {
    localStorage.clear();
    const t0 = Date.now();
    await Promise.all(Array.from({ length: 8 }, (_, i) => mbnFetch('/ws/2/artist?query=x' + i)));
    return window.__starts.map(t => t - t0).sort((x, y) => x - y);
  });
  check(starts[3] - starts[0] < 300, `the first four start at once (${starts.join(', ')} ms)`);
  check(starts[4] - starts[0] >= 90, `the fifth waits its turn (${starts.join(', ')} ms)`);
  const gaps = starts.slice(5).map((t, i) => t - starts[i + 4]);
  check(gaps.every(g => g >= 90 && g <= 220), `then an eighth of a second apart (${gaps.join(', ')} ms)`);
});

// #1095: a single request after a quiet spell drew "X-RateLimit-Who: global", and the next one went
// through: MusicBrainz's own load, not our pace. Its hold stays a flat second; ours grows as before
test("a 503 for MusicBrainz's own load holds a flat second, however many in a row", { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context);
  const r = await a.evaluate(async () => {
    localStorage.clear();
    const hold = async who => { const x = await mbnAnswer(503, n => n === 'X-RateLimit-Who' ? who : null); await new Promise(z => setTimeout(z, x.hold + 20)); return x.hold; };
    const global = [await hold('global'), await hold('global'), await hold('global')];
    const globalHot = mbnHot();
    localStorage.clear();
    const shed = [];
    for (let i = 0; i < 3; i++) { const x = await mbnAnswer(503, n => n === 'X-RateLimit-Who' ? 'search-shed' : null, { search: true }); shed.push(x.hold); await new Promise(z => setTimeout(z, x.hold + 20)); }
    localStorage.clear();
    const own = [await hold(null), await hold(null)];
    localStorage.clear();
    const ra = [];
    for (let i = 0; i < 2; i++) { const x = await mbnAnswer(503, n => n === 'Retry-After' ? '2' : null); ra.push(x.hold); await new Promise(z => setTimeout(z, x.hold + 20)); }
    return { global, globalHot, shed, own, ra };
  });
  check(r.global.every(h => h > 900 && h <= 1000), `global: a second each (${r.global.join(', ')} ms)`);
  check(r.globalHot === 0, `global: not a throttle of ours, the burst stays (hot ${r.globalHot})`);
  check(r.shed.every(h => h > 900 && h <= 1000), `search-shed: a second each (${r.shed.join(', ')} ms)`);
  check(r.ra.every(h => h > 1900 && h <= 2000), `a Retry-After holds what it says, however many in a row (${r.ra.join(', ')} ms)`);
  check(r.own[1] > 1900, `any other 503 still holds longer each time (${r.own.join(', ')} ms)`);
});

test('two tabs share one budget', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context), b = await tab(context);
  await a.evaluate(() => localStorage.clear());
  const t0 = Date.now();
  const [sa, sb] = await Promise.all([a, b].map(p => p.evaluate(async () => {
    await Promise.all(Array.from({ length: 3 }, (_, i) => mbnFetch('/ws/2/release?query=' + Math.random() + i)));
    return window.__starts;
  })));
  const all = [...sa, ...sb].map(t => t - t0).sort((x, y) => x - y);
  const spaced = all.slice(3).map((t, i) => t - all[i + 2]);
  check(all.length === 6 && spaced.every(g => g >= 850), `six requests from two tabs: a burst of three, then a second apart (${all.join(', ')} ms)`);
});

test('a 503 in one tab holds the other', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context), b = await tab(context);
  await a.evaluate(() => { localStorage.clear(); window.__answers = [503]; });
  const logs = await a.evaluate(async () => { const l = []; await mbnFetch('/ws/2/x', {}, { tries: 1, log: (lv, m) => l.push(lv + ' ' + m) }); return l; });
  check(logs.some(l => /HTTP 503 \(Retry-After: 2\) — every script holds 2s/.test(l)), `the throttle is logged: ${JSON.stringify(logs)}`);
  const waited = await b.evaluate(async () => { const t0 = Date.now(); await mbnFetch('/ws/2/y'); return Date.now() - t0; });
  check(waited >= 1700, `the other tab's next request waited the hold out (${waited} ms)`);
});

test('503s from requests already in flight count as one throttle; a throttle long gone is forgotten', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context);
  const r = await a.evaluate(async () => {
    localStorage.clear();
    const h = () => '0';
    for (let i = 0; i < 4; i++) await mbnAnswer(503, h);    // four answers of one burst
    const once = JSON.parse(localStorage.getItem('mbu:mb-gate'));
    // an old throttle: its hold ended a minute ago
    localStorage.setItem('mbu:mb-gate', JSON.stringify({ tat: 0, cool: Date.now() - 60000, hot: 6 }));
    const staleHot = mbnHot();
    await mbnAnswer(503, h);
    const fresh = JSON.parse(localStorage.getItem('mbu:mb-gate'));
    return { onceHot: once.hot, onceHold: once.cool - Date.now(), staleHot, freshHot: fresh.hot, freshHold: fresh.cool - Date.now() };
  });
  check(r.onceHot === 1 && r.onceHold <= 1100, `four 503s at once: one step, a one-second hold (${JSON.stringify(r)})`);
  check(r.staleHot === 0 && r.freshHot === 1 && r.freshHold <= 1100, 'a throttle that ended a minute ago no longer counts: the next one starts from the first step');
});

test('an interactive request goes ahead of queued background work; a cancelled wait stops', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context);
  const r = await a.evaluate(async () => {
    localStorage.clear();
    const t0 = Date.now(), bg = [];
    for (let i = 0; i < 6; i++) bg.push(mbnSlot({ label: 'bg' + i }).then(() => Date.now() - t0));
    await new Promise(z => setTimeout(z, 50));
    const inter = await mbnSlot({ background: false }).then(() => Date.now() - t0);
    let stop = false; setTimeout(() => { stop = true; }, 300);
    const c0 = Date.now(), cancelled = await mbnSlot({ cancelled: () => stop }), cancelMs = Date.now() - c0;
    return { bg: await Promise.all(bg), inter, cancelled, cancelMs };
  });
  check(r.inter < 400 && r.inter < Math.max(...r.bg), `interactive started at ${r.inter} ms, ahead of the queued ones (${r.bg.join(', ')} ms)`);
  check(r.cancelled.ok === false && r.cancelMs < 800, `a cancelled wait returns at once (${r.cancelMs} ms, ok=${r.cancelled.ok})`);
});

test('the page requests have their own line: a burst, then one a second, and no burst while throttled or busy', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context);
  const r = await a.evaluate(async () => {
    localStorage.clear();
    const five = () => { const t0 = Date.now(); return Promise.all(Array.from({ length: 5 }, () => mbnSlot({ background: false }).then(() => Date.now() - t0))); };
    const calm = await five();
    // a full background queue does not delay them, but it already spends the burst: both lanes bursting at
    // once sent five or six in one moment, and MusicBrainz answered them all with 503
    await new Promise(z => setTimeout(z, 3000));
    for (let i = 0; i < 8; i++) mbnSlot({ label: 'bg' + i });
    await new Promise(z => setTimeout(z, 50));
    const busy = await five();
    let t0;
    // throttled a moment ago (the hold is over, hot is not): one a second from the first
    await new Promise(z => setTimeout(z, 3000));
    localStorage.setItem('mbu:mb-gate', JSON.stringify({ ...JSON.parse(localStorage.getItem('mbu:mb-gate')), cool: Date.now() - 10, hot: 2, itat: 0 }));
    t0 = Date.now();
    const hot = await Promise.all(Array.from({ length: 3 }, () => mbnSlot({ background: false }).then(() => Date.now() - t0)));
    return { calm: calm.sort((x, y) => x - y), busy: busy.sort((x, y) => x - y), hot: hot.sort((x, y) => x - y) };
  });
  check(r.calm[2] < 300 && r.calm[3] >= 800 && r.calm[3] < 1400 && r.calm[4] >= 1800 && r.calm[4] < 2400, `calm: three at once, then one a second (${r.calm.join(', ')} ms)`);
  check(r.busy[0] < 300 && r.busy[1] >= 800 && r.busy[1] < 1400 && r.busy[4] < 4600, `background queue busy: ahead of it, one a second from the first (${r.busy.join(', ')} ms)`);
  check(r.hot[0] < 300 && r.hot[1] >= 800 && r.hot[2] >= 1800, `throttled: one a second from the first (${r.hot.join(', ')} ms)`);
});

// log: three page requests queued behind a hold; a 200 then cooled `hot`, and a fourth booked a
// moment later took the burst back from the line's end, onto the first one's slot: both got a 503
test('a burst never lands on a slot still to come, in either line', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context);
  const r = await a.evaluate(async () => {
    const out = {};
    for (const background of [false, true]) {
      localStorage.clear();
      await mbnState(s => { s.cool = Date.now() + 1500; s.hot = 1; });
      const t0 = Date.now(), at = [];
      const three = Array.from({ length: 3 }, () => mbnSlot({ background }).then(() => at.push(Date.now() - t0)));
      await new Promise(z => setTimeout(z, 50));
      await mbnState(s => { s.hot = 0; });   // what a 200 in the meantime does
      await mbnSlot({ background }).then(() => at.push(Date.now() - t0));
      await Promise.all(three);
      out[background ? 'bg' : 'page'] = at.sort((x, y) => x - y);
    }
    return out;
  });
  for (const [k, v] of Object.entries(r)) {
    const gaps = v.slice(1).map((t, i) => t - v[i]);
    check(v[0] >= 1400 && gaps.every(g => g >= 800), `${k}: one a second after the hold, none doubled up (${v.join(', ')} ms)`);
  }
});

test('a hold keeps the queue in its order: a request booked after it does not overtake those waiting', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context);
  const r = await a.evaluate(async () => {
    localStorage.clear();
    await mbnState(s => { s.cool = Date.now() - 1; s.hot = 1; });   // throttled a moment ago: no burst
    const t0 = Date.now(), order = [], at = {};
    const go = (k, background = true) => mbnSlot({ background }).then(() => { order.push(k); at[k] = Date.now() - t0; });
    const queued = ['A', 'B', 'C'].map(k => go(k));   // slots at 0, 1 and 2 s
    await new Promise(z => setTimeout(z, 50));
    await mbnAnswer(503, n => n === 'Retry-After' ? '2' : null);   // A's answer: everyone holds 2 s
    const late = go('D');
    await Promise.all([...queued, late]);
    return { order: order.join(''), at };
  });
  check(r.order === 'ABCD', `the requests queued before the hold still leave first (${r.order}, ${JSON.stringify(r.at)})`);
  check(r.at.B >= 1900 && r.at.C - r.at.B >= 800 && r.at.D - r.at.C >= 800, `after the hold, one a second (${JSON.stringify(r.at)})`);
});

// log: a search's 503 sent its retry to the back of a 13-request queue three times, 8-12 s each,
// and it gave up while requests booked after it got through; a retry keeps its place at the head
test('a retry after a 503 leaves first when the hold ends, ahead of the queue behind it', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context);
  const r = await a.evaluate(async () => {
    localStorage.clear();
    await mbnState(s => { s.cool = Date.now() - 1; s.hot = 1; });   // throttled a moment ago: no burst
    const t0 = Date.now(), order = [], at = {};
    let first = true;
    window.fetch = async () => {
      if (first) { first = false; await new Promise(z => setTimeout(z, 50)); return new Response('{}', { status: 503, headers: { 'Retry-After': '1' } }); }
      order.push('X'); at.X = Date.now() - t0; return new Response('{}', { status: 200 });
    };
    const x = mbnFetch('/ws/2/x');   // slot 0: sent at once, its 503 comes back 50 ms later
    while (first) await new Promise(z => setTimeout(z, 5));   // the others queue once it is sent
    const queued = ['B', 'C', 'D'].map(k => mbnSlot({}).then(() => { order.push(k); at[k] = Date.now() - t0; }));   // slots at 1, 2 and 3 s
    await Promise.all([x, ...queued]);
    return { order: order.join(''), at };
  });
  check(r.order === 'XBCD', `the retry leaves before the requests queued behind it (${r.order}, ${JSON.stringify(r.at)})`);
  check(r.at.B - r.at.X >= 800 && r.at.C - r.at.B >= 800 && r.at.D - r.at.C >= 800, `still one a second (${JSON.stringify(r.at)})`);
});

// log: a search-shed hold sent every search waiting on it to the end of the queue, behind the lookups
// booked meanwhile, ten holds in a row: one search waited 36 s; it keeps its place at the head
test('a search waiting out a search-shed hold leaves first, ahead of lookups booked after it', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context);
  const r = await a.evaluate(async () => {
    localStorage.clear();
    await mbnState(s => { s.cool = Date.now() - 1; s.hot = 1; });   // throttled a moment ago: no burst
    const t0 = Date.now(), order = [], at = {};
    const go = (k, search) => mbnSlot({ search }).then(() => { order.push(k); at[k] = Date.now() - t0; });
    const queued = [go('A', true), go('B', true), go('C', true)];   // searches at 0, 1 and 2 s
    await new Promise(z => setTimeout(z, 50));
    await mbnAnswer(503, n => n === 'Retry-After' ? '1' : n === 'X-RateLimit-Who' ? 'search-shed' : null, { search: true });   // A's: searches hold 1 s, past B's slot
    const later = [go('D'), go('E'), go('F')];   // lookups, which don't wait for the search hold
    await Promise.all([...queued, ...later]);
    return { order: order.join(''), at };
  });
  check(r.order === 'ABCDEF', `the searches queued before the hold still leave before the lookups booked after it (${r.order}, ${JSON.stringify(r.at)})`);
  check(r.at.B >= 1000 && r.at.C - r.at.B >= 800 && r.at.D - r.at.C >= 800 && r.at.E - r.at.D >= 800, `one a second (${JSON.stringify(r.at)})`);
});

test('a page request keeps trying past four throttles; a background one stops at four', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context);
  const r = await a.evaluate(async () => {
    localStorage.clear();
    window.__answers = [503, 503, 503, 503, 503];
    const bg = await mbnFetch('/ws/2/x');
    const bgCalls = window.__starts.length;
    localStorage.clear(); window.__starts = []; window.__answers = [503, 503, 503, 503, 503];
    const inter = await mbnFetch('/ws/2/x', {}, { background: false });
    return { bg: bg.status, bgCalls, inter: inter.status, interCalls: window.__starts.length };
  });
  check(r.bg === 503 && r.bgCalls === 4, `background: four tries, then the 503 (${JSON.stringify(r)})`);
  check(r.inter === 200 && r.interCalls === 6, `interactive: tries on and gets its answer (${JSON.stringify(r)})`);
});

// #847: a page being drawn (Event Horizon) holds other tabs' background requests until it ends or lapses
test('a lead holds other background requests, not the leader nor interactive ones', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context), b = await tab(context);
  await a.evaluate(() => { localStorage.clear(); return mbnLead('page', 5000); });
  // tabs see each other's localStorage a moment late (a slow runner, more): start once B sees the lead
  await b.waitForFunction(() => (JSON.parse(localStorage.getItem('mbu:mb-gate') || 'null') || {}).lead === 'page');
  const r = await b.evaluate(async () => {
    const t0 = Date.now(), at = p => p.then(() => Date.now() - t0);
    const other = at(mbnSlot({ label: 'other' })), mine = await at(mbnSlot({ lead: 'page' })), inter = await at(mbnSlot({ background: false }));
    await new Promise(z => setTimeout(z, 600));
    await mbnLead('someone', 0);   // not the holder's token: the lead stays
    await new Promise(z => setTimeout(z, 300));
    const still = JSON.parse(localStorage.getItem('mbu:mb-gate')).lead;
    await mbnLead('page', 0);
    return { other: await other, mine, inter, still };
  });
  check(r.mine < 300 && r.inter < 300, `the leader's request (${r.mine} ms) and an interactive one (${r.inter} ms) start at once`);
  check(r.still === 'page', 'only the holder ends its lead');
  check(r.other >= 850 && r.other < 2000, `another background request waits for the lead to end (${r.other} ms)`);
  const lapse = await a.evaluate(async () => {
    await mbnLead('gone', 600);
    const t0 = Date.now(); await mbnSlot({}); return Date.now() - t0;
  });
  check(lapse >= 450 && lapse < 1500, `a lead never ended lapses on its own (${lapse} ms)`);
});

test('a lock held and never released stalls a request 3 s, not for good', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context);
  const r = await a.evaluate(async () => {
    localStorage.clear();
    navigator.locks.request(MBN_LOCK, () => new Promise(() => {}));   // a holder that never lets go
    await new Promise(res => setTimeout(res, 50));
    const t0 = Date.now();
    const res = await mbnFetch('/ws/2/artist/x', {}, { background: false });
    return { ms: Date.now() - t0, ok: !!(res && res.ok), starts: window.__starts.length };
  });
  check(r.ok && r.starts === 1, `the request still goes out (${JSON.stringify(r)})`);
  check(r.ms >= 2900 && r.ms < 9000, `after about 3 s per gate step, not never (${r.ms} ms)`);
});

// majkinetor on #633: Falcon runs a queue in one tab while Platform Check adds links in another —
// does Falcon hold the line so Platform Check waits until it times out? A request books its slot
// only when it is about to start, and Falcon keeps at most 4 in flight: so another tab's request
// queues behind those 4 at most, not behind Falcon's whole queue.
test('a tab working through a long queue (4 at a time) doesn\'t starve another tab', { tag: ['@unit'] }, async ({ context }) => {
  const falcon = await tab(context), pc = await tab(context);
  await falcon.evaluate(() => localStorage.clear());
  // Falcon: 20 reads, at most 4 waiting or running at once, as its mbThrottle does
  const run = falcon.evaluate(async () => {
    const q = Array.from({ length: 20 }, (_, i) => i); let running = 0;
    await new Promise(done => {
      const next = () => {
        if (!q.length && !running) return done();
        while (running < 4 && q.length) { q.shift(); running++; mbnFetch('/ws/2/release?query=f').then(() => { running--; next(); }); }
      };
      next();
    });
  });
  await falcon.waitForTimeout(5000);   // well into Falcon's run
  const waited = await pc.evaluate(async () => { const t0 = Date.now(); await mbnFetch('/ws/2/release/x'); return Date.now() - t0; });
  await run;
  console.log('other tab waited', waited, 'ms');
  check(waited < 6000, `the other tab's request waits for the few slots already booked, not for the whole queue (${waited} ms; the queue takes ~20 s)`);
});

// #733: MusicBrainz's "Verifying your browser" check answering a website request mid-session.
// A routed stand-in for a MusicBrainz host (it never resolves; the route answers everything):
// fetch() is stubbed to answer the check until the hidden frame has "passed" it, and the
// frame's page passes it the way the real one does, by moving on to the real URL.
const MBHOST = 'https://gate.musicbrainz.org';
const CHECK = '<!DOCTYPE html><html><head><title>Verifying your browser</title></head><body><noscript><p>JavaScript is required to access this page.</p></noscript>';
async function mbTab(context, { clears = true } = {}) {
  await context.route(MBHOST + '/**', r => {
    const u = new URL(r.request().url());
    if (u.pathname === '/') return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>mb</title>' });
    if (u.searchParams.has('passed')) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    // the frame's first load: the check, which (when it can) passes and moves on
    const pass = clears ? `<script>parent.__cleared = true; location.replace(location.href + (location.search ? '&' : '?') + 'passed=1');</script>` : '';
    return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: CHECK + pass + '</body></html>' });
  });
  const p = await context.newPage();
  await p.goto(MBHOST + '/');
  await p.addScriptTag({ content: Object.entries(CONSTS).map(([k, v]) => `const ${k} = ${JSON.stringify(v)};`).join('\n') + '\n'
    + MBN_INLINE.fns.map(f => f.toString()).join('\n')
    + `\nwindow.__calls = []; window.__cleared = false;
       window.fetch = async (url, init) => { window.__calls.push(((init && init.method) || 'GET') + ' ' + url);
         return window.__cleared ? new Response('{"ok":1}', { status: 200, headers: { 'Content-Type': 'application/json' } })
                                 : new Response(${JSON.stringify(CHECK)}, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }); };
       Object.assign(window, { mbnFetch, mbnWebsite, mbnIsCheck });` });
  return p;
}

test('the browser check is passed in a hidden frame and the request retried', { tag: ['@unit'] }, async ({ context }) => {
  const p = await mbTab(context);
  const r = await p.evaluate(async () => {
    const logs = [];
    const o = { log: (lv, m) => logs.push(lv + ' ' + m) };
    // three at once share one frame
    const rs = await Promise.all(['/ws/js/artist?q=a', '/ws/js/entity/x', '/ws/js/label?q=b'].map(u => mbnFetch(u, { headers: { Accept: 'application/json' } }, o)));
    const bodies = await Promise.all(rs.map(x => x.json()));
    const post = await mbnFetch('/ws/js/edit/create', { method: 'POST', body: '{}' }, o).then(x => x.json());
    return { bodies, post, calls: window.__calls, logs, frames: document.querySelectorAll('iframe').length };
  });
  check(r.bodies.every(b => b.ok === 1), `every request gets its JSON (${JSON.stringify(r.bodies)})`);
  check(r.calls.length === 7, `each asked twice: before and after the pass, the POST once more after (${r.calls.join(' · ')})`);
  check(r.logs.filter(l => /hidden frame/.test(l)).length === 1, `one frame for the three (${JSON.stringify(r.logs)})`);
  check(r.frames === 0, 'and the frame is gone');
  check(r.post.ok === 1, 'a POST answered by the check is sent again once it is passed');
});

test('a check that doesn\'t clear gives up, says so once, and leaves the answer readable', { tag: ['@unit'] }, async ({ context }) => {
  test.setTimeout(60000);
  const p = await mbTab(context, { clears: false });
  const r = await p.evaluate(async () => {
    const logs = [], notes = [];
    const o = { log: (lv, m) => logs.push(lv + ' ' + m), notify: m => notes.push(m) };
    const a = await mbnFetch('/ws/js/artist?q=a', {}, o);
    const text = await a.text();
    const b = await mbnFetch('/ws/js/artist?q=b', {}, o);   // right after: no second frame
    return { text: text.slice(0, 60), logs, notes, calls: window.__calls.length, bStatus: b.status };
  });
  check(/Verifying your browser/.test(r.text), 'the caller still gets the answer, body readable');
  check(r.notes.length === 1 && /another tab/.test(r.notes[0]), `one notice, pointing to another tab (${JSON.stringify(r.notes)})`);
  check(r.calls === 2, `no retry, and no new frame for a minute (${r.calls} calls)`);
});

test('only MusicBrainz\'s website side is checked, and a JSON answer passes untouched', { tag: ['@unit'] }, async ({ context }) => {
  const p = await mbTab(context);
  const r = await p.evaluate(async () => {
    window.__cleared = true;
    const res = await mbnFetch('/ws/js/entity/x');
    return { website: [mbnWebsite('/ws/js/x'), mbnWebsite('https://musicbrainz.org/release/x'), mbnWebsite('/ws/2/x'), mbnWebsite('https://example.org/ws/js/x'), mbnWebsite('//example.org/x')],
      untouched: res.headers.get('content-type'), calls: window.__calls.length, frames: document.querySelectorAll('iframe').length };
  });
  check(JSON.stringify(r.website) === '[true,true,false,false,false]', `website side: relative on MusicBrainz and any musicbrainz.org page; not ws/2, not other sites (${JSON.stringify(r.website)})`);
  check(r.calls === 1 && r.frames === 0 && /json/.test(r.untouched), 'a JSON answer is returned as it came, one request, no frame');
});

// #1112: searches keep their own pace: each shed doubles the gap between search starts, each
// answered search takes a step off it, and lookups never wait in the search line
test('a shed slows searches only, and answered searches speed them up again', { tag: ['@unit'] }, async ({ context }) => {
  const a = await context.newPage();
  await a.goto(ORIGIN + '/');
  const real = MBN_INLINE.consts;
  await a.addScriptTag({ content: GATE.replace(/^const MBN_SGAP_MIN = .*$/m, 'const MBN_SGAP_MIN = ' + real.MBN_SGAP_MIN + ';').replace(/^const MBN_GAP = .*$/m, 'const MBN_GAP = ' + real.MBN_GAP + ';') });
  const r = await a.evaluate(async () => {
    localStorage.clear();
    const shed = n => n === 'X-RateLimit-Who' ? 'search-shed' : null;
    await mbnAnswer(503, shed, { search: true });
    await mbnAnswer(503, shed, { search: true });
    const sgap = JSON.parse(localStorage.getItem('mbu:mb-gate')).sgap;
    const t0 = Date.now(), starts = [];
    await Promise.all([0, 1, 2].map(i => mbnSlot({ search: true }).then(() => starts.push(['s', Date.now() - t0])))
      .concat([0, 1].map(i => mbnSlot({}).then(() => starts.push(['l', Date.now() - t0])))));
    for (let i = 0; i < 5; i++) await mbnAnswer(200, () => null, { search: true });
    return { sgap, starts, after: JSON.parse(localStorage.getItem('mbu:mb-gate')).sgap };
  });
  const s = r.starts.filter(x => x[0] === 's').map(x => x[1]).sort((x, y) => x - y), l = r.starts.filter(x => x[0] === 'l').map(x => x[1]);
  check(r.sgap === real.MBN_SGAP_MIN * 4, `two sheds: the search gap doubled twice (${r.sgap})`);
  check(s[1] - s[0] >= r.sgap - 100 && s[2] - s[1] >= r.sgap - 100, `searches start a gap apart (${s.join(', ')} ms)`);
  check(l.every(t => t < s[1]), `lookups do not wait in the search line (${l.join(', ')} ms)`);
  check(r.after === r.sgap - 5 * real.MBN_SGAP_STEP, `five answers take five steps off (${r.after})`);
});
