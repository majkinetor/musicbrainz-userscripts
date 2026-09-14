// #590, the reload half. The detection is verify-590-error-detect's job; this
// one is about the reload never becoming a loop against MusicBrainz.
//
// The reload is REAL here — location.reload() cannot be stubbed (Location's
// members are [Unforgeable], so there is no prototype to patch), and faking it
// would only prove that a mock was called. Instead the page is served from a
// fixture at Harmony's origin, so a genuine reload costs nothing and goes
// nowhere, and the retry limit is turned down to 1 so the whole give-up cycle
// fits in one short test.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.FALCON_SRC || resolve(HERE, '..', 'falcon.user.js'), 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const MBID = '20b03c7d-9e8a-42b9-8a96-bcc9564de034';
const ACTIONS = `https://harmony.pulsewidth.org.uk/release/actions?release_mbid=${MBID}`;
const act = n => `<div class="action"><p><a href="https://musicbrainz.org/recording/${n}${'0'.repeat(7)}-1111-4111-8111-111111111111/edit?edit-recording.url.0.text=https%3A%2F%2Fx.y%2F${n}">Link external IDs</a></p></div>`;
const body = inner => `<!doctype html><html><head><meta charset="utf-8"></head><body><main>${inner}</main></body></html>`;
const FIXTURES = {
  // "Internal Server Error" deliberately: it is NOT in the slow-down set, so the
  // backoff starts at 5s and the reload fits inside a sane test runtime.
  err: body(`<h2 class="release-title">T</h2>
    <div class="message error"><div class="markdown"><p>Internal Server Error</p></div></div>
    ${act(1)}${act(2)}`),
  busy: body(`<h2 class="release-title">T</h2>
    <div class="message error"><div class="markdown"><p>The MusicBrainz web server is currently busy. Please try again later.</p></div></div>
    ${act(1)}`),
  permanent: body(`<h2>Release Actions</h2>
    <div class="message error"><div class="markdown"><p>"x" is not a valid MBID</p></div></div>`),
  clean: body(`<h2 class="release-title">T</h2>${act(1)}${act(2)}`),
};

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1200, height: 900 } });
const FIX = { current: 'err' };
let served = 0;
await ctx.route(/harmony\.pulsewidth\.org\.uk/, r => {
  served++;
  return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FIXTURES[FIX.current] });
});

const open = async (which, opts) => {
  FIX.current = which;
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.log('PAGEERROR ' + e.message); fail++; });
  await page.addInitScript((o) => {
    const store = new Map(Object.entries(o));
    window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
    window.__opened = [];
    window.GM_openInTab = u => { window.__opened.push(u); return { close() {}, closed: false }; };
    window.open = u => { window.__opened.push(u); return { closed: false }; };
    window.confirm = () => false;
    window.__log = [];
    const ci = console.info.bind(console);
    console.info = (...a) => { window.__log.push(a.join(' ')); ci(...a); };
  }, opts || {});
  /* The userscript has to be re-injected after every navigation — a reload
     replaces the document and addScriptTag does not survive it. Without this the
     second load would carry no Falcon at all and the give-up branch, which is the
     whole point of the file, would never run.
     ⚠ This is the ONLY injection. Adding a script tag after goto() as well put
     TWO Falcons on the first document, each with its own closure and its own
     button: window.__falconTest pointed at the second instance while
     getElementById returned the first one's button, so clicking "cancel"
     cancelled a timer the test wasn't looking at. It read exactly like a broken
     cancel in the script. */
  page.on('load', () => { page.addScriptTag({ content: code }).catch(() => {}); });
  await page.goto(ACTIONS, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__falconTest, null, { timeout: 10000 });
  const instances = await page.evaluate(() => document.querySelectorAll('#falcon-harmony-btn').length);
  ck(instances === 1, `fixture: exactly one Falcon is running on this page (${instances})`);
  return page;
};
const has = p => p.evaluate(() => typeof window.__falconTest.maybeReloadOnError === 'function');
const pending = p => p.evaluate(() => (window.__falconTest.reloadPending ? window.__falconTest.reloadPending() : null));
const count = p => p.evaluate(() => (window.__falconTest.harmonyReloadCount ? window.__falconTest.harmonyReloadCount() : null));
const lbl = p => p.evaluate(() => { const l = document.getElementById('falcon-harmony-lbl'); return l ? l.textContent : null; });
const logs = p => p.evaluate(() => window.__log.slice());

const ON = { 'falcon:harmonyReloadOnError': true, 'falcon:autoSendFromHarmony': true, 'falcon:harmonyReloadMax': 1 };

/* ── 0. the build has the machinery ────────────────────────────────────────── */
const probe = await open('clean', ON);
ck(await has(probe), 'this build can reload an errored actions page at all');
if (!(await has(probe))) {
  console.log('no reload machinery on this build — nothing further is measurable');
  await ctx.close(); console.log(`\n${fail + 1} FAILED`); process.exit(1);
}

/* ── 1. the backoff curve ──────────────────────────────────────────────────── */
const curve = await probe.evaluate(() => {
  const f = window.__falconTest.harmonyReloadDelayMs;
  const s = n => f(n, false), slow = n => f(n, true);
  return { normal: [1, 2, 3, 4, 5, 6].map(s), slow: [1, 2, 3].map(slow),
    jitter: new Set([1, 1, 1, 1, 1, 1, 1, 1].map(s)).size };
});
console.log('\nbackoff (ms):', JSON.stringify(curve));
const floors = [5000, 10000, 20000, 40000, 60000, 60000];
ck(curve.normal.every((v, i) => v >= floors[i] && v < floors[i] + 1000),
  `5s → 60s, doubling: ${curve.normal.map(v => Math.round(v / 1000) + 's').join(', ')}`);
ck(curve.normal[5] < 61000 && curve.normal[4] < 61000, 'and it is capped, so a long series cannot drift into minutes');
ck(curve.slow[0] >= 15000 && curve.slow[0] < 16000, `a server asking for less traffic starts further out (${curve.slow[0]}ms)`);
ck(curve.jitter > 1, `there is jitter, so tabs erroring together do not return in lockstep (${curve.jitter} distinct values in 8)`);

/* ── 2. a clean load ends the series ───────────────────────────────────────── */
const cleanedUp = await probe.evaluate(() => {
  const T = window.__falconTest;
  T.setHarmonyReloadCount(3);
  const before = T.harmonyReloadCount();
  T.maybeReloadOnError();
  return { before, after: T.harmonyReloadCount(), pending: T.reloadPending() };
});
console.log('clean page with 3 reloads behind it:', JSON.stringify(cleanedUp));
ck(cleanedUp.before === 3 && cleanedUp.after === 0,
  'a clean load resets the counter, so an intermittent provider never accumulates across imports');
ck(cleanedUp.pending === false, 'and arms nothing');

/* ── 3. it refuses in every case it should ─────────────────────────────────── */
const cases = [
  ['reload turned off', 'err', { ...ON, 'falcon:harmonyReloadOnError': false }, /Reload on error" is off/],
  ['auto send off', 'err', { ...ON, 'falcon:autoSendFromHarmony': false }, /not reloaded by itself/],
  ['a permanent error', 'permanent', ON, /permanent/],
];
for (const [name, fx, opts, re] of cases) {
  const p = await open(fx, opts);
  await p.waitForTimeout(400);
  const [pe, lg] = [await pending(p), await logs(p)];
  ck(pe === false, `${name}: nothing is armed`);
  ck(lg.some(l => re.test(l)), `${name}: and the console says why — "${(lg.find(l => re.test(l)) || '').slice(0, 110)}"`);
  await p.close();
}

/* ── 4. the real cycle: arm → reload → give up ─────────────────────────────── */
const p = await open('err', ON);
await p.waitForTimeout(500);
const armedLbl = await lbl(p);
console.log('\narmed:', JSON.stringify({ pending: await pending(p), count: await count(p), label: armedLbl }));
ck(await pending(p) === true, 'an errored page arms a reload');
ck(/reloading in \d+…/.test(armedLbl || ''), `with a visible countdown (${armedLbl})`);
ck(/click to cancel/.test(armedLbl || ''), 'that says it can be cancelled');
ck(await count(p) === 0, 'the attempt is not counted until it actually happens');
// it must NOT have sent in the meantime
ck(await p.evaluate(() => window.__opened.length) === 0, 'and nothing was sent while it waits');

const servedBefore = served;
// first delay is 5s + up to 1s of jitter
await p.waitForFunction(() => window.__falconTest && window.__falconTest.harmonyReloadCount() === 1, null, { timeout: 15000 })
  .then(() => ck(true, 'the reload happened')).catch(() => ck(false, 'the reload happened'));
// The boot poller needs three unchanged action counts before it decides about
// sending, so the stand-down line below cannot appear for ~4s. Waiting 1.2s and
// then asserting on it was measuring the test's patience, not the script.
// …and it must wait for THAT line, not for "gave up" — which the give-up branch
// logs at boot, so an `/standing down|gave up/` wait resolved instantly and the
// check below was being made several seconds too early.
await p.waitForFunction(() => window.__log && window.__log.some(l => /standing down/.test(l)),
  null, { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(500);
console.log('pages served by the fixture:', servedBefore, '→', served);
ck(served > servedBefore, `the page really was requested again (${served - servedBefore} more)`);
ck(await count(p) === 1, `and the attempt is recorded, so it survives the navigation (${await count(p)})`);

const afterLbl = await lbl(p);
const afterLog = await logs(p);
console.log('after the reload:', JSON.stringify({ pending: await pending(p), label: afterLbl }));
ck(await pending(p) === false, 'with max=1 spent, no second reload is armed');
ck(afterLog.some(l => /gave up after 1 reload/.test(l)),
  `it says it gave up — "${(afterLog.find(l => /gave up/.test(l)) || '').slice(0, 120)}"`);
ck(/Harmony errored/.test(afterLbl || ''), `and the button now names the problem instead of counting down (${afterLbl})`);
ck(await p.evaluate(() => window.__opened.length) === 0,
  'and STILL nothing has been sent from the errored page — the point of the whole exercise');
ck(afterLog.some(l => /standing down/.test(l)), 'the auto-send stood down rather than shipping a batch');

/* ── 5. cancelling is sticky ───────────────────────────────────────────────── */
const pc = await open('busy', ON);
await pc.waitForTimeout(400);
ck(await pending(pc) === true, 'fixture: a reload is armed before the cancel (otherwise the cancel proves nothing)');
const cancelled = await pc.evaluate(() => {
  const T = window.__falconTest;
  document.getElementById('falcon-harmony-btn').click();     // the real affordance, not the internal call
  const afterClick = { pending: T.reloadPending(), opened: window.__opened.length };
  T.maybeReloadOnError();                                     // …and it must not re-arm
  return { afterClick, rearmed: T.reloadPending(), log: window.__log.slice() };
});
console.log('\nafter clicking the button:', JSON.stringify(cancelled.afterClick), '· re-armed:', cancelled.rearmed);
ck(cancelled.afterClick.pending === false, 'clicking the button cancels the reload');
ck(cancelled.afterClick.opened === 0,
  'and does NOT fall through into a send — one click does one thing');
ck(cancelled.rearmed === false, 'the refusal is sticky for this page load');
ck(cancelled.log.some(l => /you clicked the button/.test(l)), 'and is logged as yours, not as a failure');

ck(await count(pc) === 0, 'a cancelled reload is never counted');
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
