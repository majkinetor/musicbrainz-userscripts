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
     Object.assign(window, { mbnSlot, mbnAnswer, mbnFetch, mbnState });`;

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
