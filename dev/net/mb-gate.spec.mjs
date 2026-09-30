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
     Object.assign(window, { mbnSlot, mbnAnswer, mbnFetch, mbnState, mbnHot });`;

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
  check(starts.slice(0, 3).every(t => t < 300), `the first three start at once (${starts.join(', ')} ms)`);
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
