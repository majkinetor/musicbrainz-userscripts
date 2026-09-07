// #577 (majkinetor): "Tracklist and recording matching can't be stopped, unlike
// all others (GT work matching etc.)".
//
// The Match button now becomes the Stop button for the duration of a pass, in
// both places — the tracklist toolbar and the Recordings pane. It used to go
// disabled instead, which is exactly what made an eight-minute pass feel
// unstoppable.
//
// Driven on the real release editor at test.musicbrainz.org, because the thing
// under test is a running loop, not a pure function: a pass is started, stopped
// part-way, and what is asserted is that it actually stops, that it says so, and
// — the part that matters most — that everything matched before the stop is
// still matched afterwards. Stopping is not undoing.
//
// Nothing is submitted: every edit POST is aborted and asserted zero.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const SRC = process.env.APOLLO_SRC || 'C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js';
const code = await readFile(SRC, 'utf8');
const log = (...a) => console.log('[verify-577]', ...a);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1700, height: 1100 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'apollo', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));

await page.goto('https://test.musicbrainz.org/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }

let posts = 0;
await page.route(() => true, r => {
  const q = r.request();
  if (q.method() === 'POST' && /\/ws\/js\/edit\//.test(q.url())) { posts++; return r.abort(); }
  return r.fallback();
});

// Seed an editor with enough tracks that a pass takes long enough to interrupt.
// Freeform names only: the sandbox has none of production's entities, so a
// seeded mbid would not resolve.
const TRACKS = 24;
await page.evaluate(n => {
  const f = document.createElement('form');
  f.method = 'POST'; f.action = '/release/add';
  const add = (k, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i); };
  add('name', 'Apollo #577 stop-matching fixture');
  add('artist_credit.names.0.name', 'Various Artists');
  add('mediums.0.format', 'CD');
  for (let i = 0; i < n; i++) {
    add(`mediums.0.track.${i}.name`, 'Fixture Track ' + (i + 1));
    // real-ish names, so matching actually goes to the network for each one
    add(`mediums.0.track.${i}.artist_credit.names.0.name`, ['Miles Davis', 'John Coltrane', 'Bill Evans', 'Herbie Hancock'][i % 4] + ' ' + (i + 1));
    add(`mediums.0.track.${i}.length`, String(180000 + i * 1000));
  }
  document.body.appendChild(f); f.submit();
}, TRACKS);
await page.waitForURL(/\/release\/add|\/release\/.*\/edit/, { timeout: 30000 });
await page.waitForTimeout(4000);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 20000 });
// The release editor is a Knockout app whose tracklist is lazily built: its
// mediums stay empty, and Apollo's bar stays hidden, until the Tracklist tab has
// actually been clicked once.
await page.evaluate(() => {
  const t = [...document.querySelectorAll('a')].find(a => /^\s*Tracklist\s*$/.test(a.textContent) || (a.getAttribute('href') || '').includes('tracklist'));
  if (t) t.click();
});
await page.waitForTimeout(4000);

const btn = '#tc-bar [data-act="match"], #tc-hdr [data-act="match"]';
await page.waitForSelector(btn, { timeout: 20000 });
const idle = await page.evaluate(s => { const b = document.querySelector(s); return { text: b.textContent.trim(), disabled: b.disabled }; }, btn);
log('button at rest:', JSON.stringify(idle));
ck(/Match/.test(idle.text) && !idle.disabled, `at rest the button offers Match (got ${JSON.stringify(idle)})`);

// start a pass and let it get somewhere
await page.click(btn);
await page.waitForTimeout(4500);
const running = await page.evaluate(s => {
  const b = document.querySelector(s);
  return { text: b.textContent.trim(), disabled: b.disabled, stopping: b.classList.contains('tc-stopping') };
}, btn);
log('button while matching:', JSON.stringify(running));
ck(/Stop/.test(running.text), `while matching the button offers Stop (got ${JSON.stringify(running.text)})`);
ck(!running.disabled, 'and it is clickable — the old behaviour was to disable it, which is the bug');
ck(running.stopping, 'it is marked as the stop state, so it stops looking like "start a pass"');

// how much had been matched at the moment we press stop
const before = await page.evaluate(() => {
  const M = window.__apolloEditor.model;
  return M ? M.tracks.reduce((n, t) => n + t.slots.filter(s => s.committed || s.gid).length, 0) : -1;
});
// clicked through the DOM, not page.click(): on a build where the button is
// DISABLED while matching, page.click() waits forever and the run dies with a
// timeout instead of reporting a failed assertion.
await page.evaluate(s => document.querySelector(s).click(), btn);
const tStop = Date.now();
// cooperative: the request in flight finishes first, then the loop exits
let stoppedInTime = true;
try { await page.waitForFunction(s => /Match/.test(document.querySelector(s).textContent), btn, { timeout: 45000 }); }
catch (e) { stoppedInTime = false; }
const took = Date.now() - tStop;
log('stopped after', took + 'ms', stoppedInTime ? '' : '(gave up waiting)');

const after = await page.evaluate(() => {
  const M = window.__apolloEditor.model;
  const st = document.querySelector('.tc-globalstat, .tc-toast');
  return {
    matched: M ? M.tracks.reduce((n, t) => n + t.slots.filter(s => s.committed || s.gid).length, 0) : -1,
    pending: M ? M.tracks.reduce((n, t) => n + t.slots.filter(s => s._pending).length, 0) : -1,
    status: (document.querySelector('#tc-bar') || document.body).textContent,
    btn: document.querySelector('#tc-bar [data-act="match"], #tc-hdr [data-act="match"]').textContent.trim(),
  };
});
log('before stop:', before, ' after:', after.matched, ' still pending:', after.pending);

ck(stoppedInTime && took < 40000, `the pass really ended (${took}ms after the click${stoppedInTime ? '' : ', still running'})`);
ck(/Match/.test(after.btn), 'the button goes back to offering Match');
ck(after.matched >= before, `nothing already matched was lost: ${before} before the stop, ${after.matched} after — stopping is not undoing`);
ck(/stopped/i.test(after.status), `it says it stopped rather than going quiet (bar text: ${JSON.stringify(after.status.replace(/\s+/g, ' ').slice(0, 160))})`);

// and a second pass still works afterwards — the flag must not stay latched
await page.evaluate(s => document.querySelector(s).click(), btn);
await page.waitForTimeout(2500);
const second = await page.evaluate(s => document.querySelector(s).textContent.trim(), btn);
log('button on a second pass:', JSON.stringify(second));
ck(/Stop/.test(second), `a pass can be started again after a stop (got ${JSON.stringify(second)})`);
await page.evaluate(s => document.querySelector(s).click(), btn);
try { await page.waitForFunction(s => /Match/.test(document.querySelector(s).textContent), btn, { timeout: 45000 }); } catch (e) {}

// ── the Recordings pane, which is the other half of the complaint ───────────
// Same flag, same button-becomes-Stop treatment; asserted separately because it
// is a different button in a different pane, and "they share a variable" is not
// evidence that both are wired up.
// The pane lives on MusicBrainz's own Recordings tab; showRecMirror() builds it
// but the tab is what makes it visible, exactly as with Tracklist above.
await page.evaluate(() => {
  const t = [...document.querySelectorAll('a')].find(a => /^\s*Recordings\s*$/.test(a.textContent) || (a.getAttribute('href') || '').includes('recordings'));
  if (t) t.click();
});
await page.waitForTimeout(3000);
await page.evaluate(() => { try { window.__apolloEditor.showRecMirror(); } catch (e) {} });
// attached, not visible: this fixture is a BRAND-NEW release, and MusicBrainz
// only shows its Recordings tab for a release that already has some. The pane is
// still built and its button is still the real one the code drives, so the state
// machine can be exercised through it — visibility is not what is under test,
// and every interaction below goes through the DOM rather than a synthetic click
// that would refuse to land on a hidden node.
await page.waitForSelector('#tc-recwrap .tc-rec-am', { timeout: 25000, state: 'attached' });
const recBtn = '#tc-recwrap .tc-rec-am';
const recIdle = await page.evaluate(s => { const b = document.querySelector(s); return { text: b.textContent.trim(), disabled: b.disabled }; }, recBtn);
log('recordings button at rest:', JSON.stringify(recIdle));
ck(/Match/.test(recIdle.text) && !recIdle.disabled, `recordings: at rest the button offers Match (got ${JSON.stringify(recIdle)})`);

await page.evaluate(s => document.querySelector(s).click(), recBtn);
await page.waitForTimeout(4000);
const recRunning = await page.evaluate(s => { const b = document.querySelector(s); return b ? { text: b.textContent.trim(), disabled: b.disabled } : null; }, recBtn);
log('recordings button while matching:', JSON.stringify(recRunning));
ck(recRunning && /Stop/.test(recRunning.text), `recordings: while matching the button offers Stop (got ${JSON.stringify(recRunning)})`);
ck(recRunning && !recRunning.disabled, 'recordings: and it is clickable, where it used to be disabled');

await page.evaluate(s => { const b = document.querySelector(s); if (b) b.click(); }, recBtn);
let recStopped = true;
try { await page.waitForFunction(s => { const b = document.querySelector(s); return b && /Match/.test(b.textContent); }, recBtn, { timeout: 45000 }); }
catch (e) { recStopped = false; }
const recAfter = await page.evaluate(() => { const e = document.querySelector('#tc-recwrap .tc-rec-amstatus'); return e ? e.textContent.trim() : ''; });
log('recordings status after stop:', JSON.stringify(recAfter));
ck(recStopped, 'recordings: the pass really ended after Stop');
ck(/stopped/i.test(recAfter), `recordings: the status says it stopped rather than reading as a finished result (got ${JSON.stringify(recAfter)})`);

ck(posts === 0, `no edit was submitted (${posts} intercepted)`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
