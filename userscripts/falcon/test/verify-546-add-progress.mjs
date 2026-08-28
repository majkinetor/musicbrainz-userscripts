// #546 (majkinetor): "On a release with lots of recordings, it appears nothing
// happen when you use 'Add from release'. https://musicbrainz.org/release/
// e70b4221-34ee-4b1f-a60a-7eebca542cdf Here, it takes around 20s to load all.
// The only way to tell is that Add from release button is grayed - nothing else
// happens, including log."
//
// Measured on that exact release before changing anything: the ONE
// /ws/2/release?inc=… request took 20-45s against production MusicBrainz, while
// turning the answer into rows took 4ms and rendering them 15ms. So there is no
// work to speed up — the whole fix is to stop being silent, and that is what
// this checks.
//
// MusicBrainz is deliberately slowed here rather than hoped to be slow: on a
// warm day the request returns between two polls and the test would "pass"
// having never seen the state it exists to check. The slowed route also keeps
// the test off production's back — it is test.musicbrainz.org, and every POST
// is aborted and asserted at zero, so nothing is ever submitted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');

// a release on the sandbox with a tracklist worth adding
const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const SLOW_MS = 9000;                      // wider than the 5s heartbeat, so it must fire
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_deleteValue = k => s.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const posted = [];
await page.route(() => true, async route => {
  const r = route.request();
  if (r.method() === 'POST') { posted.push(r.url()); return route.abort(); }
  if (/\/ws\/2\/release\/[0-9a-f-]{36}\?inc=recordings/.test(r.url())) await new Promise(z => setTimeout(z, SLOW_MS));
  return route.continue();
});

for (let a = 1; ; a++) {
  try { await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 4) throw e; console.log('goto retry ' + a); await page.waitForTimeout(4000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1200);
await page.addScriptTag({ content: code });
await page.waitForTimeout(600);
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 15000 });
await page.waitForTimeout(400);

const readBtn = () => page.evaluate(() => {
  const b = document.getElementById('falcon-add-page');
  if (!b) return null;
  const bi = b.querySelector('.falcon-bi'), bt = b.querySelector('.falcon-bt');
  const cs = bi ? getComputedStyle(bi) : null;
  return {
    label: bt ? bt.textContent.trim() : null,
    icon: bi ? bi.textContent.trim() : null,
    disabled: !!b.disabled,
    busy: b.classList.contains('falcon-busy'),
    // a class nobody styled would be a lie — read what the spinner actually is
    spins: !!cs && cs.animationName === 'falcon-spin' && cs.borderTopColor !== cs.borderLeftColor,
    title: b.title,
  };
});
const readLog = () => page.evaluate(() => window.__falconTest.getLog().map(l => (l.msg || l.message || String(l))));

const idle = await readBtn();
console.log('idle : ' + JSON.stringify(idle));
ck(!!idle && !idle.disabled, 'the Add-from-release button is there and enabled at rest');
ck(!!idle && !idle.busy && !idle.spins, 'and it is not spinning at rest');
ck(!!idle && /add from release/i.test(idle.label || ''), 'labelled "Add from release" — ' + JSON.stringify(idle && idle.label));

// open the menu, tick recordings, press Add — WITHOUT awaiting the handler.
// page.evaluate awaits a returned promise, so awaiting the click would block
// for the whole slow request and the busy state would already be gone.
await page.evaluate(() => document.getElementById('falcon-add-page').click());
await page.waitForFunction(() => !!document.querySelector('.falcon-addmenu [data-a="ok"]'), null, { timeout: 8000 })
  .catch(async () => {
    console.log('menu never appeared; panel state: ' + JSON.stringify(await page.evaluate(() => {
      const b = document.getElementById('falcon-add-page'), r = b && b.getBoundingClientRect();
      return { btn: r && [r.x | 0, r.y | 0, r.width | 0, r.height | 0], menus: document.querySelectorAll('.falcon-addmenu').length };
    })));
    throw new Error('add menu did not open');
  });
await page.evaluate(() => {
  document.querySelectorAll('.falcon-addmenu input[data-w]').forEach(cb => { cb.checked = cb.dataset.w === 'recording'; });
});
const logBefore = (await readLog()).length;
const t0 = Date.now();
await page.evaluate(() => { document.querySelector('.falcon-addmenu [data-a="ok"]').click(); });

// ── it must say something IMMEDIATELY, not when it is done ──────────────────
let firstLine = null;
for (let i = 0; i < 30 && !firstLine; i++) {
  const l = await readLog();
  if (l.length > logBefore) firstLine = { ms: Date.now() - t0, text: l[l.length - 1] };
  else await page.waitForTimeout(100);
}
console.log('first log line: ' + JSON.stringify(firstLine));
ck(!!firstLine, 'the log says something without waiting for the request to finish');
ck(firstLine && firstLine.ms < SLOW_MS - 2000, `and it says it up front, not at the end (${firstLine && firstLine.ms}ms into a ${SLOW_MS}ms request)`);
ck(firstLine && /reading/i.test(firstLine.text) && /musicbrainz/i.test(firstLine.text), 'naming what it is reading and from where — ' + JSON.stringify(firstLine && firstLine.text));
ck(firstLine && /recordings/i.test(firstLine.text), 'including which boxes were ticked, readably — not the raw checkbox keys');

// ── and the button must LOOK busy, not merely disabled ──────────────────────
const busy = await readBtn();
console.log('busy : ' + JSON.stringify(busy));
ck(busy && busy.busy && busy.disabled, 'the button is in a busy state while it waits');
ck(busy && busy.spins, 'a spinner is genuinely rendered (falcon-spin animation on the icon)');
ck(busy && /reading/i.test(busy.label || ''), 'and it says what it is doing — ' + JSON.stringify(busy && busy.label));
ck(busy && /log/i.test(busy.title || ''), 'with a tooltip pointing at the log — ' + JSON.stringify(busy && busy.title));

// ── the 5s heartbeat, so a 40s wait is not 40s of silence ───────────────────
await page.waitForTimeout(6200);
const mid = await readLog();
const beats = mid.filter(l => /still waiting on MusicBrainz/i.test(l));
console.log('heartbeat lines: ' + JSON.stringify(beats));
ck(beats.length >= 1, 'it keeps saying it is still waiting while the request is out');
ck(beats.some(l => /nothing is stuck/i.test(l)), 'and reassures that nothing is stuck');

// ── then it finishes, reports, and hands the button back ────────────────────
await page.waitForFunction(() => {
  const b = document.getElementById('falcon-add-page');
  return b && !b.disabled && !b.classList.contains('falcon-busy');
}, null, { timeout: 60000 }).catch(() => {});
const done = await readBtn();
const log = await readLog();
console.log('done : ' + JSON.stringify(done));
ck(done && !done.disabled && !done.busy && !done.spins, 'the button comes back to normal when it is over');
ck(done && /add from release/i.test(done.label || ''), 'with its own label restored (not left saying "Reading…") — ' + JSON.stringify(done && done.label));
ck(done && done.icon === '+', 'and its own icon restored — ' + JSON.stringify(done && done.icon));

const added = log.find(l => /added \d+ row/.test(l));
console.log('outcome line: ' + JSON.stringify(added));
ck(!!added, 'the outcome is reported');
ck(!!added && /waiting on MusicBrainz/.test(added), 'saying where the time actually went — ' + JSON.stringify(added));
ck(!!added && /\d+\.\d+s/.test(added), 'with the elapsed time');

const rows = await page.evaluate(() => window.__falconTest.getQueue().length);
console.log('queued rows: ' + rows);
ck(rows > 0, `and rows really landed in the queue (${rows})`);

console.log('POSTs: ' + JSON.stringify(posted));
ck(posted.filter(u => /musicbrainz/.test(u)).length === 0, 'nothing was submitted to MusicBrainz');
ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
