// The shared MusicBrainz request gate (#633), in two tabs of one origin, with fetch stubbed:
// nothing reaches MusicBrainz. The pages are a local stand-in origin (Web Locks need a secure
// one), served by a route — no network.
import { test, check } from '../test/harness.mjs';
import { MBN_INLINE, mbnGated } from './mb-gate.mjs';

test.use({ profile: 'fresh', gm: false });

const ORIGIN = 'https://gate.test';
const GATE = Object.entries(MBN_INLINE.consts).map(([k, v]) => `const ${k} = ${JSON.stringify(v)};`).join('\n') + '\n'
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

test('the gate paces starts, a burst first, then one a second', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context);
  const starts = await a.evaluate(async () => {
    localStorage.clear();
    const t0 = Date.now();
    await Promise.all(Array.from({ length: 6 }, () => mbnFetch('/ws/2/artist?query=x')));
    return window.__starts.map(t => t - t0).sort((x, y) => x - y);
  });
  // measured from the first start, not from t0: a slow runner delays the whole burst
  check(starts[2] - starts[0] < 300, `the first three start at once (${starts.join(', ')} ms)`);
  const gaps = starts.slice(3).map((t, i) => t - starts[i + 2]);
  check(gaps.every(g => g >= 900 && g <= 1400), `then a second apart (${gaps.join(', ')} ms)`);
  check(await a.evaluate(() => mbnGated('/ws/2/x') && mbnGated('https://test.musicbrainz.org/ws/2/x') && !mbnGated('/ws/js/entity/x') && !mbnGated('https://example.org/ws/2/x')), 'only /ws/2 on MusicBrainz is gated');
  check(mbnGated('https://musicbrainz.org/ws/2/recording/x'), '…production included');
});

test('two tabs share one budget', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context), b = await tab(context);
  await a.evaluate(() => localStorage.clear());
  const t0 = Date.now();
  const [sa, sb] = await Promise.all([a, b].map(p => p.evaluate(async () => {
    await Promise.all(Array.from({ length: 3 }, () => mbnFetch('/ws/2/release?query=x')));
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
  check(logs.some(l => /HTTP 503 \(Retry-After: 2\) — every script holds 2/.test(l)), `the throttle is logged: ${JSON.stringify(logs)}`);
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

// #847: a page being drawn (Event Horizon) holds other tabs' background requests until it ends or lapses
test('a lead holds other background requests, not the leader nor interactive ones', { tag: ['@unit'] }, async ({ context }) => {
  const a = await tab(context), b = await tab(context);
  await a.evaluate(() => { localStorage.clear(); return mbnLead('page', 5000); });
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
  await p.addScriptTag({ content: Object.entries(MBN_INLINE.consts).map(([k, v]) => `const ${k} = ${JSON.stringify(v)};`).join('\n') + '\n'
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
