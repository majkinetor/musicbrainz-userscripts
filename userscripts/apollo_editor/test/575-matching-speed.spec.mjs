// #575 (majkinetor): "Matching takes too long … it looks like it goes serial and very slow
// at that. Both artist and recording match. Many duplicates messages in log too." Six of
// forty-two tracks matched in ten minutes. Five rounds, each measured from his logs.
//
// 1. Coalescing: 115 /ws/2 requests for 48 URLs — a cache stampede. wsJson shares a
//    request in flight (never a cache: once settled, the next call asks again).
// 2. Pacing by starts: requests were chained, so one 12 s search stalled everything
//    behind it. One start per gap, a few in flight.
// 3. A shared throttle: 90 of 121 replies were 503, because each request backed off on
//    its own while the others kept firing. One 503 now holds every lane.
// 4. Stop answers at once: nothing was frozen, but the loop saw the stop only between
//    items (a multi-second search), so Stop looked ignored. It reads "Stopping…" at once.
// 5. No resync storm: every matched track's credit write echoed back as an "external
//    edit" and scheduled a full reload; the idle "auto-match off" message flickered in.
//
// 1–3 drive wsJson with fetch stood in for, in a blank page. 4–5 run his own Discogs
// import on the sandbox, with every /ws/2 read held 3 s so the pass lasts long enough to
// watch (and it is when someone reaches for Stop). Nothing is submitted.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

async function blank(page, inject) {
  await page.setContent('<!DOCTYPE html><html><body></body></html>');
  await inject('apollo_editor', { waitFor: '__apolloEditor' });
}

test.describe('the web-service queue', () => {
  test.use({ gm: apolloGm() });

  test('round 1: identical requests in flight are one request', { tag: ['@unit', '@critical'] }, async ({ page, inject }) => {
    await blank(page, inject);
    await page.evaluate(() => {
      window.__net = []; window.__plan = {};   // url → { status, body }, until cleared
      window.fetch = url => {
        window.__net.push(String(url));
        const p = window.__plan[String(url)] || { status: 200, body: { artists: [] } };
        return new Promise(res => setTimeout(() => res({ ok: p.status >= 200 && p.status < 300, status: p.status, headers: { get: () => null }, json: async () => p.body }), 60));
      };
    });
    const A = 'https://musicbrainz.org/ws/2/artist?query=alias%3A%22Martha%20Badibala%22&fmt=json';
    const B = 'https://musicbrainz.org/ws/2/artist?query=alias%3A%22Kalombo%20Albino%22&fmt=json';
    const r = await page.evaluate(async ({ A, B }) => {
      const ws = window.__apolloEditor.wsJson, sent = u => window.__net.filter(x => x === u).length, out = {};
      const rs = await Promise.all(Array.from({ length: 10 }, () => ws(A, { label: 'alias search' })));
      out.burst = { n: sent(A), same: rs.every(x => x === rs[0]), json: rs.every(x => x && x.json) };
      await ws(A, { label: 'alias search' });
      out.later = sent(A);
      let n0 = window.__net.length;
      await Promise.all([ws(A + '&x=1', {}), ws(B, {})]);
      out.two = window.__net.length - n0;
      const T = B + '&t=1';
      window.__plan[T] = { status: 503, body: { error: 'rate limited' } };
      const ts = await Promise.all([1, 2, 3].map(() => ws(T, { label: 'alias search' })));
      delete window.__plan[T];
      out.throttled = { n: sent(T), same: ts.every(x => x === ts[0]), noJson: ts.every(x => !x.json) };
      n0 = window.__net.length;
      await Promise.all([ws(A + '&s=1', { stale: () => false }), ws(A + '&s=1', { stale: () => false })]);
      out.stale = window.__net.length - n0;
      const urls = Array.from({ length: 48 }, (_, i) => 'https://musicbrainz.org/ws/2/x?u=' + i);
      const plan = urls.concat(Array.from({ length: 67 }, (_, i) => urls[i % 12]));   // his log: 115 asks, 48 URLs
      n0 = window.__net.length;
      await Promise.all(plan.map(u => ws(u, {})));
      out.replay = { asked: plan.length, sent: window.__net.length - n0 };
      return out;
    }, { A, B });
    check(r.burst.n === 1 && r.burst.same && r.burst.json, `ten identical lookups at once: one request, one answer for all (${JSON.stringify(r.burst)})`);
    check(r.later === 2, 'once settled, the next call asks again: a flight, not a cache');
    check(r.two === 2, 'two different URLs are two requests');
    check(r.throttled.same && r.throttled.noJson, 'a throttled flight is shared too, and nobody is handed an empty answer (#555)');
    check(r.throttled.n === 4, `its retries run once, for all three callers (${r.throttled.n} attempts)`);
    check(r.stale === 2, 'a caller with stale() is never shared (its request may be dropped)');
    check(r.replay.asked === 115 && r.replay.sent === 48, `his log's profile: 115 asks, ${r.replay.sent} requests`);
  });

  // @timing (round 2 and 3, and the two Stop presses below): these assert time itself —
  // a pass shorter than chaining, gaps of 900 ms, a frame within 250 ms, a press answered
  // within 2 s — which a slower shared machine (CI) can miss for no fault of Apollo's
  test('round 2: a slow reply does not hold up the ones behind it', { tag: ['@unit', '@timing'] }, async ({ page, inject }) => {
    await blank(page, inject);
    const LATENCY = 3000, N = 8;   // a slow search, scaled down from his ~12 s
    const run = await page.evaluate(async ({ l, n }) => {
      const calls = []; let live = 0, peak = 0;
      window.fetch = url => {
        const c = { start: performance.now() }; calls.push(c); peak = Math.max(peak, ++live);
        return new Promise(res => setTimeout(() => { live--; res({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ artists: [] }) }); }, l));
      };
      const t0 = performance.now();
      await Promise.all(Array.from({ length: n }, (_, i) => window.__apolloEditor.wsJson('https://musicbrainz.org/ws/2/artist?q=' + i, {})));
      const total = performance.now() - t0, starts = calls.map(c => Math.round(c.start - t0)).sort((a, b) => a - b);
      calls.length = 0;
      const r = await window.__apolloEditor.wsJson('https://musicbrainz.org/ws/2/artist?q=stale', { stale: () => true });
      return { total: Math.round(total), starts, peak, staleSent: calls.length, stale: r };
    }, { l: LATENCY, n: N });
    const gaps = run.starts.slice(1).map((s, i) => s - run.starts[i]);
    const chained = N * (LATENCY + 1000);
    check(run.starts.length === N, `all ${N} made`);
    check(run.total < chained / 2, `${run.total} ms, where chaining would take ~${chained} ms`);
    check(run.peak > 1 && run.peak <= 4, `they overlap, at most 4 at once (peak ${run.peak})`);
    // #633: the shared gate allows a burst of three, then one a second on average: the i-th
    // start is never earlier than (i − 2) seconds in
    check(run.starts.every((s, i) => s >= (i - 2) * 1000 - 100), `but no faster than a burst of three and then one a second (${JSON.stringify(run.starts)})`);
    check(run.staleSent === 0 && run.stale && run.stale.stale === true, 'a request gone stale is never sent, and its caller is told');
  });

  test('round 3: one 503 holds every lane', { tag: ['@unit', '@timing'] }, async ({ page, inject }) => {
    await blank(page, inject);
    const out = await page.evaluate(async () => {
      const t0 = performance.now(), events = [], SICK_UNTIL = 12000;   // unwell for a while, not for a count
      let live = 0, seen = null, n = 0;
      window.fetch = () => {
        const throttled = performance.now() - t0 < SICK_UNTIL;
        n++; live++;
        events.push({ t: performance.now() - t0, live });
        return new Promise(res => setTimeout(() => {   // slower than the gap, so requests really overlap
          live--;
          if (throttled && seen === null) seen = performance.now() - t0;
          res({ ok: !throttled, status: throttled ? 503 : 200, headers: { get: () => null }, json: async () => ({ artists: [] }) });
        }, 2500));
      };
      await Promise.all([0, 1, 2, 3, 4, 5].map(k => window.__apolloEditor.wsJson('https://musicbrainz.org/ws/2/artist?query=q' + k, { label: 'probe' })));
      return { events, seen, SICK_UNTIL, total: n };
    });
    // what was already in flight at the first 503 cannot be recalled: measure from a second after
    const steady = out.events.filter(e => e.t > out.seen + 1200 && e.t < out.SICK_UNTIL);
    const gaps = steady.slice(1).map((e, i) => e.t - steady[i].t);
    check(out.seen !== null && steady.length >= 2, `the stub throttled, long enough to watch (${steady.length} starts while it did)`);
    check(Math.max(0, ...steady.map(e => e.live)) <= 1, 'while MusicBrainz says 503: one probe at a time');
    check(gaps.every(g => g >= 900), `none fired inside the shared hold (${JSON.stringify(gaps.map(Math.round))})`);
    check(out.total <= 16, `the retries stay bounded (${out.total} requests for 6 calls over a 12 s outage)`);
  });
});

// his Discogs import, the /ws/2 reads held back
async function importAndHold(page, inject) {
  const submitted = await openApollo(page, inject, {
    seed: 'seed-575-discogs-import',
    before: () => page.route(/\/ws\/2\//, async r => { await new Promise(z => setTimeout(z, 3000)); return r.fallback(); }),
  });
  await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
  await page.waitForSelector('.tc-medsec .tc-search input.nm', { state: 'visible', timeout: 60000 });
  return submitted;
}
const TL = '#tc-bar [data-act="match"], #tc-hdr [data-act="match"]', REC = '#tc-recwrap .tc-rec-am';
const labelOf = (page, sel) => page.evaluate(s => { const b = document.querySelector(s); return b ? ((b.querySelector('.tc-rec-am-lbl') || b).textContent || '').trim().replace(/\s+/g, ' ') : null; }, sel);
const waitLabel = (page, sel, re, ms = 90000) => page.waitForFunction(([s, src]) => { const b = document.querySelector(s); return b && new RegExp(src).test(b.textContent) ? b.textContent.trim() : null; }, [sel, re.source], { timeout: ms }).then(h => h.jsonValue()).catch(() => null);
// the first label that no longer says Stop, within 2 s: well inside one held read
async function ack(page, sel) {
  const t0 = Date.now();
  for (;;) {
    const l = await labelOf(page, sel);
    if ((l && !/Stop$/.test(l)) || Date.now() - t0 >= 2000) return { label: l, ms: Date.now() - t0 };
    await page.waitForTimeout(50);
  }
}

test.describe('round 4: Stop answers at once', () => {
  test.use({ gm: apolloGm({ apolloEnabled: true, autoMatch: true, autoMatchRec: true, autoMatchLabel: true, autoMatchArtist: true, discogsUrlMatch: true }) });
  // one pass per test: the stop flag is shared, so stopping one stops both

  test('the tracklist', { tag: ['@sandbox', '@login', '@timing'] }, async ({ page, inject }) => {
    const submitted = await importAndHold(page, inject);
    const raf = await page.evaluate(() => new Promise(r => { const s = performance.now(); requestAnimationFrame(() => r(Math.round(performance.now() - s))); }));
    check(raf < 250, `nothing is frozen: a frame comes back in ${raf} ms`);
    check(!!await waitLabel(page, TL, /Stop/), 'the pass runs, offering Stop');
    const before = await page.evaluate(() => window.__apolloEditor.model.tracks.filter(t => t.slots.some(s => s.committed)).length);
    await page.click(TL);
    const a = await ack(page, TL);
    check(/Stopping/.test(a.label || ''), `the press is answered in ${a.ms} ms (${a.label})`);
    check(!!await waitLabel(page, TL, /Match/), 'and the pass ends');
    const after = await page.evaluate(() => window.__apolloEditor.model.tracks.filter(t => t.slots.some(s => s.committed)).length);
    check(after >= before, `nothing is undone (${before} → ${after})`);
    check(submitted.length === 0, 'nothing submitted');
  });

  test('the Recordings pane', { tag: ['@sandbox', '@login', '@timing'] }, async ({ page, inject }) => {
    const submitted = await importAndHold(page, inject);
    await page.locator('a, button', { hasText: /^Recordings$/ }).first().click().catch(() => {});
    await page.waitForSelector(REC, { state: 'visible', timeout: 30000 }).catch(() => {});
    check(!!await waitLabel(page, REC, /Stop/), 'its pass runs by itself, offering Stop');
    await page.click(REC);
    const a = await ack(page, REC);
    check(/Stopping/.test(a.label || ''), `the press is answered in ${a.ms} ms (${a.label})`);
    check(!!await waitLabel(page, REC, /Match/), 'and the pass ends');
    const status = await page.evaluate(() => document.querySelector('#tc-recwrap .tc-rec-amstatus')?.textContent.trim() || '');
    check(!/scanning duplicates/.test(status), `the pane doesn't claim to be scanning duplicates (${status})`);
    check(submitted.length === 0, 'nothing submitted');
  });
});

test.describe('round 5: no resync storm', () => {
  // auto-match off: his setup, a manual Match
  test.use({ gm: apolloGm({ apolloEnabled: true, autoMatch: false, autoMatchRec: false, autoMatchLabel: true, autoMatchArtist: true, discogsUrlMatch: true }) });

  test('a running pass keeps its status and its table', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    const submitted = await importAndHold(page, inject);
    const text = await page.evaluate(() => document.body.innerText);
    check(!/auto-match off/.test(text), 'the idle "auto-match off — click Match" message is gone (majkinetor: "lets remove" it)');
    check(/unresolved/.test(text), 'the "N unresolved" badge it overwrote is there');
    // a reload builds a new model object: count those
    await page.evaluate(() => { window.__reloads = 0; window.__last = window.__apolloEditor.model; setInterval(() => { const m = window.__apolloEditor.model; if (m !== window.__last) { window.__reloads++; window.__last = m; } }, 60); });
    await page.click(TL);
    const seen = new Set(); let idle = false, reloads = 0;
    for (const t0 = Date.now(); Date.now() - t0 < 45000;) {
      const st = await page.evaluate(() => ({ running: /Stop/.test(document.querySelector('#tc-bar [data-act="match"], #tc-hdr [data-act="match"]')?.textContent || ''), text: ((document.querySelector('#tc-bar') || document.body).innerText || '').replace(/\s+/g, ' '), reloads: window.__reloads }));
      if (!st.running) break;
      if (/auto-match off/.test(st.text)) idle = true;
      const m = st.text.match(/matching \d+\/\d+/); if (m) seen.add(m[0]);
      reloads = st.reloads;   // while running: one after the pass is fine
      await page.waitForTimeout(100);
    }
    check(seen.size > 0, `the pass showed its progress (${[...seen].join(', ')})`);
    check(!idle, 'the idle message never came back mid-pass');
    check(reloads <= 2, `no reload per matched track (${reloads} during the pass)`);
    const deferred = await page.evaluate(() => (window.__apolloEditor.logMarkdown() || '').split('\n').filter(l => /resync deferred/.test(l)).length);
    check(deferred <= 4, `"resync deferred" is logged once per episode, not per tick (${deferred})`);
    check(submitted.length === 0, 'nothing submitted');
  });
});
